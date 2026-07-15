// Ported from ViralFrame Studio's negativePrompt.ts -- field-tested constraints
// that keep character/product appearance identical across scenes and stop AI
// video tools from hallucinating extra objects/broken anatomy. Import from here,
// never copy-paste this text elsewhere.
export const NEGATIVE_PROMPT_BLOCK = `[LOCKED PARAMETERS -- TIDAK BOLEH BERUBAH ANTAR SCENE]
Elemen berikut WAJIB identik persis di semua scene, tidak boleh bervariasi:
- Identitas & deskripsi karakter/tangan
- Bentuk, warna, dan desain produk
- Lokasi/setting dasar
- Arah dan suhu cahaya (lighting direction & color temperature)
- Wardrobe/pakaian karakter
- Color grading keseluruhan

[FLEXIBLE -- BOLEH BERVARIASI NATURAL ANTAR SCENE]
Elemen berikut boleh berubah wajar mengikuti konteks scene:
- Micro-gesture dan gerakan tangan/tubuh kecil
- Sudut kamera minor (angle, framing sedikit berbeda)
- Ekspresi natural yang mengikuti emosi scene
- Framing/komposisi shot

[NEGATIVE PROMPT -- WAJIB TERSIRAT DI SETIAP ai_ready_prompt]
Tulis ai_ready_prompt sedemikian rupa sehingga TIDAK memicu AI video tool menghasilkan:
- Perubahan bentuk/warna/desain produk dari yang sudah ditentukan
- Objek atau orang tambahan yang tidak diminta muncul di frame
- Anatomi tangan/wajah yang rusak/aneh (extra fingers, distorted face)
- Teks acak/tidak terbaca muncul di background
- Perubahan wardrobe atau lighting dari scene sebelumnya
Jaga larangan ini SINGKAT (beberapa kata saja) karena ai_ready_prompt punya batas karakter ketat.`;

export const SPOKEN_NUMBER_RULE = `ANGKA DALAM NARASI WAJIB bentuk ucapan paling natural: "empat setengah miliar" BUKAN "empat koma
lima miliar"; "dua ratus lima puluh lima meter" BUKAN "dua lima lima meter"; HINDARI kata "koma"
dalam menyebut angka kecuali benar-benar tak terhindarkan; harga dibulatkan ke bentuk lisan (mis.
"sembilan ratus ribuan" untuk Rp 949.000 kalau konteksnya santai).`;
