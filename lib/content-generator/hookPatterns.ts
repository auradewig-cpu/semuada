export const HOOK_PATTERNS: string[] = [
  "Pattern interrupt: mulai dengan aksi tak terduga di 1-2 detik pertama sebelum bicara.",
  "Jangan beli [kategori produk] sebelum nonton ini sampai habis.",
  "POV twist: buka dengan asumsi yang salah, lalu dibantah begitu produk muncul.",
  "Tanya retoris yang relate ke masalah sehari-hari, baru perkenalkan produk sebagai solusi.",
  "Reaksi jujur/kaget di detik pertama sebelum menjelaskan kenapa.",
];

export function pickHookPattern(seed: number): string {
  const index = ((seed % HOOK_PATTERNS.length) + HOOK_PATTERNS.length) % HOOK_PATTERNS.length;
  return HOOK_PATTERNS[index];
}
