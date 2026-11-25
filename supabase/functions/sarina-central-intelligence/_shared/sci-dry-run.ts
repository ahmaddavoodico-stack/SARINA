/**
 * Safe SCI endpoint integration: deterministic routing plus an in-memory,
 * simulated worker only. No provider, model, database, or domain action runs.
 *
 * Idempotency and task state are intentionally limited to this invocation.
 * This module is a test-stage adapter, not a durable production dispatcher.
 */
import { routeTask, type TaskModality } from "./task-orchestrator.ts";
import { InMemoryTaskManager, type TaskEnvelope, type TaskResult } from "./task-lifecycle.ts";

export type SciDryRunResult = {
  mode: "simulated";
  persistence: "in_memory_invocation_only";
  route: ReturnType<typeof routeTask>;
  task: {
    taskId: string;
    status: string;
    attemptCount: number;
    result?: TaskResult;
    events: Array<{ from: string | null; to: string; reason: string }>;
  };
  simulatedWorkerInvoked: boolean;
  externalEffects: false;
};

export function runSciDryRun(input: {
  farmId: string;
  question: string;
  requestId: string;
  modalities?: readonly TaskModality[];
  now?: number;
}): SciDryRunResult {
  const now = input.now ?? Date.now();
  const route = routeTask({ text: input.question, modalities: input.modalities ?? ["text"] });
  const taskId = crypto.randomUUID();
  const envelope: TaskEnvelope = {
    taskId,
    correlationId: crypto.randomUUID(),
    channel: "chat",
    contextRefs: [`farm:${input.farmId}`],
    intent: route.reasonCode.toLowerCase(),
    domain: route.domain,
    payloadRefs: [`request:${input.requestId}`],
    modalities: [...(input.modalities ?? ["text"])],
    assignedAgent: route.agentId,
    priority: "normal",
    permissions: ["read:farm_context"],
    risk: route.agentId === "specialist_handoff" ? "high" : "medium",
    createdAt: new Date(now).toISOString(),
    deadlineAt: new Date(now + 60_000).toISOString(),
    idempotencyKey: `sci-dry-run:${input.requestId}`,
    retryPolicy: { maxAttempts: 1, initialDelayMs: 0, maxDelayMs: 0 },
  };

  const manager = new InMemoryTaskManager();
  manager.createTask(envelope, now);
  manager.transition(taskId, "validated", "sci_validator", "ENVELOPE_VALIDATED", now);
  manager.transition(taskId, "queued", "sci_router", "DETERMINISTIC_ROUTE_ACCEPTED", now);

  // Clarification and human-review routes must not be completed by a worker.
  if (route.status !== "assigned" || route.humanReviewRequired) {
    manager.transition(taskId, "assigned", "sci_scheduler", "SIMULATION_ASSIGNMENT", now);
    manager.transition(taskId, "waiting_for_human", "sci_policy", "HUMAN_REVIEW_REQUIRED", now);
    const waiting = manager.getTask(taskId);
    return {
      mode: "simulated",
      persistence: "in_memory_invocation_only",
      route,
      task: {
        taskId,
        status: waiting.status,
        attemptCount: waiting.attemptCount,
        events: waiting.events.map(({ from, to, reason }) => ({ from, to, reason })),
      },
      simulatedWorkerInvoked: false,
      externalEffects: false,
    };
  }

  // This worker creates a clearly marked synthetic result; it never calls an agent.
  manager.claimTask(taskId, "sci-simulated-worker", 30_000, now);
  manager.setResult(taskId, {
    evidence: ["simulation:deterministic-router"],
    confidence: "low",
    structuredOutput: {
      simulation_only: true,
      agent_id: route.agentId,
      route_reason: route.reasonCode,
      recommendation: null,
      note: "No domain agent, model, or external service was invoked.",
    },
  }, "sci-simulated-worker", now);
  manager.transition(taskId, "succeeded", "sci-simulated-worker", "SIMULATED_RESULT_RECORDED", now);

  const completed = manager.getTask(taskId);
  return {
    mode: "simulated",
    persistence: "in_memory_invocation_only",
    route,
    task: {
      taskId,
      status: completed.status,
      attemptCount: completed.attemptCount,
      result: completed.result,
      events: completed.events.map(({ from, to, reason }) => ({ from, to, reason })),
    },
    simulatedWorkerInvoked: true,
    externalEffects: false,
  };
}
