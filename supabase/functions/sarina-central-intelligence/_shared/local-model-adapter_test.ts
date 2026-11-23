import { assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert";
import { LocalModelAdapter } from "./local-model-adapter.ts";

Deno.test("local adapter rejects a model outside the server allowlist", () => {
  try {
    new LocalModelAdapter({
      baseUrl: "https://ai.example.internal/v1",
      model: "unapproved-model",
      allowedModels: ["qwen3.5:4b"],
      runtime: "ollama",
    });
    throw new Error("expected allowlist rejection");
  } catch (error) {
    assertEquals((error as Error).message, "LOCAL_AI_MODEL_NOT_ALLOWLISTED");
  }
});

Deno.test("local adapter rejects non-HTTPS public endpoints", () => {
  try {
    new LocalModelAdapter({
      baseUrl: "http://ai.example.internal/v1",
      model: "qwen3.5:4b",
      allowedModels: ["qwen3.5:4b"],
      runtime: "ollama",
    });
    throw new Error("expected HTTPS rejection");
  } catch (error) {
    assertEquals((error as Error).message, "LOCAL_AI_ENDPOINT_MUST_USE_HTTPS");
  }
});

Deno.test("local adapter normalizes an OpenAI-compatible response", async () => {
  let requestedUrl = "";
  let requestBody: Record<string, unknown> = {};
  const fakeFetch: typeof fetch = async (input, init) => {
    requestedUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      choices: [{
        message: { role: "assistant", content: "سلام، چطور می‌توانم کمک کنم؟" },
        finish_reason: "stop",
      }],
      usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const adapter = new LocalModelAdapter({
    baseUrl: "https://ai.example.internal/v1/",
    model: "qwen3.5:4b",
    allowedModels: ["qwen3.5:4b", "qwen3.5:9b"],
    runtime: "ollama",
    fetchImpl: fakeFetch,
  });
  const result = await adapter.invoke({
    task: "routine_chat",
    correlationId: "local-ai-test-001",
    language: "fa",
    messages: [{ role: "user", content: "سلام" }],
  });

  assertEquals(requestedUrl, "https://ai.example.internal/v1/chat/completions");
  assertEquals(requestBody.model, "qwen3.5:4b");
  assertEquals(result.provider, "self_hosted");
  assertEquals(result.runtime, "ollama");
  assertEquals(result.content, "سلام، چطور می‌توانم کمک کنم؟");
  assertEquals(result.usage.totalTokens, 30);
  assertStringIncludes(result.correlationId, "local-ai-test");
});

Deno.test("local adapter bounds message count and size", async () => {
  const adapter = new LocalModelAdapter({
    baseUrl: "http://127.0.0.1:11434/v1",
    model: "qwen3.5:4b",
    allowedModels: ["qwen3.5:4b"],
    runtime: "ollama",
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });

  await assertRejects(
    () => adapter.invoke({
      task: "routine_chat",
      correlationId: "local-ai-test-002",
      language: "fa",
      messages: Array.from({ length: 31 }, () => ({ role: "user" as const, content: "سلام" })),
    }),
    Error,
    "LOCAL_AI_INVALID_MESSAGE_COUNT",
  );
});
