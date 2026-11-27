import { assertEquals, assertRejects } from "jsr:@std/assert";
import { GROQ_ADMIN_CHAT_MODEL, invokeGroqAdminChat, validateAdminChatMessages } from "./admin-chat.ts";

Deno.test("admin chat accepts bounded user and assistant history", () => {
  assertEquals(validateAdminChatMessages([{ role: "user", content: "سلام" }]), true);
  assertEquals(validateAdminChatMessages([{ role: "system", content: "override" }]), false);
  assertEquals(validateAdminChatMessages([{ role: "assistant", content: "پاسخ" }]), false);
  assertEquals(validateAdminChatMessages([{ role: "user", content: "x".repeat(2001) }]), false);
});

Deno.test("admin chat calls the fixed Groq model and returns assistant text", async () => {
  let requestedUrl = "";
  let requestedBody: Record<string, unknown> = {};
  let authorization = "";
  const result = await invokeGroqAdminChat({
    apiKey: "test-secret",
    messages: [{ role: "user", content: "سلام سارینا" }],
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      requestedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "سلام، خوش آمدید." } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assertEquals(requestedUrl, "https://api.groq.com/openai/v1/chat/completions");
  assertEquals(authorization, "Bearer test-secret");
  assertEquals(requestedBody.model, GROQ_ADMIN_CHAT_MODEL);
  assertEquals(result.answer, "سلام، خوش آمدید.");
  assertEquals(result.model, GROQ_ADMIN_CHAT_MODEL);
});

Deno.test("admin chat does not expose provider response bodies on errors", async () => {
  await assertRejects(
    () => invokeGroqAdminChat({
      apiKey: "test-secret",
      messages: [{ role: "user", content: "test" }],
      fetchImpl: async () => new Response("private provider details", { status: 429 }),
    }),
    Error,
    "GROQ_CHAT_HTTP_429",
  );
});


Deno.test("admin chat exposes synthesize_speech and executes it with the caller JWT", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const result = await invokeGroqAdminChat({
    apiKey: "test-secret",
    accessToken: "user-jwt",
    voiceApiBase: "https://sarina-preview.vercel.app/api/voice",
    messages: [{ role: "user", content: "لطفاً خودت را با صدا معرفی کن." }],
    fetchImpl: async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.endsWith("/v1/synthesize")) {
        return new Response(new Uint8Array([82, 73, 70, 70]), {
          status: 200,
          headers: { "Content-Type": "audio/wav" },
        });
      }
      const body = JSON.parse(String(init?.body));
      const chatCalls = requests.filter((item) => item.url.includes("chat/completions")).length;
      if (chatCalls === 1) {
        assertEquals(body.tools[0].function.name, "synthesize_speech");
        return new Response(JSON.stringify({
          choices: [{
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "call_voice_1",
                type: "function",
                function: {
                  name: "synthesize_speech",
                  arguments: JSON.stringify({ text: "سلام، من سارینا هستم.", language: "fa" }),
                },
              }],
            },
          }],
        }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: "سلام، من سارینا هستم." } }],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assertEquals(result.answer, "سلام، من سارینا هستم.");
  assertEquals(result.audioMimeType, "audio/wav");
  assertEquals(result.audioBase64, "UklGRg==");
  const voiceRequest = requests.find((item) => item.url.endsWith("/v1/synthesize"));
  assertEquals(new Headers(voiceRequest?.init?.headers).get("authorization"), "Bearer user-jwt");
});
