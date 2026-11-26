/**
 * Server-only typed boundary for SCI durable task RPCs.
 *
 * Call only with a service-role client created inside a trusted Edge Function.
 * Never pass this client or its credentials to a browser or farmer device.
 */
export type RpcError = { message?: string; code?: string };
export type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: RpcError | null;
  }>;
};

export type DurableTaskCreateInput = {
  task_id: string;
  parent_task_id?: string | null;
  task_kind: "parent" | "specialist_proposal";
  owner_auth_user_id: string;
  farm_id: string;
  correlation_id: string;
  channel: "chat" | "voice" | "api" | "internal";
  intent: string;
  domain: string;
  agent_id: string;
  agent_lifecycle_state: "registered" | "simulated" | "enabled" | "paused" | "deprecated";
  initial_status: "validated" | "waiting_for_human";
  priority: "low" | "normal" | "high" | "urgent";
  risk: "low" | "medium" | "high" | "critical";
  modalities: string[];
  context_refs: string[];
  payload_refs: string[];
  permissions: string[];
  request_payload: Record<string, unknown>;
  idempotency_key: string;
  human_review_required: boolean;
  deadline_at: string;
  max_attempts: number;
};

export type DurableTaskCreateResult = {
  task_id: string;
  status: string;
  duplicate: boolean;
};

export type DurableTaskTree = {
  tasks: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
};

export class DurableTaskStoreError extends Error {
  constructor(
    public readonly operation: string,
    public readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "DurableTaskStoreError";
  }
}

export function createDurableTaskStore(client: RpcClient) {
  async function call<T>(operation: string, name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.rpc(name, args);
    if (error) {
      throw new DurableTaskStoreError(operation, error.code, error.message ?? "Durable task operation failed.");
    }
    return data as T;
  }

  return {
    createTask(input: DurableTaskCreateInput) {
      return call<DurableTaskCreateResult>("create_task", "sci_create_task", { p_task: input });
    },
    authorizeDispatch(input: {
      taskId: string;
      policyDecisionRef: string;
      humanApprovalRef?: string | null;
    }) {
      return call<Record<string, unknown>>("authorize_dispatch", "sci_authorize_task_dispatch", {
        p_task_id: input.taskId,
        p_policy_decision_ref: input.policyDecisionRef,
        p_human_approval_ref: input.humanApprovalRef ?? null,
      });
    },
    claimTasks(input: { workerId: string; limit?: number; leaseSeconds?: number }) {
      return call<Array<Record<string, unknown>>>("claim_tasks", "sci_claim_tasks", {
        p_worker_id: input.workerId,
        p_limit: input.limit ?? 1,
        p_lease_seconds: input.leaseSeconds ?? 60,
      });
    },
    completeTask(input: { taskId: string; leaseToken: string; result: Record<string, unknown> }) {
      return call<Record<string, unknown>>("complete_task", "sci_complete_task", {
        p_task_id: input.taskId,
        p_lease_token: input.leaseToken,
        p_result: input.result,
      });
    },
    failTask(input: { taskId: string; leaseToken: string; errorCode: string; retryable?: boolean }) {
      return call<Record<string, unknown>>("fail_task", "sci_fail_task", {
        p_task_id: input.taskId,
        p_lease_token: input.leaseToken,
        p_error_code: input.errorCode,
        p_retryable: input.retryable ?? true,
      });
    },
    recoverExpiredTasks(limit = 50) {
      return call<{ requeued: number; timed_out: number }>(
        "recover_expired_tasks",
        "sci_recover_expired_tasks",
        { p_limit: limit },
      );
    },
    cancelTask(taskId: string, ownerAuthUserId: string) {
      return call<{ task_id: string; cancelled_count: number }>("cancel_task", "sci_cancel_task", {
        p_task_id: taskId,
        p_owner_auth_user_id: ownerAuthUserId,
      });
    },
    getTaskTree(taskId: string, ownerAuthUserId: string) {
      return call<DurableTaskTree>("get_task_tree", "sci_get_task_tree", {
        p_task_id: taskId,
        p_owner_auth_user_id: ownerAuthUserId,
      });
    },
  };
}
