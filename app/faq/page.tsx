import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = {
  title: "FAQ - Daftar Product",
  description: "Pertanyaan yang sering diajukan seputar Daftar Product.",
};

const faqs = [
  {
    question: "Bagaimana cara memesan produk?",
    answer: "Anda dapat memesan produk dengan mengklik tombol 'Lihat Produk' yang akan mengarahkan Anda ke halaman afiliasi kami. Semua transaksi, pembayaran, dan pengiriman akan diproses oleh platform partner tersebut."
  },
  {
    question: "Apakah produk yang dijual di sini asli?",
    answer: "Website ini berfungsi sebagai direktori produk afiliasi. Kami memilih produk dari penjual dan platform terpercaya. Namun, kami sangat menyarankan Anda untuk selalu memeriksa ulasan dan reputasi penjual di halaman produk sebelum melakukan pembelian."
  },
  {
    question: "Bagaimana cara melacak pesanan saya?",
    answer: "Pelacakan pesanan dapat dilakukan melalui platform e-commerce tempat Anda menyelesaikan pembelian (misalnya Shopee, Tokopedia, dll.). Silakan periksa email konfirmasi pesanan atau akun Anda di platform tersebut untuk mendapatkan detail pelacakan."
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container mx-auto px-4">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">Frequently Asked Questions (FAQ)</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem value={`item-${index}`} key={index}>
                  <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
