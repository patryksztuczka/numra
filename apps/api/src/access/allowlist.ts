import { eq } from "drizzle-orm";

import type { Db } from "../db/index.ts";
import { allowedEmail } from "../db/schema.ts";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function isEmailAllowlisted(db: Db, email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  const row = await db
    .select({ email: allowedEmail.email })
    .from(allowedEmail)
    .where(eq(allowedEmail.email, normalized))
    .get();

  return row !== undefined;
}
