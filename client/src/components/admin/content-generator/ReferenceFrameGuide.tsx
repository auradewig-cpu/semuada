import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TriangleAlert } from "lucide-react";
import type { AiToolId } from "@/hooks/useContentGenerator";

interface GuideSpec {
  label: string;
  steps: string[];
  caution?: string;
}

// Mirrors lib/content-generator/referenceGuide.ts -- duplicated client-side
// since lib/content-generator/ is server-only. Verified against public
// docs/announcements as of early 2026; tool UIs change often.
const REFERENCE_GUIDE: Record<AiToolId, GuideSpec> = {
  google_flow: {
    label: 'Google Flow',
    steps: [
      'Buka project di Google Flow, mulai scene baru.',
      'Cari opsi "Add reference image" / "Ingredients" -- upload karakter.jpg dan foto produk scene ini (maks 3 gambar per subjek).',
      'Tempel teks dari tombol "Copy Prompt" ke kolom prompt.',
      'Generate -- Flow menjaga konsistensi wajah/produk dari gambar referensi yang diupload.',
    ],
  },
  veo3: {
    label: 'Google Veo 3',
    steps: [
      'Pastikan pakai Veo 3.1 ke atas -- dukungan reference image baru ditambahkan Januari 2026.',
      'Upload sampai 3 foto referensi (karakter.jpg + foto produk scene ini) di panel reference sebelum generate.',
      'Tempel "Copy Prompt" ke kolom teks -- dialog dalam tanda kutip otomatis diucapkan sesuai bahasa isinya.',
      'Generate satu scene per satu, ganti reference produk sesuai nomor scene.',
    ],
  },
  kling_ai: {
    label: 'Kling AI',
    steps: [
      'Upload karakter.jpg ke "Subject Library"/"Element Binding" -- beberapa foto beda angle hasilnya lebih konsisten.',
      'Upload foto produk scene ini sebagai "Element" terpisah.',
      'Tempel "Copy Prompt", tag [DIALOGUE: ...] dikenali otomatis.',
      'Generate per scene, ganti Element produk sesuai nomor scene.',
    ],
  },
  runway_gen4: {
    label: 'Runway Gen-4',
    steps: [
      'Drag & drop karakter.jpg dan foto produk scene ini ke kanvas prompting sebagai References (maks 3 gambar).',
      'Opsional: beri nama tiap reference (ikon tag) supaya bisa dipanggil pakai @nama.',
      'Tempel "Copy Prompt" -- sebut "image_1"/"image_2" atau @nama kalau perlu mempertegas.',
      'Generate.',
    ],
  },
  luma_dream: {
    label: 'Luma Dream Machine',
    steps: [
      'Pilih mode "Reference" dari dropdown generate.',
      'Upload karakter.jpg untuk "Character Reference"/"Character Seed" (sampai 4 foto kalau ada).',
      'Upload foto produk scene ini sebagai reference tambahan.',
      'Tempel "Copy Prompt", generate.',
    ],
  },
  pika_labs: {
    label: 'Pika Labs',
    steps: [
      'Gunakan fitur "Scene Ingredients" -- upload karakter.jpg dan foto produk scene ini sebagai ingredients terpisah.',
      'Atau pakai "Character Reference (CREF)" khusus untuk foto karakter.',
      'Tempel "Copy Prompt", generate.',
    ],
  },
  sora: {
    label: 'OpenAI Sora',
    steps: [
      'Upload foto produk (bukan wajah) sebagai reference visual kalau fitur ini tersedia.',
      'Andalkan deskripsi visual karakter yang detail di "ai_ready_prompt" karena upload wajah dibatasi.',
      'Tempel "Copy Prompt" ke kolom teks, generate.',
    ],
    caution: 'Per kebijakan OpenAI 2026, upload foto wajah manusia (asli maupun AI-generated) diblokir sistem moderasi Sora -- karakter.jpg kemungkinan besar TIDAK BISA diupload langsung.',
  },
};

interface ReferenceFrameGuideProps {
  aiTool: AiToolId;
}

export function ReferenceFrameGuide({ aiTool }: ReferenceFrameGuideProps) {
  const guide = REFERENCE_GUIDE[aiTool];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cara Pasang Reference Image -- {guide.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {guide.caution && (
          <p className="text-xs flex items-start gap-1.5 text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2">
            <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {guide.caution}
          </p>
        )}
        <ol className="text-sm space-y-1.5 list-decimal pl-4">
          {guide.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
