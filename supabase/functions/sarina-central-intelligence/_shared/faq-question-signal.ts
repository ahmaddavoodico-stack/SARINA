export type FaqSignalLanguage = "fa" | "en" | "ar";
export type FaqSignalRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

/**
 * Conservative in-memory normalization. The returned text is never persisted;
 * only an HMAC fingerprint is sent to the server-side aggregation RPC.
 */
export function normalizeQuestionForFingerprint(question: string, language: FaqSignalLanguage): string {
  return question
    .normalize("NFKC")
    .toLocaleLowerCase(language)
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/giu, " ")
    .replace(/\bhttps?:\/\/\S+/giu, " ")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/giu, " ")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/gu, " ")
    .replace(/\d+(?:[.,/]\d+)*/gu, " ")
    .replace(/[^\p{L}\p{M}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 800);
}

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function buildFaqQuestionFingerprint(
  question: string,
  language: FaqSignalLanguage,
  hmacSecret: string,
): Promise<string | null> {
  const normalized = normalizeQuestionForFingerprint(question, language);
  if (normalized.length < 3 || !hmacSecret) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(hmacSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = new TextEncoder().encode(language + "\n" + normalized);
  return toHex(await crypto.subtle.sign("HMAC", key, payload));
}

export async function recordFaqQuestionSignal(
  client: FaqSignalRpcClient,
  hmacSecret: string,
  input: { question: string; language: FaqSignalLanguage },
): Promise<boolean> {
  const fingerprint = await buildFaqQuestionFingerprint(
    input.question,
    input.language,
    hmacSecret,
  );
  if (!fingerprint) return false;

  try {
    const { error } = await client.rpc("record_sarina_faq_question_signal", {
      p_language_code: input.language,
      p_question_fingerprint: fingerprint,
      p_topic_id: null,
    });
    return !error;
  } catch {
    return false;
  }
}
