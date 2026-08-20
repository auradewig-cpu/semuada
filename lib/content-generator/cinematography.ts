import { getAiToolSpec } from "./aiTools";
import type { CategoryCreativeBible } from "./categoryCreative";
import type { AiToolId, ContentStyleId, LanguageTone, RealismProfileId } from "./types";

// The craft layer that was entirely missing from the prompt system.
//
// Before this file, nothing anywhere told the model about shot size, lens/depth
// of field, camera-movement verbs, lighting quality, audio design, or the
// single-take constraint -- while several formatTemplate strings *asked* for a
// "[Camera angle + movement]" or "Camera keyword" the prompt never defined.
// The result was generically-described footage: correct subject, amateur
// filmmaking. Everything here is written in English on purpose, because it is
// vocabulary meant to be reused verbatim inside ai_ready_prompt (which is
// mandated English), unlike the Indonesian instruction prose around it.

// Which visual vocabulary a scene should be written in.
//
// These two used to be emitted TOGETHER: the cinematography rule mandated
// film-school moves (dolly in, orbit, rack focus, golden hour) while the
// realism rule simultaneously demanded "looks like it was shot on a phone".
// Veo 3 already skews glossy/commercial by default, so pushing cinematic
// vocabulary on top of it is what made affiliate content come out looking
// like a TV ad -- the exact opposite of the creator-made feel being asked for.
export type VisualDictionary = "ugc" | "cinematic";

// Styles whose premise is "someone filming their own life" override the tone --
// a vlog or storytime shot like a commercial stops reading as either.
const ALWAYS_UGC_STYLES: ContentStyleId[] = ["vlog_daily", "storytime"];

// Only the two deliberately polished registers stay cinematic. Everything else
// is a creator persona and should look self-filmed.
const CINEMATIC_TONES: LanguageTone[] = ["formal_netral", "elegan_premium"];

export function resolveVisualDictionary(tone: LanguageTone, style: ContentStyleId): VisualDictionary {
  if (ALWAYS_UGC_STYLES.includes(style)) return "ugc";
  return CINEMATIC_TONES.includes(tone) ? "cinematic" : "ugc";
}

// The 5-tier realism profile replaces the binary ugc/cinematic as the target.
// Default comes from the category bible; Stage A can override it. The profiles
// are a gradient from "raw phone" to "polished commercial" -- the default is
// premium naturalism (believable human behavior, still well-composed): "not
// looking AI" must never mean "looking bad".
export function resolveRealismProfile(
  tone: LanguageTone,
  style: ContentStyleId,
  defaultProfile: RealismProfileId = "creator_ugc"
): RealismProfileId {
  if (CINEMATIC_TONES.includes(tone)) return defaultProfile === "commercial" ? "commercial" : "lifestyle";
  if (ALWAYS_UGC_STYLES.includes(style)) return defaultProfile === "commercial" ? "premium_ugc" : defaultProfile;
  return defaultProfile;
}

// A short prose line per profile describing the level of production polish
// + the acting/camera note that keeps it believable.
export function buildRealismDescriptor(profile: RealismProfileId): string {
  switch (profile) {
    case "raw_phone":
      return "RAW PHONE: terasa seperti rekaman HP mentah, framing tidak sempurna, pencahayaan apa adanya, gerakan tangan asli, tanpa grading.";
    case "creator_ugc":
      return "CREATOR UGC: terasa buatan creator sendiri (bukan agensi), rapi secukupnya tapi tetap seperti HP, ada satu ketidaksempurnaan kecil yang wajar agar tidak seperti render AI.";
    case "premium_ugc":
      return "PREMIUM UGC: creator yang rapi -- komposisi enak dilihat dan cahaya lumayan tapi tetap manusiawi, akting natural, JANGAN sampai steril seperti iklan studio.";
    case "lifestyle":
      return "LIFESTYLE: komposisi dan pencahayaan terkelola rapi, nuansa hangat editorial, tetapi perilaku manusia tetap believable (bukan model berpose).";
    case "commercial":
      return "COMMERCIAL: hasil akhir rapi/sinematik, tetapi akting dan detail tetap masuk akal -- hindari kesan render AI, sisakan ketidaksempurnaan kecil yang wajar.";
  }
}

// Literal English tokens that must survive into ai_ready_prompt. Veo 3's
// default look is polished; these are the specific phrases documented to pull
// it toward authentic phone footage. Stated as exact strings rather than
// described in Indonesian prose, because the script-writing model was
// previously left to invent its own translation and usually produced something
// weaker ("realistic phone recording") that the video model ignores.
export const UGC_LOOK_TOKENS = "shot on a smartphone, vertical handheld video, natural unpolished look, no color grading";

