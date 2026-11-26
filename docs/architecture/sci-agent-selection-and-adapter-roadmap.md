# SCI Specialist Agent Selection and Adapter Roadmap

**Status:** Selection proposal and testable catalog; no new specialist or provider is enabled.
**Date:** 2026-11-26
**Authority:** SARINA Central Intelligence (SCI)

## 1. Selection principles

1. Select a capability implementation, not a brand name. A specialist role may combine deterministic calculations, curated data, retrieval, a local model, and (only when justified) an external adapter.
2. Keep the specialist identity separate from the execution adapter. SCI owns routing, data scope, authorization, lifecycle, review disposition, and result aggregation.
3. Prefer deterministic scientific/financial calculations for numerical outputs. Use an LLM for language, evidence synthesis, and clarification—not as the source of truth for formulas, law, or diagnosis.
4. No paid API is a prerequisite for core operation. Public APIs are subject to their actual terms; where commercial-use terms are restrictive, self-host or use a separately approved data source.
5. No agent is enabled by this catalog. All ten specialist roles remain `registered`, and every proposed provider dispatch remains disabled.
6. Never claim a local model is available until SARINA has a controlled inference host, resource measurements, access controls, and a successful offline test.

## 2. Shared foundation candidates

| Component | Candidate | Proposed use | License / operating note | Decision |
|---|---|---|---|---|
| General multilingual reasoning | Qwen3 8B / 14B | Shared local language and reasoning service for SCI and selected specialists | Qwen3 model family lists Apache 2.0 open-weight variants and Persian among 119 supported languages. Run locally with a compatible serving stack. Actual Persian quality and hardware throughput must be benchmarked. | Preferred candidate; not installed or enabled |
| Visual language | Qwen3-VL 4B Instruct | Image/document triage and visual question understanding | Open-weight model candidate; never sole authority for crop diagnosis. | Candidate; benchmark required |
| Multilingual retrieval | BGE-M3 | Dense + sparse hybrid retrieval for Persian/Arabic/English agricultural and regulatory documents | MIT model card; supports 100+ languages and up to 8,192-token inputs. Must evaluate Persian/Arabic retrieval quality on SARINA corpus. | Preferred retrieval candidate |
| Document OCR / layout | PaddleOCR | Extract text, tables and structure from lab reports, certificates and scanned documents | Open-source toolkit; language coverage varies by model/version. Persian and Arabic accuracy must be measured before production use. | Candidate, not selected for production |
| Weather and historical climate data | Open-Meteo source, self-hosted | Forecast, historical and reference ET₀ inputs for climate/irrigation services | Public hosted free tier is non-commercial; data is CC BY 4.0 and server code AGPLv3. For SARINA commercial operation, do not rely on the public free tier: self-host or separately approve a paid/other source. | Self-host candidate |
| Crop water simulation | FAO-56 calculations + AquaCrop Python 7.3 | Reference/crop evapotranspiration, crop-water and yield-response scenarios | FAO reference method; AquaCrop is available as open-source Python code. Validate crop parameters and local calibration. | Preferred scientific engine candidate |
| Optimization | Google OR-Tools | Route, storage, packing, scheduling and constrained allocation optimization | Apache 2.0; use deterministic solver outputs with explicit input assumptions. | Preferred optimization candidate |

### Hardware and deployment gate

The current SARINA stack (Vercel + Supabase) is not evidence of a dedicated model-serving host. Before selecting a model size or deploying Qwen/BGE/VL, record available CPU, RAM, GPU/VRAM, disk, region, network reliability, concurrency target, and monthly operating ceiling. Benchmark 4B/8B/14B variants on the actual host. If no suitable host exists, keep deterministic services and approved external research adapters optional; do not silently substitute a paid API.

## 3. Specialist selection matrix

| SCI specialist | Recommended first implementation | Shared components | External adapter | Current decision |
|---|---|---|---|---|
| `soil_water_specialist` | Deterministic soil/water assessment rules, unit conversion, test-range validation, evidence-backed retrieval | BGE-M3 + BM25; Qwen3 only for explanation after host benchmark | None initially | Internal-first; no LLM diagnosis or treatment prescription |
| `irrigation_specialist` | FAO-56 Penman–Monteith / crop coefficient calculations, water balance and scenario engine | Self-hosted Open-Meteo, AquaCrop, Qwen3 for narrative | None initially | Deterministic-first; field calibration required |
| `plant_nutrition_specialist` | Nutrient balance and fertilizer arithmetic with explicit units, crop-stage rules and test provenance | BGE-M3; Qwen3 for evidence synthesis only | Human agronomist escalation | Internal-first; no automatic fertilizer dosing or application |
| `plant_health_specialist` | Image-quality gate, symptom checklist, differential retrieval, uncertainty and escalation | Qwen3-VL candidate; later field-trained crop classifiers; BGE-M3 | Qualified plant-health expert | Defer autonomous diagnosis; field-labelled local dataset is prerequisite |
| `climate_specialist` | Forecast/history normalization, heat/cold/wind/flood risk indices and local station reconciliation | Self-hosted Open-Meteo and trusted national data; Qwen3 summary | None initially | Deterministic-first |
| `agricultural_knowledge_specialist` | SAI-approved corpus retrieval, provenance, applicability and version checks | BGE-M3 hybrid retrieval + Qwen3 synthesis | Manus only for explicitly assigned research tasks, not canonical knowledge | Internal retrieval first; SAI approval remains separate |
| `market_intelligence_specialist` | Dated source collection, source-to-claim mapping, market data normalization and uncertainty tracking | BGE-M3 + Qwen3 after host benchmark | Manus is the first external research adapter | Pilot only; first report save/read and owner evaluation still pending |
| `trade_export_specialist` | Product/origin/destination requirement matrix, official-source registry, rule and date checks | BGE-M3 + Qwen3 explanation; shared market source registry | Manus may assist within an approved mission; no buyer contact | Internal rule/evidence engine; legal ambiguity escalates |
| `finance_economics_specialist` | Deterministic cost, margin, cash-flow, sensitivity and scenario calculators | Qwen3 only to explain assumptions/results | None initially | Calculator-first; never invent missing prices/costs |
| `logistics_supply_chain_specialist` | Constraint and cost model for storage, packaging, transport and cold-chain scenarios | OR-Tools; source-backed rates; Qwen3 for explanation | None initially | Optimization-first; no booking or commercial commitment |

