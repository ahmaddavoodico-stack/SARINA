/**
 * In-memory task lifecycle core for SARINA SCI.
 *
 * Pure orchestration primitives only: no database, queue transport, model call,
 * external provider, or domain side effect is performed by this module.
 */
import { getRegisteredAgent, type AgentId, type TaskDomain, type TaskModality } from "./task-orchestrator.ts";

export type TaskStatus =
  | "received" | "validated" | "queued" | "assigned" | "running"
  | "waiting_for_human" | "succeeded" | "failed" | "cancelled" | "timed_out";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskRisk = "low" | "medium" | "high" | "critical";
export type TaskChannel = "chat" | "voice" | "api" | "internal";
export type Confidence = "low" | "medium" | "high";

export type RetryPolicy = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
};

export type TaskEnvelope = {
  taskId: string;
  parentTaskId?: string;
  correlationId: string;
  channel: TaskChannel;
  userId?: string;
  contextRefs: string[];
  intent: string;
  domain: TaskDomain;
  payloadRefs: string[];
  modalities: TaskModality[];
  assignedAgent: AgentId;
  priority: TaskPriority;
  permissions: string[];
  risk: TaskRisk;
  createdAt: string;
  deadlineAt: string;
  idempotencyKey: string;
  retryPolicy: RetryPolicy;
};

export type TaskResult = {
  evidence: string[];
  confidence: Confidence;
  structuredOutput: Record<string, unknown>;
  errorCode?: string;
};

export type TaskEvent = {
  sequence: number;
  taskId: string;
  from: TaskStatus | null;
  to: TaskStatus;
  at: string;
  actor: string;
  reason: string;
};

export type TaskRecord = {
  envelope: TaskEnvelope;
  status: TaskStatus;
  attemptCount: number;
  availableAt: string;
  lease?: { workerId: string; expiresAt: string };
  result?: TaskResult;
  approvals: ApprovalRecord[];
  events: TaskEvent[];
  updatedAt: string;
};

export type ApprovalAction =
  | "order" | "payment" | "outbound_message" | "account_change"
  | "deletion" | "consequential_operation";

export type ApprovalRecord = {
  action: ApprovalAction;
  approvedBy: string;
  approvedAt: string;
  confirmationId: string;
};

export class TaskLifecycleError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "TaskLifecycleError";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TERMINAL = new Set<TaskStatus>(["succeeded", "cancelled", "timed_out"]);
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  received: ["validated", "cancelled"],
  validated: ["queued", "cancelled"],
  queued: ["assigned", "cancelled", "timed_out"],
  assigned: ["running", "waiting_for_human", "cancelled", "timed_out"],
  running: ["waiting_for_human", "succeeded", "failed", "cancelled", "timed_out"],
  waiting_for_human: ["queued", "assigned", "cancelled", "timed_out"],
  succeeded: [],
  failed: [],
  cancelled: [],
  timed_out: [],
};

