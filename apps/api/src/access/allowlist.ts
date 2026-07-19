import { eq } from "drizzle-orm";
import { z } from "zod";

import type { Db } from "../db/index.ts";
import { allowedEmails } from "../db/schema.ts";

export const emailSchema = z.email().transform((email) => email.trim().toLowerCase());

export const authEmailBodySchema = z.object({
  email: emailSchema,
});

export function normalizeEmail(email: string): string {
  return emailSchema.parse(email);
}

export async function isEmailAllowlisted(db: Db, email: string): Promise<boolean> {
  const parsed = emailSchema.safeParse(email);

  if (!parsed.success) {
    return false;
  }

  const row = await db
    .select({ email: allowedEmails.email })
    .from(allowedEmails)
    .where(eq(allowedEmails.email, parsed.data))
    .get();

  return row !== undefined;
}
