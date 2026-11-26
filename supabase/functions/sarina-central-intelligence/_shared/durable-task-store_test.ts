import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
  createDurableTaskStore,
  DurableTaskStoreError,
  type RpcClient,
} from "./durable-task-store.ts";

Deno.test("durable task store maps create request to the private server RPC contract", async () => {
  let seenName = "";
  let seenArgs: Record<string, unknown> = {};
  const client: RpcClient = {
    async rpc(name, args) {
      seenName = name;
      seenArgs = args;
      return { data: { task_id: "task-1", status: "waiting_for_human", duplicate: false }, error: null };
    },
  };
  const store = createDurableTaskStore(client);
  const result = await store.createTask({
    task_id: "task-1",
    task_kind: "parent",
    owner_auth_user_id: "user-1",
    farm_id: "farm-1",
    correlation_id: "corr-1",
    channel: "chat",
    intent: "general_request",
    domain: "conversation",
    agent_id: "conversation_coordinator",
    agent_lifecycle_state: "enabled",
    initial_status: "waiting_for_human",
    priority: "normal",
    risk: "low",
    modalities: ["text"],
    context_refs: ["farm:farm-1"],
    payload_refs: ["request:req-1"],
    permissions: ["read:farm_context"],
    request_payload: { question: "test" },
    idempotency_key: "idem-key-12345678",
    human_review_required: true,
    deadline_at: "2026-11-26T02:00:00.000Z",
    max_attempts: 3,
  });
  assertEquals(seenName, "sci_create_task");
  assertEquals((seenArgs.p_task as Record<string, unknown>).task_id, "task-1");
  assertEquals(result.duplicate, false);
});

Deno.test("durable task store sends owner scope for task history and cancellation", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: RpcClient = {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: name === "sci_get_task_tree"
          ? { tasks: [{ task_id: "task-1" }], events: [] }
          : { task_id: "task-1", cancelled_count: 2 },
        error: null,
      };
    },
  };
  const store = createDurableTaskStore(client);
  const tree = await store.getTaskTree("task-1", "owner-auth-1");
  const cancelled = await store.cancelTask("task-1", "owner-auth-1");
  assertEquals(tree.tasks.length, 1);
  assertEquals(cancelled.cancelled_count, 2);
  assertEquals(calls[0].args.p_owner_auth_user_id, "owner-auth-1");
  assertEquals(calls[1].args.p_owner_auth_user_id, "owner-auth-1");
});

Deno.test("durable task store surfaces RPC errors without leaking credentials", async () => {
  const client: RpcClient = {
    async rpc() {
      return { data: null, error: { code: "42501", message: "Service role required" } };
    },
  };
  const store = createDurableTaskStore(client);
  const error = await assertRejects(
    () => store.recoverExpiredTasks(),
    DurableTaskStoreError,
  ) as DurableTaskStoreError;
  assertEquals(error.operation, "recover_expired_tasks");
  assertEquals(error.code, "42501");
  assertEquals(error.message, "Service role required");
});
