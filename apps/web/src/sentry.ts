import * as Sentry from "@sentry/react";

const dsn =
  import.meta.env.VITE_SENTRY_DSN ??
  "https://a4b0a653d736b410792b64eb65436e5c@o4511763138936832.ingest.de.sentry.io/4511763225182288";

Sentry.init({
  dsn,
  environment: import.meta.env.MODE,
  sendDefaultPii: false,
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
});

export { Sentry };
