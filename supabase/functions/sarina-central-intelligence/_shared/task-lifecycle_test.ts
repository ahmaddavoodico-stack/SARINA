import { assertEquals, assertThrows } from "jsr:@std/assert";
import {
  InMemoryTaskManager,
  TaskLifecycleError,
  calculateRetryDelay,
  validateTaskEnvelope,
} from "./task-lifecycle.ts";
import type { TaskEnvelope } from "./task-lifecycle.ts";

const BASE = Date.parse("2026-11-25T12:00:00.000Z");
const iso = (offset: number) => new Date(BASE + offset).toISOString();

function envelope(overrides: Partial<TaskEnvelope> = {}): TaskEnvelope {
  return {
    taskId: "11111111-1111-4111-8111-111111111111",
    correlationId: "22222222-2222-4222-8222-222222222222",
    channel: "chat",
    contextRefs: ["farm:demo"],
    intent: "soil_advice",
    domain: "agronomy",
    payloadRefs: ["message:demo"],
    modalities: ["text"],
    assignedAgent: "agronomy_advisor",
    priority: "normal",
    permissions: ["read:farm_context"],
    risk: "medium",
    createdAt: iso(0),
    deadlineAt: iso(60_000),
    idempotencyKey: "idem-key-demo-0001",
    retryPolicy: { maxAttempts: 2, initialDelayMs: 100, maxDelayMs: 500 },
    ...overrides,
  };
}

function queuedManager(e = envelope()) {
  const manager = new InMemoryTaskManager();
  manager.createTask(e, BASE);
  manager.transition(e.taskId, "validated", "validator", "SCHEMA_VALIDATED", BASE + 1);
  manager.transition(e.taskId, "queued", "router", "ROUTE_ACCEPTED", BASE + 2);
  return manager;
}

Deno.test("envelope validation rejects malformed identifiers and retry policies", () => {
  const invalid = envelope({ taskId: "not-a-uuid", retryPolicy: { maxAttempts: 99, initialDelayMs: -1, maxDelayMs: 0 } });
  const issues = validateTaskEnvelope(invalid, BASE);
  assertEquals(issues.includes("INVALID_TASK_ID"), true);
  assertEquals(issues.includes("INVALID_RETRY_POLICY"), true);
});

Deno.test("idempotency key returns the original task and prevents duplicate creation", () => {
  const manager = new InMemoryTaskManager();
  const first = manager.createTask(envelope(), BASE);
  const duplicate = manager.createTask(envelope({
    taskId: "33333333-3333-4333-8333-333333333333",
  }), BASE + 1);
  assertEquals(first.duplicate, false);
  assertEquals(duplicate.duplicate, true);
  assertEquals(duplicate.task.envelope.taskId, first.task.envelope.taskId);
});

Deno.test("state transitions are controlled and result is required for success", () => {
  const manager = queuedManager();
  assertThrows(() => manager.transition(envelope().taskId, "succeeded", "worker", "SKIP", BASE + 3), TaskLifecycleError);
  manager.claimTask(envelope().taskId, "worker-1", 5_000, BASE + 3);
  manager.setResult(envelope().taskId, {
    evidence: ["source:field-observation"],
    confidence: "medium",
    structuredOutput: { recommendation: "review_required" },
  }, "worker-1", BASE + 4);
  const done = manager.transition(envelope().taskId, "succeeded", "worker-1", "RESULT_VALIDATED", BASE + 5);
  assertEquals(done.status, "succeeded");
  assertEquals(done.events.map((event) => event.to), ["received", "validated", "queued", "assigned", "running", "running", "succeeded"]);
});

Deno.test("running state cannot be entered without acquiring a worker lease", () => {
  const manager = queuedManager();
  assertThrows(
    () => manager.transition(envelope().taskId, "running", "worker-1", "BYPASS_CLAIM", BASE + 3),
    (error) => error instanceof TaskLifecycleError && error.code === "TASK_CLAIM_REQUIRED",
  );
});

