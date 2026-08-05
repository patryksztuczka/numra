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
  renameBankAccountForUser,
  reorderBankAccountsForUser,
  startEnableBankingConnect,
  SUPPORTED_ASPSPS,
} from "./connections.ts";
import { runLedgerEtl } from "./etl.ts";
import {
  createSeriesFromTransaction,
  deleteSeriesForUser,
  getOccurrencesForUser,
  listSeriesForUser,
  monthRange,
  RecurringError,
  todayIso,
  updateSeriesForUser,
} from "./recurring.ts";
import { listTransactionsForUser } from "./transactions.ts";

const startBodySchema = z.object({
  aspspName: z.string().min(1),
  aspspCountry: z.string().length(2),
});

const accountOrderBodySchema = z.object({
  accountIds: z.array(z.string().min(1)),
});

const accountNameBodySchema = z.object({
  customName: z.string().max(80).nullable(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date.");
const cadenceSchema = z.enum(["weekly", "biweekly", "monthly", "quarterly"]);
const seriesKindSchema = z.enum(["income", "expense"]);

const createSeriesBodySchema = z.object({
  transactionId: z.string().min(1),
  cadence: cadenceSchema,
  label: z.string().max(120).nullish(),
  expectedAmountMinor: z.number().int().positive().nullish(),
  startDate: isoDate.nullish(),
  endDate: isoDate.nullish(),
});

const updateSeriesBodySchema = z
  .object({
    label: z.string().min(1).max(120).optional(),
    expectedAmountMinor: z.number().int().positive().optional(),
    cadence: cadenceSchema.optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
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

financeRoutes.patch("/accounts/order", async (context) => {
  const parsed = accountOrderBodySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    return context.json({ error: "invalid_body", message: "accountIds must be an array." }, 400);
  }

  const user = context.get("user");
  const db = createDb(context.env);
  try {
    await reorderBankAccountsForUser(db, user.id, parsed.data.accountIds);
    return context.json({ ok: true });
  } catch (error) {
    if (error instanceof ConnectError) {
      return context.json({ error: error.code, message: error.message }, 400);
    }
    throw error;
  }
});

financeRoutes.patch("/accounts/:accountId", async (context) => {
  const parsed = accountNameBodySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    return context.json(
      { error: "invalid_body", message: "customName must be null or at most 80 characters." },
      400,
    );
  }

  const user = context.get("user");
  const db = createDb(context.env);
  const trimmed = parsed.data.customName?.trim() || null;

  try {
    await renameBankAccountForUser(db, user.id, context.req.param("accountId"), trimmed);
    return context.json({ ok: true });
  } catch (error) {
    if (error instanceof ConnectError) {
      return context.json({ error: error.code, message: error.message }, 404);
    }
    throw error;
  }
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

function recurringErrorStatus(code: string): 400 | 404 {
  return code === "transaction_not_found" || code === "series_not_found" ? 404 : 400;
}

financeRoutes.get("/recurring-series", async (context) => {
  const user = context.get("user");
  const db = createDb(context.env);
  const kind = seriesKindSchema.safeParse(context.req.query("kind"));

  const items = await listSeriesForUser(db, user.id, kind.success ? kind.data : undefined);
  return context.json({ series: items });
});

financeRoutes.post("/recurring-series", async (context) => {
  const parsed = createSeriesBodySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    return context.json(
      {
        error: "invalid_body",
        message: "transactionId and a valid cadence are required.",
      },
      400,
    );
  }

  const user = context.get("user");
  const db = createDb(context.env);

  try {
    const series = await createSeriesFromTransaction(db, user.id, {
      transactionId: parsed.data.transactionId,
      cadence: parsed.data.cadence,
      label: parsed.data.label ?? null,
      expectedAmountMinor: parsed.data.expectedAmountMinor ?? null,
      startDate: parsed.data.startDate ?? null,
      endDate: parsed.data.endDate ?? null,
    });
    return context.json({ series }, 201);
  } catch (error) {
    if (error instanceof RecurringError) {
      return context.json(
        { error: error.code, message: error.message },
        recurringErrorStatus(error.code),
      );
    }
    throw error;
  }
});

financeRoutes.patch("/recurring-series/:seriesId", async (context) => {
  const parsed = updateSeriesBodySchema.safeParse(await context.req.json().catch(() => null));
  if (!parsed.success) {
    return context.json(
      { error: "invalid_body", message: "Provide at least one valid field to update." },
      400,
    );
  }

  const user = context.get("user");
  const db = createDb(context.env);

  try {
    const series = await updateSeriesForUser(
      db,
      user.id,
      context.req.param("seriesId"),
      parsed.data,
    );
    return context.json({ series });
  } catch (error) {
    if (error instanceof RecurringError) {
      return context.json(
        { error: error.code, message: error.message },
        recurringErrorStatus(error.code),
      );
    }
    throw error;
  }
});

financeRoutes.delete("/recurring-series/:seriesId", async (context) => {
  const user = context.get("user");
  const db = createDb(context.env);

  try {
    await deleteSeriesForUser(db, user.id, context.req.param("seriesId"));
    return context.json({ ok: true });
  } catch (error) {
    if (error instanceof RecurringError) {
      return context.json(
        { error: error.code, message: error.message },
        recurringErrorStatus(error.code),
      );
    }
    throw error;
  }
});

/** Projected occurrences with their matched transactions. Defaults to this month. */
financeRoutes.get("/recurring-occurrences", async (context) => {
  const user = context.get("user");
  const db = createDb(context.env);

  const defaults = monthRange(todayIso());
  const from = context.req.query("from") ?? defaults.from;
  const to = context.req.query("to") ?? defaults.to;
  const kind = seriesKindSchema.safeParse(context.req.query("kind"));

  try {
    const result = await getOccurrencesForUser(db, user.id, {
      from,
      to,
      ...(kind.success ? { kind: kind.data } : {}),
    });
    return context.json(result);
  } catch (error) {
    if (error instanceof RecurringError) {
      return context.json(
        { error: error.code, message: error.message },
        recurringErrorStatus(error.code),
      );
    }
    throw error;
  }
});
