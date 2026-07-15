import type { ContentStyleId } from "./types";

interface ContentStyleDefinition {
  id: ContentStyleId;
  label: string;
  cameraInstruction: string;
  toneInstruction: string;
}

export const CONTENT_STYLES: Record<ContentStyleId, ContentStyleDefinition> = {
  vlog: {
    id: "vlog",
    label: "Vlog / Ngeflog",
    cameraInstruction:
      "Kamera handheld phone, sedikit goyang natural, framing tidak selalu simetris, talent bicara langsung ke kamera sambil jalan/beraktivitas.",
    toneInstruction:
      "Nada ngobrol santai seperti cerita ke teman, energik, sesekali jeda natural sebelum poin penting.",
  },
  content_creator: {
    id: "content_creator",
    label: "Content Creator",
    cameraInstruction:
      "Kamera stabil di tripod/gimbal ringan, framing medium shot talent + produk, sesekali cutaway ke detail produk.",
    toneInstruction:
      "Nada persuasif tapi santai, energi tinggi di awal (hook), lebih tenang saat menjelaskan detail produk.",
  },
  faceless_pov: {
    id: "faceless_pov",
    label: "Faceless POV Tangan",
    cameraInstruction:
      "POV tangan saja (tidak ada wajah talent), kamera handheld dari sudut pandang orang pertama, fokus ke interaksi tangan dengan produk.",
    toneInstruction:
      "Voiceover saja (tidak ada talent di frame), narasi tetap natural dan cepat, tidak monoton.",
  },
};

export function getContentStyle(id: ContentStyleId): ContentStyleDefinition {
  return CONTENT_STYLES[id];
}