Deno.test("active lease prevents a second worker from claiming the same task", () => {
  const manager = queuedManager();
  manager.claimTask(envelope().taskId, "worker-1", 5_000, BASE + 3);
  assertThrows(() => manager.claimTask(envelope().taskId, "worker-2", 5_000, BASE + 4), TaskLifecycleError);
});

Deno.test("expired worker lease is recovered through bounded retry scheduling", () => {
  const manager = queuedManager();
  manager.claimTask(envelope().taskId, "worker-1", 100, BASE + 3);
  const recovered = manager.recoverExpiredLease(envelope().taskId, "reaper", BASE + 104);
  assertEquals(recovered.status, "queued");
  assertEquals(recovered.attemptCount, 1);
  assertEquals(Date.parse(recovered.availableAt), BASE + 204);
});

Deno.test("retry cap is enforced and delay uses bounded exponential backoff", () => {
  const manager = queuedManager();
  manager.claimTask(envelope().taskId, "worker-1", 5_000, BASE + 3);
  manager.transition(envelope().taskId, "failed", "worker-1", "TRANSIENT_ERROR", BASE + 4);
  manager.retryTask(envelope().taskId, "retry-worker", BASE + 5);
  manager.claimTask(envelope().taskId, "worker-2", 5_000, BASE + 106);
  manager.transition(envelope().taskId, "failed", "worker-2", "TRANSIENT_ERROR", BASE + 107);
  assertThrows(() => manager.retryTask(envelope().taskId, "retry-worker", BASE + 108), TaskLifecycleError);
  assertEquals(calculateRetryDelay({ maxAttempts: 5, initialDelayMs: 100, maxDelayMs: 250 }, 4), 250);
});

Deno.test("deadline expires queued work and cancellation is terminal", () => {
  const expired = queuedManager();
  const timedOut = expired.claimTask(envelope().taskId, "worker", 100, BASE + 60_000);
  assertEquals(timedOut.status, "timed_out");

  const cancelled = queuedManager();
  assertEquals(cancelled.cancelTask(envelope().taskId, "user", "USER_CANCELLED", BASE + 10).status, "cancelled");
  assertThrows(() => cancelled.transition(envelope().taskId, "queued", "system", "RESUME", BASE + 11), TaskLifecycleError);
});

Deno.test("explicit approval is separate from task permissions", () => {
  const manager = queuedManager();
  manager.claimTask(envelope().taskId, "worker", 5_000, BASE + 3);
  assertThrows(() => manager.assertActionApproved(envelope().taskId, "payment"), TaskLifecycleError);
  assertThrows(() => manager.recordApproval(envelope().taskId, "payment", "system", "confirmation-1", BASE + 4), TaskLifecycleError);
  manager.recordApproval(envelope().taskId, "payment", "verified-user", "confirmation-1", BASE + 5);
  manager.assertActionApproved(envelope().taskId, "payment");
  assertEquals(manager.getTask(envelope().taskId).approvals.length, 1);
});

Deno.test("audit events are ordered and returned records cannot mutate internal state", () => {
  const manager = queuedManager();
  const snapshot = manager.getTask(envelope().taskId);
  snapshot.events.pop();
  assertEquals(manager.getTask(envelope().taskId).events.length, 3);
  assertEquals(manager.getTask(envelope().taskId).events.map((event) => event.sequence), [1, 2, 3]);
});

Deno.test("queue ordering honors priority and availability time", () => {
  const manager = new InMemoryTaskManager();
  const low = envelope();
  const high = envelope({
    taskId: "33333333-3333-4333-8333-333333333333",
    correlationId: "44444444-4444-4444-8444-444444444444",
    idempotencyKey: "idem-key-demo-0002",
    priority: "urgent",
  });
  for (const item of [low, high]) {
    manager.createTask(item, BASE);
    manager.transition(item.taskId, "validated", "validator", "OK", BASE + 1);
    manager.transition(item.taskId, "queued", "router", "OK", BASE + 2);
  }
  assertEquals(manager.listQueued(BASE + 3).map((task) => task.envelope.priority), ["urgent", "normal"]);
});
