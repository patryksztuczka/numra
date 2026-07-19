import { createMiddleware } from "hono/factory";

import { createAuth, type Auth } from "../auth/index.ts";
import { createDb } from "../db/index.ts";
import type { Env } from "../env.ts";
import { isEmailAllowlisted } from "./allowlist.ts";

type SessionPayload = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

export type AppVariables = {
  user: SessionPayload["user"];
  session: SessionPayload["session"];
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

export const requireSession = createMiddleware<AppEnv>(async (context, next) => {
  const auth = createAuth(context.env);
  const result = await auth.api.getSession({
    headers: context.req.raw.headers,
  });

  if (!result) {
    return context.json(
      {
        error: "unauthorized",
        message: "Authentication is required.",
      },
      401,
    );
  }

  const allowed = await isEmailAllowlisted(createDb(context.env), result.user.email);

  if (!allowed) {
    await auth.api.signOut({
      headers: context.req.raw.headers,
    });

    return context.json(
      {
        error: "forbidden",
        message: "This email address is not allowed to access Numra.",
      },
      403,
    );
  }

  context.set("user", result.user);
  context.set("session", result.session);
  return next();
});
