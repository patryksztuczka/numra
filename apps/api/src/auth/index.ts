import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { authEmailBodySchema, isEmailAllowlisted, normalizeEmail } from "../access/allowlist.ts";
import { createAuthAdapter, createDb } from "../db/index.ts";
import type { Env } from "../env.ts";

const allowlistDeniedMessage = "This email address is not allowed to access Numra.";

export function createAuth(env: Env) {
  const db = createDb(env);

  return betterAuth({
    appName: "Numra",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.WEB_ORIGIN],
    database: createAuthAdapter(db),
    emailAndPassword: {
      enabled: true,
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"],
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-in/email" && ctx.path !== "/sign-up/email") {
          return;
        }

        const parsed = authEmailBodySchema.safeParse(ctx.body);

        if (!parsed.success) {
          return;
        }

        const allowed = await isEmailAllowlisted(db, parsed.data.email);

        if (!allowed) {
          throw new APIError("FORBIDDEN", {
            message: allowlistDeniedMessage,
          });
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const allowed = await isEmailAllowlisted(db, user.email);

            if (!allowed) {
              throw new APIError("FORBIDDEN", {
                message: allowlistDeniedMessage,
              });
            }

            return {
              data: {
                ...user,
                email: normalizeEmail(user.email),
              },
            };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
