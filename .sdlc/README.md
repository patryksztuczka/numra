# SDLC workflow

A minimal autonomous issue-to-validated-change workflow built with the Pi SDK.

## Usage

Authenticate Pi as usual, then run from the repository root:

```bash
pnpm sdlc "Implement a plain-text issue"
```

The workflow:

1. Creates one in-memory Pi agent session using `openai-codex/gpt-5.6-sol`, low thinking effort, and the user's Pi authentication.
2. Streams agent text, thinking, tool activity, and workflow prompts to a timestamped `.sdlc/runs/*.log` file while also showing normal agent text in the terminal.
3. Gives the agent the issue and lets it edit the current checkout.
4. Runs, in order:
   - `pnpm check:fix`
   - `pnpm check`
   - `pnpm test`
   - `pnpm build`
5. Sends the first failing command and its output back to the same agent session.
6. Repeats until every command passes.
7. Asks the agent to review the final git diff. If the review changes code, validation and review repeat.

Follow a running agent from another terminal with:

```bash
tail -f "$(ls -t .sdlc/runs/*.log | head -1)"
```

The workflow does not create a branch, worktree, commit, or pull request. Use Ctrl+C to stop it. Review all changes before committing.
