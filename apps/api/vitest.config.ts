import path from "node:path";
import { fileURLToPath } from "node:url";

import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(root, "drizzle"));

  return {
    plugins: [
      cloudflareTest({
        wrangler: {
          configPath: "./wrangler.jsonc",
        },
        miniflare: {
          bindings: {
            BETTER_AUTH_SECRET: "test-secret-with-at-least-32-characters!",
            BETTER_AUTH_URL: "http://localhost:8787",
            WEB_ORIGIN: "http://localhost:5173",
            TEST_MIGRATIONS: migrations,
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./src/test/apply-migrations.ts"],
      coverage: {
        reporter: ["text", "json", "html"],
      },
    },
  };
});
