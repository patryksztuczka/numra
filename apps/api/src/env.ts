export type Env = {
  DB: D1Database;
  LEDGER_SYNC_WORKFLOW: Workflow;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  ENVIRONMENT: string;
  SENTRY_DSN: string;
  WEB_ORIGIN: string;
  ENABLE_BANKING_APPLICATION_ID: string;
  ENABLE_BANKING_PRIVATE_KEY: string;
  ENABLE_BANKING_API_BASE: string;
  ENABLE_BANKING_REDIRECT_URL: string;
  /** 32-byte key, base64-encoded, for AES-GCM at-rest encryption. */
  ENCRYPTION_KEY: string;
};
