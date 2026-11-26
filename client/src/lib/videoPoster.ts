// Still-image thumbnail for a Cloudinary video, to use as a <video poster>
// alongside preload="none".
//
// Why: the admin grids (Video Library, Scheduler, the video picker) render one
// <video> per card, and without a preload attribute Chrome fetches the start
// of EVERY video as soon as the page opens -- measured 2026-11-26 at 142
// Cloudinary requests and ~3-4 s buffered per video on a single Video Library
// visit, roughly 100 MB. Repeated page views were the bulk of the bandwidth
// that pushed every free Cloudinary account past its monthly quota and got the
// Perlengkapan Rumah one (piyno6jy) disabled, which stopped Naya, Caca and
// Mila posting. With preload="none" a video is only downloaded when someone
// presses play; the poster keeps the card recognisable for ~25 KB.
//
// Cloudinary derives the image from the video itself: same path, an image
// extension, and so_0 (start offset 0 = first frame). Each thumbnail is a
// derived asset, generated once and then served from cache, so it costs one
// transformation per video, not one per view.
const CLOUDINARY_VIDEO = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)\.(mp4|mov|webm|m4v|mkv)$/i;

export function videoPosterUrl(videoUrl: string | null | undefined, width = 400): string | undefined {
  const match = videoUrl ? CLOUDINARY_VIDEO.exec(videoUrl) : null;
  if (!match) return undefined;
  const [, prefix, path] = match;
  return `${prefix}so_0,w_${width},c_limit,q_auto/${path}.jpg`;
}
