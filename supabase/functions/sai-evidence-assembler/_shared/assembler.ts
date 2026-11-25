import type {
  SaiCaseEnvelope,
  SaiEvidenceItem,
  SaiEvidenceQuality,
  SaiSourceType,
} from "../../../src/lib/sai/evidence-contract.ts";

type Row = Record<string, unknown>;

export interface SaiAssemblerInput {
  farm: Row;
  cropCycles: Row[];
  soilTests: Row[];
  waterTests: Row[];
  irrigationEvents: Row[];
  observations: Row[];
  productivityMeasurements: Row[];
  baselines: Row[];
  contextObservations: Row[];
  outcomeReviews: Row[];
  improvementActions: Row[];
  requestId: string;
  assembledAt: string;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function date(value: unknown): string | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function quality(value: unknown): SaiEvidenceQuality {
  return value === "high" || value === "medium" || value === "low" ? value : "unknown";
}

function sourceType(value: unknown): SaiSourceType {
  if (value === "farmer_reported" || value === "measured" || value === "laboratory" ||
      value === "official" || value === "remote_estimate" || value === "modelled" ||
      value === "inferred" || value === "ai_generated_unverified") return value;
  return "farmer_reported";
}

function measurementEvidence(
  table: string,
  row: Row,
  key: string,
  value: unknown,
  unit: string | null,
  observedAt: unknown,
  source: SaiSourceType,
  qualityLabel: unknown = "unknown",
): SaiEvidenceItem | null {
  if (value === null || value === undefined) return null;
  const original = typeof value === "number" || typeof value === "string" ? value : String(value);
  const safeUnit = unit ?? (typeof original === "string" ? "text" : "unspecified");
  const timestamp = date(observedAt);
  return {
    evidenceId: String(row.id) + ":" + key,
    kind: key,
    source: { table, recordRef: String(row.id), sourceType: source },
    observedAt: timestamp,
    period: { start: timestamp, end: timestamp },
    value: {
      state: "present",
      original,
      originalUnit: safeUnit,
      normalized: original,
      normalizedUnit: safeUnit,
      qualifier: source === "measured" || source === "laboratory" ? "measured" :
        source === "modelled" || source === "remote_estimate" ? "modelled" :
        source === "inferred" ? "inferred" : "reported",
    },
    quality: { label: quality(qualityLabel), limitations: [] },
    review: { state: "unreviewed", reviewerRef: null, reviewedAt: null },
  };
}

function recordEvidence(
  table: string,
  row: Row,
  kind: string,
  observedAt: unknown,
  source: SaiSourceType,
  qualityLabel: unknown = "unknown",
): SaiEvidenceItem {
  const timestamp = date(observedAt);
  return {
    evidenceId: String(row.id),
    kind,
    source: { table, recordRef: String(row.id), sourceType: source },
    observedAt: timestamp,
    period: { start: timestamp, end: timestamp },
    value: null,
    quality: { label: quality(qualityLabel), limitations: [] },
    review: { state: "unreviewed", reviewerRef: null, reviewedAt: null },
  };
}

function numericRows(
  rows: Row[],
  table: string,
  fields: Array<[string, string]>,
  observedAtField: string,
  sourceForRow: (row: Row) => SaiSourceType,
): SaiEvidenceItem[] {
  const output: SaiEvidenceItem[] = [];
  for (const row of rows) {
    for (const [field, unit] of fields) {
      const item = measurementEvidence(
        table, row, field, row[field], unit, row[observedAtField],
        sourceForRow(row), row.quality_label,
      );
      if (item) output.push(item);
    }
  }
  return output;
}

function earliestDate(values: Array<unknown>, fallback: string): string {
  const valid = values.map(date).filter((item): item is string => item !== null).sort();
  return valid[0] ?? fallback;
}

function outcomeClass(value: unknown): SaiCaseEnvelope["outcome"]["classification"] {
  return value === "positive" || value === "negative" || value === "mixed" ||
    value === "no_change" || value === "inconclusive" || value === "insufficient_evidence"
    ? value : "inconclusive";
}

function attribution(value: unknown): SaiCaseEnvelope["outcome"]["attribution"] {
  return value === "strongly_supported" || value === "partially_supported" ||
    value === "unclear" || value === "not_attributable" ? value : "unclear";
}

export function buildSaiCaseEnvelope(input: SaiAssemblerInput): SaiCaseEnvelope {
  const farmId = String(input.farm.id);
  const latestCycle = [...input.cropCycles].sort((a, b) =>
    String(b.planting_date ?? b.created_at ?? "").localeCompare(
      String(a.planting_date ?? a.created_at ?? ""),
    )
  )[0] ?? null;

  const evidence: SaiEvidenceItem[] = [
    ...numericRows(input.soilTests, "soil_tests", [
      ["ph", "pH"], ["ec_ds_m", "dS/m"], ["organic_matter_pct", "%"],
      ["calcium_carbonate_pct", "%"], ["nitrogen_mg_kg", "mg/kg"],
      ["phosphorus_mg_kg", "mg/kg"], ["potassium_mg_kg", "mg/kg"],
      ["sodium_mg_kg", "mg/kg"], ["chloride_mg_kg", "mg/kg"],
      ["cec_cmol_kg", "cmol/kg"],
    ], "sampled_at", (row) => row.data_source === "laboratory" ? "laboratory" : "farmer_reported"),
    ...numericRows(input.waterTests, "water_tests", [
      ["ph", "pH"], ["ec_ds_m", "dS/m"], ["tds_mg_l", "mg/L"],
      ["sodium_mg_l", "mg/L"], ["calcium_mg_l", "mg/L"],
      ["magnesium_mg_l", "mg/L"], ["chloride_mg_l", "mg/L"],
      ["bicarbonate_mg_l", "mg/L"], ["sar", "ratio"], ["boron_mg_l", "mg/L"],
    ], "sampled_at", (row) => row.data_source === "laboratory" ? "laboratory" : "farmer_reported"),
    ...numericRows(input.productivityMeasurements, "farm_productivity_measurements", [
      ["metric_value", "unit_code"],
    ], "observed_at", (row) => sourceType(row.source_type)),
    ...numericRows(input.contextObservations, "farm_productivity_context_observations", [
      ["numeric_value", "unit_code"],
    ], "observed_at", (row) => sourceType(row.source_type)),
    ...input.observations.map((row) =>
      recordEvidence("farm_observations", row, "farm_observation", row.observed_at, "farmer_reported")
    ),
    ...input.irrigationEvents.map((row) =>
      recordEvidence("irrigation_events", row, "irrigation_event", row.started_at, "farmer_reported")
    ),
    ...input.baselines.map((row) =>
      recordEvidence("farm_productivity_baselines", row, "productivity_baseline", row.baseline_date, "measured")
    ),
  ];

  const interventions: SaiCaseEnvelope["interventions"] = input.improvementActions.map((row) => {
    const status = row.status === "completed" ? "performed" :
      row.status === "in_progress" ? "partially_performed" :
      row.status === "planned" || row.status === "pending" ? "planned" :
      row.status === "cancelled" || row.status === "not_performed" ? "not_performed" : "unknown";
    return {
      interventionId: String(row.id),
      description: str(row.title) ?? str(row.description) ?? "Farm improvement action",
      status,
      performedAt: status === "performed" ? date(row.completed_at) : null,
      evidenceRefs: str(row.source_recommendation_action_id)
        ? [String(row.source_recommendation_action_id)] : [],
    };
  });

  const followUps: SaiCaseEnvelope["followUps"] = input.observations
    .filter((row) => date(row.observed_at) !== null)
    .map((row) => ({
      followUpId: String(row.id),
      observedAt: date(row.observed_at)!,
      evidenceRefs: [String(row.id)],
      notes: str(row.description),
    }));

  const latestOutcome = [...input.outcomeReviews].sort((a, b) =>
    String(b.reviewed_at ?? b.created_at ?? "").localeCompare(
      String(a.reviewed_at ?? a.created_at ?? ""),
    )
  )[0] ?? null;

  const startDate = earliestDate([
    input.farm.created_at,
    ...input.cropCycles.map((row) => row.planting_date),
    ...evidence.map((item) => item.observedAt),
  ], input.assembledAt);

  const missingCriticalFields: string[] = [];
  if (!latestCycle) missingCriticalFields.push("crop_cycle");
  if (evidence.length === 0) missingCriticalFields.push("farm_evidence");
  if (!latestOutcome) missingCriticalFields.push("expert_reviewed_outcome");

  const populatedCategories = [
    input.cropCycles.length > 0,
    input.soilTests.length > 0 || input.waterTests.length > 0,
    input.observations.length > 0,
    input.irrigationEvents.length > 0,
    input.productivityMeasurements.length > 0 || input.contextObservations.length > 0,
    input.outcomeReviews.length > 0,
  ].filter(Boolean).length;

  return {
    contract: "sarina.sai.case",
    contractVersion: "1.0.0",
    caseId: input.requestId,
    scope: {
      farmRef: farmId,
      fieldRef: str(latestCycle?.field_id),
      cropCycleRef: str(latestCycle?.id),
      cropCode: str(latestCycle?.crop_id) ?? "unknown",
      varietyCode: str(latestCycle?.variety_id),
      productionSystem: null,
      countryCode: null,
      regionCode: null,
    },
    period: {
      startedAt: startDate,
      endedAt: null,
      timezone: "UTC",
    },
    problem: {
      reportedDescription: "Read-only farm evidence snapshot; no diagnosis or causal conclusion is generated.",
      symptoms: [],
      diagnoses: [],
    },
    evidence,
    interventions,
    recommendations: [],
    followUps,
    outcome: {
      classification: latestOutcome ? outcomeClass(latestOutcome.classification) : "insufficient_evidence",
      attribution: latestOutcome ? attribution(latestOutcome.attribution_type) : "not_attributable",
      attributionConfidence: null,
      evidenceQuality: quality(latestOutcome?.evidence_quality),
      causalClaimPermitted: false,
    },
    provenance: {
      assembledAt: input.assembledAt,
      assemblerVersion: "0.1.0",
      sourceRefs: [
        ...input.cropCycles.map((row) => "crop_cycles:" + String(row.id)),
        ...input.soilTests.map((row) => "soil_tests:" + String(row.id)),
        ...input.waterTests.map((row) => "water_tests:" + String(row.id)),
        ...input.irrigationEvents.map((row) => "irrigation_events:" + String(row.id)),
        ...input.observations.map((row) => "farm_observations:" + String(row.id)),
        ...input.productivityMeasurements.map((row) => "farm_productivity_measurements:" + String(row.id)),
        ...input.baselines.map((row) => "farm_productivity_baselines:" + String(row.id)),
        ...input.contextObservations.map((row) => "farm_productivity_context_observations:" + String(row.id)),
        ...input.outcomeReviews.map((row) => "farm_productivity_outcome_reviews:" + String(row.id)),
        ...input.improvementActions.map((row) => "farm_improvement_actions:" + String(row.id)),
      ],
    },
    governance: {
      farmerConsent: "not_checked",
      expertConsent: "not_checked",
      anonymization: "not_started",
      reviewState: "not_submitted",
      eligibleForSharedKnowledge: false,
    },
    quality: {
      completeness: populatedCategories / 6,
      missingCriticalFields,
      warnings: [
        "Private farm-scoped snapshot only; shared-knowledge promotion is disabled.",
        "AI conversations, unreviewed model outputs and admin-only knowledge candidates are excluded.",
        "No causal relationship is inferred from outcome or metric movement.",
      ],
    },
  };
}
