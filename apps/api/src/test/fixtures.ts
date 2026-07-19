import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";

import { normalizeEmail } from "../access/allowlist.ts";
import { createDb } from "../db/index.ts";
import { accounts, allowedEmails, sessions, users, verifications } from "../db/schema.ts";
import type { Env } from "../env.ts";

export function testEnv(): Env {
  return {
    DB: env.DB,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    WEB_ORIGIN: env.WEB_ORIGIN,
  };
}

export async function resetAuthState() {
  const db = createDb(testEnv());

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
