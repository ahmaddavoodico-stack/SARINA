# SARINA FAQ & Reusable Answer Knowledge Layer V1

**Status:** Implementation specification aligned to the SAI governance model  
**Target branch:** \`feat/farmer-map-conversation-v1-mainline\`  
**Purpose:** Reuse reviewed, relatively stable answers without turning private conversations or unverified AI output into public knowledge.

## 1. Reuse the existing conversation foundation

SARINA already has \`ai_conversations\`, \`ai_messages\`, \`ai_message_feedback\`, and \`ai_analysis_runs\`. These remain the private conversation and interaction history. The FAQ layer is not a second chat system and does not copy message bodies into a shared knowledge store.

The existing \`farm_productivity_knowledge_candidates\` remains the evidence-governance path for reusable farm outcomes and case-derived knowledge. FAQ content is a separate, curated answer type that can cite those reviewed cases without duplicating the underlying farm record.

## 2. Data model

| Table | Responsibility |
|---|---|
| \`sarina_faq_topics\` | Stable, language-neutral topic identifiers |
| \`sarina_faq_entries\` | Stable FAQ identity, risk level, answer mode and applicability scope |
| \`sarina_faq_versions\` | Localized question/answer content, version, confidence, review state and full-text search document |
| \`sarina_faq_source_references\` | Traceable official, scientific, product-label, specialist and internal evidence references |
| \`sarina_faq_review_events\` | Append-only approval, rejection, revision, publication and retirement audit |
| \`sarina_faq_question_signals\` | Aggregated, privacy-redacted recurring-question patterns; no user, farm, conversation or message identifiers |
| \`sarina_faq_usage_events\` | Privacy-minimized retrieval outcome telemetry; no prompt or farmer identity |

## 3. Answer lifecycle

1. Detect recurring questions from authorized conversation processing.
2. Normalize language and intent, then redact personal, location, contact and farm-identifying details before creating a question signal.
3. Aggregate by language plus one-way SHA-256 fingerprint; do not store raw conversation text.
4. A knowledge editor drafts a stable answer and identifies applicability limits.
5. Attach current evidence references. Product-related answers must cite the current product label/specification; agronomic answers must cite relevant authoritative or expert-reviewed evidence.
6. A reviewer approves the exact localized version. High/critical-risk entries require the qualified-specialist approval path.
7. Publish a new version; the previous published version is superseded in the same transaction.
8. Retrieve only published, in-date versions. Record only FAQ ID, retrieval method, score and coarse outcome.
9. Repeated "not helpful", unresolved or escalated outcomes return the entry to review; they do not silently rewrite it.

## 4. Retrieval V1

The first retrieval path is provider-neutral PostgreSQL full-text search using the \`simple\` text configuration and a GIN index. This supports Persian, Arabic and English tokenization without depending on a paid embedding API. It is lexical, not semantic: the router should use confidence/score thresholds and escalate low-match or ambiguous queries.

The \`search_sarina_faq\` RPC:
- is \`SECURITY INVOKER\` and respects RLS;
- returns only published, in-date versions for the requested or fallback language;
- returns risk level and answer mode so the router can distinguish normal answers from caution/escalation;
- returns current source references with the answer;
- is executable by authenticated users only.

A later semantic retriever may be added behind the same contract using a locally hosted embedding model or an approved vector extension. It must not make external API dependency mandatory.

## 5. Risk and trust rules

- A model-generated response is a draft, never a published answer by itself.
- A farmer's report remains a report; it does not become a diagnosis.
- High/critical risk answers require a qualified-specialist approval record and are marked \`must_escalate\` unless a separately reviewed policy explicitly permits a narrower response.
- Every published version needs reviewer identity, timestamps and at least one current source reference.
- Every edit creates a new version; old versions and review history remain auditable.
- Expired evidence or answers are excluded from retrieval until reviewed.
- User/farm/conversation-specific answers remain in the private conversation or farm record, not in shared FAQ.
- Question telemetry must be redacted before insertion; schema constraints require \`privacy_redacted = true\`, but application-side redaction remains mandatory.

## 6. Integration with SAI and SCI

- SAI governs evidence quality, case reuse, expert review and promotion into trusted knowledge.
- FAQ is the low-latency, repeatable-answer shelf for stable, bounded questions.
- SCI remains responsible for intent routing, provider choice, specialist handoff, budget policy and safety gates.
- The router should prefer FAQ retrieval for repeated, low-risk and context-independent questions; it should use structured farm context or specialist workflows when the answer depends on a specific farm, diagnosis, crop stage, water/soil result or high-consequence action.
- FAQ retrieval is read-only. It must never issue farm actions, purchases, chemical applications or irrigation commands.

## 7. Operational acceptance gates

- Persian, Arabic and English examples return the correct language version and valid fallback.
- Draft, review, rejected, superseded, withdrawn and expired versions are never returned.
- High/critical-risk answers cannot be published without specialist approval metadata.
- A published answer without a current source reference is rejected by the database trigger.
- Authenticated users can read published content but cannot create or edit it.
- Anonymous users cannot query FAQ content.
- Internal question signals, reviews and usage telemetry are inaccessible to client roles.
- Duplicate questions aggregate by language/fingerprint after redaction.
- No raw message, user ID, farm ID, conversation ID or message ID is copied into shared FAQ telemetry.
- Low retrieval scores, conflicting sources, stale validity or high-risk content cause a safe deferral or specialist escalation.

## 8. Explicit non-goals

- Replacing the SAI evidence repository or SCI task router.
- Auto-publishing model output.
- Training a model from raw chat transcripts.
- Claiming semantic retrieval quality from a lexical search index.
- Using farmer-specific data outside its authorized farm context.
