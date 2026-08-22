// Dispatch outcome rules verification.
//
//   npx tsx scripts/verify-scheduler-dispatch.ts
//
// No database, no network, no provider calls -- exercises the real
// resolveDispatchOutcome() from lib/scheduler/dispatch.ts, which is the
// function that decides whether a row is "posted" or "failed" and whether its
// video goes back into the pool. Testing it directly matters here because the
// only other way to reach these branches is a live dispatch that really posts
// to nine social accounts.

import { resolveDispatchOutcome } from "@root/lib/scheduler/dispatch";
import type { ProviderResults } from "@root/lib/scheduler/types";

let failed = false;
function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : ` -- ${detail}`}`);
  if (!cond) failed = true;
}

const show = (r: ReturnType<typeof resolveDispatchOutcome>) =>
  `status=${r.status} anySucceeded=${r.anySucceeded} releaseVideo=${r.releaseVideo}`;

// 1. No platforms at all. THE regression this exists to pin: a scheduler
// account with no channel IDs produced platforms=[], and the old
// `outcomes.length > 0 && ...` guard made that read as "posted" -- a green
// tick with no provider contacted, and a video stranded out of the pool
// forever.
{
  const r = resolveDispatchOutcome({});
  check("nol platform -> failed (bukan posted)", r.status === "failed", show(r));
  check("nol platform -> video dilepas kembali ke pool", r.releaseVideo === true, show(r));
  check("nol platform -> ada pesan error", r.errorMessage === "Tidak ada platform yang dituju.", String(r.errorMessage));
}

// 2. Everything failed, nothing reached a provider (Cloudinary down, bad key).
{
  const results: ProviderResults = {
    tiktok: { ok: false, error: "Buffer API key belum diisi." },
    threads: { ok: false, error: "Gagal mengambil video dari Cloudinary (404)." },
  };
  const r = resolveDispatchOutcome(results);
  check("semua gagal tanpa postId -> failed", r.status === "failed", show(r));
  check("semua gagal tanpa postId -> video dilepas", r.releaseVideo === true, show(r));
  check("pesan error menggabungkan keduanya", (r.errorMessage ?? "").includes("Cloudinary"), String(r.errorMessage));
}

// 3. Everything failed BUT a provider handed back an id. The provider may
// have accepted it anyway; releasing the video would risk a second post.
{
  const results: ProviderResults = {
    tiktok: { ok: false, postId: "abc123", error: "Timeout membaca respons." },
    threads: { ok: false, error: "HTTP 500" },
  };
  const r = resolveDispatchOutcome(results);
  check("gagal tapi ada postId -> tetap failed", r.status === "failed", show(r));
  check("gagal tapi ada postId -> video DITAHAN", r.releaseVideo === false, show(r));
}

// 4. Partial success -- the common real case (YouTube disconnected while the
// rest went out). Row is "posted", video is trashed, nothing is released.
{
  const results: ProviderResults = {
    tiktok: { ok: true, postId: "t1" },
    instagram: { ok: true, postId: "i1" },
    youtube: { ok: false, error: "Invalid Credentials" },
  };
  const r = resolveDispatchOutcome(results);
  check("sebagian berhasil -> posted", r.status === "posted", show(r));
  check("sebagian berhasil -> anySucceeded", r.anySucceeded === true, show(r));
  check("sebagian berhasil -> video tidak dilepas", r.releaseVideo === false, show(r));
  check("sebagian berhasil -> errorMessage null", r.errorMessage === null, String(r.errorMessage));
}

// 5. Full success.
{
  const r = resolveDispatchOutcome({ tiktok: { ok: true, postId: "t1" }, threads: { ok: true, postId: "z1" } });
  check("semua berhasil -> posted", r.status === "posted" && r.anySucceeded, show(r));
  check("semua berhasil -> tidak ada pelepasan", r.releaseVideo === false, show(r));
}

console.log(failed ? "\nADA YANG GAGAL" : "\nSEMUA LULUS");
process.exit(failed ? 1 : 0);
