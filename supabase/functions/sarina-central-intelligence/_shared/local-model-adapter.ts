/**
 * Provider-neutral local model adapter for SARINA's low-risk AI pilot.
 *
 * Supports Strata/Ollama/other OpenAI-compatible local runtimes.
 * This module is intentionally not wired into production dispatch.
 * SCI remains responsible for consent, scope, risk classification and routing.
 */
export type LocalTaskCategory =
  | "routine_chat"
  | "summarization"
  | "classification"
  | "extraction";

export type LocalChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LocalModelRequest = {
  task: LocalTaskCategory;
  correlationId: string;
  language: "fa" | "en" | "ar";
  messages: LocalChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
};

export type LocalModelResult = {
  provider: "self_hosted";
  runtime: "ollama" | "strata" | "openai_compatible";
  model: string;
  correlationId: string;
  content: string;
  latencyMs: number;
  finishReason: string | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  };
};

type AdapterOptions = {
  baseUrl: string;
  model: string;
  allowedModels: string[];
  runtime: LocalModelResult["runtime"];
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeBaseUrl(value: string): string {
  const parsed = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) {
    throw new Error("LOCAL_AI_ENDPOINT_MUST_USE_HTTPS");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error("LOCAL_AI_ENDPOINT_CONTAINS_DISALLOWED_URL_PARTS");
  }
  return parsed.toString().replace(/\/+$/, "");
}

export class LocalModelAdapter {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: AdapterOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;

    if (!options.model || !options.allowedModels.includes(options.model)) {
      throw new Error("LOCAL_AI_MODEL_NOT_ALLOWLISTED");
    }
    if (this.timeoutMs < 1_000 || this.timeoutMs > 60_000) {
      throw new Error("LOCAL_AI_TIMEOUT_OUT_OF_RANGE");
    }
  }

  async invoke(request: LocalModelRequest): Promise<LocalModelResult> {
    if (!request.correlationId || request.correlationId.length > 128) {
      throw new Error("LOCAL_AI_INVALID_CORRELATION_ID");
    }
    if (!Array.isArray(request.messages) || request.messages.length < 1 || request.messages.length > 30) {
      throw new Error("LOCAL_AI_INVALID_MESSAGE_COUNT");
    }
    if (!request.messages.every((message) =>
      ["system", "user", "assistant"].includes(message.role) &&
      typeof message.content === "string" &&
      message.content.length <= 12_000
    )) {
      throw new Error("LOCAL_AI_INVALID_MESSAGE");
    }

    const serialized = JSON.stringify(request.messages);
    if (new TextEncoder().encode(serialized).byteLength > 40_000) {
      throw new Error("LOCAL_AI_PAYLOAD_TOO_LARGE");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const startedAt = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.options.apiKey) {
        headers.Authorization = `Bearer ${this.options.apiKey}`;
      }

      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.options.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.3,
          max_tokens: Math.min(Math.max(request.maxOutputTokens ?? 700, 64), 1_500),
          stream: false,
        }),
      });

      if (!response.ok) {
        // Do not include provider response bodies: they may contain sensitive data.
        throw new Error(`LOCAL_AI_PROVIDER_HTTP_${response.status}`);
      }

      const data: unknown = await response.json();
      if (!isRecord(data) || !Array.isArray(data.choices) || !isRecord(data.choices[0])) {
        throw new Error("LOCAL_AI_INVALID_PROVIDER_RESPONSE");
      }
      const choice = data.choices[0];
      const message = choice.message;
      if (!isRecord(message) || typeof message.content !== "string" || !message.content.trim()) {
        throw new Error("LOCAL_AI_EMPTY_MODEL_OUTPUT");
      }

      const usage = isRecord(data.usage) ? data.usage : {};
      return {
        provider: "self_hosted",
        runtime: this.options.runtime,
        model: this.options.model,
        correlationId: request.correlationId,
        content: message.content,
        latencyMs: Date.now() - startedAt,
        finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
        usage: {
          promptTokens: optionalNumber(usage.prompt_tokens),
          completionTokens: optionalNumber(usage.completion_tokens),
          totalTokens: optionalNumber(usage.total_tokens),
        },
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("LOCAL_AI_PROVIDER_TIMEOUT");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Disabled by default. The model ID must be explicitly allowlisted in server
 * secrets; caller input can never choose a provider, runtime, endpoint or model.
 */
export function createLocalModelAdapterFromEnv(): LocalModelAdapter {
  if (Deno.env.get("SARINA_LOCAL_AI_ENABLED") !== "true") {
    throw new Error("LOCAL_AI_ADAPTER_DISABLED");
  }

  const baseUrl = Deno.env.get("SARINA_LOCAL_AI_BASE_URL") ?? "";
  const model = Deno.env.get("SARINA_LOCAL_AI_MODEL") ?? "";
  const allowedModels = (Deno.env.get("SARINA_LOCAL_AI_ALLOWED_MODELS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const runtimeValue = Deno.env.get("SARINA_LOCAL_AI_RUNTIME") ?? "ollama";
  const runtime = ["ollama", "strata"].includes(runtimeValue)
    ? runtimeValue as "ollama" | "strata"
    : "openai_compatible";

  if (!baseUrl || !model || !allowedModels.includes(model)) {
    throw new Error("LOCAL_AI_ADAPTER_NOT_CONFIGURED_OR_MODEL_NOT_ALLOWLISTED");
  }

  return new LocalModelAdapter({
    baseUrl,
    model,
    allowedModels,
    runtime,
    apiKey: Deno.env.get("SARINA_LOCAL_AI_API_KEY") ?? undefined,
  });
}
