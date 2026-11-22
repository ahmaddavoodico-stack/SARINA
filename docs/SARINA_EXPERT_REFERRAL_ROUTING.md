# SARINA Expert Referral and Domestic / International Directory

## Purpose

The farmer expert directory supports two distinct referral paths while keeping domestic and international experts clearly separated relative to the selected farm.

## Country classification

Classification is farm-relative, not based on the farmer's nationality or the current device location:

- **Domestic**: expert_profiles.country_id equals the selected farm's farms.country_id.
- **International**: both IDs are present and differ.
- **Unknown**: either ID is missing.

Unknown profiles are never guessed into either country group. Domestic/international filters remain unavailable until the selected farm has a country ID. A farmer may have farms in different countries; changing the selected farm recalculates the classification.

## Referral paths

1. **SARINA suggestions** (referral_source = sarina_suggested): a deterministic, explainable ranking using registered specialty match, preferred interface language, declared availability, and experience. The farmer must select one of the first five displayed suggestions and explicitly submit the request. The system does not dispatch a case automatically.
2. **Farmer direct selection** (referral_source = farmer_selected): the farmer browses the directory and selects the specialist directly.

The current ranking is rule-based, not an LLM/AI assessment. Missing specialty, language, availability, or country data is not fabricated. The referral context stores only non-sensitive ranking inputs and the country-classification snapshot; the existing request consent snapshot remains in place.

## Persistence

expert_requests.referral_source records the workflow path. expert_requests.referral_context records the versioned, non-sensitive context used at submission. Existing requests retain the default farmer_selected value; no existing request data is rewritten or deleted.

The database check constraint limits referral source values to the two supported paths. The index supports filtering and operational reporting by referral source.

## Current data readiness (2026-11-22)

The live project audit found:
- 1 expert profile
- 0 verified experts eligible for the farmer directory
- 0 rows in countries
- 0 existing expert requests
- no user or expert profile with a populated country reference

Therefore the interface and data model are prepared, but real domestic/international classification and end-to-end referral behavior cannot be demonstrated until verified experts and farm country references are entered through legitimate onboarding. No sample expert, country, farm, or request records are seeded by this change.

## Acceptance checks

- Directory only reads verified profiles with directory or public visibility.
- Domestic/international classification requires exact country ID comparison against the selected farm.
- Unknown country references remain explicitly unknown.
- SARINA suggestions rank only from stored profile data and do not send requests without farmer confirmation.
- Direct selection and SARINA-suggested referrals are separately stored and visible in request history.
- Existing consultation, assignment, consent, notification, and handover workflows remain the same.
