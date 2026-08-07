import { pickExamples, formatExamples, deriveSeed, CTA_PHRASE_BANK } from "./exampleBank";
import { GROWTH_ALLOWED_CTAS } from "./types";
import type { CtaTypeId, ContentGoal, PlatformTarget } from "./types";

interface CtaTypeSpec {
  id: CtaTypeId;
  label: string;
  instruction: string;
}

// Ported/adapted from ViralFrame Studio's CTA_TYPES -- klik_keranjang_kuning is
// Shopee-specific ("yellow cart" in-app checkout button).
export const CTA_TYPES: Record<CtaTypeId, CtaTypeSpec> = {
  link_bio: { id: "link_bio", label: "Klik Link di Bio", instruction: "arahkan penonton ke link di bio untuk info lebih lanjut" },
  dm_whatsapp: { id: "dm_whatsapp", label: "DM / Chat WhatsApp", instruction: "ajak penonton menghubungi lewat WhatsApp untuk tanya-tanya atau pesan" },
  comment_keyword: { id: "comment_keyword", label: "Komen Keyword", instruction: "ajak penonton menuliskan kata kunci tertentu di kolom komentar untuk info lebih lanjut" },
  follow_more: { id: "follow_more", label: "Follow untuk Konten Berikutnya", instruction: "ajak penonton follow akun untuk konten berikutnya" },
  share_tag_friend: { id: "share_tag_friend", label: "Share & Tag Teman", instruction: "ajak penonton share atau menandai teman yang butuh info ini" },
  visit_website: { id: "visit_website", label: "Kunjungi Website/Toko", instruction: "ajak penonton mengunjungi website atau toko" },
  limited_urgency: { id: "limited_urgency", label: "Stok/Waktu Terbatas", instruction: "ajak penonton bertindak cepat karena stok/waktu terbatas (tetap jujur, JANGAN mengarang urgensi palsu)" },
  save_for_later: { id: "save_for_later", label: "Simpan Video Ini", instruction: "ajak penonton menyimpan video untuk ditonton lagi nanti" },
  // Brand-fixed: "keranjang kuning" is the literal name of Shopee's in-app
  // checkout button, so this wording stays exact -- rotating it would make the
  // instruction point at a UI element that doesn't exist.
  klik_keranjang_kuning: { id: "klik_keranjang_kuning", label: "Klik Keranjang Kuning", instruction: 'ajak penonton secara eksplisit "klik keranjang kuning sekarang" (khusus Shopee Video)' },
};

export function getCtaType(id: CtaTypeId): CtaTypeSpec {
  return CTA_TYPES[id];
}

// Adds a rotating set of example phrasings so the same ctaType doesn't produce
// the byte-identical closing line in every generation.
export function buildCtaInstruction(id: CtaTypeId, seed: number): string {
  const spec = getCtaType(id);
  const pool = CTA_PHRASE_BANK[id];
  if (!pool) return spec.instruction;
  const picked = pickExamples(pool, 2, deriveSeed(seed, 3));
  return `${spec.instruction}. Variasi ungkapan yang bisa jadi acuan rasa (JANGAN disalin persis): ${formatExamples(picked)}`;
}

// Growth-goal content can't use hard-sell CTAs -- fall back to the closest
// allowed one (follow_more) if the requested CTA isn't permitted.
export function resolveCtaForGoal(ctaType: CtaTypeId, contentGoal: ContentGoal): CtaTypeId {
  if (contentGoal !== "growth") return ctaType;
  return GROWTH_ALLOWED_CTAS.includes(ctaType) ? ctaType : "follow_more";
}

// Shopee's yellow cart only exists inside the Shopee app, and Shopee's own
// platform behaviour text explicitly rules out external links. Previously
// neither direction was gated, so an Instagram video could be told to say
// "klik keranjang kuning", and a Shopee video could be told to point at a
// link in bio that the platform block simultaneously forbids.
export function resolveCtaForPlatform(ctaType: CtaTypeId, platform: PlatformTarget): CtaTypeId {
  if (platform === "shopee_video") {
    // External-destination CTAs don't work inside the Shopee player.
    return ctaType === "link_bio" || ctaType === "visit_website" ? "klik_keranjang_kuning" : ctaType;
  }
  return ctaType === "klik_keranjang_kuning" ? "link_bio" : ctaType;
}
