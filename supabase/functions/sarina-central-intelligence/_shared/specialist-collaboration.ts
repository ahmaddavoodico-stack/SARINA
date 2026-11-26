/**
 * SCI-owned, deterministic collaboration planning and result reconciliation.
 *
 * This module creates plans only. It never creates child tasks, dispatches
 * agents, calls models/providers, reads farm data, or performs domain actions.
 */
import {
  getRegisteredAgent,
  type AgentId,
  type TaskDomain,
  type TaskModality,
} from "./task-orchestrator.ts";

export type SpecialistDomain =
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

export type CollaborationPlanStatus =
  | "ready_for_sci_approval"
  | "blocked"
  | "clarification_required";

export type CollaborationWorkItem = {
  /** Stable proposal key; this is not a persisted task ID. */
  proposalKey: string;
  parentTaskId: string;
  domain: SpecialistDomain;
  agentId: AgentId;
  purpose: string;
  expectedOutput: string;
  contextRefs: string[];
  availability: "eligible" | "blocked";
  blockedReasons: string[];
  humanReviewRequired: true;
  dispatchAuthorized: false;
};

export type CollaborationPlan = {
  status: CollaborationPlanStatus;
  parentTaskId: string;
  workItems: CollaborationWorkItem[];
  reasonCodes: string[];
  selectedSpecialistCount: number;
  maxSpecialists: 4;
  modelPolicy: "none";
  executionStarted: false;
  farmerResponseAuthorized: false;
};

const DOMAIN_CONTRACTS: Record<SpecialistDomain, { agentId: AgentId; purpose: string; expectedOutput: string }> = {
  soil_water: {
    agentId: "soil_water_specialist",
    purpose: "Assess soil properties, salinity, alkalinity, drainage and irrigation-water quality.",
    expectedOutput: "Evidence-backed soil/water assessment, constraints, missing tests and uncertainty.",
  },
  irrigation: {
    agentId: "irrigation_specialist",
    purpose: "Assess crop water demand, irrigation timing and irrigation-method options.",
    expectedOutput: "Advisory options, assumptions, water-risk flags and missing inputs; no actuation.",
  },
  plant_nutrition: {
    agentId: "plant_nutrition_specialist",
    purpose: "Assess nutrient status and information needed for a reviewed nutrition plan.",
    expectedOutput: "Nutrient hypotheses, evidence, missing tests and review requirements; no dosing instruction.",
  },
  plant_health: {
    agentId: "plant_health_specialist",
    purpose: "Assess pest, disease and plant-disorder possibilities.",
    expectedOutput: "Differential possibilities, evidence, risk flags and escalation requirements.",
  },
  climate: {
    agentId: "climate_specialist",
    purpose: "Assess weather context and crop heat/cold or climate risks.",
    expectedOutput: "Dated climate-risk summary, time horizon, assumptions and adaptation options.",
  },
  agricultural_knowledge: {
    agentId: "agricultural_knowledge_specialist",
    purpose: "Retrieve and evaluate approved agricultural knowledge and research.",
    expectedOutput: "Source-linked evidence, applicability, limitations and knowledge-review status.",
  },
  market_intelligence: {
    agentId: "market_intelligence_specialist",
    purpose: "Assess market demand, price trends and target-market opportunities.",
    expectedOutput: "Dated market findings, source quality, assumptions and unknowns; no buyer contact.",
  },
  trade_export: {
    agentId: "trade_export_specialist",
    purpose: "Assess trade rules, standards, certificates and export-readiness gaps.",
    expectedOutput: "Requirement matrix, official sources, compliance gaps and caveats.",
  },
  finance_economics: {
    agentId: "finance_economics_specialist",
    purpose: "Analyze verified agricultural costs, margins and economic scenarios.",
    expectedOutput: "Transparent calculations, assumptions, sensitivity and uncertainty.",
  },
  logistics_supply_chain: {
    agentId: "logistics_supply_chain_specialist",
    purpose: "Assess packaging, storage, transport and supply-chain constraints.",
    expectedOutput: "Logistics options, constraints, evidence and operational risks.",
  },
};

const SPECIALIST_DOMAINS = Object.keys(DOMAIN_CONTRACTS) as SpecialistDomain[];

