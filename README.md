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

## Recurring income

Recurring money is user-declared, not detected. On the transactions list, an
incoming payment can be marked as recurring: that transaction seeds a series
(counterparty, amount, currency, account) and its booking date becomes the
cadence anchor. An optional end date covers income that is known to stop, such
as a fixed-term contract.

Occurrences are not stored. They are projected from cadence + start date at
read time and matched against real transactions by counterparty and date
proximity (±5 days), never by amount — so a bonus or a raise still counts as
the month it belongs to. Each transaction is claimed by at most one occurrence.
An occurrence is `received` once matched, `late` once past its grace window,
and `expected` otherwise.

The `recurring_series` table carries a `kind` column (`income` today) so fixed
costs can reuse the same projection and matching without a schema change.

## Requirements

- Node.js 26.4.0
- pnpm 11.9.0

The Node version is pinned in `.node-version`, `.nvmrc`, and the root package
engines. The pnpm version is pinned with the `packageManager` field.

## Get started

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @numra/api db:migrate:local
pnpm --filter @numra/api db:seed:local
pnpm dev
```

Edit `apps/api/.env` and set a long random `BETTER_AUTH_SECRET` before
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

Legal pages (`/privacy`, `/terms`) require web env `VITE_OPERATOR_NAME`,
`VITE_CONTACT_EMAIL`, and `VITE_SERVICE_URL` (see `apps/web/.env.example`).
They are inlined at build time and the web app throws if any are missing —
set them in `apps/web/.env.local` for dev and in the web deploy environment
before `pnpm --filter @numra/web build`.

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

- `POST /connections/enable-banking/start` begins PKO Bank Polski consent.
- `GET /connections/enable-banking/callback` completes the session, stores
  accounts, and enqueues the ledger sync workflow (inline ETL fallback in tests).
- `GET /connections`, `GET /accounts`, `GET /transactions` are session-scoped
  read models over D1.
- Workflow binding `LEDGER_SYNC_WORKFLOW` runs post-connect sync and is scheduled
  hourly (`0 * * * *`) to refresh all active connections.
- Money is stored as integer minor units + currency code.

## Auth notes

- Better Auth is mounted at `/api/auth/*` on the API Worker.
- `GET /me` returns the current user when a valid allowlisted session exists.
- Allowlist rows live in D1 (`allowed_emails`). Exact emails only; values are
  compared after trim + lowercase normalization.
- Removing an email from the allowlist blocks future sign-in and rejects `/me`
  for existing sessions (and signs them out).
- Configure production secrets with Wrangler (`BETTER_AUTH_SECRET`,
  Enable Banking credentials, `ENCRYPTION_KEY`). Public config lives in
  `apps/api/wrangler.jsonc` vars (`BETTER_AUTH_URL`, `WEB_ORIGIN`, …).
  Local `wrangler dev` overrides those via `apps/api/.env`.

## Production (Cloudflare)

Web:

- URL: https://numra.patryksztuczka.com
- Pages project: `numra`
- Pages fallback URL: https://numra-5vi.pages.dev
- SPA fallback: `apps/web/public/_redirects`

API:

- URL: https://api.numra.patryksztuczka.com
- Workers.dev fallback: https://numra-api.patryk-sztuczka00.workers.dev
- Worker: `numra-api`
- `BETTER_AUTH_URL`: `https://api.numra.patryksztuczka.com`
- `WEB_ORIGIN`: `https://numra.patryksztuczka.com`
- D1: `numra` (`665a7fa0-943b-4e3e-b148-d95ea6496603`)
- Workflow: `numra-ledger-sync` (hourly schedule: `0 * * * *`)
- Secrets: `BETTER_AUTH_SECRET`, `ENABLE_BANKING_APPLICATION_ID`,
  `ENABLE_BANKING_PRIVATE_KEY`, `ENCRYPTION_KEY`

The Pages production and preview environments define `VITE_API_URL`,
`VITE_SENTRY_DSN`, `VITE_OPERATOR_NAME`, `VITE_CONTACT_EMAIL`, and
`VITE_SERVICE_URL`. Vite inlines these values during a build, so local direct
uploads also need them in `apps/web/.env.local` or the calling environment.

Register this Enable Banking redirect URL on the application:

`https://api.numra.patryksztuczka.com/connections/enable-banking/callback`

Redeploy after authenticating Wrangler (`wrangler login` or
`CLOUDFLARE_API_TOKEN`):

```sh
pnpm --filter @numra/web deploy
pnpm --filter @numra/api deploy
pnpm --filter @numra/api db:migrate:remote
# secrets (once, or when rotating)
# pnpm --filter @numra/api exec wrangler secret put BETTER_AUTH_SECRET
```
