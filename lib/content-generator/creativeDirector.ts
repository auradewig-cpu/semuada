import type {
  ContentGoal,
  ContentStyleId,
  CtaTypeId,
  HookArchetype,
  LanguageTone,
  MechanismId,
  RealismProfileId,
} from "./types";
import { GROWTH_ALLOWED_CTAS } from "./types";
import type { CategoryCreativeBible } from "./categoryCreative";
import { pickWeighted } from "./rotation";
import type { UsageCounts } from "./rotation";

// Creative Director (Stage A): a small, cheap, text-only call that decides the
// creative direction BEFORE the heavy Stage B prompt is compiled. Output is a
// strict JSON brief. If it fails or can't be parsed, the caller falls back to
// pure rotation (resolveAutoChoices) -- generate must never fail because Stage A
// did.

export const ALL_STYLES: ContentStyleId[] = [
  "direct_response",
  "vlog_daily",
  "tutorial_howto",
  "storytime",
  "listicle_countdown",
  "before_after",
  "pattern_break_twist",
  "series_episodic",
];
export const ALL_HOOKS: HookArchetype[] = [
  "unpopular_opinion",
  "pov_realism",
  "specific_outcome",
  "curiosity_gap",
  "relatable",
  "emotional",
  "mistake_warning",
];
export const ALL_CTAS: CtaTypeId[] = [
  "link_bio",
  "dm_whatsapp",
  "comment_keyword",
  "follow_more",
  "share_tag_friend",
  "visit_website",
  "limited_urgency",
  "save_for_later",
  "klik_keranjang_kuning",
];
export const ALL_TONES: LanguageTone[] = [
  "formal_netral",
  "santai_ngobrol",
  "gaul_kekinian",
  "elegan_premium",
  "heboh_lebay",
  "kocak_receh",
  "sotoy_santai",
  "curhat_personal",
  "sarkas_julid",
  "ibu_bapack_relatable",
];
export const ALL_REALISM: RealismProfileId[] = ["raw_phone", "creator_ugc", "premium_ugc", "lifestyle", "commercial"];

export interface CreativeBriefScene {
  scene_number: number;
  beat: string;
  primary_action: string;
}

export interface CreativeBrief {
  mechanism: MechanismId;
  style: ContentStyleId;
  hook_archetype: HookArchetype;
  cta_type: CtaTypeId;
  language_tone: LanguageTone;
  realism_profile: RealismProfileId;
  environment: string;
  reasoning: string;
  scene_plan: CreativeBriefScene[];
}

export interface BriefInput {
  productName: string;
  category: string;
  subcategory?: string | null;
  facts: string;
  bible: CategoryCreativeBible;
  contentGoal: ContentGoal;
  avoidRepetitionBlock: string;
  sceneDurations: number[];
}

export function compileCreativeBriefPrompt(input: BriefInput): string {
  const mechanismMenu = input.bible.mechanisms
    .map((m) => `- ${m.id}: ${m.label} (alur: ${m.storyBeats.join(" -> ")})`)
    .join("\n");
  const ctaMenu = input.contentGoal === "growth" ? GROWTH_ALLOWED_CTAS.join(", ") : ALL_CTAS.join(", ");
  const envs = input.bible.visual.environments.join("; ");

  return `Kamu adalah creative director video affiliate. Pilih satu KONSEP kreatif untuk video produk di bawah, dan keluarkan HANYA JSON.

PRODUK: ${input.productName} (${input.category}${input.subcategory ? ` / ${input.subcategory}` : ""})
FAKTA (yang boleh disebut, JANGAN mengarang yang lain): ${input.facts}
PENONTON: ${input.bible.audience.who}. Alasan beli: ${input.bible.audience.buyingMotivation}. Masalah: ${input.bible.audience.painPoints.join(", ")}.
TUJUAN KONTEN: ${input.contentGoal}.
LINGKUNGAN YANG MASUK AKAL: ${envs}.
Jumlah scene: ${input.sceneDurations.length} (durasi: ${input.sceneDurations.join("s, ")}s).${input.avoidRepetitionBlock ? `\n${input.avoidRepetitionBlock}` : ""}

Pilih:
- mechanism (dari daftar ini, atau buat id singkat yang masuk akal jika tidak ada yang cocok):
${mechanismMenu}
- style (satu dari): ${ALL_STYLES.join(", ")}
- hook_archetype (satu dari): ${ALL_HOOKS.join(", ")}
- cta_type (satu dari): ${ctaMenu}
- language_tone (satu dari): ${ALL_TONES.join(", ")}
- realism_profile (satu dari): ${ALL_REALISM.join(", ")}
- environment (satu kalimat pendek lingkungan yang wajar)
- scene_plan: untuk tiap scene, satu "beat" (alur singkat) dan satu "primary_action" (satu klausa aksi dominan, TANPA "lalu"/"sambil"/"kemudian").

JANGAN mengarang klaim spesifikasi/performa tanpa data. Keluarkan HANYA JSON dengan bentuk persis:
{
  "mechanism": string,
  "style": string,
  "hook_archetype": string,
  "cta_type": string,
  "language_tone": string,
  "realism_profile": string,
  "environment": string,
  "reasoning": "<satu kalimat kenapa konsep ini dipilih>",
  "scene_plan": [
    { "scene_number": 1, "beat": "...", "primary_action": "..." }
  ]
}`;
}

