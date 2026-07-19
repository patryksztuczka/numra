import { Hono } from "hono";
import { cors } from "hono/cors";

export const app = new Hono();

app.use("*", cors());

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

app.notFound((context) =>
  context.json(
    {
      error: "not_found",
      message: "The requested route does not exist.",
    },
    404,
  ),
);
