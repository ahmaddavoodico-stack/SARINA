/**
 * Deterministic, model-free task routing for SARINA Core Intelligence.
 *
 * This module only classifies and assigns a task. It never invokes a model,
 * accesses user data, performs a domain action, or grants permissions.
 */

export type TaskModality = "text" | "image" | "document" | "audio" | "other";
export type AgentId =
  | "conversation_coordinator"
  | "agronomy_advisor"
  | "crop_diagnostics"
  | "knowledge_research"
  | "marketplace_assistant"
  | "specialist_handoff"
  | "account_support"
  | "soil_water_specialist"
  | "irrigation_specialist"
  | "plant_nutrition_specialist"
  | "plant_health_specialist"
  | "climate_specialist"
  | "agricultural_knowledge_specialist"
  | "market_intelligence_specialist"
  | "trade_export_specialist"
  | "finance_economics_specialist"
  | "logistics_supply_chain_specialist";

export type TaskDomain =
  | "conversation"
  | "agronomy"
  | "crop_diagnostics"
  | "knowledge"
  | "marketplace"
  | "specialist"
  | "account"
  | "soil_water"
  | "irrigation"
  | "plant_nutrition"
  | "plant_health"
  | "climate"
  | "agricultural_knowledge"
  | "market_intelligence"
  | "trade_export"
  | "finance_economics"
  | "logistics_supply_chain";

export type AgentLifecycleState = "registered" | "simulated" | "enabled" | "paused" | "deprecated";

export type AgentDefinition = {
  id: AgentId;
  domain: TaskDomain;
  capabilities: readonly string[];
  acceptedModalities: readonly TaskModality[];
  /** Registration and execution availability are deliberately separate. */
  lifecycleState: AgentLifecycleState;
  enabled: boolean;
  humanReviewByDefault: boolean;
};

