import {
  canonicalizeSiacp,
  InMemoryNonceStore,
  signSiacpEnvelope,
  verifySignedSiacpTask,
} from "./siacp-security.ts";
import { buildSpecialistCaseEvidence } from "./specialist-preparation.ts";

const KEY = "unit-test-signing-secret-at-least-32-characters";
const NOW = Date.now();

Deno.test("SIACP canonicalization sorts object keys recursively", () => {
  const actual = canonicalizeSiacp({ z: 1, a: { y: true, b: "x" } });
  if (actual !== '{"a":{"b":"x","y":true},"z":1}') throw new Error(actual);
});

Deno.test("SIACP signing verifies once and rejects replay", async () => {
  const envelope: Record<string, unknown> = {
    header: {
      protocol: "SIACP/1.1", type: "TASK_REQUEST", message_id: "m1",
      correlation_id: "c1", sender: "sarina-sci", recipients: ["adapter-chatgpt"],
      timestamp: new Date(NOW).toISOString(), nonce: "0123456789abcdef", ttl_seconds: 120,
    },
    body: { task: "specialist_case_preparation", inputs: { farm_id: "123e4567-e89b-42d3-a456-426614174000" } },
  };
  const signature = await signSiacpEnvelope(envelope, KEY);
  (envelope.header as Record<string, unknown>).signature = signature;
  const nonceStore = new InMemoryNonceStore();
  const options = {
    signingKey: KEY,
    allowedSenders: new Set(["sarina-sci"]),
    allowedRecipients: new Set(["adapter-chatgpt"]),
    nonceStore,
    now: NOW,
  };
  const first = await verifySignedSiacpTask(envelope, options);
  if (!first.ok) throw new Error(first.code);
  const replay = await verifySignedSiacpTask(envelope, options);
  if (replay.ok || replay.code !== "SIACP_REPLAY_DETECTED") throw new Error("replay accepted");
});

Deno.test("SIACP rejects changed payload and untrusted recipient", async () => {
  const envelope: Record<string, unknown> = {
    header: {
      protocol: "SIACP/1.1", type: "TASK_REQUEST", message_id: "m2",
      correlation_id: "c2", sender: "sarina-sci", recipients: ["adapter-chatgpt"],
      timestamp: new Date(NOW).toISOString(), nonce: "fedcba9876543210", ttl_seconds: 120,
    },
    body: { task: "farm_analysis" },
  };
  (envelope.header as Record<string, unknown>).signature = await signSiacpEnvelope(envelope, KEY);
  (envelope.body as Record<string, unknown>).task = "changed_after_signing";
  const result = await verifySignedSiacpTask(envelope, {
    signingKey: KEY, allowedSenders: new Set(["sarina-sci"]),
    allowedRecipients: new Set(["adapter-chatgpt"]), nonceStore: new InMemoryNonceStore(), now: NOW,
  });
  if (result.ok || result.code !== "SIACP_SIGNATURE_INVALID") throw new Error("tampered payload accepted");
});

Deno.test("specialist evidence keeps farmer reports separate from laboratory measurements", () => {
  const packet = buildSpecialistCaseEvidence({
    request: {
      id: "r1", subject: "Yellowing", problem_description: "Leaves are yellow",
      request_type: "crop_diagnosis", priority: "normal", status: "assigned",
      preferred_language: "fa", created_at: "2026-11-20T10:00:00Z",
    },
    soilTests: [{ id: "s1", data_source: "laboratory", sampled_at: "2026-11-01", ph: 7.8 }],
    observations: [{ id: "o1", description: "Yellow leaves", observed_at: "2026-11-19" }],
  });
  if (packet.evidence.find((item) => item.id === "observation:o1")?.provenance !== "farmer_report") {
    throw new Error("observation provenance was promoted");
  }
  if (packet.evidence.find((item) => item.id === "soil-test:s1")?.provenance !== "verified_measurement") {
    throw new Error("laboratory provenance lost");
  }
  if (!packet.coverage.missingDomains.includes("water_test")) throw new Error("missing domain not recorded");
});
