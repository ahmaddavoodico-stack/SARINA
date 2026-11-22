export type EvidenceRecord = {
  id: string;
  label: string;
  value: string;
  provenance: "farmer_report" | "verified_measurement" | "recorded_source" | "model_estimate" | "system_fact";
  observedAt?: string | null;
  source?: string | null;
};

export type SpecialistCaseEvidence = {
  schema: "SARINA_SPECIALIST_CASE_EVIDENCE_V1";
  request: {
    id: string;
    subject: string;
    requestType: string;
    priority: string;
    status: string;
    preferredLanguage: "fa" | "en";
    createdAt: string;
  };
  farm: Record<string, unknown> | null;
  field: Record<string, unknown> | null;
  cropCycle: Record<string, unknown> | null;
  evidence: EvidenceRecord[];
  existingAssistant: {
    status: string;
    completeness: string;
    summary: string | null;
    missingInformation: string[];
  } | null;
  coverage: {
    farmRecordAvailable: boolean;
    soilTestCount: number;
    waterTestCount: number;
    observationCount: number;
    missingDomains: string[];
  };
  safety: {
    reportsAreNotVerifiedMeasurements: true;
    regionalEstimatesAreNotFarmMeasurements: true;
    missingValuesRemainMissing: true;
    finalExpertReviewRequired: true;
  };
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function buildSpecialistCaseEvidence(input: {
  request: Record<string, unknown>;
  farm?: Record<string, unknown> | null;
  field?: Record<string, unknown> | null;
  cropCycle?: Record<string, unknown> | null;
  soilTests?: Record<string, unknown>[];
  waterTests?: Record<string, unknown>[];
  observations?: Record<string, unknown>[];
  assistant?: Record<string, unknown> | null;
}): SpecialistCaseEvidence {
  const { request } = input;
  const evidence: EvidenceRecord[] = [{
    id: "case:" + asString(request.id),
    label: "شرح ثبت‌شده درخواست",
    value: asString(request.problem_description),
    provenance: "farmer_report",
    observedAt: asString(request.created_at),
    source: "expert_requests.problem_description",
  }];
  if (input.farm) {
    evidence.push({
      id: "farm:" + asString(input.farm.id),
      label: "مشخصات ثبت‌شده مزرعه",
      value: JSON.stringify({
        farm_name: input.farm.farm_name ?? null,
        total_area: input.farm.total_area ?? null,
        area_unit: input.farm.area_unit ?? null,
        status: input.farm.status ?? null,
      }),
      provenance: "system_fact",
      source: "farms",
    });
  }
  for (const row of input.soilTests ?? []) {
    evidence.push({
      id: "soil-test:" + asString(row.id),
      label: "آزمون خاک ثبت‌شده",
      value: JSON.stringify(row),
      provenance: row.data_source === "laboratory" ? "verified_measurement" : "recorded_source",
      observedAt: asString(row.sampled_at),
      source: asString(row.laboratory_name) || asString(row.data_source) || "soil_tests",
    });
  }
  for (const row of input.waterTests ?? []) {
    evidence.push({
      id: "water-test:" + asString(row.id),
      label: "آزمون آب ثبت‌شده",
      value: JSON.stringify(row),
      provenance: row.data_source === "laboratory" ? "verified_measurement" : "recorded_source",
      observedAt: asString(row.sampled_at),
      source: asString(row.laboratory_name) || asString(row.data_source) || "water_tests",
    });
  }
  for (const row of input.observations ?? []) {
    evidence.push({
      id: "observation:" + asString(row.id),
      label: "مشاهده میدانی ثبت‌شده",
      value: asString(row.description),
      provenance: "farmer_report",
      observedAt: asString(row.observed_at),
      source: "farm_observations",
    });
  }
  const missingDomains: string[] = [];
  if (!input.farm) missingDomains.push("farm_profile");
  if (!input.field) missingDomains.push("field_profile");
  if (!input.cropCycle) missingDomains.push("crop_cycle");
  if (!(input.soilTests?.length)) missingDomains.push("soil_test");
  if (!(input.waterTests?.length)) missingDomains.push("water_test");
  if (!(input.observations?.length)) missingDomains.push("field_observations");

  const assistant = input.assistant;
  return {
    schema: "SARINA_SPECIALIST_CASE_EVIDENCE_V1",
    request: {
      id: asString(request.id),
      subject: asString(request.subject),
      requestType: asString(request.request_type),
      priority: asString(request.priority),
      status: asString(request.status),
      preferredLanguage: request.preferred_language === "fa" ? "fa" : "en",
      createdAt: asString(request.created_at),
    },
    farm: input.farm ?? null,
    field: input.field ?? null,
    cropCycle: input.cropCycle ?? null,
    evidence,
    existingAssistant: assistant ? {
      status: asString(assistant.assistant_status),
      completeness: asString(assistant.completeness_status),
      summary: typeof assistant.assistant_summary === "string" ? assistant.assistant_summary : null,
      missingInformation: Array.isArray(assistant.missing_information)
        ? assistant.missing_information.filter((item): item is string => typeof item === "string")
        : [],
    } : null,
    coverage: {
      farmRecordAvailable: Boolean(input.farm),
      soilTestCount: input.soilTests?.length ?? 0,
      waterTestCount: input.waterTests?.length ?? 0,
      observationCount: input.observations?.length ?? 0,
      missingDomains,
    },
    safety: {
      reportsAreNotVerifiedMeasurements: true,
      regionalEstimatesAreNotFarmMeasurements: true,
      missingValuesRemainMissing: true,
      finalExpertReviewRequired: true,
    },
  };
}
