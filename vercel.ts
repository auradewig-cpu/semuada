import type { VercelConfig } from '@vercel/config/v1';

// Only 2 of the scheduler's 3 cron jobs run here -- both need just once/day,
// which Vercel's Hobby plan supports natively. The 3rd (dispatch-posts) needs
// a much higher frequency to hit specific times of day (06:00/12:00/19:00
// style slots), which Hobby's cron cadence can't do -- it's triggered
// externally instead, see .github/workflows/dispatch-scheduler.yml.
export const config: VercelConfig = {
  crons: [
    { path: '/api/cron/build-schedule', schedule: '5 0 * * *' },
    { path: '/api/cron/purge-trash', schedule: '30 0 * * *' },
  ],
};