export function planSpecialistCollaboration(input: {
  parentTaskId: string;
  requestedDomains: readonly TaskDomain[];
  contextRefs: readonly string[];
  modalities: readonly TaskModality[];
}): CollaborationPlan {
  const base = {
    parentTaskId: input.parentTaskId,
    workItems: [] as CollaborationWorkItem[],
    selectedSpecialistCount: 0,
    maxSpecialists: 4 as const,
    modelPolicy: "none" as const,
    executionStarted: false as const,
    farmerResponseAuthorized: false as const,
  };

  if (!input.parentTaskId.trim() ||
      !Array.isArray(input.requestedDomains) ||
      !Array.isArray(input.contextRefs) ||
      input.contextRefs.some((ref) => typeof ref !== "string" || !ref.trim()) ||
      !Array.isArray(input.modalities) || input.modalities.length === 0) {
    return { ...base, status: "clarification_required", reasonCodes: ["INVALID_COLLABORATION_INPUT"] };
  }

  const uniqueDomains = [...new Set(input.requestedDomains)];
  if (uniqueDomains.length === 0) {
    return { ...base, status: "clarification_required", reasonCodes: ["NO_SPECIALIST_DOMAINS_SELECTED"] };
  }
  if (uniqueDomains.length > base.maxSpecialists) {
    return { ...base, status: "clarification_required", reasonCodes: ["SPECIALIST_FANOUT_LIMIT_EXCEEDED"] };
  }
  if (uniqueDomains.some((domain) => !SPECIALIST_DOMAINS.includes(domain as SpecialistDomain))) {
    return { ...base, status: "clarification_required", reasonCodes: ["NON_SPECIALIST_OR_UNKNOWN_DOMAIN"] };
  }

  const domains = uniqueDomains as SpecialistDomain[];
  const workItems = domains.map((domain): CollaborationWorkItem => {
    const contract = DOMAIN_CONTRACTS[domain];
    const agent = getRegisteredAgent(contract.agentId);
    const blockedReasons: string[] = [];
    if (!agent || !agent.enabled || agent.lifecycleState !== "enabled") {
      blockedReasons.push("AGENT_NOT_ENABLED");
    }
    if (agent && input.modalities.some((modality) => !agent.acceptedModalities.includes(modality))) {
      blockedReasons.push("MODALITY_NOT_SUPPORTED");
    }
    return {
      proposalKey: `${input.parentTaskId}:${domain}`,
      parentTaskId: input.parentTaskId,
      domain,
      agentId: contract.agentId,
      purpose: contract.purpose,
      expectedOutput: contract.expectedOutput,
      contextRefs: [...new Set(input.contextRefs)],
      availability: blockedReasons.length ? "blocked" : "eligible",
      blockedReasons,
      humanReviewRequired: true,
      dispatchAuthorized: false,
    };
  });

  const blocked = workItems.some((item) => item.availability === "blocked");
  return {
    ...base,
    status: blocked ? "blocked" : "ready_for_sci_approval",
    workItems,
    selectedSpecialistCount: workItems.length,
    reasonCodes: blocked ? [...new Set(workItems.flatMap((item) => item.blockedReasons))] : ["MINIMUM_SPECIALIST_SET_PREPARED"],
  };
}

export type SpecialistFinding = {
  topicKey: string;
  position: string;
  summary: string;
  evidenceRefs: string[];
  confidence: "low" | "medium" | "high";
  missingInputs: string[];
  limitations: string[];
};

export type SpecialistResult = {
  agentId: AgentId;
  domain: SpecialistDomain;
  status: "succeeded" | "failed" | "timed_out" | "cancelled";
  findings: SpecialistFinding[];
  errorCode?: string;
};

export type CollaborationAggregate = {
  status: "complete" | "partial" | "needs_human_review" | "not_aggregatable";
  findings: SpecialistFinding[];
  conflicts: Array<{ topicKey: string; positions: string[] }>;
  missingAgentIds: AgentId[];
  failedAgentIds: AgentId[];
  issues: string[];
  humanReviewRequired: true;
  automaticConsensus: false;
  farmerResponseAuthorized: false;
};

export function aggregateSpecialistResults(
  plan: CollaborationPlan,
  results: readonly SpecialistResult[],
): CollaborationAggregate {
  const empty = {
    findings: [] as SpecialistFinding[],
    conflicts: [] as Array<{ topicKey: string; positions: string[] }>,
    missingAgentIds: [] as AgentId[],
    failedAgentIds: [] as AgentId[],
    issues: [] as string[],
    humanReviewRequired: true as const,
    automaticConsensus: false as const,
    farmerResponseAuthorized: false as const,
  };
  if (plan.status !== "ready_for_sci_approval" || plan.executionStarted || !plan.workItems.length) {
    return { ...empty, status: "not_aggregatable", issues: ["PLAN_NOT_EXECUTABLE_OR_EMPTY"] };
  }

  const expected = new Map(plan.workItems.map((item) => [item.agentId, item]));
  const seen = new Set<AgentId>();
  const accepted: SpecialistResult[] = [];
  for (const result of results) {
    const item = expected.get(result.agentId);
    if (!item || item.domain !== result.domain) {
      empty.issues.push("UNEXPECTED_AGENT_OR_DOMAIN_RESULT");
      continue;
    }
    if (seen.has(result.agentId)) {
      empty.issues.push("DUPLICATE_AGENT_RESULT");
      continue;
    }
    seen.add(result.agentId);
    if (result.status !== "succeeded") {
      empty.failedAgentIds.push(result.agentId);
      continue;
    }
    if (!Array.isArray(result.findings) || result.findings.some((finding) =>
      !finding.topicKey?.trim() || !finding.position?.trim() || !finding.summary?.trim() ||
      !Array.isArray(finding.evidenceRefs) || !Array.isArray(finding.missingInputs) ||
      !Array.isArray(finding.limitations) ||
      !["low", "medium", "high"].includes(finding.confidence)
    )) {
      empty.issues.push("INVALID_SPECIALIST_RESULT");
      empty.failedAgentIds.push(result.agentId);
      continue;
    }
    accepted.push(result);
  }

  empty.missingAgentIds = [...expected.keys()].filter((agentId) => !seen.has(agentId));
  empty.findings = accepted.flatMap((result) => result.findings.map((finding) => structuredClone(finding)));

  const positionsByTopic = new Map<string, Set<string>>();
  for (const finding of empty.findings) {
    const topic = finding.topicKey.normalize("NFKC").trim().toLocaleLowerCase();
    const position = finding.position.normalize("NFKC").trim().toLocaleLowerCase();
    const positions = positionsByTopic.get(topic) ?? new Set<string>();
    positions.add(position);
    positionsByTopic.set(topic, positions);
  }
  empty.conflicts = [...positionsByTopic.entries()]
    .filter(([, positions]) => positions.size > 1)
    .map(([topicKey, positions]) => ({ topicKey, positions: [...positions].sort() }));

  const incomplete = empty.missingAgentIds.length > 0 || empty.failedAgentIds.length > 0;
  const status = empty.issues.length || empty.conflicts.length
    ? "needs_human_review"
    : incomplete ? "partial" : "complete";
  return { ...empty, status };
}
