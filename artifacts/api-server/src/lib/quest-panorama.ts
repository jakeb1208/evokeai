export const QUEST_PANORAMA_QUALITY = "quest_centered";
export const MAX_QUEST_PANORAMA_BYTES = 8 * 1024 * 1024;

export function isQuestPanorama(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null &&
    "quality" in value && value.quality === QUEST_PANORAMA_QUALITY;
}

/** Inspect JPEG structure, not a client-supplied MIME type or dimensions. */
export function validateQuestJpeg(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || bytes.length > MAX_QUEST_PANORAMA_BYTES ||
      bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
      bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return false;
  let offset = 2;
  let correctFrame = false;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 0xff) return false;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return false;
    if (marker === 0xda) {
      return correctFrame && length >= 6 && offset + length < bytes.length - 2;
    }
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (length < 8) return false;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (width !== 4096 || height !== 2048) return false;
      correctFrame = true;
    }
    offset += length;
  }
  return false;
}
