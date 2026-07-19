import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../env.ts";
import { schema } from "./schema.ts";

export function createDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof createDb>;
