# Numra

A pnpm + Turborepo monorepo with a Hono API on Cloudflare Workers and a Vite,
React, and Tailwind CSS web app. Both applications use TypeScript 7.

## Requirements

- Node.js 26.4.0
- pnpm 11.9.0

The Node version is pinned in `.node-version`, `.nvmrc`, and the root package
engines. The pnpm version is pinned with the `packageManager` field.

## Get started

```sh
pnpm install
pnpm dev
```

The web app runs at `http://localhost:5173` and the Worker API at
`http://localhost:8787`. Copy `apps/web/.env.example` to `apps/web/.env.local`
when you need to point the web app at a different API.

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

## Structure

```text
apps/
├── api/  Hono application deployed with Wrangler
└── web/  Vite + React + Tailwind CSS application
```

Deploy the API after authenticating Wrangler:

```sh
pnpm --filter @numra/api deploy
```
