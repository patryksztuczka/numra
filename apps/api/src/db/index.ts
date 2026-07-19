import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../env.ts";
import { accounts, schema, sessions, users, verifications } from "./schema.ts";

export function createDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof createDb>;

/** Better Auth model names → plural Drizzle tables. */
export function createAuthAdapter(db: Db) {
  return drizzleAdapter(db, {
    provider: "sqlite",
    usePlural: true,
    schema: {
      users,
      sessions,
      accounts,
      verifications,
    },
  });
}
