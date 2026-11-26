import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { z } from "zod";

const SERVER_NAME = "sarina-manus-mcp";
const SERVER_VERSION = "0.1.0";
const MAX_REQUEST_BYTES = 256 * 1024;

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return difference === 0;
}

function authorized(req: Request): boolean {
  const expected = Deno.env.get("SARINA_MANUS_ACCESS_TOKEN") ?? "";
  if (expected.length < 32) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  return constantTimeEqual(header.slice(7).trim(), expected);
}

function getAdminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) throw new Error("SARINA_DATABASE_NOT_CONFIGURED");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MANUS_INSTANCE_ID = "manus_market_intelligence";
const MANUS_CAPABILITIES = [
  "sarina_connection_check",
  "sarina_integration_capabilities",
  "save_market_research_draft",
  "list_market_research_drafts",
  "get_market_research_draft",
  "sarina_agent_heartbeat",
] as const;

async function recordManusHeartbeat(input: {
  capabilities: string[];
  activeTaskCount: number;
  capacity: number | null;
  eventType?: "heartbeat" | "capability_check";
}) {
  const client = getAdminClient();
  const now = new Date().toISOString();
  const capabilityCheckOk = MANUS_CAPABILITIES.every((name) => input.capabilities.includes(name));
  const runtimeState = !capabilityCheckOk ? "responding" : input.activeTaskCount > 0 ? "busy" : "ready";
  const health = capabilityCheckOk ? "healthy" : "unknown";
  const reasonCode = capabilityCheckOk ? "AUTHENTICATED_MCP_HEARTBEAT_AND_CAPABILITIES_CONFIRMED" : "MCP_CAPABILITY_SET_INCOMPLETE";
  const { error } = await client.from("sci_agent_runtime").upsert({
    agent_instance_id: MANUS_INSTANCE_ID,
    adapter_id: "manus",
    specialist_role: "market_intelligence_specialist",
    lifecycle_state: "enabled",
    dispatch_enabled: false,
    last_heartbeat_at: now,
    last_capability_check_at: now,
    capability_check_ok: capabilityCheckOk,
    capabilities: input.capabilities,
    active_task_count: input.activeTaskCount,
    capacity: input.capacity,
    runtime_metadata: { gateway_version: SERVER_VERSION, signal_source: "authenticated_manus_mcp_call" },
    updated_at: now,
  }, { onConflict: "agent_instance_id" });
  if (error) throw error;
  const { error: eventError } = await client.from("sci_agent_health_events").insert({
    agent_instance_id: MANUS_INSTANCE_ID,
    event_type: input.eventType ?? "heartbeat",
    health,
    runtime_state: runtimeState,
    reason_code: reasonCode,
    evidence: { capability_check_ok: capabilityCheckOk, active_task_count: input.activeTaskCount, capacity: input.capacity, capability_count: input.capabilities.length },
    occurred_at: now,
  });
  if (eventError) throw eventError;
  return { heartbeat_at: now, runtime_state: runtimeState, health, capability_check_ok: capabilityCheckOk, reason_code: reasonCode };
}

const mcp = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  schemaAdapter: (schema) => z.toJSONSchema(schema as z.ZodType),
});

mcp.tool(
  "sarina_connection_check",
  {
    description: "Check that Manus can reach the authenticated SARINA integration gateway. Does not access farmer or production business data.",
    inputSchema: z.object({}),
    handler: async () => {
    const databaseConfigured = Boolean(
      Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );
    let databaseConnected = false;
    let draftStoreReady = false;
    let runtimeSignal: Record<string, unknown> | null = null;
    if (databaseConfigured) {
      try {
        const { error } = await getAdminClient()
          .from("sarina_manus_market_research_drafts")
          .select("id")
          .limit(1);
        databaseConnected = !error;
        draftStoreReady = !error;
        if (!error) {
          runtimeSignal = await recordManusHeartbeat({
            capabilities: [...MANUS_CAPABILITIES],
            activeTaskCount: 0,
            capacity: null,
            eventType: "capability_check",
          });
        }
      } catch {
        databaseConnected = false;
        draftStoreReady = false;
        runtimeSignal = null;
      }
    }
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ok: true,
          service: SERVER_NAME,
          version: SERVER_VERSION,
          database_configured: databaseConfigured,
          database_connected: databaseConnected,
          draft_store_ready: draftStoreReady,
          runtime_signal: runtimeSignal,
          access_scope: [
            "read integration capabilities",
            "save agricultural market research drafts",
            "list and retrieve those drafts",
          ],
          protected_resources: [
            "production product catalog",
            "farmer identities and farm records",
            "orders, payments, and marketplace publication",
          ],
        }),
      }],
    };
  }
  }
);

