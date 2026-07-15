import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Cara Berbelanja - Daftar Product",
  description: "Panduan langkah demi langkah berbelanja melalui Daftar Product.",
};

export default function HowToShopPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Cara Berbelanja</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p>
              Selamat datang di Daftar Product! Kami memudahkan Anda menemukan produk-produk terbaik dari berbagai platform e-commerce. Berikut adalah langkah-langkah sederhana untuk berbelanja melalui website kami:
            </p>
            <ol>
              <li>
                <strong>Cari & Temukan Produk:</strong> Gunakan fitur pencarian atau filter untuk menemukan produk yang Anda inginkan. Jelajahi kategori produk terbaru dan produk unggulan kami.
              </li>
              <li>
                <strong>Lihat Detail Produk:</strong> Klik pada kartu produk untuk melihat detail seperti nama, harga, dan rating.
              </li>
              <li>
                <strong>Kunjungi Halaman Penjual:</strong> Klik tombol <strong>"Lihat Produk"</strong>. Anda akan secara otomatis diarahkan ke halaman produk di platform partner kami (seperti Shopee, Tokopedia, dll).
              </li>
              <li>
                <strong>Selesaikan Pembelian:</strong> Lakukan proses pemesanan, pembayaran, dan konfirmasi langsung di platform partner tersebut. Semua transaksi aman dan ditangani oleh sistem mereka.
              </li>
            </ol>
            <p>Sangat mudah, bukan? Selamat berbelanja!</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
