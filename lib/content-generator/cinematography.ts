import { getAiToolSpec } from "./aiTools";
import type { AiToolId } from "./types";

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
export function buildCinematographyRule(aiTool: AiToolId): string {
  const spec = getAiToolSpec(aiTool);

  const audioRule = usesNativeAudio(aiTool)
    ? `\nAUDIO: ${spec.label} menghasilkan audio bersama videonya. Sebutkan singkat suasana audionya di "ai_ready_prompt" -- ambience ruangan, dan bunyi natural saat produk dipegang/dibuka/dipakai (foley). Kalau tidak ingin ada musik, nyatakan eksplisit "no background music".`
    : "";

  return `KOSAKATA SINEMATOGRAFI (pakai istilah-istilah ini di "camera_direction" dan "ai_ready_prompt" -- JANGAN cuma menulis "kamera bagus"/"cinematic" tanpa menyebut teknik konkret):
- Shot size (WAJIB sebut satu tiap scene): ${SHOT_SIZES.join("; ")}.
- Gerakan kamera (WAJIB sebut satu tiap scene): ${CAMERA_MOVES.join("; ")}.
- Pencahayaan (WAJIB sebut arah/kualitasnya, bukan cuma "natural"): ${LIGHTING_TERMS.join("; ")}.
- Depth of field: sebut "shallow depth of field, background softly blurred" kalau produknya kecil/detail, atau "deep focus" kalau konteks lingkungan penting.
Variasikan shot size antar scene -- video yang semua scene-nya memakai ukuran shot sama terasa datar dan amatir.${audioRule}`;
}

function usesNativeAudio(aiTool: AiToolId): boolean {
  // Veo 3 and Google Flow generate synchronized audio natively; the rest are
  // silent-video models where audio direction is wasted prompt budget.
  return aiTool === "veo3" || aiTool === "google_flow";
}

// One ai_ready_prompt = ONE continuous generation on every supported tool.
// Nothing said so before, and the A-roll/B-roll rule actively invited cutaway
// descriptions into the generation prompt -- which produces a morphing single
// take rather than an edit.
export function buildSingleTakeRule(): string {
  return `SATU SCENE = SATU TAKE UTUH: "ai_ready_prompt" menghasilkan satu klip berkelanjutan tanpa potongan. JANGAN menulis pergantian shot, cut, atau "then the camera cuts to..." di dalamnya -- pergantian shot hanya boleh ditulis di "camera_direction" sebagai catatan editing. Sebutkan secara eksplisit bahwa ini satu shot berkelanjutan (mis. "single continuous shot").
JANGAN memicu teks/subtitle terbakar di video: video tool TIDAK boleh menampilkan tulisan apapun di frame. Teks di layar ditambahkan manual saat editing dari field "text_overlay", bukan oleh AI video tool.`;
}
