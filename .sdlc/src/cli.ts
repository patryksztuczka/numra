/* eslint-disable no-await-in-loop -- workflow stages and repair attempts must run sequentially */
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const validationCommands = [
  ["pnpm", ["check:fix"]],
  ["pnpm", ["check"]],
  ["pnpm", ["test"]],
  ["pnpm", ["build"]],
] as const;

interface CommandResult {
  command: string;
  exitCode: number;
  output: string;
}

function usage(): never {
  console.error('Usage: pnpm sdlc "<issue to implement>"');
  process.exit(2);
}

function runCommand(command: string, args: readonly string[]): Promise<CommandResult> {
  const displayCommand = [command, ...args].join(" ");
  console.log(`\n\x1b[1;36m[sdlc] Running: ${displayCommand}\x1b[0m`);

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";

    for (const stream of [child.stdout, child.stderr]) {
      stream.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        output += text;
        process.stdout.write(text);
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ command: displayCommand, exitCode: code ?? 1, output });
    });
  });
}

async function validate(): Promise<CommandResult | undefined> {
  for (const [command, args] of validationCommands) {
    const result = await runCommand(command, args);
    if (result.exitCode !== 0) return result;
  }
  return undefined;
}

function feedbackFor(result: CommandResult): string {
  const maxOutputLength = 60_000;
  const output =
    result.output.length <= maxOutputLength
      ? result.output
      : `[Earlier output omitted]\n${result.output.slice(-maxOutputLength)}`;

  return `The deterministic validation command \`${result.command}\` failed with exit code ${result.exitCode}.

Fix the underlying problems in the checkout. Do not merely describe a solution. You may inspect files and run focused commands. When done, stop so the workflow can rerun the complete validation sequence.

<validation-output>
${output}
</validation-output>`;
}

async function main(): Promise<void> {
  const issue = process.argv.slice(2).join(" ").trim();
  if (!issue) usage();

  const cwd = process.cwd();
  const runsDirectory = join(cwd, ".sdlc", "runs");
  mkdirSync(runsDirectory, { recursive: true });
  const runId = new Date().toISOString().replaceAll(":", "-");
  const logPath = join(runsDirectory, `${runId}.log`);
  const log = createWriteStream(logPath, { flags: "wx" });
  console.log(`[sdlc] Streaming agent activity to ${logPath}`);

  const modelRuntime = await ModelRuntime.create();
  const model = modelRuntime.getModel("openai-codex", "gpt-5.6-sol");
  if (!model) throw new Error("Model openai-codex/gpt-5.6-sol is not available.");

  const { session } = await createAgentSession({
    cwd,
    model,
    modelRuntime,
    thinkingLevel: "low",
    sessionManager: SessionManager.inMemory(cwd),
  });

  log.write(
    `# SDLC agent run\n\nModel: openai-codex/gpt-5.6-sol\nThinking: low\nIssue: ${issue}\n`,
  );

  let response = "";
  session.subscribe((event) => {
    if (event.type === "message_update") {
      if (event.assistantMessageEvent.type === "text_delta") {
        const delta = event.assistantMessageEvent.delta;
        response += delta;
        process.stdout.write(delta);
        log.write(delta);
      } else if (event.assistantMessageEvent.type === "thinking_delta") {
        log.write(event.assistantMessageEvent.delta);
      }
    } else if (event.type === "tool_execution_start") {
      log.write(`\n\n[tool:start] ${event.toolName}\n`);
    } else if (event.type === "tool_execution_end") {
      log.write(`\n[tool:end] ${event.toolName} (${event.isError ? "error" : "success"})\n`);
    }
  });

  const prompt = async (text: string): Promise<string> => {
    response = "";
    log.write(`\n\n## Workflow prompt\n\n${text}\n\n## Agent activity\n\n`);
    await session.prompt(text);
    process.stdout.write("\n");
    log.write("\n");
    return response;
  };

  try {
    console.log("\x1b[1;36m[sdlc] Agent is implementing the issue\x1b[0m\n");
    await prompt(`Implement the following software issue in the current checkout:

<issue>
${issue}
</issue>

Work autonomously and make all necessary code changes. Inspect the repository and follow its conventions. Add or update tests where appropriate. Do not only explain what should be done: implement it. When implementation is complete, stop and return control to the workflow. The workflow will run formatting, linting, type checking, tests, and the build.`);

    while (true) {
      const failure = await validate();
      if (failure) {
        console.log(
          "\n\x1b[1;33m[sdlc] Validation failed; returning feedback to the agent\x1b[0m\n",
        );
        await prompt(feedbackFor(failure));
        continue;
      }

      console.log("\n\x1b[1;36m[sdlc] Validation passed; requesting final diff review\x1b[0m\n");
      const review =
        await prompt(`Perform a final, careful review of the current git diff for the original issue. Look for correctness problems, regressions, missing tests, unsafe behavior, and unnecessary changes.

If you find an actionable issue, fix it in the checkout and end your response with exactly REVIEW_CHANGES_MADE.
If the diff is ready and you made no changes, end your response with exactly REVIEW_APPROVED.
If a serious issue cannot be fixed autonomously, explain why and end with exactly REVIEW_BLOCKED.`);

      if (review.includes("REVIEW_BLOCKED")) {
        throw new Error("The final review found an issue that could not be fixed autonomously.");
      }
      if (review.includes("REVIEW_APPROVED")) {
        console.log("\n\x1b[1;32m[sdlc] Success: validation and final review passed\x1b[0m");
        return;
      }

      console.log("\n\x1b[1;33m[sdlc] Review changed the diff; validating again\x1b[0m");
    }
  } finally {
    session.dispose();
    log.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n\x1b[1;31m[sdlc] Failed: ${message}\x1b[0m`);
  process.exitCode = 1;
});
