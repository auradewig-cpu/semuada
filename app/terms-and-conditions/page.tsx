import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan - Daftar Product",
  description: "Syarat dan ketentuan penggunaan Daftar Product.",
};

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Syarat & Ketentuan</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <h2>1. Penerimaan Persyaratan</h2>
            <p>
              Dengan mengakses dan menggunakan website Daftar Product, Anda setuju untuk mematuhi syarat dan ketentuan yang tercantum di halaman ini.
            </p>

            <h2>2. Peran Website</h2>
            <p>
              Daftar Product adalah platform direktori produk afiliasi. Kami tidak menjual produk secara langsung. Semua transaksi, termasuk pembayaran, pengiriman, dan layanan purna jual, adalah tanggung jawab penuh platform e-commerce partner.
            </p>

            <h2>3. Akurasi Informasi</h2>
            <p>
              Kami berusaha untuk menyajikan informasi produk (harga, stok, rating) seakurat mungkin. Namun, data dapat berubah sewaktu-waktu. Informasi yang paling akurat adalah yang tertera di halaman produk pada situs partner kami.
            </p>

            <h2>4. Batasan Tanggung Jawab</h2>
            <p>
              Kami tidak bertanggung jawab atas segala kerugian atau kerusakan yang timbul dari transaksi Anda dengan pihak ketiga.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
