# Scraper produk Shopee -> CSV import SEMUADA

Script ini menggantikan `main.exe` lama (source code-nya sudah hilang). Baca
CSV affiliate hasil download dari dashboard Shopee, buka tiap "Link Produk"
pakai Chrome (via `undetected-chromedriver` biar tidak kena deteksi bot),
scrape detail produknya, lalu tulis CSV yang formatnya sudah cocok untuk
tombol **Import** di admin dashboard SEMUADA (`/admin/dashboard` > tab
Products > Import).

## Install (sekali saja)

```
cd scraper
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

Chrome harus sudah terinstall di komputer (undetected-chromedriver memakai
Chrome yang ada, bukan browser bawaan sendiri).

## Cara pakai Panel (direkomendasikan)

Panel kontrol web lokal -- tombol Siapkan Browser / Mulai Scrape / Pause /
Stop, dan hasil scraping **langsung masuk ke database** situs (skip proses
CSV/Import manual sepenuhnya).

```
python panel_app.py
```

Buka `http://localhost:5000` di browser. Panel ini **cuma bisa diakses dari
komputer ini sendiri** (`127.0.0.1`), tidak bisa dibuka dari HP/komputer lain.

Langkah di panel:
1. Isi **Base URL** situs (misal `https://semuada.vercel.app`), username &
   password admin -- ini dipakai untuk login ke API situs, disimpan hanya di
   memori selama panel jalan (tidak pernah ditulis ke file).
2. Upload CSV affiliate Shopee. Panel otomatis mendeteksi kolom "Link
   Produk"; kalau tidak ketemu (nama kolom beda), pilih manual dari dropdown.
3. Klik **Siapkan Browser** -- Chrome terbuka, login manual ke akun Shopee
   di jendela itu (cuma perlu sekali, sesi tersimpan di `chrome_profile/`).
4. Klik **Mulai Scrape**. Progress, jumlah sukses/gagal, dan log berjalan
   real-time di panel.
5. **Pause** untuk jeda sementara (browser tetap terbuka, lanjut kapan saja
   dengan klik lagi), **Stop** untuk berhenti total setelah produk yang
   sedang diproses selesai.

Produk yang `ID Produk`-nya sudah ada di database otomatis dilewati -- jadi
aman upload CSV yang sama berkali-kali atau lanjut habis di-Stop.

## Menjalankan lewat command line (alternatif/lanjutan)

```
python scrape.py "G:\Viral Frame Konten\Shopee\...\Produk A.csv" "output\Produk A - hasil scrape.csv"
```

- Argumen 1: path CSV affiliate asli dari Shopee (harus punya kolom `ID Produk`,
  `Nama Produk`, `Nama Toko`, `Komisi`, `Link Produk`, `Link Komisi Ekstra`).
- Argumen 2: path file CSV output yang akan dibuat/ditambah datanya.

Browser Chrome akan terbuka otomatis (sengaja tidak headless, supaya lebih
sulit dideteksi Shopee sebagai bot). Sesi login Shopee kamu tersimpan di
`chrome_profile/`, jadi cuma perlu login manual sekali saja (run berikutnya
otomatis tetap login).

**Mode manusiawi**: tiap pindah produk, script menunggu jeda acak 25-32
detik (bukan buru-buru), dan di tiap halaman melakukan scroll pelan-pelan
beberapa kali sebelum mengambil data -- meniru pola orang baca produk
sungguhan, sekaligus memicu gambar/harga yang lazy-load supaya sempat
ke-render sebelum di-scrape.

Karena jeda ini sengaja lambat, **137 produk butuh waktu sekitar 1-1.5 jam**.
Biarkan berjalan di background; kalau berhenti di tengah jalan tinggal
jalankan command yang sama lagi (lihat bagian "Kalau berhenti di tengah
jalan" di bawah).

## Kalau berhenti di tengah jalan

Tinggal jalankan command yang **sama persis** lagi. Baris yang `ID Produk`-nya
sudah ada di file output otomatis dilewati, jadi tidak scraping ulang dari
nol.

## Kalau Shopee memblokir (yang paling sering terjadi)

Cek dulu ke sini sebelum menyalahkan selector. Shopee membalas dengan **empat
halaman berbeda**, dan scraper sekarang mengenali keempatnya lalu bereaksi
sendiri:

| Yang muncul di panel | Artinya | Yang dilakukan scraper |
|---|---|---|
| `Diblokir (verifikasi)` | Shopee minta verifikasi captcha | **Berhenti dan menunggu Anda**: selesaikan verifikasinya di jendela Chrome, lalu klik **Lanjutkan** di panel |
| `Diblokir (halaman_tidak_tersedia)` | Penolakan server | Istirahat 10 menit, naik 2× tiap blokir beruntun (maks 30 menit) |
| `Diblokir (halaman_cangkang)` | Halaman terbuka tapi isi produk kosong | Istirahat 3 menit, eskalasi sama |
| `Diblokir (error_sementara)` | Shopee sendiri bilang "Coba Lagi" | Ulangi langsung, maksimal 2× |

Produk yang diblokir **tidak dibuang**: di akhir run scraper mengulanginya
sampai 2 lintasan tambahan. Blokirnya terbukti sementara — produk yang sama
sering berhasil di percobaan berikutnya.

Produk yang diblokir juga **tidak pernah masuk database**, jadi tidak ada
risiko baris kosong/berantakan dari halaman blokir.

Setiap percobaan dicatat di `scraper/scrape_log.csv` (waktu, produk, hasil,
durasi) dan log panel disimpan di `scraper/logs/`. Kalau run berhenti lebih
cepat dari biasanya, dua file itu jawabannya — bukan tebakan.

## Kalau hasilnya kosong / salah (Shopee ganti tampilan)

Ini baru relevan kalau dump di `scraper/debug/` bernama `selector_*`. Nama
`diblokir_*` berarti masalahnya blokir, bukan tampilan — lihat bagian di atas.


Selector CSS yang dipakai ada di `shopee_selectors.py` (satu file terpisah biar
gampang diupdate). Kalau Shopee redesign halaman produk mereka, biasanya
cuma perlu update nama class di file itu:

1. Buka halaman produk Shopee di Chrome biasa, klik kanan elemen yang mau
   diambil (harga/gambar/rating) > **Inspect**.
2. Lihat nama class-nya, update konstanta yang sesuai di `shopee_selectors.py`.
3. Field yang tidak pakai CSS class (jumlah terjual, jumlah penilaian,
   dikirim dari) dicari lewat teks di sekitarnya, jadi biasanya lebih tahan
   terhadap perubahan tampilan -- tapi kalau labelnya sendiri berubah
   (misalnya "Terjual" jadi kata lain), update juga pattern regex terkait
   di `shopee_selectors.py`.

## Setelah scraping selesai

1. Buka file CSV output, cek sekilas beberapa baris (harga/kategori/gambar
   masuk akal, tidak kosong semua).
2. Login admin (`/admin/login`), masuk tab **Products**, klik **Import**,
   pilih file CSV output ini.
3. Cek di homepage: produk baru muncul, tombol "Lihat Produk" mengarah ke
   link affiliate (`Link Komisi Ekstra`), bukan ke `shopee.co.id` langsung.

## Field yang TIDAK diisi otomatis

- `video_url`, `original_price`, `featured_order` dikosongkan -- isi manual
  lewat form Edit Produk di admin kalau perlu.
- `is_featured` selalu `false` -- atur produk unggulan manual dari admin.
