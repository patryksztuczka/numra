import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../access/session.ts";
import { createDb } from "../db/index.ts";
import { getEnableBankingClient } from "../enable-banking/index.ts";
import {
  completeEnableBankingConnect,
  ConnectError,
  listBankAccountsForUser,
  listConnectionsForUser,
  markConnectFailed,
  startEnableBankingConnect,
  SUPPORTED_ASPSPS,
} from "./connections.ts";
import { runLedgerEtl } from "./etl.ts";
import { listTransactionsForUser } from "./transactions.ts";

const startBodySchema = z.object({
  aspspName: z.string().min(1),
  aspspCountry: z.string().length(2),
});

export const financeRoutes = new Hono<AppEnv>();

financeRoutes.get("/connections/aspsps", (context) => {
  return context.json({
    aspsps: SUPPORTED_ASPSPS.map((item) => ({
      name: item.name,
      country: item.country,
      label: item.label,
    })),
  });
});

financeRoutes.post("/connections/enable-banking/start", async (context) => {
  const parsed = startBodySchema.safeParse(await context.req.json().catch(() => null));

  if (!parsed.success) {
    return context.json(
      {
        error: "invalid_body",
        message: "aspspName and aspspCountry are required.",
      },
      400,
    );
  }

  const user = context.get("user");
  const db = createDb(context.env);

  try {
    const result = await startEnableBankingConnect({
      db,
      env: context.env,
      userId: user.id,
      aspspName: parsed.data.aspspName,
      aspspCountry: parsed.data.aspspCountry,
    });

    return context.json({
      redirectUrl: result.redirectUrl,
      connectionId: result.connectionId,
    });
  } catch (error) {
    if (error instanceof ConnectError) {
      return context.json({ error: error.code, message: error.message }, 400);
    }

    throw error;
  }
});

/**
 * Enable Banking redirects here after consent.
 * Registered outside requireSession in app.ts because the browser may land
 * without a same-site session cookie in some edge cases; ownership is bound
 * via the stored auth state instead. Session is still preferred when present.
 */
export async function handleEnableBankingCallback(context: {
  env: AppEnv["Bindings"];
  req: { query: (key: string) => string | undefined };
  redirect: (url: string) => Response;
}): Promise<Response> {
  const webOrigin = context.env.WEB_ORIGIN.replace(/\/$/, "");
  const code = context.req.query("code");
  const state = context.req.query("state");
  const error = context.req.query("error");
  const errorDescription = context.req.query("error_description");

  const db = createDb(context.env);

  if (error) {
    await markConnectFailed({
      db,
      state,
      message: errorDescription ?? error,
    });

    const params = new URLSearchParams({
      connect: "error",
      message: errorDescription ?? error,
    });
    return context.redirect(`${webOrigin}/connections?${params.toString()}`);
  }

  if (!code || !state) {
    const params = new URLSearchParams({
      connect: "error",
      message: "Missing authorization code or state.",
    });
    return context.redirect(`${webOrigin}/connections?${params.toString()}`);
  }

  try {
    const completed = await completeEnableBankingConnect({
      db,
      env: context.env,
      code,
      state,
    });

    // Initial backfill uses the same ETL function as the hourly workflow.
    const client = getEnableBankingClient(context.env);
    await runLedgerEtl({
      db,
      env: context.env,
      client,
      connectionId: completed.connectionId,
    });

    // Also enqueue the durable workflow so retries continue if the isolate dies
    // mid-request in production. Failures here are non-fatal (inline ETL already ran).
    try {
      await context.env.LEDGER_SYNC_WORKFLOW.create({
        params: { connectionId: completed.connectionId },
      });
    } catch {
      // Workflow binding may be unavailable in some local/test contexts.
    }

    const params = new URLSearchParams({
      connect: "success",
      connectionId: completed.connectionId,
    });
    return context.redirect(`${webOrigin}/connections?${params.toString()}`);
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Failed to complete bank connection.";
    await markConnectFailed({ db, state, message });
    const params = new URLSearchParams({
      connect: "error",
      message,
    });
    return context.redirect(`${webOrigin}/connections?${params.toString()}`);
  }
}

financeRoutes.get("/connections", async (context) => {
  const user = context.get("user");
  const db = createDb(context.env);
  const items = await listConnectionsForUser(db, user.id);
  return context.json({ connections: items });
});

financeRoutes.get("/accounts", async (context) => {
  const user = context.get("user");
  const db = createDb(context.env);
  const items = await listBankAccountsForUser(db, user.id);
  return context.json({ accounts: items });
});

financeRoutes.get("/transactions", async (context) => {
  const user = context.get("user");
  const db = createDb(context.env);
  const accountId = context.req.query("accountId");
  const limit = Number(context.req.query("limit") ?? "100");
  const offset = Number(context.req.query("offset") ?? "0");

  const result = await listTransactionsForUser(db, user.id, {
    ...(accountId ? { accountId } : {}),
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  return context.json(result);
});