export function validateTaskEnvelope(value: unknown, now = Date.now()): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return ["INVALID_ENVELOPE"];
  const e = value as Partial<TaskEnvelope>;
  const issues: string[] = [];
  if (!UUID.test(e.taskId ?? "")) issues.push("INVALID_TASK_ID");
  if (e.parentTaskId !== undefined && !UUID.test(e.parentTaskId)) issues.push("INVALID_PARENT_TASK_ID");
  if (!UUID.test(e.correlationId ?? "")) issues.push("INVALID_CORRELATION_ID");
  if (!["chat", "voice", "api", "internal"].includes(e.channel ?? "")) issues.push("INVALID_CHANNEL");
  if (typeof e.intent !== "string" || !e.intent.trim() || e.intent.length > 160) issues.push("INVALID_INTENT");
  if (!Array.isArray(e.contextRefs) || e.contextRefs.some((x) => typeof x !== "string")) issues.push("INVALID_CONTEXT_REFS");
  if (!Array.isArray(e.payloadRefs) || e.payloadRefs.some((x) => typeof x !== "string")) issues.push("INVALID_PAYLOAD_REFS");
  if (!Array.isArray(e.modalities) || e.modalities.length === 0) issues.push("INVALID_MODALITIES");
  if (!Array.isArray(e.permissions) || e.permissions.some((x) => typeof x !== "string")) issues.push("INVALID_PERMISSIONS");
  const agent = typeof e.assignedAgent === "string" ? getRegisteredAgent(e.assignedAgent as AgentId) : undefined;
  if (!agent) issues.push("INVALID_ASSIGNED_AGENT");
  if (!["conversation", "agronomy", "crop_diagnostics", "knowledge", "marketplace", "specialist", "account", "soil_water", "irrigation", "plant_nutrition", "plant_health", "climate", "agricultural_knowledge", "market_intelligence", "trade_export", "finance_economics", "logistics_supply_chain"].includes(e.domain ?? "")) issues.push("INVALID_DOMAIN");
  else if (agent && agent.domain !== e.domain) issues.push("AGENT_DOMAIN_MISMATCH");
  if (!Array.isArray(e.modalities) || e.modalities.some((item) => !["text", "image", "document", "audio", "other"].includes(item))) {
    if (!issues.includes("INVALID_MODALITIES")) issues.push("INVALID_MODALITIES");
  }
  if (!["low", "normal", "high", "urgent"].includes(e.priority ?? "")) issues.push("INVALID_PRIORITY");
  if (!["low", "medium", "high", "critical"].includes(e.risk ?? "")) issues.push("INVALID_RISK");
  const created = Date.parse(e.createdAt ?? "");
  const deadline = Date.parse(e.deadlineAt ?? "");
  if (!Number.isFinite(created)) issues.push("INVALID_CREATED_AT");
  if (!Number.isFinite(deadline) || deadline <= now || (Number.isFinite(created) && deadline <= created)) issues.push("INVALID_OR_EXPIRED_DEADLINE");
  if (typeof e.idempotencyKey !== "string" || e.idempotencyKey.trim().length < 8 || e.idempotencyKey.length > 200) issues.push("INVALID_IDEMPOTENCY_KEY");
  const retry = e.retryPolicy;
  if (!retry || !Number.isInteger(retry.maxAttempts) || retry.maxAttempts < 1 || retry.maxAttempts > 8 ||
      !Number.isInteger(retry.initialDelayMs) || retry.initialDelayMs < 0 ||
      !Number.isInteger(retry.maxDelayMs) || retry.maxDelayMs < retry.initialDelayMs) {
    issues.push("INVALID_RETRY_POLICY");
  }
  return issues;
}

export function requiresExplicitApproval(action: ApprovalAction): true {
  // Authorization/permissions alone never count as the user's confirmation.
  void action;
  return true;
}

export function calculateRetryDelay(policy: RetryPolicy, nextAttempt: number): number {
  if (!Number.isInteger(nextAttempt) || nextAttempt < 1) {
    throw new TaskLifecycleError("INVALID_ATTEMPT", "Attempt number must be a positive integer.");
  }
  const exponential = policy.initialDelayMs * 2 ** Math.min(nextAttempt - 1, 30);
  return Math.min(exponential, policy.maxDelayMs);
}

export class InMemoryTaskManager {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly idempotency = new Map<string, string>();
  private sequence = 0;

  createTask(envelope: TaskEnvelope, now = Date.now()): { task: TaskRecord; duplicate: boolean } {
    const issues = validateTaskEnvelope(envelope, now);
    if (issues.length) throw new TaskLifecycleError("INVALID_ENVELOPE", issues.join(","));
    const existingId = this.idempotency.get(envelope.idempotencyKey);
    if (existingId) return { task: this.getTask(existingId), duplicate: true };
    if (this.tasks.has(envelope.taskId)) throw new TaskLifecycleError("TASK_ID_CONFLICT", "Task ID already exists.");
    const task: TaskRecord = {
      envelope: structuredClone(envelope),
      status: "received",
      attemptCount: 0,
      availableAt: new Date(now).toISOString(),
      approvals: [],
      events: [],
      updatedAt: new Date(now).toISOString(),
    };
    this.tasks.set(envelope.taskId, task);
    this.idempotency.set(envelope.idempotencyKey, envelope.taskId);
    this.appendEvent(task, null, "received", "system", "TASK_ACCEPTED", now);
    return { task: this.getTask(envelope.taskId), duplicate: false };
  }

