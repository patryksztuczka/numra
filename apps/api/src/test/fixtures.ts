import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { normalizeEmail } from "../access/allowlist.ts";
import { createDb } from "../db/index.ts";
import {
  accounts,
  allowedEmails,
  bankAccounts,
  connections,
  sessions,
  transactions,
  users,
  verifications,
} from "../db/schema.ts";
import type { Env } from "../env.ts";

/** Deterministic 32-byte key (base64) used only in tests. */
export const TEST_ENCRYPTION_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: env.DB,
    LEDGER_SYNC_WORKFLOW: env.LEDGER_SYNC_WORKFLOW,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    ENVIRONMENT: "test",
    SENTRY_DSN: "",
    WEB_ORIGIN: env.WEB_ORIGIN,
    ENABLE_BANKING_APPLICATION_ID: "test-app-id",
    ENABLE_BANKING_PRIVATE_KEY: "test-private-key",
    ENABLE_BANKING_API_BASE: "https://api.enablebanking.com",
    ENABLE_BANKING_REDIRECT_URL: "http://localhost:8787/connections/enable-banking/callback",
    ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    ...overrides,
  };
}

export async function resetAuthState() {
  const db = createDb(testEnv());

  await db.delete(transactions);
  await db.delete(bankAccounts);
  await db.delete(connections);
  await db.delete(sessions);
  await db.delete(accounts);
  await db.delete(verifications);
  await db.delete(users);
  await db.delete(allowedEmails);
}

export async function allowEmail(email: string, note?: string) {
  const db = createDb(testEnv());
  const normalized = normalizeEmail(email);

  await db.insert(allowedEmails).values({
    id: crypto.randomUUID(),
    email: normalized,
    note: note ?? null,
    createdAt: new Date(),
  });
}

export async function revokeEmail(email: string) {
  const db = createDb(testEnv());
  const normalized = normalizeEmail(email);

  await db.delete(allowedEmails).where(eq(allowedEmails.email, normalized));
}

export function extractSetCookie(response: Response): string[] {
  const headers = response.headers as Headers & {
    getSetCookie?: () => string[];
  };

  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie();
  }

  const single = response.headers.get("set-cookie");
  return single ? [single] : [];
}

export function cookieHeaderFromResponse(response: Response): string {
  return extractSetCookie(response)
    .map((value) => value.split(";")[0])
    .filter((value): value is string => Boolean(value))
    .join("; ");
}
