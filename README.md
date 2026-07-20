# Numra

A pnpm + Turborepo monorepo with a Hono API on Cloudflare Workers and a Vite,
React, and Tailwind CSS web app. Both applications use TypeScript 7.

Identity uses [Better Auth](https://www.better-auth.com/) with email/password,
Cloudflare D1, and Drizzle. Sign-up and sign-in are limited to emails stored in
the `allowed_emails` table.

Bank connectivity goes through [Enable Banking](https://enablebanking.com/).
Numra stores connections, accounts, and transactions in D1 (the local ledger)
and refreshes them hourly via a Cloudflare Workflow ETL. The web UI reads only
from Numra — never live from the bank on page load.

## Requirements

- Node.js 26.4.0
- pnpm 11.9.0

The Node version is pinned in `.node-version`, `.nvmrc`, and the root package
engines. The pnpm version is pinned with the `packageManager` field.

## Get started

```sh
pnpm install
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @numra/api db:migrate:local
pnpm --filter @numra/api db:seed:local
pnpm dev
```

Edit `apps/api/.dev.vars` and set a long random `BETTER_AUTH_SECRET` before
relying on auth outside local smoke tests. For bank connect, also set:

- `ENABLE_BANKING_APPLICATION_ID` / `ENABLE_BANKING_PRIVATE_KEY` (RS256 PEM)
- `ENABLE_BANKING_API_BASE` (default `https://api.enablebanking.com`)
- `ENABLE_BANKING_REDIRECT_URL` (API callback; local default is
  `http://localhost:8787/connections/enable-banking/callback`)
- `ENCRYPTION_KEY` — 32-byte key, base64 (`openssl rand -base64 32`), used to
  encrypt Enable Banking session ids at rest

Register that redirect URL on your Enable Banking application. Sandbox apps
activate automatically; production personal use typically needs account
whitelisting.

The web app runs at `http://localhost:5173` and the Worker API at
`http://localhost:8787`.

Both apps report errors to separate Sentry projects. The web DSN can be
overridden with `VITE_SENTRY_DSN`; the API reads `SENTRY_DSN` and
`ENVIRONMENT` from Wrangler vars. Set `ENVIRONMENT` to `production` in the
deployed Worker environment to enable 10% performance tracing.

The local seed allowlists `dev@numra.local` so you can sign up immediately.

## Commands

| Command          | Purpose                                                            |
| ---------------- | ------------------------------------------------------------------ |
| `pnpm dev`       | Run both apps through Turbo                                        |
| `pnpm build`     | Build the web app and dry-run the Worker deployment                |
| `pnpm check`     | Check Oxfmt formatting, Oxlint rules, dependency policy, and types |
| `pnpm check:fix` | Apply Oxlint, Oxfmt, and Syncpack fixes                            |
| `pnpm format`    | Format the repository with Oxfmt                                   |
| `pnpm lint`      | Lint TypeScript and JavaScript with type-aware Oxlint              |
| `pnpm test`      | Run tests through Turbo                                            |

### API database

| Command                                      | Purpose                         |
| -------------------------------------------- | ------------------------------- |
| `pnpm --filter @numra/api db:generate`       | Generate Drizzle SQL migrations |
| `pnpm --filter @numra/api db:migrate:local`  | Apply migrations to local D1    |
| `pnpm --filter @numra/api db:migrate:remote` | Apply migrations to remote D1   |
| `pnpm --filter @numra/api db:seed:local`     | Seed local allowlist            |
| `pnpm --filter @numra/api db:seed:remote`    | Seed remote allowlist           |

## Structure

```text
apps/
├── api/  Hono Worker (auth, Enable Banking gateway, ledger ETL workflow, D1)
└── web/  Vite + React + Tailwind CSS application
```

## Finance notes

- `POST /connections/enable-banking/start` begins ASPSP consent (PKO BP / Revolut).
- `GET /connections/enable-banking/callback` completes the session, stores
  accounts, and enqueues the ledger sync workflow (inline ETL fallback in tests).
- `GET /connections`, `GET /accounts`, `GET /transactions` are session-scoped
  read models over D1.
- Hourly schedule: Workflow binding `LEDGER_SYNC_WORKFLOW` (`0 * * * *`).
- Money is stored as integer minor units + currency code.

## Auth notes

- Better Auth is mounted at `/api/auth/*` on the API Worker.
- `GET /me` returns the current user when a valid allowlisted session exists.
- Allowlist rows live in D1 (`allowed_emails`). Exact emails only; values are
  compared after trim + lowercase normalization.
- Removing an email from the allowlist blocks future sign-in and rejects `/me`
  for existing sessions (and signs them out).
- Configure production secrets with Wrangler (`BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `WEB_ORIGIN`, Enable Banking credentials, `ENCRYPTION_KEY`)
  and point the D1 binding at a real database.

Deploy the API after authenticating Wrangler:

```sh
pnpm --filter @numra/api deploy
```
