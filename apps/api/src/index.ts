import * as Sentry from "@sentry/cloudflare";

import { app } from "./app.ts";
import type { Env } from "./env.ts";

export { LedgerSyncWorkflow } from "./workflows/ledger-sync.ts";

const handler = {
  fetch: app.fetch,
};

export default Sentry.withSentry((env: Env) => {
  return {
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    sendDefaultPii: false,
    tracesSampleRate: env.ENVIRONMENT === "production" ? 0.1 : 0,
    dataCollection: {
      userInfo: false,
      httpBodies: [],
    },
  };
}, handler);