## 4. Important crop-health evidence boundary

Do not choose a plant-disease model based only on a high benchmark score. Public field datasets are limited and may not represent SARINA's crops, varieties, geography, image devices, climate, or symptom combinations.

A newly published banana dataset (BLADE, 2026) contains 1,218 patches from 873 field images across four foliar categories collected on two farms in India. It is useful as a benchmark candidate, not proof of performance in Khuzestan or on date palms. Before any diagnostic model is enabled, require geographically diverse field images, expert-verified labels, crop/variety/stage metadata, out-of-distribution detection, calibrated uncertainty, and a prospective field test. Date-palm disease and nutrient-disorder coverage must be assessed separately.

## 5. First connection order

1. **Manus (already configured):** keep it as the first Market Intelligence adapter. Do not create another task or poll the existing task. Wait for Manus to invoke the current MCP heartbeat and submit the existing mission's private report. Verify the actual heartbeat payload and draft save/get round-trip; then score the first report against the existing rubric.
2. **Shared retrieval foundation:** benchmark BGE-M3 against a SARINA sample set in Persian, Arabic and English; compare hybrid retrieval with lexical BM25 alone. Do not ingest unreviewed agent output into SAI.
3. **Shared local reasoning foundation:** only after host inventory, benchmark Qwen3 8B and 14B on Persian, Arabic, English, structured output, tool selection, hallucination resistance, latency, memory and concurrent load. Compare Qwen3-VL separately for image tasks.
4. **First agronomic implementation:** start with low-risk, read-only soil/water or climate evidence retrieval and deterministic calculations. Irrigation and nutrition advice remain review-gated until local validation.
5. **Plant-health vision:** keep disabled until local field data and expert evaluation are adequate.
6. **Trade, finance and logistics:** add source-backed rule/calculation/optimization engines before adding more external LLM providers.

## 6. Required acceptance tests for every selected agent

- Identity, domain, capabilities, modality, lifecycle and version are registered in the one SCI registry.
- Adapter identity and execution location are explicit; no hidden provider fallback.
- Persian, Arabic and English test set where applicable; include low-bandwidth and malformed-input cases.
- Data access is least-privilege and auditable; private farm data is not sent to external adapters without explicit scope/consent.
- Evidence references, timestamps, assumptions, confidence, unknowns and output schema are validated.
- Quota exhaustion, timeout, stale heartbeat, partial response, duplicate request, cancellation and provider outage are tested.
- No external side effects or consequential agronomic actions; human escalation triggers are tested.
- A no-provider test proves core behavior remains available without paid APIs.
- Only after all gates pass may SCI request a separate enablement approval for that one specialist.

## 7. Source register

- Qwen3 announcement and license/model/deployment details: https://qwen.ai/blog?id=qwen3 and https://github.com/QwenLM/Qwen3
- Qwen3-VL official model/repository: https://github.com/QwenLM/Qwen3-VL and https://huggingface.co/Qwen/Qwen3-VL-4B-Instruct
- BGE-M3 model card and license: https://huggingface.co/BAAI/bge-m3
- PaddleOCR repository: https://github.com/PaddlePaddle/PaddleOCR
- Open-Meteo API terms, data license and self-hosting: https://open-meteo.com/ and https://github.com/open-meteo/open-meteo
- FAO crop evapotranspiration guidance: https://www.fao.org/land-water/land/land-governance-and-planning/land-resources-planning-toolbox/detail/crop-evapotranspiration-%28crop-et0%29/en
- FAO AquaCrop and Python implementation: https://www.fao.org/land-water/resources/tools/software/aquacrop/en and https://github.com/un-fao/fao-AquaCrop
- OR-Tools license and capabilities: https://github.com/google/or-tools and https://developers.google.com/optimization
- BLADE banana field-image dataset (2026): https://www.nature.com/articles/s41597-026-08603-3
- PlantDoc / real-world dataset generalization limitations: https://doi.org/10.1186/s13007-025-01450-0

## 8. Explicit non-goals

This selection catalog does not install models, create provider credentials, activate any specialist, enable dispatch, remove review gates, change farmer data, or start another Manus mission. It is the controlled selection baseline for the next one-at-a-time connection work.
