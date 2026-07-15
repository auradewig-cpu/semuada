import { Card, CardContent } from "@/components/ui/card";
import type { PlatformTarget } from "@/hooks/useContentGenerator";

const PLATFORMS: { id: PlatformTarget; label: string; blurb: string }[] = [
  { id: 'shopee_video', label: 'Shopee Video', blurb: 'Penonton sudah niat beli -- tampilkan produk/harga cepat, tutup dengan klik keranjang kuning.' },
  { id: 'instagram_reels', label: 'Instagram Reels', blurb: 'Save & share (DM ke teman) lebih penting dari like -- buat konten worth dikirim.' },
  { id: 'facebook_reels', label: 'Facebook Reels', blurb: 'Audiens 30+ lebih dominan, tone lebih formal, social proof efektif.' },
  { id: 'youtube_shorts', label: 'YouTube Shorts', blurb: 'Watch time & completion rate segalanya -- hook detik pertama menentukan.' },
];

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
