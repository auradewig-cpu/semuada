import type { SceneOutput } from "./types";
import type { PolicyViolation } from "./policyCheck";

// Ported concept from ViralFrame Studio's autoRephrase.ts -- instead of
// resending the whole result and asking the AI to "fix everything" (our
// existing structural repair loop in jsonParser.ts), this targets ONLY the
// scene/caption that has a flagged phrase and asks for a minimal rewrite,
// keeping everything else byte-identical. Cheaper and less likely to
// introduce new drift than a full regenerate.

function formatViolations(violations: PolicyViolation[]): string {
  return violations.map((v) => `- [${v.field}] "${v.match}" (${v.category}): ${v.suggestion}`).join("\n");
}

export function buildSceneRephrasePrompt(scene: SceneOutput, violations: PolicyViolation[]): string {
  return `
Scene JSON berikut punya frasa yang melanggar kebijakan compliance:
${JSON.stringify(scene)}

PELANGGARAN YANG WAJIB DIPERBAIKI:
${formatViolations(violations)}

ATURAN PERBAIKAN:
- Perbaiki HANYA kalimat/frasa yang disebutkan di pelanggaran, pada field yang disebutkan.
- Field lain dan struktur JSON WAJIB tetap identik persis (termasuk scene_number, duration_seconds, reference_images).
- Jangan ubah makna/isi selain menghilangkan pelanggaran itu sendiri.
- Balas HANYA satu objek JSON scene tunggal yang sudah diperbaiki, struktur sama seperti input. Mulai {, akhiri }. Tidak ada teks lain.
`.trim();
}

export function buildCaptionRephrasePrompt(caption: string, violations: PolicyViolation[]): string {
  return `
Caption berikut punya frasa yang melanggar kebijakan compliance:
"${caption}"

PELANGGARAN YANG WAJIB DIPERBAIKI:
${formatViolations(violations)}

Tulis ulang caption ini, perbaiki HANYA frasa yang melanggar, pertahankan nada dan pesan lain apa adanya. Balas HANYA teks caption baru, tanpa tanda kutip, tanpa hashtag, tanpa teks lain.
`.trim();
}
