import { assertEquals, assertRejects } from "jsr:@std/assert";
import { GroqChatCompletionsAdapter } from "./groq-provider-adapter.ts";

const validDraft = {
  known_facts: ["پرونده ثبت شده است"],
  farmer_reports: ["کشاورز زردی برگ را گزارش کرده است"],
  verified_measurements: [],
  model_estimates: [],
  missing_information: ["آزمون خاک"],
  possible_explanations: [],
  risk_flags: [],
  follow_up_questions: ["آیا تصویر برگ موجود است؟"],
  source_references: [],
  limitations: ["تشخیص قطعی انجام نشده است"],
  review_required: true,
};

Deno.test("Groq adapter calls the OpenAI-compatible endpoint and validates structured output", async () => {
  let url = "";
  let headers = new Headers();
  let body: Record<string, unknown> = {};
  const adapter = new GroqChatCompletionsAdapter({
    apiKey: "test-secret",
    model: "openai/gpt-oss-20b",
    allowedModels: ["openai/gpt-oss-20b"],
    fetchImpl: async (input, init) => {
      url = String(input);
      headers = new Headers(init?.headers);
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        id: "groq-test-response",
        choices: [{ message: { role: "assistant", content: JSON.stringify(validDraft) }, finish_reason: "stop" }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  const result = await adapter.invoke({
    task: "specialist_case_preparation",
    correlationId: "groq-test-001",
    language: "fa",
    payload: { schema: "SARINA_SPECIALIST_CASE_EVIDENCE_V1" },
  });

  assertEquals(url, "https://api.groq.com/openai/v1/chat/completions");
  assertEquals(headers.get("authorization"), "Bearer test-secret");
  assertEquals(body.model, "openai/gpt-oss-20b");
  assertEquals((body.response_format as Record<string, unknown>).type, "json_schema");
  assertEquals(result.provider, "groq");
  assertEquals(result.correlationId, "groq-test-001");
  assertEquals(result.responseId, "groq-test-response");
  assertEquals(result.output.review_required, true);
});

Deno.test("Groq adapter rejects a model outside the server allowlist", () => {
  try {
    new GroqChatCompletionsAdapter({
      apiKey: "test-secret",
      model: "unapproved",
      allowedModels: ["openai/gpt-oss-20b"],
    });
    throw new Error("expected model allowlist rejection");
  } catch (error) {
    assertEquals((error as Error).message, "GROQ_MODEL_NOT_ALLOWLISTED");
  }
});

Deno.test("Groq adapter rejects schema-invalid output", async () => {
  const adapter = new GroqChatCompletionsAdapter({
    apiKey: "test-secret",
    model: "openai/gpt-oss-20b",
    allowedModels: ["openai/gpt-oss-20b"],
    fetchImpl: async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ review_required: false }) } }],
    }), { status: 200 }),
  });
  await assertRejects(
    () => adapter.invoke({
      task: "specialist_case_preparation",
      correlationId: "groq-test-002",
      language: "fa",
      payload: {},
    }),
    Error,
    "GROQ_OUTPUT_SCHEMA_INVALID",
  );
});

Deno.test("Groq adapter does not expose provider response bodies on errors", async () => {
  const adapter = new GroqChatCompletionsAdapter({
    apiKey: "test-secret",
    model: "openai/gpt-oss-20b",
    allowedModels: ["openai/gpt-oss-20b"],
    fetchImpl: async () => new Response("private provider details", { status: 429 }),
  });
  await assertRejects(
    () => adapter.invoke({
      task: "specialist_case_preparation",
      correlationId: "groq-test-003",
      language: "fa",
      payload: {},
    }),
    Error,
    "GROQ_PROVIDER_HTTP_429",
  );
});
