export type LocalTranslator = {
  translate: (
    text: string,
    options?: { signal?: AbortSignal },
  ) => Promise<string>;
  destroy: () => void;
};
type TranslatorAPI = {
  availability: (options: {
    sourceLanguage: string;
    targetLanguage: string;
  }) => Promise<string>;
  create: (options: {
    sourceLanguage: string;
    targetLanguage: string;
    signal: AbortSignal;
    monitor: (monitor: EventTarget) => void;
  }) => Promise<LocalTranslator>;
};
export function browserTranslator() {
  return (globalThis as unknown as { Translator?: TranslatorAPI }).Translator;
}
export async function localTranslator(
  source: string,
  target: string,
  signal: AbortSignal,
  progress: (message: string) => void,
) {
  const api = browserTranslator();
  if (!api)
    throw Error(
      "On-device translation is unavailable in this browser. Use a supported desktop Chrome browser or select an online service.",
    );
  const options = { sourceLanguage: source, targetLanguage: target };
  const available = await api.availability(options);
  if (available === "unavailable")
    throw Error(
      "This browser does not support this language pair on-device. Select an online service.",
    );
  progress(
    available === "downloadable"
      ? "Downloading browser translation model. First use may take a few minutes…"
      : "Preparing on-device translation…",
  );
  try {
    return await api.create({
      ...options,
      signal: AbortSignal.any([signal, AbortSignal.timeout(180000)]),
      monitor: (monitor) =>
        monitor.addEventListener("downloadprogress", (event) =>
          progress(
            `Downloading browser translation model: ${Math.round((event as Event & { loaded: number }).loaded * 100)}%`,
          ),
        ),
    });
  } catch {
    if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
    throw Error(
      "Browser translation model could not load. Check the connection, retry, or select an online service.",
    );
  }
}
