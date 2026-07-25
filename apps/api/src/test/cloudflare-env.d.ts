declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    LEDGER_SYNC_WORKFLOW: Workflow;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    WEB_ORIGIN: string;
    ENABLE_BANKING_APPLICATION_ID: string;
    ENABLE_BANKING_PRIVATE_KEY: string;
    ENABLE_BANKING_API_BASE: string;
    ENABLE_BANKING_REDIRECT_URL: string;
    ENCRYPTION_KEY: string;
    TEST_MIGRATIONS: Array<{
      name: string;
      queries: string[];
    }>;
  }
}
