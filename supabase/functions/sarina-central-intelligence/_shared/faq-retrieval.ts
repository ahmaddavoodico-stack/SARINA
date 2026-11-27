export type FaqLanguage = "fa" | "en" | "ar";
export type FaqCandidate = {
  faq_entry_id: string;
  faq_version_id: string;
  topic_slug: string;
  language_code: FaqLanguage;
  risk_level: "low" | "medium" | "high" | "critical";
  answer_mode: "auto_answer" | "answer_with_caution" | "must_escalate";
  confidence: number;
  retrieval_score: number;
};
export type FaqRetrievalResult = {
  status: "matched" | "no_match" | "unavailable";
  candidates: FaqCandidate[];
};
export type FaqRpcClient = {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCandidate(value: unknown): value is FaqCandidate {
  if (!isRecord(value)) return false;
  const risk = value.risk_level;
  const mode = value.answer_mode;
  const language = value.language_code;
  const highRisk = risk === "high" || risk === "critical";
  return typeof value.faq_entry_id === "string" && UUID.test(value.faq_entry_id) &&
    typeof value.faq_version_id === "string" && UUID.test(value.faq_version_id) &&
    typeof value.topic_slug === "string" &&
    (language === "fa" || language === "en" || language === "ar") &&
    (risk === "low" || risk === "medium" || risk === "high" || risk === "critical") &&
    (mode === "auto_answer" || mode === "answer_with_caution" || mode === "must_escalate") &&
    (!highRisk || mode === "must_escalate") &&
    typeof value.confidence === "number" && Number.isFinite(value.confidence) &&
    value.confidence >= 0 && value.confidence <= 1 &&
    typeof value.retrieval_score === "number" && Number.isFinite(value.retrieval_score) &&
    value.retrieval_score >= 0;
}

export async function retrieveFaqCandidates(
  client: FaqRpcClient,
  input: { question: string; language: FaqLanguage },
): Promise<FaqRetrievalResult> {
  const query = input.question.trim().slice(0, 1000);
  if (query.length < 2) return { status: "no_match", candidates: [] };

  try {
    const { data, error } = await client.rpc("search_sarina_faq", {
      p_query: query,
      p_language_code: input.language,
      p_fallback_language_code: input.language === "en" ? null : "en",
      p_topic_slug: null,
      p_limit: 5,
      // Until farm/crop/region scope is explicitly assembled, only global
      // answers are eligible. Never guess an applicability scope.
      p_scope_type: "global",
      p_scope_key: null,
    });
    if (error || !Array.isArray(data)) {
      return { status: "unavailable", candidates: [] };
    }
    const candidates = data.filter(isCandidate);
    if (data.length > 0 && candidates.length === 0) {
      return { status: "unavailable", candidates: [] };
    }
    return {
      status: candidates.length > 0 ? "matched" : "no_match",
      candidates,
    };
  } catch {
    // Missing migration, RPC outage or transient network failure must not
    // block the ordinary SCI path.
    return { status: "unavailable", candidates: [] };
  }
}
