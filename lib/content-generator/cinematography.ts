import { getAiToolSpec } from "./aiTools";
import type { AiToolId, ContentStyleId, LanguageTone } from "./types";

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

const SHOT_SIZES = [
  "extreme close-up (detail tekstur produk)",
  "close-up (produk memenuhi frame)",
  "medium close-up (tangan + produk)",
  "medium shot (subjek dari pinggang ke atas)",
  "wide shot (subjek + lingkungan)",
  "over-the-shoulder (POV dari belakang bahu)",
  "top-down / flat-lay (dari atas)",
];

const CAMERA_MOVES = [
  "static locked-off shot (kamera diam total)",
  "slow push in / dolly in (mendekat perlahan)",
  "pull out / dolly out (menjauh)",
  "orbit / arc around subject (memutari subjek)",
  "handheld follow (mengikuti, sedikit goyang natural)",
  "tilt up / tilt down",
  "pan left / pan right",
  "rack focus (fokus berpindah antar objek)",
];

const LIGHTING_TERMS = [
  "soft natural window light (cahaya jendela, lembut)",
  "warm indoor practical light (lampu ruangan, hangat)",
  "overcast diffused daylight (mendung, merata)",
  "golden hour side light (sore, dari samping)",
  "bright even daylight (siang, merata)",
];

// Composed once and injected into all three builders. Deliberately compact:
// the instruction budget is already strained, so this teaches vocabulary
// rather than adding more mandates.
export function buildCinematographyRule(aiTool: AiToolId, dictionary: VisualDictionary): string {
  const spec = getAiToolSpec(aiTool);

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
- Shot size (WAJIB sebut satu tiap scene): ${UGC_SHOT_SIZES.join("; ")}.
- Gerakan kamera (WAJIB sebut satu tiap scene): ${UGC_CAMERA_MOVES.join("; ")}.
- Pencahayaan (pakai cahaya yang memang ada di ruangan, JANGAN studio lighting): ${UGC_LIGHTING.join("; ")}.
- DILARANG memakai istilah sinematik: dolly, orbit, arc shot, rack focus, golden hour, cinematic lighting, film look, color grading. Istilah-istilah itu justru membuat hasilnya terasa seperti iklan.
Variasikan shot size antar scene supaya tidak datar.${audioRule}`;
  }

  return `KOSAKATA SINEMATOGRAFI (pakai istilah-istilah ini di "camera_direction" dan "ai_ready_prompt" -- JANGAN cuma menulis "kamera bagus"/"cinematic" tanpa menyebut teknik konkret):
- Shot size (WAJIB sebut satu tiap scene): ${SHOT_SIZES.join("; ")}.
- Gerakan kamera (WAJIB sebut satu tiap scene): ${CAMERA_MOVES.join("; ")}.
- Pencahayaan (WAJIB sebut arah/kualitasnya, bukan cuma "natural"): ${LIGHTING_TERMS.join("; ")}.
- Depth of field: sebut "shallow depth of field, background softly blurred" kalau produknya kecil/detail, atau "deep focus" kalau konteks lingkungan penting.
Variasikan shot size antar scene -- video yang semua scene-nya memakai ukuran shot sama terasa datar dan amatir.${audioRule}`;
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
