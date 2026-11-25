import { assert, assertEquals } from "jsr:@std/assert@1";
import { validateSaiCaseEnvelope } from "../../../../src/lib/sai/evidence-contract.ts";
import { buildSaiCaseEnvelope } from "./assembler.ts";

Deno.test("assembler produces a valid private case without promoting shared knowledge", () => {
  const envelope = buildSaiCaseEnvelope({
    farm: { id: "farm-1", created_at: "2026-01-01T00:00:00.000Z" },
    cropCycles: [{
      id: "cycle-1", field_id: "field-1", crop_id: "crop-1",
      variety_id: null, planting_date: "2026-02-01",
    }],
    soilTests: [{
      id: "soil-1", sampled_at: "2026-02-02", data_source: "laboratory",
      ph: 7.8, ec_ds_m: 1.2, organic_matter_pct: null,
    }],
    waterTests: [],
    irrigationEvents: [{
      id: "irrigation-1", started_at: "2026-02-03T08:00:00Z",
      water_volume_m3: 12, duration_minutes: 90,
    }],
    observations: [{
      id: "observation-1", observed_at: "2026-02-04T08:00:00Z",
      description: "Farmer-reported leaf yellowing",
    }],
    productivityMeasurements: [{
      id: "measurement-1", metric_value: 120, unit_code: "kg/ha",
      metric_code: "yield", observed_at: "2026-03-01T00:00:00Z",
      source_type: "measured", quality_label: "medium",
    }],
    baselines: [],
    contextObservations: [],
    outcomeReviews: [],
    improvementActions: [{
      id: "action-1", title: "Improve drainage",
      status: "completed", completed_at: "2026-02-05T00:00:00Z",
    }],
    requestId: "case-1",
    assembledAt: "2026-03-02T00:00:00Z",
  });

  assertEquals(validateSaiCaseEnvelope(envelope), []);
  assertEquals(envelope.governance.eligibleForSharedKnowledge, false);
  assertEquals(envelope.governance.farmerConsent, "not_checked");
  assertEquals(envelope.outcome.causalClaimPermitted, false);
  assert(envelope.evidence.some((item) =>
    item.kind === "metric_value" && item.value?.originalUnit === "kg/ha"
  ));
  assert(envelope.interventions.some((item) =>
    item.status === "performed" && item.performedAt === "2026-02-05T00:00:00.000Z"
  ));
});

Deno.test("assembler preserves unverified AI evidence as unverified and non-shareable", () => {
  const envelope = buildSaiCaseEnvelope({
    farm: { id: "farm-2", created_at: "2026-01-01T00:00:00.000Z" },
    cropCycles: [],
    soilTests: [],
    waterTests: [],
    irrigationEvents: [],
    observations: [],
    productivityMeasurements: [{
      id: "measurement-ai", metric_value: 3, unit_code: "score",
      observed_at: "2026-02-01T00:00:00Z",
      source_type: "ai_generated_unverified", quality_label: "unknown",
    }],
    baselines: [],
    contextObservations: [],
    outcomeReviews: [],
    improvementActions: [],
    requestId: "case-2",
    assembledAt: "2026-02-02T00:00:00Z",
  });

  assertEquals(validateSaiCaseEnvelope(envelope), []);
  const aiEvidence = envelope.evidence.find((item) => item.evidenceId === "measurement-ai:metric_value");
  assert(aiEvidence);
  assertEquals(aiEvidence.source.sourceType, "ai_generated_unverified");
  assertEquals(aiEvidence.review.state, "unreviewed");
  assertEquals(envelope.governance.eligibleForSharedKnowledge, false);
});

Deno.test("empty farm history remains an explicit incomplete case, not fabricated zeros", () => {
  const envelope = buildSaiCaseEnvelope({
    farm: { id: "farm-3", created_at: "2026-01-01T00:00:00Z" },
    cropCycles: [],
    soilTests: [],
    waterTests: [],
    irrigationEvents: [],
    observations: [],
    productivityMeasurements: [],
    baselines: [],
    contextObservations: [],
    outcomeReviews: [],
    improvementActions: [],
    requestId: "case-3",
    assembledAt: "2026-02-02T00:00:00Z",
  });

  assertEquals(validateSaiCaseEnvelope(envelope), []);
  assertEquals(envelope.evidence.length, 0);
  assert(envelope.quality.missingCriticalFields.includes("crop_cycle"));
  assert(envelope.quality.missingCriticalFields.includes("farm_evidence"));
  assertEquals(envelope.outcome.classification, "insufficient_evidence");
});
