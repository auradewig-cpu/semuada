// How long things are kept. Browser-safe (no imports) so the admin UI can show
// the same numbers the purge-trash cron enforces.

// Days a video sits in trash before purge-trash permanently removes it.
// 3 at the user's request (2026-11-27), down from 30: every video is handed
// to Buffer/Zernio at ~01:00 and published the same day, so nothing needs the
// file after that, and a short window keeps each free Cloudinary account's
// storage small. Trash is where the scheduler puts a video once it has been
// handed off (lib/scheduler/dispatch.ts), so this is also how long a post
// that failed on one platform can still be retried with its video.
export const TRASH_RETENTION_DAYS = 3;

// Days performance metrics are kept, counted from the post's slot. Separate
// on purpose: until 2026-11-27 the metrics expiry reused the trash constant,
// so shortening trash retention to 3 days would have silently erased every
// snapshot older than 3 days -- the whole Dashboard and the posting-hour
// analysis, which needs weeks of history.
export const METRICS_RETENTION_DAYS = 30;