mcp.tool(
  "sarina_integration_capabilities",
  {
    description: "Describe the limited actions available to Manus through SARINA.",
    inputSchema: z.object({}),
    handler: async () => ({
    content: [{
      type: "text",
      text: JSON.stringify({
        integration: "SARINA direct Manus MCP",
        capabilities: [
          { tool: "sarina_connection_check", access: "read-only" },
          { tool: "sarina_integration_capabilities", access: "read-only" },
          { tool: "save_market_research_draft", access: "insert-only; human review required" },
          { tool: "list_market_research_drafts", access: "read-only; own integration workspace" },
          { tool: "get_market_research_draft", access: "read-only; own integration workspace" },
        ],
        prohibited: [
          "publish or edit active products",
          "change prices or inventory",
          "read or edit farmer identities, farms, or private conversations",
          "place orders, issue refunds, or make payments",
          "contact companies or publish external content",
          "change production configuration",
        ],
        approval_rule: "All market research remains a draft until an authorized SARINA reviewer approves it.",
      }),
    }],
  })
  }
);

mcp.tool(
  "sarina_agent_heartbeat",
  {
    description: "Send an authenticated Manus runtime heartbeat to SCI. This reports only adapter health, task load and declared MCP capabilities; it does not authorize mission dispatch.",
    inputSchema: z.object({
      active_task_count: z.number().int().min(0).max(100),
      capacity: z.number().int().min(1).max(100).nullable(),
      capabilities: z.array(z.enum([
        "sarina_connection_check",
        "sarina_integration_capabilities",
        "save_market_research_draft",
        "list_market_research_drafts",
        "get_market_research_draft",
        "sarina_agent_heartbeat",
      ])).max(6),
    }),
    handler: async ({ active_task_count, capacity, capabilities }) => {
      try {
        const signal = await recordManusHeartbeat({
          activeTaskCount: active_task_count,
          capacity,
          capabilities,
          eventType: "heartbeat",
        });
        return { content: [{ type: "text", text: JSON.stringify({ ok: true, agent_instance_id: MANUS_INSTANCE_ID, ...signal, dispatch_enabled: false }) }] };
      } catch {
        return { isError: true, content: [{ type: "text", text: "Could not persist the Manus runtime heartbeat to SCI." }] };
      }
    },
  }
);

const sourceSchema = z.object({
  title: z.string().min(1).max(250),
  url: z.string().url().refine((value) => value.startsWith("https://"), {
    message: "Sources must use HTTPS URLs.",
  }),
  publisher: z.string().max(200).optional(),
  accessed_at: z.string().max(40).optional(),
});

