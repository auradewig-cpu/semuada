import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireCronSecret } from "@root/lib/cronAuth";
import { claimDuePosts, dispatchScheduledPost } from "@root/lib/scheduler/dispatch";

// Triggered externally via a GitHub Actions scheduled workflow, NOT Vercel
// Cron -- the project is on Vercel's Hobby plan, which only runs native
// crons once/day, far too coarse for 06:00/12:00/19:00-style posting slots.
// See .github/workflows/dispatch-scheduler.yml.
export async function GET(request: NextRequest) {
  const unauthorized = requireCronSecret(request);
  if (unauthorized) return unauthorized;

  // Claimed, not merely selected -- this workflow fires every 10 minutes with
  // no concurrency guard and drains backlogs sequentially with a full video
  // upload per post, so a run can outlast its own interval. See claimDuePosts().
  const due = await claimDuePosts(new Date());

  // Sequential on purpose -- a burst of overdue posts (e.g. after a missed
  // trigger) shouldn't hammer Buffer/Zernio with concurrent calls and risk
  // tripping their rate limits.
  for (const post of due) {
    await dispatchScheduledPost(post);
  }

  return NextResponse.json({ ok: true, processed: due.length });
}
