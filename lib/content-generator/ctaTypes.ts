import { GROWTH_ALLOWED_CTAS } from "./types";
import type { CtaTypeId, ContentGoal } from "./types";

interface CtaTypeSpec {
  id: CtaTypeId;
  label: string;
  instruction: string;
}

// Ported/adapted from ViralFrame Studio's CTA_TYPES -- klik_keranjang_kuning is
// Shopee-specific ("yellow cart" in-app checkout button).
export const CTA_TYPES: Record<CtaTypeId, CtaTypeSpec> = {
  link_bio: { id: "link_bio", label: "Klik Link di Bio", instruction: 'ajakan "klik link di bio" untuk info lebih lanjut' },
  dm_whatsapp: { id: "dm_whatsapp", label: "DM / Chat WhatsApp", instruction: 'ajakan "chat WA sekarang" untuk tanya-tanya/pesan' },
  comment_keyword: { id: "comment_keyword", label: "Komen Keyword", instruction: 'ajakan komentar kata kunci tertentu untuk info lebih lanjut' },
  follow_more: { id: "follow_more", label: "Follow untuk Konten Berikutnya", instruction: 'ajakan follow akun untuk konten berikutnya' },
  share_tag_friend: { id: "share_tag_friend", label: "Share & Tag Teman", instruction: 'ajakan share atau tag teman yang butuh info ini' },
  visit_website: { id: "visit_website", label: "Kunjungi Website/Toko", instruction: 'ajakan kunjungi website atau toko' },
  limited_urgency: { id: "limited_urgency", label: "Stok/Waktu Terbatas", instruction: 'ajakan bertindak cepat karena stok/waktu terbatas (tetap jujur, jangan mengarang urgensi palsu)' },
  save_for_later: { id: "save_for_later", label: "Simpan Video Ini", instruction: 'ajakan simpan video untuk ditonton lagi nanti' },
  klik_keranjang_kuning: { id: "klik_keranjang_kuning", label: "Klik Keranjang Kuning", instruction: 'ajakan eksplisit "klik keranjang kuning sekarang" (khusus Shopee Video)' },
};

export function getCtaType(id: CtaTypeId): CtaTypeSpec {
  return CTA_TYPES[id];
}

// Growth-goal content can't use hard-sell CTAs -- fall back to the closest
// allowed one (follow_more) if the requested CTA isn't permitted.
export function resolveCtaForGoal(ctaType: CtaTypeId, contentGoal: ContentGoal): CtaTypeId {
  if (contentGoal !== "growth") return ctaType;
  return GROWTH_ALLOWED_CTAS.includes(ctaType) ? ctaType : "follow_more";
}
