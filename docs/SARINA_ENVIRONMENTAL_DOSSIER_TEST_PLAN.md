# SARINA Environmental Dossier — Security and Correctness Test Plan

## Automated unit coverage added

Test file: `supabase/functions/sarina-central-intelligence/_shared/environmental-dossier_test.ts`

The deterministic test stubs all four existing context endpoints and checks:

- All four domain adapters are requested and caller Authorization plus publishable key are forwarded.
- The weather adapter receives `read_only: true`, preventing its normal forecast-record write side effect.
- A failed spatial provider does not discard successful weather, land, or historical-climate results.
- A mixed response remains `partial`; all-provider failures become `needs_review` and do not fabricate missing data.
- Soil and water rows tagged `laboratory_record` are counted as laboratory evidence; other rows remain separately classified.
- Farmer observations, weather model estimates, provider failures, and missing historical climate remain distinguishable.

Run from the repository root with Deno:
```sh
deno test --allow-env --allow-net supabase/functions/sarina-central-intelligence/_shared/environmental-dossier_test.ts
```

The test has been committed but has **not** been executed in this environment; a green test result must not be inferred from its presence.

## Security and integration cases required before production use

These require a controlled Supabase test project and at least two farmer identities plus an authorized specialist identity. They are not simulated by the pure unit test.

| Case | Request / setup | Expected result |
|---|---|---|
| Missing bearer token | No Authorization header | 401 `AUTH_REQUIRED` |
| Invalid/expired JWT | Invalid bearer token | 401 `INVALID_SESSION` |
| Invalid farm ID | Malformed UUID | 422 `INVALID_FARM_ID` |
| Owner access | Owner requests own farm | 200; only caller-authorized farm context |
| Cross-farm IDOR | Farmer A submits Farmer B farm_id | 404 `FARM_ACCESS_DENIED`; no provider function called |
| Assigned expert | Specialist with valid active farm assignment/consent | Result must follow the approved access policy; currently requires explicit verification against live RLS semantics |
| Unassigned expert | Specialist without assignment/consent | 404 `FARM_ACCESS_DENIED` |
| Partial provider outage | One context function returns 5xx | 200 partial dossier; failed domain recorded |
| Total provider outage | All context functions unavailable | 200 needs_review dossier with missing domains; no invented values |
| Weather read-only | Dossier refresh with weather context available | Weather response says `persistence: not_persisted`; `weather_records` count unchanged |
| Normal weather flow | Existing ordinary weather request without `read_only` | Existing forecast persistence behavior remains intact |
| Model vs laboratory | SoilGrids available, no lab test | Regional reference available; laboratory evidence still missing |
| No snapshot write | Any dossier refresh | `farm_environmental_assessments` count unchanged |
| Secret isolation | Inspect response and logs | No service-role key, provider credential, or raw authorization token returned/logged |

## Current verification boundary

- The implementation and test file are committed only to `feature/environmental-dossier-integration`.
- Weather context now supports an explicit read-only request. Its normal request path remains the persistence path.
- No production SQL, migration application, secret mutation, Edge Function deployment, frontend deployment, or merge to `main` has been performed.
- Automated test execution, live RLS authorization matrix, live row-count side-effect check, and deployed Edge Function verification remain outstanding.
- Do not enable snapshot persistence until the authorization matrix passes and the migration-ledger discrepancy documented in `SARINA_ENVIRONMENTAL_DOSSIER_DATABASE_AUDIT.md` is reconciled without recreating the existing table.
