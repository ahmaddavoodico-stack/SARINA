/**
 * Explicit local-first / external-fallback policy for SARINA.
 *
 * This module is deliberately not wired into the live SCI handler yet.
 * External dispatch requires three independent gates: operator enablement,
 * farmer/data-transfer approval, and an atomic budget reservation.
 */
export type AIRiskTier = "routine" | "complex" | "high_consequence";

export type RoutedAIRequest<T> = {
  correlationId: string;
  riskTier: AIRiskTier;
  payload: T;
};

export type AIProviderResult = {
  provider: "self_hosted" | "openai";
  model: string;
  content: string;
  latencyMs: number;
};

export interface AIProvider<T> {
  invoke(request: RoutedAIRequest<T>): Promise<AIProviderResult>;
}

export interface OpenAIBudgetGuard {
  /** Must atomically reserve estimated spend before the external API call. */
  reserve(correlationId: string): Promise<boolean>;
}

export type RoutingPolicy = {
  localEnabled: boolean;
  openAIFallbackEnabled: boolean;
  externalDataApproved: boolean;
};

export type RoutingOutcome =
  | { status: "completed"; result: AIProviderResult; reviewRequired: true }
  | { status: "disabled"; reason: "LOCAL_AI_DISABLED" }
  | { status: "specialist_review_required"; reason: string }
  | { status: "provider_unavailable"; reason: string };

export async function dispatchWithPolicy<T>(
  request: RoutedAIRequest<T>,
  policy: RoutingPolicy,
  providers: {
    local: AIProvider<T>;
    openai: AIProvider<T>;
    budget: OpenAIBudgetGuard;
  },
): Promise<RoutingOutcome> {
  const canUseOpenAI = async (): Promise<boolean> => {
    if (!policy.openAIFallbackEnabled || !policy.externalDataApproved) return false;
    return await providers.budget.reserve(request.correlationId);
  };

  // Complex/high-consequence cases are prepared by the stronger provider only
  // when external transfer and a budget reservation are explicitly approved.
  if (request.riskTier !== "routine") {
    if (!await canUseOpenAI()) {
      return {
        status: "specialist_review_required",
        reason: "EXTERNAL_ESCALATION_NOT_APPROVED_OR_BUDGET_UNAVAILABLE",
      };
    }
    try {
      const result = await providers.openai.invoke(request);
      return { status: "completed", result, reviewRequired: true };
    } catch {
      return { status: "provider_unavailable", reason: "OPENAI_PROVIDER_FAILED" };
    }
  }

  if (!policy.localEnabled) {
    return { status: "disabled", reason: "LOCAL_AI_DISABLED" };
  }

  try {
    const result = await providers.local.invoke(request);
    return { status: "completed", result, reviewRequired: true };
  } catch {
    if (!await canUseOpenAI()) {
      return {
        status: "provider_unavailable",
        reason: "LOCAL_PROVIDER_FAILED_AND_EXTERNAL_FALLBACK_NOT_APPROVED",
      };
    }
    try {
      const result = await providers.openai.invoke(request);
      return { status: "completed", result, reviewRequired: true };
    } catch {
      return { status: "provider_unavailable", reason: "LOCAL_AND_OPENAI_PROVIDERS_FAILED" };
    }
  }
}
