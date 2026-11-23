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
