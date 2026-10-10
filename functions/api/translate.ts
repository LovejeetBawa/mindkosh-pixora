const languages = new Set([
  "en",
  "hi",
  "pa",
  "ur",
  "bn",
  "ta",
  "te",
  "mr",
  "gu",
  "kn",
  "ml",
  "ar",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "ru",
  "ja",
  "ko",
  "zh-CN",
]);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
export async function onRequestPost({ request }: { request: Request }) {
  try {
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin)
      return json({ error: "Use translation from this website." }, 403);
    if (Number(request.headers.get("Content-Length") || 0) > 4096)
      return json({ error: "Request too large." }, 413);
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: "Request too large." }, 413);
    const { text, source, target } = JSON.parse(raw);
    if (
      typeof text !== "string" ||
      !text.trim() ||
      new TextEncoder().encode(text).length > 450 ||
      !languages.has(source) ||
      !languages.has(target) ||
      source === target
    )
      return json(
        {
          error:
            "Use up to 450 UTF-8 bytes and two different supported languages.",
        },
        400,
      );
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", `${source}|${target}`);
    const upstream = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!upstream.ok)
      return json(
        { error: "Free translation service is temporarily unavailable." },
        502,
      );
    const data = (await upstream.json()) as {
      responseStatus?: number;
      responseDetails?: string;
      quotaFinished?: boolean;
      responseData?: { translatedText?: string };
    };
    if (Number(data.responseStatus) !== 200 || data.quotaFinished)
      return json(
        {
          error:
            data.responseDetails || "Free translation daily quota reached.",
        },
        429,
      );
    if (typeof data.responseData?.translatedText !== "string")
      return json({ error: "No translation returned." }, 502);
    return json({ text: data.responseData.translatedText });
  } catch {
    return json(
      {
        error: "Translation could not finish. Check the connection and retry.",
      },
      502,
    );
  }
}