export function parseCreativeBrief(text: string): CreativeBrief | null {
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== "object") return null;
    const rawPlan: unknown[] = Array.isArray(obj.scene_plan) ? obj.scene_plan : [];
    const scenePlan = rawPlan
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        scene_number: Number(s.scene_number ?? 0),
        beat: typeof s.beat === "string" ? s.beat : "",
        primary_action: typeof s.primary_action === "string" ? s.primary_action : "",
      }));
    return {
      mechanism: typeof obj.mechanism === "string" ? obj.mechanism : "",
      style: obj.style,
      hook_archetype: obj.hook_archetype,
      cta_type: obj.cta_type,
      language_tone: obj.language_tone,
      realism_profile: obj.realism_profile,
      environment: typeof obj.environment === "string" ? obj.environment : "",
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
      scene_plan: scenePlan,
    };
  } catch {
    return null;
  }
}

function isValidId<T extends string>(v: unknown, allowed: readonly T[]): v is T {
  return typeof v === "string" && (allowed as readonly string[]).includes(v);
}

// Coerce any invalid/untrusted value in a parsed brief back to a safe rotation
// pick (never fail the request over a bad field). Mechanism must exist in the
// bible, or falls back to a bible mechanism.
export function validateCreativeBrief(brief: CreativeBrief, bible: CategoryCreativeBible, contentGoal: ContentGoal, seed: number): CreativeBrief {
  const mechanismIds = bible.mechanisms.map((m) => m.id);
  const ctaMenu = contentGoal === "growth" ? GROWTH_ALLOWED_CTAS : ALL_CTAS;

  const coerced: CreativeBrief = {
    ...brief,
    style: isValidId(brief.style, ALL_STYLES) ? brief.style : (pickWeighted(ALL_STYLES, {}, seed + 1) as ContentStyleId),
    hook_archetype: isValidId(brief.hook_archetype, ALL_HOOKS) ? brief.hook_archetype : (pickWeighted(ALL_HOOKS, {}, seed + 2) as HookArchetype),
    cta_type: isValidId(brief.cta_type, ctaMenu) ? brief.cta_type : (pickWeighted(ctaMenu, {}, seed + 3) as CtaTypeId),
    language_tone: isValidId(brief.language_tone, ALL_TONES) ? brief.language_tone : (pickWeighted(ALL_TONES, {}, seed + 4) as LanguageTone),
    realism_profile: isValidId(brief.realism_profile, ALL_REALISM) ? brief.realism_profile : bible.defaultRealism,
    mechanism: mechanismIds.includes(brief.mechanism) ? brief.mechanism : pickWeighted(mechanismIds.length ? mechanismIds : ["default"], {}, seed + 5),
  };
  return coerced;
}

// The auto-resolution fallback when Stage A fails entirely -- pure rotation.
export interface AutoChoices {
  mechanism: MechanismId;
  style: ContentStyleId;
  hook_archetype: HookArchetype;
  cta_type: CtaTypeId;
  language_tone: LanguageTone;
  realism_profile: RealismProfileId;
}

export interface CreativeUsage {
  styles: UsageCounts;
  hooks: UsageCounts;
  ctaTypes: UsageCounts;
  tones: UsageCounts;
  mechanisms: UsageCounts;
}

export function resolveAutoChoices(
  bible: CategoryCreativeBible,
  contentGoal: ContentGoal,
  usage: CreativeUsage,
  seed: number
): AutoChoices {
  const ctaMenu = contentGoal === "growth" ? GROWTH_ALLOWED_CTAS : ALL_CTAS;
  const mechanismIds = bible.mechanisms.map((m) => m.id);
  return {
    style: pickWeighted(ALL_STYLES, usage.styles, seed) as ContentStyleId,
    hook_archetype: pickWeighted(ALL_HOOKS, usage.hooks, seed + 7) as HookArchetype,
    cta_type: pickWeighted(ctaMenu, usage.ctaTypes, seed + 13) as CtaTypeId,
    language_tone: pickWeighted(ALL_TONES, usage.tones, seed + 17) as LanguageTone,
    realism_profile: bible.defaultRealism,
    mechanism: pickWeighted(mechanismIds.length ? mechanismIds : ["default"], usage.mechanisms, seed + 23),
  };
}