const UGC_SHOT_SIZES = [
  "close-up (produk memenuhi frame, tangan memegang)",
  "medium close-up (tangan + produk, jarak lengan)",
  "selfie-style medium shot (subjek memegang kamera sendiri)",
  "over-the-shoulder POV (seperti dilihat mata sendiri)",
  "top-down casual (dari atas meja, apa adanya)",
];

const UGC_CAMERA_MOVES = [
  "handheld with slight natural shake (goyang halus seperti dipegang tangan)",
  "quick reframe / adjust grip (menyesuaikan pegangan)",
  "casual tilt down to the product (menunduk ke produk)",
  "static handheld (diam tapi tetap ada micro-movement)",
  "walk-and-talk handheld (sambil jalan)",
];

const UGC_LIGHTING = [
  "natural window light (cahaya jendela apa adanya)",
  "ordinary room lighting (lampu kamar/ruangan biasa)",
  "slightly uneven indoor light (agak tidak merata, natural)",
  "bright daylight through a window (siang, dari jendela)",
];

// The category bible's visual grammar REPLACES the generic menus above -- a
// Handphone video and a Kecantikan video now get genuinely different shot
// sizes/environments/lighting while the prompt size stays flat (the lists
// stay ~5/5/4). The constants above remain as the fallback if a bible ever
// carries empty lists (GENERIC_BIBLE also ships its own copies).
function pickList<T>(bible: CategoryCreativeBible, key: "shotSizes" | "cameraMoves" | "lighting", fallback: T[]): T[] {
  const value = bible.visual[key] as T[];
  return value && value.length > 0 ? value : fallback;
}

// Composed once and injected into all three builders. Deliberately compact:
// the instruction budget is already strained, so this teaches vocabulary
// rather than adding more mandates.
export function buildCinematographyRule(
  aiTool: AiToolId,
  dictionary: VisualDictionary,
  bible: CategoryCreativeBible,
  realismProfile?: RealismProfileId,
  // Set when the Creative Director already fixed the setting. The menu of
  // "lingkungan wajar kategori ini" then has nothing left to decide, and the
  // lighting list can shrink to the two options that read as ordinary room
  // light -- this is the "replace, don't stack" rule from the plan.
  briefEnvironment?: string
): string {
  const spec = getAiToolSpec(aiTool);
  const shotSizes = pickList(bible, "shotSizes", UGC_SHOT_SIZES);
  const cameraMoves = pickList(bible, "cameraMoves", UGC_CAMERA_MOVES);
  const lightingAll = pickList<string>(bible, "lighting", UGC_LIGHTING);
  const lighting = briefEnvironment ? lightingAll.slice(0, 2) : lightingAll;
  const environmentLine = briefEnvironment
    ? ""
    : `\n- Lingkungan wajar kategori ini: ${bible.visual.environments.join("; ")}.`;
  // The generic cinematic ban-list and the bible's own `forbidden` used to be
  // emitted as two separate bullets that overlap heavily. Merged into one, with
  // duplicates dropped, so a category adding "jangan pakai dolly" doesn't get
  // the word "dolly" printed to the model twice.
  const GENERIC_CINEMATIC_BANS = [
    "dolly", "orbit", "arc shot", "rack focus", "golden hour",
    "cinematic lighting", "film look", "color grading",
  ];
  const bibleBans = bible.forbidden.filter(
    (f) => !GENERIC_CINEMATIC_BANS.some((g) => f.toLowerCase().includes(g))
  );
  const banLine = `\n- DILARANG: ${[...GENERIC_CINEMATIC_BANS, ...bibleBans].join("; ")} -- istilah/pola itu membuat hasilnya terasa seperti iklan.`;
  const profileNote = realismProfile ? `\n- PROFIL REALISME: ${buildRealismDescriptor(realismProfile)}` : "";

  // Deliberately phrased as ADDITIVE, not a standalone audio instruction.
  // The earlier wording competed with buildDialogueRule's narrator-audio
  // requirement (voiceover mode) -- being the more concrete/easier of the two
  // instructions, the model satisfied this one and skipped the narrator
  // clause entirely, shipping videos with no narration audio at all.
  const audioRule = usesNativeAudio(aiTool)
    ? `\nAUDIO: ${spec.label} menghasilkan audio bersama videonya. Kalau scene ini bermode voiceover, klausa "Audio: ..." WAJIB berisi narator dulu (lihat instruksi MODE NARASI) -- detail ambience ruangan/foley HANYA boleh ditambahkan SETELAH klausa narator itu, bukan menggantikannya. Kalau tidak ingin ada musik, nyatakan eksplisit "no background music".`
    : "";

  if (dictionary === "ugc") {
    return `KOSAKATA VISUAL: UGC / KONTEN BUATAN CREATOR SENDIRI (BUKAN iklan, BUKAN sinematik).
Video ini harus terlihat seperti direkam sendiri pakai HP, bukan hasil produksi agensi. AI video tool secara default membuat gambar terlalu rapi/mengkilap -- lawan itu secara eksplisit.
- WAJIB sertakan token ini APA ADANYA di "ai_ready_prompt": "${UGC_LOOK_TOKENS}".
${environmentLine ? environmentLine.slice(1) + "\n" : ""}- Shot size (WAJIB sebut satu tiap scene): ${shotSizes.join("; ")}.
- Gerakan kamera (WAJIB sebut satu tiap scene): ${cameraMoves.join("; ")}.
- Pencahayaan (pakai cahaya yang memang ada di ruangan, JANGAN studio lighting): ${lighting.join("; ")}.${banLine}
Variasikan shot size antar scene supaya tidak datar.${profileNote}${audioRule}`;
  }

  return `KOSAKATA SINEMATOGRAFI (pakai istilah-istilah ini di "camera_direction" dan "ai_ready_prompt" -- JANGAN cuma menulis "kamera bagus"/"cinematic" tanpa menyebut teknik konkret):
${environmentLine ? environmentLine.slice(1) + "\n" : ""}- Shot size (WAJIB sebut satu tiap scene): ${shotSizes.join("; ")}.
- Gerakan kamera (WAJIB sebut satu tiap scene): ${cameraMoves.join("; ")}.
- Pencahayaan (WAJIB sebut arah/kualitasnya, bukan cuma "natural"): ${lighting.join("; ")}.
- Depth of field: sebut "shallow depth of field, background softly blurred" kalau produknya kecil/detail, atau "deep focus" kalau konteks lingkungan penting.${bibleBans.length > 0 ? `\n- DILARANG: ${bibleBans.join("; ")}.` : ""}
Variasikan shot size antar scene -- video yang semua scene-nya memakai ukuran shot sama terasa datar dan amatir.${profileNote}${audioRule}`;
}

