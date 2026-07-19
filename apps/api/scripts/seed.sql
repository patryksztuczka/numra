-- Seed allowlisted emails for local development.
-- Apply with: pnpm --filter @numra/api db:seed:local
INSERT OR IGNORE INTO allowed_email (id, email, note, created_at)
VALUES
  (
    'seed_allowed_dev',
    'dev@numra.local',
    'Local development operator',
    unixepoch() * 1000
  );
