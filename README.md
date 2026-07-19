# Numra

A pnpm + Turborepo monorepo with a Hono API on Cloudflare Workers and a Vite,
React, and Tailwind CSS web app. Both applications use TypeScript 7.

Identity uses [Better Auth](https://www.better-auth.com/) with email/password,
Cloudflare D1, and Drizzle. Sign-up and sign-in are limited to emails stored in
the `allowed_emails` table.

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
relying on auth outside local smoke tests.

The web app runs at `http://localhost:5173` and the Worker API at
`http://localhost:8787`.

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
├── api/  Hono application deployed with Wrangler (Better Auth + D1)
└── web/  Vite + React + Tailwind CSS application
```

## Auth notes

- Better Auth is mounted at `/api/auth/*` on the API Worker.
- `GET /me` returns the current user when a valid allowlisted session exists.
- Allowlist rows live in D1 (`allowed_emails`). Exact emails only; values are
  compared after trim + lowercase normalization.
- Removing an email from the allowlist blocks future sign-in and rejects `/me`
  for existing sessions (and signs them out).
- Configure production secrets with Wrangler (`BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL`, `WEB_ORIGIN`) and point the D1 binding at a real database.

Deploy the API after authenticating Wrangler:

```sh
pnpm --filter @numra/api deploy
```