export function usesNativeAudio(aiTool: AiToolId): boolean {
  // Veo 3 and Google Flow generate synchronized audio natively; the rest are
  // silent-video models where audio direction is wasted prompt budget.
  return aiTool === "veo3" || aiTool === "google_flow";
}

// One ai_ready_prompt = ONE continuous generation on every supported tool.
// Nothing said so before, and the A-roll/B-roll rule actively invited cutaway
// descriptions into the generation prompt -- which produces a morphing single
// take rather than an edit.
export function buildSingleTakeRule(aiTool: AiToolId): string {
  // "no subtitles" is stated as an exact required token rather than described.
  // Veo 3 / Flow burn in their own captions whenever a prompt contains speech,
  // and that collides with text_overlay (which is meant to be added by hand in
  // the editor) -- producing two competing sets of on-screen text. Describing
  // the requirement in Indonesian and hoping the script writer translated it
  // into the right English phrase did not reliably work.
  const subtitleRule = usesNativeAudio(aiTool)
    ? `\n${getAiToolSpec(aiTool).label} otomatis membakar subtitle sendiri kalau ada ucapan di prompt, dan itu bentrok dengan "text_overlay" yang ditempel manual saat editing. Karena itu "ai_ready_prompt" WAJIB memuat token ini APA ADANYA: "no subtitles, no captions, no on-screen text".`
    : `\nJANGAN memicu teks/subtitle terbakar di video: video tool TIDAK boleh menampilkan tulisan apapun di frame. Teks di layar ditambahkan manual saat editing dari field "text_overlay", bukan oleh AI video tool.`;

  return `SATU SCENE = SATU TAKE UTUH: "ai_ready_prompt" menghasilkan satu klip berkelanjutan tanpa potongan. JANGAN menulis pergantian shot, cut, atau "then the camera cuts to..." di dalamnya -- pergantian shot hanya boleh ditulis di "camera_direction" sebagai catatan editing. "ai_ready_prompt" WAJIB memuat frasa ini APA ADANYA: "single continuous shot".${subtitleRule}`;
}
