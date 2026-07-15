import type { AspectRatio, PlatformTarget } from "./types";

interface PlatformSpec {
  id: PlatformTarget;
  label: string;
  defaultRatio: AspectRatio;
  durationHint: string;
  behavior: string;
}

// PLATFORM_BEHAVIOR text for instagram_reels/facebook_reels/youtube_shorts ported
// from ViralFrame Studio's maps.ts (field-tested). shopee_video is new -- authored
// for this project since Shopee Video is commerce-embedded (viewer already has
// purchase intent) rather than a general social feed.
export const PLATFORMS: Record<PlatformTarget, PlatformSpec> = {
  shopee_video: {
    id: "shopee_video",
    label: "Shopee Video",
    defaultRatio: "9:16",
    durationHint: "15-60 detik",
    behavior:
      "Video ditonton di dalam app belanja -- penonton sudah punya niat beli. Tampilkan produk & harga/promo secepat mungkin di hook, gaya UGC-review yang jujur lebih efektif daripada sinematik berlebihan. Akhiri dengan ajakan eksplisit klik keranjang kuning, bukan link eksternal.",
  },
  instagram_reels: {
    id: "instagram_reels",
    label: "Instagram Reels",
    defaultRatio: "9:16",
    durationHint: "15-90 detik",
    behavior:
      "Save dan share (terutama DM ke teman) lebih penting dari like. Buat konten yang terasa 'worth saving' atau 'worth dikirim ke teman'. Aesthetic visual lebih diperhatikan dibanding platform lain.",
  },
  facebook_reels: {
    id: "facebook_reels",
    label: "Facebook Reels",
    defaultRatio: "9:16",
    durationHint: "15-60 detik",
    behavior:
      "Audiens 30+ lebih dominan. Tone lebih formal/kredibel dibanding TikTok-style. Social proof dan detail konkret (fakta, angka) sangat efektif dibanding hype kosong.",
  },
  youtube_shorts: {
    id: "youtube_shorts",
    label: "YouTube Shorts",
    defaultRatio: "9:16",
    durationHint: "15-60 detik",
    behavior:
      "Watch time dan completion rate adalah segalanya -- hook detik pertama menentukan distribusi. Narasi asli/orisinal (bukan seperti audio trending) lebih disukai algoritma dibanding gaya ikut-ikutan.",
  },
};

export function getPlatformSpec(id: PlatformTarget): PlatformSpec {
  return PLATFORMS[id];
}
