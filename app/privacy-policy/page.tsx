import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Kebijakan Privasi - Daftar Product",
  description: "Kebijakan privasi Daftar Product.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Kebijakan Privasi</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <h2>1. Pengumpulan Informasi</h2>
            <p>
              Kami tidak mengumpulkan data pribadi sensitif dari pengunjung. Kami hanya melacak interaksi non-pribadi seperti klik pada produk untuk tujuan analitik internal guna meningkatkan layanan kami.
            </p>

            <h2>2. Penggunaan Cookie</h2>
            <p>
              Website kami mungkin menggunakan cookie untuk meningkatkan pengalaman pengguna. Cookie ini tidak menyimpan informasi pribadi. Platform afiliasi partner kami mungkin juga menggunakan cookie mereka sendiri saat Anda diarahkan ke situs mereka.
            </p>

            <h2>3. Tautan Pihak Ketiga</h2>
            <p>
              Website ini berisi tautan ke situs pihak ketiga (platform e-commerce). Kami tidak bertanggung jawab atas praktik privasi atau konten dari situs-situs tersebut. Kebijakan privasi ini hanya berlaku untuk website kami.
            </p>

            <h2>4. Perubahan Kebijakan</h2>
            <p>
              Kami dapat memperbarui kebijakan privasi ini dari waktu ke waktu. Perubahan akan diposting di halaman ini.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
