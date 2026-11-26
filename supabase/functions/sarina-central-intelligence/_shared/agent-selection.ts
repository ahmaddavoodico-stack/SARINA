import type { AgentId, TaskDomain } from "./task-orchestrator.ts";

export type SelectionDisposition =
  | "pilot_adapter_pending_acceptance"
  | "candidate_not_installed"
  | "internal_engine_first"
  | "defer_until_field_data";

export type ExecutionPattern =
  | "deterministic_first"
  | "retrieval_plus_shared_model"
  | "vision_triage_plus_expert"
  | "external_research_adapter_plus_internal_fallback"
  | "optimization_first";

export type SpecialistSelectionProfile = {
  agentId: AgentId;
  domain: TaskDomain;
  disposition: SelectionDisposition;
  executionPattern: ExecutionPattern;
  preferredComponents: readonly string[];
  optionalAdapters: readonly string[];
  hardBoundaries: readonly string[];
  acceptanceGates: readonly string[];
  providerDispatchEnabled: false;
};

/**
 * Selection baseline only. These profiles do not install models, enable agents,
 * authorize dispatch, or change the SCI registry lifecycle.
 */
export const SPECIALIST_SELECTION_PROFILES = [
  {
    agentId: "soil_water_specialist",
    domain: "soil_water",
    disposition: "internal_engine_first",
    executionPattern: "retrieval_plus_shared_model",
    preferredComponents: ["unit-and-lab-range validators", "soil/water rule calculations", "BGE-M3 hybrid retrieval candidate", "Qwen3 shared language model candidate after host benchmark"],
    optionalAdapters: [],
    hardBoundaries: ["No diagnosis from an LLM alone", "No chemical amendment or irrigation actuation", "Do not infer missing lab values"],
    acceptanceGates: ["Persian/Arabic/English soil-test benchmark", "unit and conversion tests", "source and lab provenance checks", "missing-data and out-of-range tests"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "irrigation_specialist",
    domain: "irrigation",
    disposition: "candidate_not_installed",
    executionPattern: "deterministic_first",
    preferredComponents: ["FAO-56 Penman-Monteith calculations", "crop-coefficient and water-balance engine", "AquaCrop Python 7.3 candidate", "self-hosted Open-Meteo candidate"],
    optionalAdapters: ["Qwen3 shared model for explanation only"],
    hardBoundaries: ["No irrigation actuation", "No schedule without crop stage, soil, water and weather context", "Local crop coefficients require validation"],
    acceptanceGates: ["FAO-56 reference test vectors", "local climate backtesting", "crop parameter provenance", "unit and timezone tests"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "plant_nutrition_specialist",
    domain: "plant_nutrition",
    disposition: "internal_engine_first",
    executionPattern: "retrieval_plus_shared_model",
    preferredComponents: ["deterministic nutrient-balance calculator", "crop/stage nutrient reference tables", "BGE-M3 retrieval candidate", "Qwen3 shared language model candidate"],
    optionalAdapters: ["qualified agronomist escalation"],
    hardBoundaries: ["No automatic fertilizer dosing or application", "No invented soil/leaf analysis", "Separate product concentration from nutrient dose"],
    acceptanceGates: ["unit and formulation tests", "crop-stage evidence review", "soil/leaf/water input validation", "agronomist-reviewed case set"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "plant_health_specialist",
    domain: "plant_health",
    disposition: "defer_until_field_data",
    executionPattern: "vision_triage_plus_expert",
    preferredComponents: ["image-quality and symptom checklist", "Qwen3-VL 4B candidate for triage only", "future crop-specific classifier trained/evaluated on expert-labelled field images"],
    optionalAdapters: ["qualified plant pathologist or crop-health expert"],
    hardBoundaries: ["No definitive diagnosis from a single image", "No pesticide prescription", "No treatment without risk and label checks"],
    acceptanceGates: ["local banana/date-palm field dataset", "expert verified labels", "out-of-distribution detection", "calibrated uncertainty", "prospective field validation"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "climate_specialist",
    domain: "climate",
    disposition: "candidate_not_installed",
    executionPattern: "deterministic_first",
    preferredComponents: ["self-hosted Open-Meteo candidate", "national meteorological sources", "heat/cold/wind/flood risk indices", "local station reconciliation"],
    optionalAdapters: ["Qwen3 shared model for dated summaries"],
    hardBoundaries: ["Distinguish forecast, observation and reanalysis", "No false precision for farm microclimate", "Show source resolution and timestamp"],
    acceptanceGates: ["forecast/archive distinction tests", "regional backtesting", "station comparison", "data freshness and source licensing checks"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "agricultural_knowledge_specialist",
    domain: "agricultural_knowledge",
    disposition: "candidate_not_installed",
    executionPattern: "retrieval_plus_shared_model",
    preferredComponents: ["SAI reviewed knowledge corpus", "BGE-M3 hybrid retrieval candidate", "BM25 lexical baseline", "Qwen3 shared synthesis candidate"],
    optionalAdapters: ["Manus for explicitly approved research tasks"],
    hardBoundaries: ["Raw model output is not trusted knowledge", "No SAI promotion without separate review", "Preserve source version and applicability"],
    acceptanceGates: ["Persian/Arabic/English retrieval evaluation", "citation-to-claim checks", "stale-source detection", "SAI promotion approval test"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "market_intelligence_specialist",
    domain: "market_intelligence",
    disposition: "pilot_adapter_pending_acceptance",
    executionPattern: "external_research_adapter_plus_internal_fallback",
    preferredComponents: ["SARINA Manus MCP gateway", "source-to-claim evidence registry", "BGE-M3 retrieval candidate", "Qwen3 internal fallback candidate after host benchmark"],
    optionalAdapters: ["Manus as first external research adapter only"],
    hardBoundaries: ["No buyer contact", "No external publication or commercial commitment", "No invented prices, buyers or trade figures"],
    acceptanceGates: ["existing pilot mission save/get round-trip", "first report scored against owner rubric", "heartbeat and declared capacity verified", "official-source traceability", "provider-off fallback test"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "trade_export_specialist",
    domain: "trade_export",
    disposition: "internal_engine_first",
    executionPattern: "retrieval_plus_shared_model",
    preferredComponents: ["official authority/source registry", "product-origin-destination requirement matrix", "date/version-aware rule checks", "BGE-M3 retrieval candidate"],
    optionalAdapters: ["Manus research support within approved mission scope"],
    hardBoundaries: ["Do not present legal interpretation as legal advice", "Separate law, voluntary standard and buyer preference", "No buyer or authority contact"],
    acceptanceGates: ["official primary-source coverage", "effective-date and jurisdiction checks", "HS-code uncertainty tests", "regulatory ambiguity escalation"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "finance_economics_specialist",
    domain: "finance_economics",
    disposition: "internal_engine_first",
    executionPattern: "deterministic_first",
    preferredComponents: ["deterministic cost/margin/cash-flow calculator", "sensitivity and scenario engine", "auditable unit conversion"],
    optionalAdapters: ["Qwen3 shared model for explanation only"],
    hardBoundaries: ["No invented prices, costs, exchange rates or yields", "No autonomous investment or credit decision", "Show assumptions and missing values"],
    acceptanceGates: ["known-answer calculation suite", "currency/date validation", "rounding and unit tests", "sensitivity reproducibility"],
    providerDispatchEnabled: false,
  },
  {
    agentId: "logistics_supply_chain_specialist",
    domain: "logistics_supply_chain",
    disposition: "candidate_not_installed",
    executionPattern: "optimization_first",
    preferredComponents: ["Google OR-Tools candidate", "storage/packaging constraints model", "route and cold-chain cost inputs"],
    optionalAdapters: ["Qwen3 shared model for explanation only"],
    hardBoundaries: ["No booking or carrier contact", "No invented freight quotes or transit times", "Optimization result is conditional on supplied inputs"],
    acceptanceGates: ["constraint feasibility tests", "route/capacity known-answer cases", "cost provenance checks", "solver timeout and infeasible-case handling"],
    providerDispatchEnabled: false,
  },
] as const satisfies readonly SpecialistSelectionProfile[];

export function getSpecialistSelectionProfile(agentId: AgentId) {
  return SPECIALIST_SELECTION_PROFILES.find((profile) => profile.agentId === agentId);
}
