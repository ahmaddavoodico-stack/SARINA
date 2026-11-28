import { isRecord } from "./sci-contract.ts";

type DomainResult = { payload: Record<string, unknown> | null; httpStatus: number | null; error: string | null };

async function callContext(
  baseUrl: string,
  functionName: string,
  farmId: string,
  headers: Record<string, string>,
): Promise<DomainResult> {
  try {
    const response = await fetch(`${baseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ farm_id: farmId }),
      signal: AbortSignal.timeout(40_000),
    });
    let body: unknown = null;
    try { body = await response.json(); } catch { /* malformed provider/function response */ }
    if (!response.ok || !isRecord(body)) {
      return { payload: null, httpStatus: response.status, error: !response.ok ? "HTTP_ERROR" : "INVALID_RESPONSE" };
    }
    if (body.ok === false) return { payload: null, httpStatus: response.status, error: "DOMAIN_UNAVAILABLE" };
    return { payload: body, httpStatus: response.status, error: null };
  } catch (error) {
    return {
      payload: null,
      httpStatus: null,
      error: error instanceof DOMException && error.name === "TimeoutError" ? "TIMEOUT" : "NETWORK_ERROR",
    };
  }
}

function timestamp(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function statusFor(payload: Record<string, unknown> | null, explicit?: unknown): string {
  if (!payload) return "unavailable";
  if (typeof explicit === "string") return explicit;
  return "available";
}

function sourceEntry(input: {
  domain: string;
  status: string;
  provider: string | null;
  evidenceClass: string;
  retrievedAt: string | null;
  observedPeriod?: unknown;
  validUntil?: string | null;
  geometryScope?: unknown;
  spatialResolution?: unknown;
  sourceUrl?: string | null;
  license?: string | null;
  limitations?: unknown;
  itemCount?: number;
}) {
  return {
    domain: input.domain,
    status: input.status,
    provider: input.provider,
    evidence_class: input.evidenceClass,
    retrieved_at: input.retrievedAt,
    observed_period: input.observedPeriod ?? null,
    valid_until: input.validUntil ?? null,
    geometry_scope: input.geometryScope ?? null,
    spatial_resolution: input.spatialResolution ?? null,
    source_url: input.sourceUrl ?? null,
    license: input.license ?? null,
    limitations: input.limitations ?? null,
    item_count: input.itemCount ?? 0,
  };
}

export async function buildEnvironmentalDossier(input: {
  supabaseUrl: string;
  publishableKey: string;
  authorization: string;
  farmId: string;
  correlationId: string;
}) {
  const headers = {
    Authorization: input.authorization,
    apikey: input.publishableKey,
    "Content-Type": "application/json",
    "x-sarina-correlation-id": input.correlationId,
  };
  const names = [
    "farm-weather-context",
    "farm-land-context",
    "farm-historical-climate-context",
    "farm-spatial-context",
  ] as const;
  const results = await Promise.all(names.map((name) =>
    callContext(input.supabaseUrl, name, input.farmId, headers)
  ));
  const [weatherResult, landResult, climateResult, spatialResult] = results;

  // Weather currently returns its context as a flat response; land returns { ok, context }.
  const weather = weatherResult.payload && isRecord(weatherResult.payload.context)
    ? weatherResult.payload.context
    : weatherResult.payload;
  const land = landResult.payload && isRecord(landResult.payload.context)
    ? landResult.payload.context
    : null;
  const climate = climateResult.payload && isRecord(climateResult.payload.climate)
    ? climateResult.payload.climate
    : null;
  const terrain = spatialResult.payload && isRecord(spatialResult.payload.terrain)
    ? spatialResult.payload.terrain
    : null;
  const satellite = spatialResult.payload && isRecord(spatialResult.payload.satellite)
    ? spatialResult.payload.satellite
    : null;

  const manifest: Record<string, unknown>[] = [];
  const missingDomains: string[] = [];
  const retrievedAt = new Date().toISOString();

  const weatherAt = timestamp(weather?.retrieved_at);
  const weatherAvailable = !!weather && isRecord(weather.current) && Array.isArray(weather.forecast);
  manifest.push(sourceEntry({
    domain: "weather",
    status: weatherAvailable ? "available" : "unavailable",
    provider: typeof weather?.source === "string" ? weather.source : "Open-Meteo",
    evidenceClass: "model_estimate",
    retrievedAt: weatherAt,
    observedPeriod: weather?.current && isRecord(weather.current)
      ? { current_at: weather.current.observed_at ?? null, forecast_days: Array.isArray(weather.forecast) ? weather.forecast.length : 0 }
      : null,
    validUntil: weatherAt ? new Date(Date.parse(weatherAt) + 24 * 60 * 60 * 1000).toISOString() : null,
    limitations: "Current conditions and forecasts are provider model estimates, not on-farm sensor measurements.",
    itemCount: (weatherAvailable ? 1 : 0) + (Array.isArray(weather?.forecast) ? weather.forecast.length : 0),
  }));
  if (!weatherAvailable) missingDomains.push("weather");

  const soilTests = Array.isArray(land?.soil_tests) ? land.soil_tests : [];
  const waterTests = Array.isArray(land?.water_tests) ? land.water_tests : [];
  const farmerReports = Array.isArray(land?.farmer_reports) ? land.farmer_reports : [];
  const landAt = timestamp(land?.retrieved_at);
  const soilLabTests = soilTests.filter((row) => isRecord(row) && row.provenance === "laboratory_record");
  const soilOtherRecords = soilTests.length - soilLabTests.length;
  const waterLabTests = waterTests.filter((row) => isRecord(row) && row.provenance === "laboratory_record");
  const waterOtherRecords = waterTests.length - waterLabTests.length;
  manifest.push(sourceEntry({
    domain: "soil_laboratory_tests",
    status: soilLabTests.length ? "available" : "needs_lab_evidence",
    provider: soilLabTests.length ? "farm_soil_tests" : null,
    evidenceClass: "laboratory_measurement",
    retrievedAt: landAt,
    itemCount: soilLabTests.length,
    limitations: "Only records explicitly tagged as laboratory records are counted as laboratory evidence.",
  }));
  manifest.push(sourceEntry({
    domain: "soil_other_records",
    status: soilOtherRecords ? "available" : "none_recorded",
    provider: soilOtherRecords ? "farm_soil_tests" : null,
    evidenceClass: "recorded_source",
    retrievedAt: landAt,
    itemCount: soilOtherRecords,
    limitations: "These records are not confirmed as laboratory measurements.",
  }));
  manifest.push(sourceEntry({
    domain: "water_laboratory_tests",
    status: waterLabTests.length ? "available" : "needs_lab_evidence",
    provider: waterLabTests.length ? "farm_water_tests" : null,
    evidenceClass: "laboratory_measurement",
    retrievedAt: landAt,
    itemCount: waterLabTests.length,
    limitations: "Only records explicitly tagged as laboratory records are counted as laboratory evidence.",
  }));
  manifest.push(sourceEntry({
    domain: "water_other_records",
    status: waterOtherRecords ? "available" : "none_recorded",
    provider: waterOtherRecords ? "farm_water_tests" : null,
    evidenceClass: "recorded_source",
    retrievedAt: landAt,
    itemCount: waterOtherRecords,
    limitations: "These records are not confirmed as laboratory measurements.",
  }));
  manifest.push(sourceEntry({
    domain: "farmer_observations",
    status: farmerReports.length ? "available" : "no_observations_recorded",
    provider: farmerReports.length ? "farm_observations" : null,
    evidenceClass: "farmer_observation",
    retrievedAt: landAt,
    itemCount: farmerReports.length,
    limitations: "Farmer-reported observations are not independently verified.",
  }));
  if (!soilLabTests.length) missingDomains.push("soil_laboratory_measurements");
  if (!waterLabTests.length) missingDomains.push("water_laboratory_measurements");
    const regional = land && isRecord(land.regional_context) ? land.regional_context : null;
  const soilGrids = regional && isRecord(regional.soilgrids) ? regional.soilgrids : null;
  const regionalStatus = typeof soilGrids?.status === "string" ? soilGrids.status : "not_available";
  manifest.push(sourceEntry({
    domain: "regional_soil_reference",
    status: regionalStatus,
    provider: typeof soilGrids?.provider === "string" ? soilGrids.provider : "ISRIC SoilGrids 2.0",
    evidenceClass: "regional_reference",
    retrievedAt: timestamp(soilGrids?.checked_at),
    spatialResolution: soilGrids?.resolution_m ?? null,
    sourceUrl: typeof soilGrids?.source_url === "string" ? soilGrids.source_url : null,
    license: typeof soilGrids?.license === "string" ? soilGrids.license : null,
    limitations: "Regional gridded estimates must never be presented as a farm laboratory test.",
  }));
  if (regionalStatus !== "available") missingDomains.push("regional_soil_reference");

  const climateStatus = statusFor(climate, climate?.status);
  manifest.push(sourceEntry({
    domain: "historical_climate",
    status: climateStatus,
    provider: typeof climate?.source === "string" ? climate.source : "Open-Meteo ERA5-Land",
    evidenceClass: "model_estimate",
    retrievedAt: timestamp(climate?.retrieved_at ?? climate?.checked_at),
    observedPeriod: climate?.temporal_coverage_returned ?? climate?.temporal_coverage_requested ?? null,
    spatialResolution: climate?.approximate_spatial_resolution_km ?? climate?.spatial_resolution_degrees ?? null,
    sourceUrl: typeof climate?.source_url === "string" ? climate.source_url : null,
    license: typeof climate?.license === "string" ? climate.license : null,
    limitations: climate?.limitation ?? null,
  }));
  if (climateStatus !== "available") missingDomains.push("historical_climate");

  const terrainStatus = statusFor(terrain, terrain?.status);
  const satelliteStatus = statusFor(satellite, satellite?.status ?? satellite?.analysis_status);
  const geometryScope = spatialResult.payload?.analysis_area ?? null;
  manifest.push(sourceEntry({
    domain: "terrain",
    status: terrainStatus,
    provider: typeof terrain?.provider === "string" ? terrain.provider : "Copernicus DEM GLO-90",
    evidenceClass: "remote_sensing",
    retrievedAt: timestamp(terrain?.retrieved_at ?? spatialResult.payload?.retrieved_at),
    geometryScope,
    spatialResolution: terrain?.native_resolution_m ?? null,
    sourceUrl: typeof terrain?.source_url === "string" ? terrain.source_url : null,
    limitations: terrain?.limitation ?? (geometryScope ? "Spatial proxy scope; not confirmed parcel geometry." : null),
  }));
  manifest.push(sourceEntry({
    domain: "satellite_vegetation",
    status: satelliteStatus,
    provider: typeof satellite?.provider === "string" ? satellite.provider : "Copernicus Sentinel-2",
    evidenceClass: "remote_sensing",
    retrievedAt: timestamp(satellite?.retrieved_at ?? spatialResult.payload?.retrieved_at),
    observedPeriod: satellite?.temporal_window ?? null,
    geometryScope,
    spatialResolution: satellite?.spatial_resolution_m ?? null,
    sourceUrl: typeof satellite?.source_url === "string" ? satellite.source_url : null,
    limitations: satellite?.limitation ?? (geometryScope ? "Current spatial function declares a centroid buffer proxy, not a farm parcel boundary." : null),
  }));
  if (terrainStatus !== "available") missingDomains.push("terrain");
  if (satelliteStatus !== "available") missingDomains.push("satellite_vegetation");

  const regionalSync = {
    status: "not_connected",
    reason: "sarina-regional-sync is a signed inter-region event transport, not a farm-scoped regional evidence query. It is intentionally not invoked by dossier refresh.",
  };
  manifest.push(sourceEntry({
    domain: "governed_regional_datasets",
    status: "not_connected",
    provider: "sarina-regional-sync",
    evidenceClass: "regional_reference",
    retrievedAt: null,
    limitations: regionalSync.reason,
  }));
  missingDomains.push("governed_regional_datasets");

  const domainStatuses = manifest.map((item) => String(item.status));
  const availableCount = domainStatuses.filter((status) => status === "available").length;
  const status = availableCount === manifest.length ? "complete" : availableCount > 0 ? "partial" : "needs_review";

  return {
    schema: "SARINA_ENVIRONMENTAL_DOSSIER_V1",
    farm_id: input.farmId,
    correlation_id: input.correlationId,
    generated_at: retrievedAt,
    status,
    persistence: "read_only_not_persisted",
    version: null,
    domains: {
      weather: weather ?? { status: "unavailable" },
      land: land ?? { status: "unavailable" },
      historical_climate: climate ?? { status: climateStatus },
      terrain: terrain ?? { status: terrainStatus },
      satellite: satellite ?? { status: satelliteStatus },
      regional_sync: regionalSync,
    },
    source_manifest: manifest,
    quality_summary: {
      source_count: manifest.length,
      available_source_count: availableCount,
      missing_domain_count: [...new Set(missingDomains)].length,
      farmer_observation_count: farmerReports.length,
      soil_test_count: soilTests.length,
      soil_laboratory_test_count: soilLabTests.length,
      water_test_count: waterTests.length,
      water_laboratory_test_count: waterLabTests.length,
      regional_soil_status: regionalStatus,
      spatial_scope: geometryScope,
      spatial_parcel_accuracy: "not_confirmed_by_current_spatial_adapter",
    },
    missing_domains: [...new Set(missingDomains)],
    provider_calls: names.map((name, index) => ({
      function: name,
      http_status: results[index].httpStatus,
      status: results[index].error ? "failed" : "responded",
      error_code: results[index].error,
    })),
    safety: {
      no_persisted_snapshot: true,
      no_provider_or_model_output_authorizes_physical_action: true,
      model_estimates_are_not_on_farm_measurements: true,
      missing_values_remain_missing: true,
    },
  };
}
