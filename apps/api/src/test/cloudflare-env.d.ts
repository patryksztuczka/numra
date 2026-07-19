declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
    WEB_ORIGIN: string;
    TEST_MIGRATIONS: Array<{
      name: string;
      queries: string[];
    }>;
  }
}
