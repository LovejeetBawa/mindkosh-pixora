export const languages: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  pa: "Punjabi",
  ur: "Urdu",
  bn: "Bengali",
  ta: "Tamil",
  te: "Telugu",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  ar: "Arabic",
  fr: "French",
  de: "German",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Chinese",
};
export function splitTranslation(text: string, maxBytes = 450) {
  if (maxBytes < 4) throw Error("Chunk size too small.");
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let remaining = text;
  while (remaining) {
    let length = 0,
      bytes = 0,
      lastSpace = 0;
    for (const ch of remaining) {
      const size = encoder.encode(ch).length;
      if (bytes + size > maxBytes) break;
      bytes += size;
      length += ch.length;
      if (/\s/.test(ch)) lastSpace = length;
    }
    if (length < remaining.length && lastSpace > length / 2) length = lastSpace;
    if (!length) throw Error("Could not split text.");
    chunks.push(remaining.slice(0, length));
    remaining = remaining.slice(length);
  }
  return chunks;
}
export function readTranslation(data: {
  responseStatus?: number | string;
  responseDetails?: string;
  quotaFinished?: boolean;
  responseData?: { translatedText?: string };
}) {
  if (Number(data.responseStatus) !== 200 || data.quotaFinished)
    throw Error(
      data.responseDetails ||
        "Free translation quota is unavailable. Try again later.",
    );
  const text = data.responseData?.translatedText;
  if (typeof text !== "string")
    throw Error("Translation service returned no result.");
  return text;
}

export function readGoogleTranslation(data: unknown) {
  if (!Array.isArray(data) || !Array.isArray(data[0]))
    throw Error("Google returned no translation.");
  const text = data[0]
    .map((segment: unknown) =>
      Array.isArray(segment) && typeof segment[0] === "string"
        ? segment[0]
        : "",
    )
    .join("");
  if (!text) throw Error("Google returned no translation.");
  return text;
}