export const AGENT_REGISTRY: readonly AgentDefinition[] = [
  {
    id: "conversation_coordinator",
    domain: "conversation",
    capabilities: ["greeting", "general_triage", "clarification"],
    acceptedModalities: ["text", "audio", "image", "document", "other"],
    lifecycleState: "enabled",
    enabled: true,
    humanReviewByDefault: false,
  },
  {
    id: "agronomy_advisor",
    domain: "agronomy",
    capabilities: ["crop_management", "soil", "water", "nutrition", "cultivation"],
    acceptedModalities: ["text", "image", "document"],
    enabled: true,
    humanReviewByDefault: true,
  },
  {
    id: "crop_diagnostics",
    domain: "crop_diagnostics",
    capabilities: ["symptom_assessment", "pest_and_disease_triage", "plant_image_review"],
    acceptedModalities: ["text", "image", "document"],
    enabled: true,
    humanReviewByDefault: true,
  },
  {
    id: "knowledge_research",
    domain: "knowledge",
    capabilities: ["source_lookup", "document_review", "agricultural_research"],
    acceptedModalities: ["text", "document", "image"],
    enabled: true,
    humanReviewByDefault: false,
  },
  {
    id: "marketplace_assistant",
    domain: "marketplace",
    capabilities: ["catalog", "product_discovery", "order_status", "seller_questions"],
    acceptedModalities: ["text", "image", "document"],
    enabled: true,
    humanReviewByDefault: false,
  },
  {
    id: "specialist_handoff",
    domain: "specialist",
    capabilities: ["expert_escalation", "case_handoff", "professional_review"],
    acceptedModalities: ["text", "image", "document", "audio"],
    enabled: true,
    humanReviewByDefault: true,
  },
  {
    id: "account_support",
    domain: "account",
    capabilities: ["sign_in_help", "profile_help", "technical_support"],
    acceptedModalities: ["text", "image", "document"],
    enabled: true,
    humanReviewByDefault: false,
  },
  {
    id: "soil_water_specialist", domain: "soil_water",
    capabilities: ["soil_properties", "salinity", "alkalinity", "drainage", "water_quality"],
    acceptedModalities: ["text", "image", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "irrigation_specialist", domain: "irrigation",
    capabilities: ["crop_water_demand", "irrigation_scheduling", "irrigation_method_assessment"],
    acceptedModalities: ["text", "image", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "plant_nutrition_specialist", domain: "plant_nutrition",
    capabilities: ["nutrient_diagnosis", "fertilizer_planning", "nutrient_interactions"],
    acceptedModalities: ["text", "image", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "plant_health_specialist", domain: "plant_health",
    capabilities: ["pest_triage", "disease_triage", "symptom_differential", "plant_image_review"],
    acceptedModalities: ["text", "image", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "climate_specialist", domain: "climate",
    capabilities: ["weather_context", "heat_stress", "climate_adaptation"],
    acceptedModalities: ["text", "image", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "agricultural_knowledge_specialist", domain: "agricultural_knowledge",
    capabilities: ["approved_knowledge_retrieval", "source_evaluation", "research_synthesis"],
    acceptedModalities: ["text", "image", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "market_intelligence_specialist", domain: "market_intelligence",
    capabilities: ["market_demand", "price_trends", "target_market_research", "buyer_discovery"],
    acceptedModalities: ["text", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "trade_export_specialist", domain: "trade_export",
    capabilities: ["export_readiness", "trade_regulations", "standards_and_certificates", "labeling_requirements"],
    acceptedModalities: ["text", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "finance_economics_specialist", domain: "finance_economics",
    capabilities: ["cost_analysis", "margin_analysis", "investment_scenarios", "sensitivity_analysis"],
    acceptedModalities: ["text", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
  {
    id: "logistics_supply_chain_specialist", domain: "logistics_supply_chain",
    capabilities: ["packaging", "storage", "transport", "cold_chain", "supply_chain_risk"],
    acceptedModalities: ["text", "document"], lifecycleState: "registered", enabled: false, humanReviewByDefault: true,
  },
] as const;

export type RouteStatus = "assigned" | "clarification_required" | "agent_unavailable";

export type TaskRoute = {
  status: RouteStatus;
  agentId: AgentId;
  domain: TaskDomain;
  reasonCode: string;
  confidence: "high" | "medium" | "low";
  candidates: AgentId[];
  humanReviewRequired: boolean;
  modelPolicy: "none";
  executionStatus: "not_started";
};

type Rule = {
  domain: TaskDomain;
  agentId: AgentId;
  patterns: readonly RegExp[];
  reasonCode: string;
};

const RULES: readonly Rule[] = [
  {
    domain: "specialist",
    agentId: "specialist_handoff",
    reasonCode: "HIGH_CONSEQUENCE_OR_EXPLICIT_EXPERT_REQUEST",
    patterns: [
      /کارشناس|متخصص|مشاور حضوری|ارجاع به متخصص|صحبت با کارشناس|درخواست کارشناس/,
      /دوز سم|مقدار سم|سمپاشی|سموم خطرناک|مصرف آفت.?کش|نسخه درمانی/,
      /تجویز کود|مقدار دقیق کود|دوز کود|دستور اجرای آبیاری|کنترل خودکار آبیاری/,
      /pesticide dosage|chemical application|exact fertilizer rate|automated irrigation|talk to an expert/,
    ],
  },
  {
    domain: "crop_diagnostics",
    agentId: "crop_diagnostics",
    reasonCode: "PLANT_HEALTH_OR_SYMPTOM_REQUEST",
    patterns: [
      /بیمار|آفت|قارچ|باکتری|پوسید|زردی برگ|زرد شدن|لکه برگ|خشک شدن برگ|علائم بیماری|تشخیص بیماری/,
      /leaf spot|yellowing|wilting|rot|fungus|pest|disease|plant diagnosis/,
    ],
  },
  {
    domain: "marketplace",
    agentId: "marketplace_assistant",
    reasonCode: "MARKETPLACE_OR_ORDER_REQUEST",
    patterns: [
      /فروشگاه|بازارگاه|خرید|فروش محصول|سفارش|سبد خرید|قیمت محصول|فروشنده|محصولات من|پیگیری سفارش/,
      /marketplace|catalog|buy|sell|order status|seller|shopping cart/,
    ],
  },
  {
    domain: "account",
    agentId: "account_support",
    reasonCode: "ACCOUNT_OR_ACCESS_SUPPORT",
    patterns: [
      /ورود به حساب|رمز عبور|فراموشی رمز|ثبت.?نام|حساب کاربری|مشکل ورود|پروفایل/,
      /login|password reset|sign.?up|account access|profile settings/,
    ],
  },
  {
    domain: "knowledge",
    agentId: "knowledge_research",
    reasonCode: "RESEARCH_OR_SOURCE_REQUEST",
    patterns: [
      /منبع علمی|مقاله|تحقیق|بخشنامه|استاندارد|مطالعه کن|جست.?وجو کن|مقایسه علمی|مستندات/,
      /research|scientific source|paper|regulation|standard|literature review/,
    ],
  },
  {
    domain: "agronomy",
    agentId: "agronomy_advisor",
    reasonCode: "FARM_MANAGEMENT_REQUEST",
    patterns: [
      /کود|تغذیه گیاه|آبیاری|خاک|شوری|شوری خاک|ph خاک|کشت|کاشت|برداشت|هرس|نهال|موز|خرما|محصول زراعی/,
      /fertilizer|irrigation|soil|salinity|plant nutrition|cultivation|harvest|pruning|seedling/,
    ],
  },
];

const REGISTRY_BY_ID = new Map(AGENT_REGISTRY.map((agent) => [agent.id, agent]));

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\u064a]/g, "ی")
    .replace(/[\u0643]/g, "ک").replace(/\s+/g, " ").trim();
}

function hasMatch(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function makeRoute(
  status: RouteStatus,
  agent: AgentDefinition,
  reasonCode: string,
  confidence: TaskRoute["confidence"],
  candidates: AgentId[] = [agent.id],
): TaskRoute {
  return {
    status,
    agentId: agent.id,
    domain: agent.domain,
    reasonCode,
    confidence,
    candidates,
    humanReviewRequired: agent.humanReviewByDefault,
    modelPolicy: "none",
    executionStatus: "not_started",
  };
}

export function getRegisteredAgent(agentId: AgentId): AgentDefinition | undefined {
  return REGISTRY_BY_ID.get(agentId);
}

export function routeTask(input: {
  text?: string;
  modalities?: readonly TaskModality[];
}): TaskRoute {
  const text = normalizeText(input.text ?? "");
  const modalities = input.modalities?.length ? [...new Set(input.modalities)] : ["text" as const];

  const coordinator = REGISTRY_BY_ID.get("conversation_coordinator")!;
  if (!text && modalities.every((modality) => modality === "text" || modality === "audio")) {
    return makeRoute("clarification_required", coordinator, "TRANSCRIPT_OR_QUESTION_REQUIRED", "low");
  }

  // An attached plant image should reach diagnostic triage even if the caption is short.
  if (modalities.includes("image") &&
      (hasMatch(text, RULES[1].patterns) || !text || /گیاه|درخت|برگ|مزرعه|plant|leaf|crop/.test(text))) {
    const agent = REGISTRY_BY_ID.get("crop_diagnostics")!;
    return agent.enabled
      ? makeRoute("assigned", agent, "PLANT_IMAGE_REVIEW", "high")
      : makeRoute("agent_unavailable", coordinator, "CROP_DIAGNOSTICS_DISABLED", "low", [agent.id]);
  }

  const matches = RULES.filter((rule) => hasMatch(text, rule.patterns));

  // Safety escalation has precedence over all other classifications.
  const specialistMatch = matches.find((rule) => rule.domain === "specialist");
  if (specialistMatch) {
    const agent = REGISTRY_BY_ID.get(specialistMatch.agentId)!;
    return makeRoute("assigned", agent, specialistMatch.reasonCode, "high");
  }

  // Symptom diagnosis takes precedence over a crop-name-only agronomy match.
  const diagnosticMatch = matches.find((rule) => rule.domain === "crop_diagnostics");
  const nonAgronomyConflicts = matches.filter((rule) =>
    rule.domain !== "crop_diagnostics" && rule.domain !== "agronomy"
  );
  if (diagnosticMatch && nonAgronomyConflicts.length === 0) {
    const agent = REGISTRY_BY_ID.get(diagnosticMatch.agentId)!;
    return makeRoute("assigned", agent, diagnosticMatch.reasonCode, "high");
  }

  if (matches.length > 1) {
    return makeRoute(
      "clarification_required",
      coordinator,
      "MULTIPLE_TASK_DOMAINS_MATCHED",
      "low",
      matches.map((match) => match.agentId),
    );
  }

  if (matches.length === 1) {
    const rule = matches[0];
    const agent = REGISTRY_BY_ID.get(rule.agentId)!;
    if (!agent.enabled) {
      return makeRoute("agent_unavailable", coordinator, "REGISTERED_AGENT_DISABLED", "low", [agent.id]);
    }
    const unsupported = modalities.filter((modality) => !agent.acceptedModalities.includes(modality));
    if (unsupported.length) {
      return makeRoute("clarification_required", coordinator, "MODALITY_NOT_SUPPORTED_BY_AGENT", "low", [agent.id]);
    }
    return makeRoute(
      "assigned",
      agent,
      rule.reasonCode,
      rule.agentId === "specialist_handoff" ? "high" : "medium",
    );
  }

  if (modalities.includes("document")) {
    const agent = REGISTRY_BY_ID.get("knowledge_research")!;
    return makeRoute("assigned", agent, "DOCUMENT_REVIEW_REQUEST", "low");
  }

  if (/سلام|درود|خوبی|وقت بخیر|hello|hi\b|good morning/.test(text)) {
    return makeRoute("assigned", coordinator, "GREETING_OR_SOCIAL_TURN", "high");
  }

  return makeRoute("clarification_required", coordinator, "NO_CONFIDENT_DOMAIN_MATCH", "low");
}
