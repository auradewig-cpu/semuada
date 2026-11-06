-- Scheduler: per-account posts per day + automatic, collision-free posting times.
--
-- Run ONCE against the target database, BEFORE deploying the code that reads
-- these columns. drizzle-kit generate/migrate is deliberately NOT used -- the
-- drizzle/ journal in this repo is stale (see migrate-phase0.sql).
--
--   psql "$DATABASE_URL" -f scripts/migrate-posts-per-day.sql
--
-- Additive and backwards compatible: the old code keeps working against the
-- migrated table (it still finds base_times/cap_time populated on every
-- existing row), so the deploy can follow at any time.

BEGIN;

-- 1. How many posts a day each account is set to. DEFAULT 5 is what moves the
--    ten existing accounts to 5/day -- all of them are past the warm-up
--    (rotation.ts postsAllowedToday), so they take it from the next build.
ALTER TABLE scheduler_accounts
  ADD COLUMN IF NOT EXISTS posts_per_day integer NOT NULL DEFAULT 5;
ALTER TABLE scheduler_accounts DROP CONSTRAINT IF EXISTS scheduler_accounts_posts_per_day_range;
ALTER TABLE scheduler_accounts
  ADD CONSTRAINT scheduler_accounts_posts_per_day_range CHECK (posts_per_day BETWEEN 1 AND 5);

-- 2. Each account's permanent lane in the daily time allocation. UNIQUE is
--    the collision guarantee (distinct lanes -> distinct offsets on every
--    day), so it lives in the database, not only in the insert route.
--    Backfilled 0..n-1 in creation order.
ALTER TABLE scheduler_accounts ADD COLUMN IF NOT EXISTS slot_lane integer;
WITH ordered AS (
  SELECT id, (row_number() OVER (ORDER BY created_at, id) - 1)::int AS lane
  FROM scheduler_accounts
)
UPDATE scheduler_accounts s
SET slot_lane = ordered.lane
FROM ordered
WHERE ordered.id = s.id AND s.slot_lane IS NULL;
ALTER TABLE scheduler_accounts ALTER COLUMN slot_lane SET NOT NULL;
ALTER TABLE scheduler_accounts DROP CONSTRAINT IF EXISTS scheduler_accounts_slot_lane_unique;
ALTER TABLE scheduler_accounts
  ADD CONSTRAINT scheduler_accounts_slot_lane_unique UNIQUE (slot_lane);
ALTER TABLE scheduler_accounts DROP CONSTRAINT IF EXISTS scheduler_accounts_slot_lane_range;
ALTER TABLE scheduler_accounts
  ADD CONSTRAINT scheduler_accounts_slot_lane_range CHECK (slot_lane BETWEEN 0 AND 35);

-- 3. Hand-typed posting times are retired. Kept as history, no longer
--    required, so new accounts can be inserted without them.
ALTER TABLE scheduler_accounts ALTER COLUMN base_times DROP NOT NULL;
ALTER TABLE scheduler_accounts ALTER COLUMN cap_time DROP NOT NULL;

COMMIT;
