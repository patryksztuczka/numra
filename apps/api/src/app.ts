import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./access/session.ts";
import { requireSession } from "./access/session.ts";
import { createAuth } from "./auth/index.ts";
import { financeRoutes, handleEnableBankingCallback } from "./finance/routes.ts";

export const app = new Hono<AppEnv>();

app.use("*", async (context, next) => {
  const origin = context.env.WEB_ORIGIN;

  const middleware = cors({
    origin,
    allowHeaders: ["Content-Type", "Authorization", "sentry-trace", "baggage"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });

  return middleware(context, next);
});

// Public routes (registered before requireSession)
app.on(["GET", "POST"], "/api/auth/*", (context) => {
  const auth = createAuth(context.env);
  return auth.handler(context.req.raw);
});

app.get("/", (context) =>
  context.json({
    name: "numra-api",
    runtime: "cloudflare-workers",
    status: "ready",
    version: "0.0.0",
  }),
);

app.get("/health", (context) =>
  context.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  }),
);

// Enable Banking OAuth callback — public; ownership bound via auth state.
app.get("/connections/enable-banking/callback", (context) => handleEnableBankingCallback(context));

// Default: session required for all routes registered below
app.use("*", requireSession);

app.get("/me", (context) => {
  const user = context.get("user");

  return context.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
    },
  });
});

app.route("/", financeRoutes);

app.notFound((context) =>
  context.json(
    {
      error: "not_found",
      message: "The requested route does not exist.",
    },
    404,
  ),
);
