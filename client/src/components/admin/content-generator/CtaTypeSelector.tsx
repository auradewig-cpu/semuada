import { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GROWTH_ALLOWED_CTAS, type ContentGoal, type CtaTypeId, type PlatformTarget } from "@/hooks/useContentGenerator";

const CTA_TYPES: { id: CtaTypeId; label: string }[] = [
  { id: 'link_bio', label: 'Klik Link di Bio' },
  { id: 'dm_whatsapp', label: 'DM / Chat WhatsApp' },
  { id: 'comment_keyword', label: 'Komen Keyword' },
  { id: 'follow_more', label: 'Follow untuk Konten Berikutnya' },
  { id: 'share_tag_friend', label: 'Share & Tag Teman' },
  { id: 'visit_website', label: 'Kunjungi Website/Toko' },
  { id: 'limited_urgency', label: 'Stok/Waktu Terbatas' },
  { id: 'save_for_later', label: 'Simpan Video Ini' },
  { id: 'klik_keranjang_kuning', label: 'Klik Keranjang Kuning (Shopee)' },
];

interface CtaTypeSelectorProps {
  value: CtaTypeId;
  onChange: (value: CtaTypeId) => void;
  contentGoal: ContentGoal;
  platform: PlatformTarget;
}

export function CtaTypeSelector({ value, onChange, contentGoal, platform }: CtaTypeSelectorProps) {
  const options = contentGoal === 'growth' ? CTA_TYPES.filter((c) => GROWTH_ALLOWED_CTAS.includes(c.id)) : CTA_TYPES;

  useEffect(() => {
    if (!options.some((o) => o.id === value)) {
      onChange(options[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentGoal]);

  return (
    <Select value={value} onValueChange={(v) => onChange(v as CtaTypeId)}>
      <SelectTrigger>
        <SelectValue placeholder="Pilih tipe CTA" />
      </SelectTrigger>
      <SelectContent>
        {options.map((cta) => (
          <SelectItem key={cta.id} value={cta.id}>
            {cta.label}{cta.id === 'klik_keranjang_kuning' && platform !== 'shopee_video' ? ' (khusus Shopee)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
