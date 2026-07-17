import { Card, CardContent } from "@/components/ui/card";
import type { AspectRatio, PlatformTarget } from "@/hooks/useContentGenerator";

// defaultRatio mirrors lib/content-generator/platforms.ts's PlatformSpec --
// keep both in sync if a platform's expected orientation changes (e.g. a
// future "YouTube Long" entry would be "16:9", not "9:16").
export const PLATFORMS: { id: PlatformTarget; label: string; blurb: string; defaultRatio: AspectRatio }[] = [
  { id: 'shopee_video', label: 'Shopee Video', blurb: 'Penonton sudah niat beli -- tampilkan produk/harga cepat, tutup dengan klik keranjang kuning.', defaultRatio: '9:16' },
  { id: 'instagram_reels', label: 'Instagram Reels', blurb: 'Save & share (DM ke teman) lebih penting dari like -- buat konten worth dikirim.', defaultRatio: '9:16' },
  { id: 'facebook_reels', label: 'Facebook Reels', blurb: 'Audiens 30+ lebih dominan, tone lebih formal, social proof efektif.', defaultRatio: '9:16' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', blurb: 'Watch time & completion rate segalanya -- hook detik pertama menentukan.', defaultRatio: '9:16' },
];

export function getPlatformDefaultRatio(id: PlatformTarget): AspectRatio {
  return PLATFORMS.find((p) => p.id === id)?.defaultRatio ?? '9:16';
}

interface PlatformSelectorProps {
  value: PlatformTarget;
  onChange: (value: PlatformTarget) => void;
}

export function PlatformSelector({ value, onChange }: PlatformSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {PLATFORMS.map((platform) => (
        <Card
          key={platform.id}
          className={`cursor-pointer transition-colors ${value === platform.id ? 'border-primary ring-1 ring-primary' : ''}`}
          onClick={() => onChange(platform.id)}
        >
          <CardContent className="p-4">
            <p className="text-sm font-medium">{platform.label}</p>
            <p className="text-xs text-muted-foreground mt-1">{platform.blurb}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
