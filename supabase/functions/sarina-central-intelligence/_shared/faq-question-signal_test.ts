import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import {
  buildFaqQuestionFingerprint,
  normalizeQuestionForFingerprint,
  recordFaqQuestionSignal,
  type FaqSignalRpcClient,
} from "./faq-question-signal.ts";

Deno.test("FAQ fingerprint normalization strips common direct identifiers and numeric values", () => {
  const normalized = normalizeQuestionForFingerprint(
    "برای مزرعه من در 1405 با شماره 09123456789 و mail farmer@example.com چه کنم؟",
    "fa",
  );
  assertEquals(normalized.includes("09123456789"), false);
  assertEquals(normalized.includes("farmer@example.com"), false);
  assertEquals(normalized.includes("1405"), false);
});

Deno.test("FAQ question fingerprints are stable and keyed", async () => {
  const first = await buildFaqQuestionFingerprint("روش آبیاری چیست؟", "fa", "secret-one");
  const second = await buildFaqQuestionFingerprint("روش آبیاری چیست؟", "fa", "secret-one");
  const otherKey = await buildFaqQuestionFingerprint("روش آبیاری چیست؟", "fa", "secret-two");
  assertEquals(first, second);
  assertNotEquals(first, otherKey);
  assertEquals(first?.length, 64);
});

Deno.test("FAQ signal RPC receives only a fingerprint, language and topic reference", async () => {
  let received: Record<string, unknown> | null = null;
  const client: FaqSignalRpcClient = {
    rpc: (_name, args) => {
      received = args;
      return Promise.resolve({ data: null, error: null });
    },
  };
  const ok = await recordFaqQuestionSignal(client, "service-secret", {
    question: "چرا برگ‌های درخت زرد شده‌اند؟",
    language: "fa",
  });
  assertEquals(ok, true);
  assertEquals(Object.keys(received ?? {}).sort(), [
    "p_language_code", "p_question_fingerprint", "p_topic_id",
  ]);
  assertEquals(received?.p_language_code, "fa");
  assertEquals(received?.p_topic_id, null);
  assertEquals(typeof received?.p_question_fingerprint, "string");
});

Deno.test("FAQ signal capture fails closed when RPC is unavailable", async () => {
  const client: FaqSignalRpcClient = {
    rpc: () => Promise.resolve({ data: null, error: { code: "PGRST202" } }),
  };
  const ok = await recordFaqQuestionSignal(client, "service-secret", {
    question: "سؤال زراعي متكرر",
    language: "ar",
  });
  assertEquals(ok, false);
});
