import type { ContentGoal, GenerationResult } from "./types";

// Ported from ViralFrame Studio's policyCheck.ts -- a regex-based compliance
// linter mirroring the POLICY COMPLIANCE instructions in the master prompt.
// Runs AFTER generation as a safety net independent of what the AI actually
// followed, since prompt instructions alone aren't reliably obeyed.

export interface PolicyViolation {
  sceneNumber: number | null;
  field: string;
  match: string;
  category: string;
  suggestion: string;
}

interface PolicyRule {
  pattern: RegExp;
  category: string;
  suggestion: string;
}

const GROWTH_MODE_RULES: PolicyRule[] = [
  {
    pattern: /\b(beli(?:lah)?|checkout|check ?out|keranjang|link (?:di )?bio|promo|diskon|harga (?:spesial|khusus)|order sekarang|gratis ongkir|cod|flash sale)\b/gi,
    category: "Bahasa komersial (Mode Growth)",
    suggestion: "Mode Growth melarang bahasa jualan -- ganti dengan ajakan follow/save/share atau hapus.",
  },
];

const POLICY_RULES: PolicyRule[] = [
  {
    pattern: /\b(dijamin|jamin(?:an)? 100%|pasti (?:untung|berhasil|sembuh|naik)|100% (?:aman|berhasil|ampuh|original)|terbaik|nomor (?:1|satu)|no\.? ?1|paling (?:murah|ampuh|efektif|bagus))\b/gi,
    category: "Klaim absolut",
    suggestion: 'Ubah jadi observasi netral, mis. "banyak dipilih konsumen" alih-alih "nomor 1".',
  },
  {
    pattern: /\b(menyembuhkan|sembuh total|obat (?:ampuh|mujarab)|terbukti klinis|tanpa efek samping|anti (?:kanker|diabetes)|menghilangkan (?:kerutan|jerawat|lemak) dalam \d+)\b/gi,
    category: "Klaim medis/kesehatan",
    suggestion: 'Ganti dengan bahasa perawatan netral, mis. "diformulasikan untuk merawat kulit".',
  },
  {
    pattern: /\b(instant result|hasil instan|dalam \d+ (?:hari|minggu) (?:langsung|dijamin|pasti)|meningkatkan \w+ (?:hingga|sampai) \d+%)\b/gi,
    category: "Klaim performa tanpa bukti",
    suggestion: "Hapus janji waktu/angka spesifik, deskripsikan manfaat secara umum.",
  },
  {
    pattern: /\b(saya (?:sudah )?pakai dan langsung|aku coba dan langsung|setelah pakai \w+ (?:langsung|jadi))\b/gi,
    category: "Testimonial fiktif",
    suggestion: "Hindari format kesaksian pribadi; gunakan deskripsi fitur produk.",
  },
  {
    pattern: /\b(guaranteed|100% guaranteed|the best|number one|no\.? ?1|cures?|clinically proven|instant results?)\b/gi,
    category: "Klaim absolut (English)",
    suggestion: "Rewrite ke deskripsi netral -- prompt English juga difilter kebijakan Google.",
  },
];

function scanText(text: string | null | undefined, extraRules: PolicyRule[] = []): { match: string; category: string; suggestion: string }[] {
  if (!text) return [];
  const found: { match: string; category: string; suggestion: string }[] = [];
  for (const rule of [...POLICY_RULES, ...extraRules]) {
    rule.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.pattern.exec(text)) !== null) {
      found.push({ match: m[0], category: rule.category, suggestion: rule.suggestion });
    }
  }
  return found;
}

export function checkPolicyCompliance(result: GenerationResult, contentGoal: ContentGoal = "conversion"): PolicyViolation[] {
  const violations: PolicyViolation[] = [];
  const extraRules = contentGoal === "growth" ? GROWTH_MODE_RULES : [];

  for (const scene of result.scenes) {
    const fields: [string, string | null | undefined][] = [
      ["script_narration", scene.script_narration],
      ["ai_ready_prompt", scene.ai_ready_prompt],
    ];
    for (const [field, text] of fields) {
      for (const hit of scanText(text, extraRules)) {
        violations.push({ sceneNumber: scene.scene_number, field, ...hit });
      }
    }
  }

  for (const hit of scanText(result.caption, extraRules)) {
    violations.push({ sceneNumber: null, field: "caption", ...hit });
  }

  return violations;
}

export function formatPolicyViolations(violations: PolicyViolation[]): string[] {
  return violations.map((v) => {
    const loc = v.sceneNumber !== null ? `Scene ${v.sceneNumber} (${v.field})` : v.field;
    return `POLICY [${v.category}] ${loc}: "${v.match}" -- ${v.suggestion}`;
  });
}