mcp.tool(
  "save_market_research_draft",
  {
    description: "Save a structured agricultural market research report as a private SARINA draft. It is never published or added to the active product catalog.",
    inputSchema: z.object({
      title: z.string().min(1).max(200),
      market_scope: z.string().min(1).max(300),
      summary: z.string().min(1).max(8000),
      findings: z.array(z.string().min(1).max(1500)).max(30),
      sources: z.array(sourceSchema).max(30),
      recommendations: z.array(z.string().min(1).max(1500)).max(20),
      external_task_id: z.string().min(3).max(160).optional(),
    }),
    handler: async (args) => {
    try {
      const supabase = getAdminClient();
      let externalMissionId: string | null = null;
      if (args.external_task_id) {
        const { data: mission, error: missionError } = await supabase
          .from("sci_external_missions")
          .select("id")
          .eq("external_task_id", args.external_task_id)
          .maybeSingle();
        if (missionError) throw missionError;
        if (!mission) throw new Error("EXTERNAL_MISSION_NOT_REGISTERED");
        externalMissionId = mission.id;
      }
      const { data, error } = await supabase
        .from("sarina_manus_market_research_drafts")
        .insert({
          title: args.title,
          market_scope: args.market_scope,
          summary: args.summary,
          findings: args.findings,
          sources: args.sources,
          recommendations: args.recommendations,
          status: "pending_review",
          submitted_by: "manus",
          external_mission_id: externalMissionId,
        })
        .select("id,title,status,created_at,external_mission_id")
        .single();

      if (error) throw error;
      if (externalMissionId) {
        await supabase.from("sci_external_missions").update({
          draft_id: data.id,
          status: "owner_review",
          report_received_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", externalMissionId);
      }
      const now = new Date().toISOString();
      await supabase.from("sci_agent_runtime").update({
        last_success_at: now,
        updated_at: now,
      }).eq("agent_instance_id", MANUS_INSTANCE_ID);
      await supabase.from("sci_agent_health_events").insert({
        agent_instance_id: MANUS_INSTANCE_ID,
        event_type: "task_succeeded",
        health: "healthy",
        runtime_state: "responding",
        reason_code: "MARKET_RESEARCH_DRAFT_SAVED",
        evidence: { draft_id: data.id, mission_linked: Boolean(externalMissionId) },
        occurred_at: now,
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ ok: true, saved_as: "private_draft", draft: data }),
        }],
      };
    } catch (error) {
      console.error("save_market_research_draft failed", error instanceof Error ? error.message : "unknown");
      return {
        isError: true,
        content: [{ type: "text", text: "Could not save the research draft. Check the SARINA integration database configuration." }],
      };
    }
  }
  }
);

mcp.tool(
  "list_market_research_drafts",
  {
    description: "List recent private market research drafts submitted through the Manus integration.",
    inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
    handler: async ({ limit }) => {
    try {
      const { data, error } = await getAdminClient()
        .from("sarina_manus_market_research_drafts")
        .select("id,title,market_scope,status,created_at")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, drafts: data ?? [] }) }] };
    } catch (error) {
      console.error("list_market_research_drafts failed", error instanceof Error ? error.message : "unknown");
      return { isError: true, content: [{ type: "text", text: "Could not read research drafts from SARINA." }] };
    }
  }
  }
);

mcp.tool(
  "get_market_research_draft",
  {
    description: "Retrieve one private market research draft by its SARINA draft ID.",
    inputSchema: z.object({ draft_id: z.string().uuid() }),
    handler: async ({ draft_id }) => {
    try {
      const { data, error } = await getAdminClient()
        .from("sarina_manus_market_research_drafts")
        .select("id,title,market_scope,summary,findings,sources,recommendations,status,created_at")
        .eq("id", draft_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { isError: true, content: [{ type: "text", text: "Draft not found." }] };
      return { content: [{ type: "text", text: JSON.stringify({ ok: true, draft: data }) }] };
    } catch (error) {
      console.error("get_market_research_draft failed", error instanceof Error ? error.message : "unknown");
      return { isError: true, content: [{ type: "text", text: "Could not retrieve the research draft from SARINA." }] };
    }
  }
  }
);

const transport = new StreamableHttpTransport();
const mcpHandler = transport.bind(mcp);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": "https://manus.im",
      "access-control-allow-headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "vary": "Origin",
    }});
  }

  if (req.method !== "GET" && req.method !== "POST" && req.method !== "DELETE") {
    return jsonResponse(405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const configuredToken = Deno.env.get("SARINA_MANUS_ACCESS_TOKEN") ?? "";
  if (configuredToken.length < 32) {
    return jsonResponse(503, { ok: false, error: "INTEGRATION_NOT_CONFIGURED" });
  }
  if (!authorized(req)) {
    return jsonResponse(401, { ok: false, error: "UNAUTHORIZED" });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return jsonResponse(413, { ok: false, error: "REQUEST_TOO_LARGE" });
  }

  try {
    let mcpRequest = req;
    if (req.method === "POST") {
      const body = await req.arrayBuffer();
      if (body.byteLength > MAX_REQUEST_BYTES) {
        return jsonResponse(413, { ok: false, error: "REQUEST_TOO_LARGE" });
      }
      mcpRequest = new Request(req.url, {
        method: req.method,
        headers: req.headers,
        body,
      });
    }
    const response = await mcpHandler(mcpRequest);
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status: response.status, headers });
  } catch (error) {
    console.error("SARINA Manus MCP request failed", error instanceof Error ? error.message : "unknown");
    return jsonResponse(500, { ok: false, error: "MCP_REQUEST_FAILED" });
  }
});