  getTask(taskId: string): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new TaskLifecycleError("TASK_NOT_FOUND", "Task does not exist.");
    return structuredClone(task);
  }

  listQueued(now = Date.now(), limit = 50): TaskRecord[] {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new TaskLifecycleError("INVALID_LIMIT", "Queue limit must be between 1 and 500.");
    }
    return [...this.tasks.values()]
      .filter((task) => task.status === "queued" && Date.parse(task.availableAt) <= now)
      .sort((a, b) => priorityRank(b.envelope.priority) - priorityRank(a.envelope.priority) ||
        Date.parse(a.envelope.createdAt) - Date.parse(b.envelope.createdAt))
      .slice(0, limit)
      .map((task) => structuredClone(task));
  }

  transition(taskId: string, next: TaskStatus, actor: string, reason: string, now = Date.now()): TaskRecord {
    const task = this.requireTask(taskId);
    this.expireIfPastDeadline(task, now);
    if (task.status === "timed_out") return structuredClone(task);
    if (next === "running") {
      throw new TaskLifecycleError("TASK_CLAIM_REQUIRED", "Tasks must enter running through claimTask so a worker lease is acquired.");
    }
    if (!TRANSITIONS[task.status].includes(next)) {
      throw new TaskLifecycleError("INVALID_STATE_TRANSITION", `Cannot move ${task.status} to ${next}.`);
    }
    if (next === "succeeded" && !task.result) {
      throw new TaskLifecycleError("RESULT_REQUIRED", "A validated task result is required before success.");
    }
    const previous = task.status;
    task.status = next;
    delete task.lease;
    task.updatedAt = new Date(now).toISOString();
    this.appendEvent(task, previous, next, actor, reason, now);
    return structuredClone(task);
  }

  claimTask(taskId: string, workerId: string, leaseMs: number, now = Date.now()): TaskRecord {
    const task = this.requireTask(taskId);
    this.expireIfPastDeadline(task, now);
    if (task.status === "timed_out") return structuredClone(task);
    if (task.status !== "queued" && task.status !== "assigned") {
      throw new TaskLifecycleError("TASK_NOT_CLAIMABLE", "Only queued or assigned tasks can be claimed.");
    }
    if (task.lease && Date.parse(task.lease.expiresAt) > now) {
      throw new TaskLifecycleError("TASK_LEASE_ACTIVE", "Task is already leased to another worker.");
    }
    if (!workerId.trim() || !Number.isInteger(leaseMs) || leaseMs < 1 || leaseMs > 300_000) {
      throw new TaskLifecycleError("INVALID_LEASE", "Worker and lease duration are invalid.");
    }
    const previous = task.status;
    if (previous === "queued") {
      task.status = "assigned";
      this.appendEvent(task, "queued", "assigned", workerId, "TASK_ASSIGNED", now);
    }
    task.status = "running";
    task.attemptCount += 1;
    task.lease = { workerId, expiresAt: new Date(Math.min(now + leaseMs, Date.parse(task.envelope.deadlineAt))).toISOString() };
    task.updatedAt = new Date(now).toISOString();
    this.appendEvent(task, "assigned", "running", workerId, "TASK_CLAIMED", now);
    return structuredClone(task);
  }

  recoverExpiredLease(taskId: string, actor = "lease_reaper", now = Date.now()): TaskRecord {
    const task = this.requireTask(taskId);
    this.expireIfPastDeadline(task, now);
    if (task.status === "timed_out") return structuredClone(task);
    if (task.status !== "running" || !task.lease || Date.parse(task.lease.expiresAt) > now) {
      throw new TaskLifecycleError("LEASE_NOT_EXPIRED", "Task has no expired running lease.");
    }
    delete task.lease;
    task.status = "failed";
    task.updatedAt = new Date(now).toISOString();
    this.appendEvent(task, "running", "failed", actor, "WORKER_LEASE_EXPIRED", now);
    if (task.attemptCount < task.envelope.retryPolicy.maxAttempts) return this.retryTask(taskId, actor, now);
    return structuredClone(task);
  }

  setResult(taskId: string, result: TaskResult, actor: string, now = Date.now()): TaskRecord {
    const task = this.requireTask(taskId);
    if (task.status !== "running" && task.status !== "waiting_for_human") {
      throw new TaskLifecycleError("RESULT_NOT_ACCEPTED", "Results are accepted only for active or human-review tasks.");
    }
    if (!Array.isArray(result.evidence) || !["low", "medium", "high"].includes(result.confidence) ||
        !result.structuredOutput || typeof result.structuredOutput !== "object" || Array.isArray(result.structuredOutput)) {
      throw new TaskLifecycleError("INVALID_RESULT", "Task result does not match the required schema.");
    }
    task.result = structuredClone(result);
    task.updatedAt = new Date(now).toISOString();
    this.appendEvent(task, task.status, task.status, actor, "TASK_RESULT_RECORDED", now);
    return structuredClone(task);
  }

  retryTask(taskId: string, actor: string, now = Date.now()): TaskRecord {
    const task = this.requireTask(taskId);
    this.expireIfPastDeadline(task, now);
    if (task.status === "timed_out") return structuredClone(task);
    if (task.status !== "failed") throw new TaskLifecycleError("TASK_NOT_RETRYABLE", "Only failed tasks can be retried.");
    if (task.attemptCount >= task.envelope.retryPolicy.maxAttempts) {
      throw new TaskLifecycleError("RETRY_LIMIT_REACHED", "Maximum execution attempts reached.");
    }
    const delay = calculateRetryDelay(task.envelope.retryPolicy, task.attemptCount);
    const availableAt = now + delay;
    if (availableAt >= Date.parse(task.envelope.deadlineAt)) {
      task.status = "timed_out";
      task.updatedAt = new Date(now).toISOString();
      this.appendEvent(task, "failed", "timed_out", actor, "RETRY_WOULD_EXCEED_DEADLINE", now);
      return structuredClone(task);
    }
    task.status = "queued";
    task.availableAt = new Date(availableAt).toISOString();
    task.updatedAt = new Date(now).toISOString();
    delete task.result;
    delete task.lease;
    this.appendEvent(task, "failed", "queued", actor, "RETRY_SCHEDULED", now);
    return structuredClone(task);
  }

  cancelTask(taskId: string, actor: string, reason: string, now = Date.now()): TaskRecord {
    return this.transition(taskId, "cancelled", actor, reason || "CANCELLED_BY_REQUEST", now);
  }

  recordApproval(taskId: string, action: ApprovalAction, approvedBy: string, confirmationId: string, now = Date.now()): TaskRecord {
    const task = this.requireTask(taskId);
    // The caller must bind this actor to an authenticated human session. This
    // pure module records the assertion but does not authenticate the actor.
    if (!approvedBy.trim() || approvedBy === "system" || !confirmationId.trim()) {
      throw new TaskLifecycleError("EXPLICIT_APPROVAL_REQUIRED", "An authenticated human actor and confirmation reference are required.");
    }
    if (task.status !== "running" && task.status !== "waiting_for_human") {
      throw new TaskLifecycleError("APPROVAL_NOT_EXPECTED", "Approval can be recorded only for an active task.");
    }
    if (task.approvals.some((item) => item.action === action)) {
      throw new TaskLifecycleError("APPROVAL_ALREADY_RECORDED", "An approval for this action already exists.");
    }
    task.approvals.push({ action, approvedBy, approvedAt: new Date(now).toISOString(), confirmationId });
    task.updatedAt = new Date(now).toISOString();
    this.appendEvent(task, task.status, task.status, approvedBy, `USER_APPROVAL_RECORDED:${action}`, now);
    return structuredClone(task);
  }

  assertActionApproved(taskId: string, action: ApprovalAction): void {
    const task = this.requireTask(taskId);
    if (requiresExplicitApproval(action) && !task.approvals.some((item) => item.action === action)) {
      throw new TaskLifecycleError("EXPLICIT_APPROVAL_REQUIRED", `Explicit user approval is required for ${action}.`);
    }
  }

  private requireTask(taskId: string): TaskRecord {
    const task = this.tasks.get(taskId);
    if (!task) throw new TaskLifecycleError("TASK_NOT_FOUND", "Task does not exist.");
    return task;
  }

  private expireIfPastDeadline(task: TaskRecord, now: number): void {
    if (!TERMINAL.has(task.status) && now >= Date.parse(task.envelope.deadlineAt)) {
      const previous = task.status;
      task.status = "timed_out";
      delete task.lease;
      task.updatedAt = new Date(now).toISOString();
      this.appendEvent(task, previous, "timed_out", "system", "DEADLINE_EXCEEDED", now);
    }
  }

  private appendEvent(task: TaskRecord, from: TaskStatus | null, to: TaskStatus, actor: string, reason: string, now: number): void {
    task.events.push({
      sequence: ++this.sequence,
      taskId: task.envelope.taskId,
      from,
      to,
      at: new Date(now).toISOString(),
      actor,
      reason,
    });
  }
}

function priorityRank(priority: TaskPriority): number {
  return ({ low: 0, normal: 1, high: 2, urgent: 3 })[priority];
}
