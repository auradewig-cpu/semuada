import type { VercelConfig } from '@vercel/config/v1';

// Only 2 of the scheduler's 3 cron jobs run here -- both need just once/day,
// which Vercel's Hobby plan supports natively. The 3rd (dispatch-posts) needs
// a much higher frequency to hit specific times of day (06:00/12:00/19:00
// style slots), which Hobby's cron cadence can't do -- it's triggered
// externally instead, see .github/workflows/dispatch-scheduler.yml.
//
// build-schedule fires at 18:00 UTC = 01:00 WIB (Vercel cron schedules are
// UTC) -- deliberately well before the earliest configured base time
// (06:00 WIB) across all accounts, so every slot is already queued by the
// time its target hour arrives and dispatch-posts (polling every ~10 min)
// picks it up on time. Firing this any later than an account's earliest
// base time means that slot gets queued already-overdue and posts almost
// immediately instead of at its intended hour -- if a future account ever
// needs a base time earlier than 01:00 WIB, this needs to move earlier too.
export const config: VercelConfig = {
  crons: [
    { path: '/api/cron/build-schedule', schedule: '0 18 * * *' },
    { path: '/api/cron/purge-trash', schedule: '30 0 * * *' },
  ],
};
