import { buildEnvironmentalDossier } from "./environmental-dossier.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.test("environmental dossier preserves partial results and evidence provenance", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ name: string; body: Record<string, unknown>; headers: Headers }> = [];
  const now = "2026-11-28T12:00:00.000Z";

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const name = url.split("/").pop() ?? "";
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    requests.push({ name, body, headers: new Headers(init?.headers) });

    if (name === "farm-weather-context") {
      return jsonResponse({
        farm_id: body.farm_id,
        source: "open-meteo",
        retrieved_at: now,
        current: { observed_at: now, temperature_c: 29, provenance: "provider_current_model_estimate_not_farm_sensor" },
        forecast: [{ date: "2026-11-28", max_c: 31, min_c: 21 }],
        stored_records: 0,
        persistence: "not_persisted",
      });
    }
    if (name === "farm-land-context") {
      return jsonResponse({
        ok: true,
        context: {
          schema: "SARINA_FARM_LAND_CONTEXT_V1",
          retrieved_at: now,
          soil_tests: [
            { id: "soil-lab", provenance: "laboratory_record" },
            { id: "soil-other", provenance: "recorded_source" },
          ],
          water_tests: [{ id: "water-other", provenance: "recorded_source" }],
          farmer_reports: [{ id: "farmer-report" }],
          regional_context: {
            soilgrids: { status: "provider_unavailable", provider: "ISRIC SoilGrids 2.0" },
          },
        },
      });
    }
    if (name === "farm-historical-climate-context") {
      return jsonResponse({
        ok: true,
        climate: { status: "provider_license_not_configured" },
        missing_domains: ["historical_climate"],
      });
    }
    if (name === "farm-spatial-context") {
      return jsonResponse({ ok: false, code: "SPATIAL_PROVIDER_UNAVAILABLE" }, 503);
    }
    throw new Error("Unexpected context function: " + name);
  }) as typeof fetch;

  try {
    const dossier = await buildEnvironmentalDossier({
      supabaseUrl: "https://project.example",
      publishableKey: "publishable-test-key",
      authorization: "Bearer test-user-jwt",
      farmId: "11111111-1111-4111-8111-111111111111",
      correlationId: "test-correlation-id",
    });

    assert(dossier.status === "partial", "one successful domain must preserve a partial dossier");
    assert(dossier.persistence === "read_only_not_persisted", "builder must identify read-only output");
    assert(requests.length === 4, "all four context adapters must be invoked");
    assert(
      requests.find((request) => request.name === "farm-weather-context")?.body.read_only === true,
      "weather context must explicitly disable forecast persistence",
    );
    assert(
      requests.every((request) => request.headers.get("Authorization") === "Bearer test-user-jwt"),
      "caller JWT must be forwarded to every context function",
    );
    assert(
      requests.every((request) => request.headers.get("apikey") === "publishable-test-key"),
      "publishable key must be forwarded to every context function",
    );

    const quality = dossier.quality_summary as Record<string, unknown>;
    assert(quality.soil_laboratory_test_count === 1, "only laboratory-tagged soil tests count as lab evidence");
    assert(quality.soil_test_count === 2, "other soil records must remain visible but distinct");
    assert(quality.water_laboratory_test_count === 0, "non-laboratory water record must not count as lab evidence");
    assert(quality.farmer_observation_count === 1, "farmer observations must be counted independently");

    const manifest = dossier.source_manifest as Array<Record<string, unknown>>;
    const soilLab = manifest.find((entry) => entry.domain === "soil_laboratory_tests");
    const soilOther = manifest.find((entry) => entry.domain === "soil_other_records");
    const weather = manifest.find((entry) => entry.domain === "weather");
    assert(soilLab?.evidence_class === "laboratory_measurement", "lab evidence class must be explicit");
    assert(soilOther?.evidence_class === "recorded_source", "unverified records must not be labelled lab evidence");
    assert(weather?.evidence_class === "model_estimate", "weather provider values must remain model estimates");

    const calls = dossier.provider_calls as Array<Record<string, unknown>>;
    const spatialCall = calls.find((entry) => entry.function === "farm-spatial-context");
    assert(spatialCall?.status === "failed", "failed spatial source must be reported");
    assert(
      Array.isArray(dossier.missing_domains) && dossier.missing_domains.includes("historical_climate"),
      "unavailable historical climate must be reported as missing",
    );

    globalThis.fetch = (async () => {
      throw new DOMException("network unavailable", "NetworkError");
    }) as typeof fetch;
    const unavailable = await buildEnvironmentalDossier({
      supabaseUrl: "https://project.example",
      publishableKey: "publishable-test-key",
      authorization: "Bearer test-user-jwt",
      farmId: "11111111-1111-4111-8111-111111111111",
      correlationId: "all-failed-correlation",
    });
    assert(unavailable.status === "needs_review", "all failed providers must yield needs_review, not fabricated data");
    assert(
      unavailable.safety.missing_values_remain_missing === true,
      "all-provider failure must retain missing-data safety flag",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
