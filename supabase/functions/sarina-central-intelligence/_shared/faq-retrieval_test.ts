import { assertEquals } from "jsr:@std/assert";
import { retrieveFaqCandidates, type FaqRpcClient } from "./faq-retrieval.ts";

const candidate = {
  faq_entry_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  faq_version_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  topic_slug: "irrigation",
  language_code: "fa",
  risk_level: "low",
  answer_mode: "auto_answer",
  confidence: 0.94,
  retrieval_score: 0.31,
};

Deno.test("FAQ retrieval requests only global, language-aware candidates", async () => {
  let args: Record<string, unknown> | null = null;
  const client: FaqRpcClient = {
    rpc: (_name, received) => {
      args = received;
      return Promise.resolve({ data: [candidate], error: null });
    },
  };
  const result = await retrieveFaqCandidates(client, { question: "روش آبیاری چیست؟", language: "fa" });
  assertEquals(result.status, "matched");
  assertEquals(result.candidates.length, 1);
  assertEquals(args?.p_language_code, "fa");
  assertEquals(args?.p_fallback_language_code, "en");
  assertEquals(args?.p_scope_type, "global");
  assertEquals(args?.p_scope_key, null);
  assertEquals(args?.p_limit, 5);
});

Deno.test("FAQ retrieval never treats high-risk content as auto-answerable", async () => {
  const client: FaqRpcClient = {
    rpc: () => Promise.resolve({
      data: [{ ...candidate, risk_level: "critical", answer_mode: "auto_answer" }],
      error: null,
    }),
  };
  const result = await retrieveFaqCandidates(client, { question: "سوال", language: "fa" });
  assertEquals(result.status, "unavailable");
  assertEquals(result.candidates.length, 0);
});

Deno.test("FAQ retrieval degrades safely when the database migration is unavailable", async () => {
  const client: FaqRpcClient = {
    rpc: () => Promise.resolve({ data: null, error: { code: "PGRST202", message: "missing RPC" } }),
  };
  const result = await retrieveFaqCandidates(client, { question: "سوال کشاورزی", language: "ar" });
  assertEquals(result.status, "unavailable");
  assertEquals(result.candidates.length, 0);
});

Deno.test("FAQ retrieval does not block on empty questions", async () => {
  let called = false;
  const client: FaqRpcClient = {
    rpc: () => {
      called = true;
      return Promise.resolve({ data: [], error: null });
    },
  };
  const result = await retrieveFaqCandidates(client, { question: " ", language: "en" });
  assertEquals(called, false);
  assertEquals(result.status, "no_match");
});
