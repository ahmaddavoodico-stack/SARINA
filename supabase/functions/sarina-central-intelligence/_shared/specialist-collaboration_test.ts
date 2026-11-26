import { assertEquals } from "jsr:@std/assert";
import {
  aggregateSpecialistResults,
  planSpecialistCollaboration,
  type CollaborationPlan,
  type SpecialistResult,
} from "./specialist-collaboration.ts";

const PARENT = "11111111-1111-4111-8111-111111111111";

function readyPlan(): CollaborationPlan {
  return {
    status: "ready_for_sci_approval",
    parentTaskId: PARENT,
    selectedSpecialistCount: 2,
    maxSpecialists: 4,
    modelPolicy: "none",
    executionStarted: false,
    farmerResponseAuthorized: false,
    reasonCodes: ["MINIMUM_SPECIALIST_SET_PREPARED"],
    workItems: [
      {
        proposalKey: `${PARENT}:soil_water`,
        parentTaskId: PARENT,
        domain: "soil_water",
        agentId: "soil_water_specialist",
        purpose: "Assess soil and water.",
        expectedOutput: "Evidence-backed assessment.",
        contextRefs: ["farm:private-ref"],
        availability: "eligible",
        blockedReasons: [],
        humanReviewRequired: true,
        dispatchAuthorized: false,
      },
      {
        proposalKey: `${PARENT}:irrigation`,
        parentTaskId: PARENT,
        domain: "irrigation",
        agentId: "irrigation_specialist",
        purpose: "Assess irrigation.",
        expectedOutput: "Advisory options.",
        contextRefs: ["farm:private-ref"],
        availability: "eligible",
        blockedReasons: [],
        humanReviewRequired: true,
        dispatchAuthorized: false,
      },
    ],
  };
}

Deno.test("collaboration plan keeps registered-only specialists blocked", () => {
  const plan = planSpecialistCollaboration({
    parentTaskId: PARENT,
    requestedDomains: ["soil_water", "irrigation"],
    contextRefs: ["farm:private-ref"],
    modalities: ["text"],
  });
  assertEquals(plan.status, "blocked");
  assertEquals(plan.workItems.length, 2);
  assertEquals(plan.workItems.every((item) =>
    item.availability === "blocked" &&
    item.blockedReasons.includes("AGENT_NOT_ENABLED") &&
    item.dispatchAuthorized === false
  ), true);
  assertEquals(plan.executionStarted, false);
  assertEquals(plan.farmerResponseAuthorized, false);
  assertEquals(plan.modelPolicy, "none");
});

Deno.test("planner selects only requested domains, deduplicates and scopes context", () => {
  const plan = planSpecialistCollaboration({
    parentTaskId: PARENT,
    requestedDomains: ["soil_water", "soil_water", "irrigation"],
    contextRefs: ["farm:one", "farm:one", "soil-test:latest"],
    modalities: ["text"],
  });
  assertEquals(plan.selectedSpecialistCount, 2);
  assertEquals(plan.workItems.map((item) => item.domain), ["soil_water", "irrigation"]);
  assertEquals(plan.workItems[0].contextRefs, ["farm:one", "soil-test:latest"]);
});

Deno.test("planner refuses broad fan-out and unknown domains", () => {
  const tooMany = planSpecialistCollaboration({
    parentTaskId: PARENT,
    requestedDomains: ["soil_water", "irrigation", "plant_nutrition", "climate", "trade_export"],
    contextRefs: ["farm:one"],
    modalities: ["text"],
  });
  const unknown = planSpecialistCollaboration({
    parentTaskId: PARENT,
    requestedDomains: ["conversation"],
    contextRefs: ["farm:one"],
    modalities: ["text"],
  });
  assertEquals(tooMany.reasonCodes, ["SPECIALIST_FANOUT_LIMIT_EXCEEDED"]);
  assertEquals(unknown.reasonCodes, ["NON_SPECIALIST_OR_UNKNOWN_DOMAIN"]);
  assertEquals(tooMany.workItems.length, 0);
  assertEquals(unknown.workItems.length, 0);
});

Deno.test("planner blocks unsupported modalities and empty requests", () => {
  const unsupported = planSpecialistCollaboration({
    parentTaskId: PARENT,
    requestedDomains: ["trade_export"],
    contextRefs: ["farm:one"],
    modalities: ["audio"],
  });
  const empty = planSpecialistCollaboration({
    parentTaskId: PARENT,
    requestedDomains: [],
    contextRefs: ["farm:one"],
    modalities: ["text"],
  });
  assertEquals(unsupported.status, "blocked");
  assertEquals(unsupported.workItems[0].blockedReasons.includes("MODALITY_NOT_SUPPORTED"), true);
  assertEquals(empty.reasonCodes, ["NO_SPECIALIST_DOMAINS_SELECTED"]);
});

Deno.test("blocked plans cannot be aggregated", () => {
  const plan = planSpecialistCollaboration({
    parentTaskId: PARENT,
    requestedDomains: ["soil_water"],
    contextRefs: ["farm:one"],
    modalities: ["text"],
  });
  assertEquals(aggregateSpecialistResults(plan, []).status, "not_aggregatable");
});

Deno.test("aggregator preserves conflicting specialist findings and requires review", () => {
  const plan = readyPlan();
  const results: SpecialistResult[] = [
    {
      agentId: "soil_water_specialist",
      domain: "soil_water",
      status: "succeeded",
      findings: [{
        topicKey: "irrigation_water_ec",
        position: "acceptable_for_crop",
        summary: "The available measurement appears acceptable.",
        evidenceRefs: ["water-test:1"],
        confidence: "medium",
        missingInputs: [],
        limitations: ["Single sample."],
      }],
    },
    {
      agentId: "irrigation_specialist",
      domain: "irrigation",
      status: "succeeded",
      findings: [{
        topicKey: "irrigation_water_ec",
        position: "requires_caution",
        summary: "The measurement warrants caution for this crop.",
        evidenceRefs: ["crop-reference:2"],
        confidence: "medium",
        missingInputs: ["Repeat water sample."],
        limitations: ["Crop stage not confirmed."],
      }],
    },
  ];
  const aggregate = aggregateSpecialistResults(plan, results);
  assertEquals(aggregate.status, "needs_human_review");
  assertEquals(aggregate.findings.length, 2);
  assertEquals(aggregate.conflicts.length, 1);
  assertEquals(aggregate.conflicts[0].positions, ["acceptable_for_crop", "requires_caution"]);
  assertEquals(aggregate.automaticConsensus, false);
  assertEquals(aggregate.farmerResponseAuthorized, false);
});

Deno.test("aggregator reports missing specialist results as partial", () => {
  const plan = readyPlan();
  const aggregate = aggregateSpecialistResults(plan, [{
    agentId: "soil_water_specialist",
    domain: "soil_water",
    status: "succeeded",
    findings: [],
  }]);
  assertEquals(aggregate.status, "partial");
  assertEquals(aggregate.missingAgentIds, ["irrigation_specialist"]);
});

Deno.test("aggregator flags duplicate and unexpected results", () => {
  const plan = readyPlan();
  const result: SpecialistResult = {
    agentId: "soil_water_specialist",
    domain: "soil_water",
    status: "succeeded",
    findings: [],
  };
  const aggregate = aggregateSpecialistResults(plan, [
    result,
    result,
    { ...result, agentId: "climate_specialist", domain: "climate" },
  ]);
  assertEquals(aggregate.status, "needs_human_review");
  assertEquals(aggregate.issues, ["DUPLICATE_AGENT_RESULT", "UNEXPECTED_AGENT_OR_DOMAIN_RESULT"]);
});
