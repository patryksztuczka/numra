import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AppEnv } from "./access/session.ts";
import { requireSession } from "./access/session.ts";
import { createAuth } from "./auth/index.ts";

export const app = new Hono<AppEnv>();

app.use("*", async (context, next) => {
  const origin = context.env.WEB_ORIGIN;

  const middleware = cors({
    origin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  });

  return middleware(context, next);
});

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

app.get("/me", requireSession, (context) => {
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

app.notFound((context) =>
  context.json(
    {
      error: "not_found",
      message: "The requested route does not exist.",
    },
    404,
  ),
);
