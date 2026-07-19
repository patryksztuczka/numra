import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";

import { normalizeEmail } from "../access/allowlist.ts";
import { createDb } from "../db/index.ts";
import { account, allowedEmail, session, user, verification } from "../db/schema.ts";
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

  await db.delete(session);
  await db.delete(account);
  await db.delete(verification);
  await db.delete(user);
  await db.delete(allowedEmail);
}

export async function allowEmail(email: string, note?: string) {
  const db = createDb(testEnv());
  const normalized = normalizeEmail(email);

  await db.insert(allowedEmail).values({
    id: crypto.randomUUID(),
    email: normalized,
    note: note ?? null,
    createdAt: new Date(),
  });
}

export async function revokeEmail(email: string) {
  const db = createDb(testEnv());
  const normalized = normalizeEmail(email);

  await db.delete(allowedEmail).where(eq(allowedEmail.email, normalized));
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
