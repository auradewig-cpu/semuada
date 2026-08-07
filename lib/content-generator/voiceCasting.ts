import { pickExamples, deriveSeed, VOICE_PERSONA_BANK } from "./exampleBank";
import type { LanguageTone, NarratorVoice } from "./types";

// Turns the user's voice choice into a description the video model can cast
// from. Written in English because it is embedded inside ai_ready_prompt.
//
// Two things are deliberately combined here rather than left to the script
// writer's improvisation:
//
// 1. WHO speaks (gender + rough age), from the user's explicit selection.
// 2. HOW they speak, derived from the selected language tone -- otherwise a
//    "curhat/personal" script and a "heboh/lebay" script get cast with the
//    identical flat delivery, which is a large part of why generated videos
//    all sounded the same regardless of the tone picked.
//
// The native-accent clause is not decoration: Veo 3 frequently renders
// Indonesian with an English accent unless the speaker is described as a
// native one.

const VOICE_DELIVERY_BY_TONE: Record<LanguageTone, string> = {
  formal_netral: "calm, clear, neutral delivery",
  santai_ngobrol: "relaxed conversational delivery, like talking to a close friend",
  gaul_kekinian: "fast, upbeat, casual Gen-Z creator energy",
  elegan_premium: "slow, refined, understated delivery",
  heboh_lebay: "loud, excited, high-energy delivery",
  kocak_receh: "playful, light, faintly amused delivery",
  sotoy_santai: "easygoing knowledgeable delivery, never lecturing",
  curhat_personal: "soft, slow, intimate delivery with natural pauses",
  sarkas_julid: "dry, deadpan, lightly teasing delivery",
  ibu_bapack_relatable: "warm, caring, motherly/fatherly delivery",
};

export function buildVoiceDescriptor(voice: NarratorVoice, tone: LanguageTone, seed: number): string {
  const [persona] = pickExamples(VOICE_PERSONA_BANK[voice], 1, deriveSeed(seed, 8));
  return `${persona}, native Indonesian speaker with a natural Jakarta accent, ${VOICE_DELIVERY_BY_TONE[tone]}`;
}
