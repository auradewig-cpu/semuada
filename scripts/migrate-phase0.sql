-- Content Generator refactor, Phase 0: foundation data (FK + fingerprint).
--
-- Run ONCE against the target database. drizzle-kit generate/migrate is
-- deliberately NOT used here -- the drizzle/ journal in this repo is stale and
-- would generate migrations that try to recreate tables that already exist.
--
--   psql "$DATABASE_URL" -f scripts/migrate-phase0.sql
--   (or run the statements via any Postgres client)

-- 1. FK linking a video back to the Content Generator output that produced it.
--    ON DELETE SET NULL: deleting a generation must never delete its videos
--    (and manual uploads have no generation at all, hence nullable).
ALTER TABLE video_contents
  ADD COLUMN IF NOT EXISTS content_generation_id uuid REFERENCES content_generations(id) ON DELETE SET NULL;

-- 2. Fingerprint columns on content_generations (all nullable, old rows not
--    backfilled). auto_selected marks choices that came from the Creative
--    Director (Stage A) rather than manual user selection.
ALTER TABLE content_generations
  ADD COLUMN IF NOT EXISTS mechanism text,
  ADD COLUMN IF NOT EXISTS language_tone text,
  ADD COLUMN IF NOT EXISTS ai_tool text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS realism_profile text,
  ADD COLUMN IF NOT EXISTS scene_count integer,
  ADD COLUMN IF NOT EXISTS total_duration integer,
  ADD COLUMN IF NOT EXISTS auto_selected boolean NOT NULL DEFAULT false;
