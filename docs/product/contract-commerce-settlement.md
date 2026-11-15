# SARINA Contract, Commerce & Settlement Engine (v1)

## Purpose
Provide a provider-independent economic layer for farmer services, human experts, SARINA AI services, field services and future organizations. Keep agreements, billing documents, money movement and payout allocation as separate records.

## Commercial relationship types
- `human_expert`: farmer contracts an approved human expert.
- `ai_service`: farmer buys a SARINA-delivered AI capability. The AI model itself is not a legal payee; SARINA accounts for model/API usage as an internal provider cost.
- `hybrid`: one engagement combines expert and AI work, with responsibilities and cost components itemized.
- `field_service`: on-site work with travel/materials and completion evidence.
- `organization`: future institutional or company service.

## Pricing models
- `fixed_fee`: one agreed total.
- `milestone`: payment tied to explicitly accepted deliverables.
- `subscription`: recurring service period and renewal terms.
- `per_use`: metered analyses, requests or credits.
- `result_based`: contingent fee based on a documented, measurable outcome.
- `hybrid`: base fee plus usage, milestones or outcome share.

A result-based clause must define baseline, measurement window, metric, evidence source, excluded external factors, implementation costs, attribution method, cap/floor, dispute window and what happens when data is incomplete. The previously discussed 5% expert share is a configurable pilot proposal only, never a universal default or automatic entitlement.

## Revenue and settlement
- Farmer payment is collected by SARINA or a configured payment operator.
- Human expert compensation is calculated from the accepted contract: fixed, milestone, subscription share or validated result share.
- SARINA platform fee is a contract-specific amount/rate, not hard-coded globally.
- AI provider/API costs are internal costs borne by SARINA unless a contract explicitly itemizes a permitted pass-through charge.
- Refunds, taxes, chargebacks, provider fees and currency rounding are explicit ledger items.
- Settlement allocations are calculated only from confirmed payment events and eligible contractual milestones/outcomes.

## Lifecycle
1. Farmer creates a private draft.
2. SARINA validates service eligibility, provider status, terms and pricing.
3. A versioned offer is issued to the other party.
4. Each required party accepts the same immutable terms version.
5. Invoice is issued and payment is initiated through an enabled provider.
6. Provider webhook/server verification confirms payment; client UI cannot mark an invoice paid.
7. Service delivery and milestones are recorded.
8. Outcome-based fees are evaluated against agreed evidence and confounders.
9. Settlement allocations are calculated, reviewed and paid through a supported payout rail.
10. Corrections, disputes, refunds and reversals create audit events; they do not silently rewrite history.

## Data model (migration 015)
- `service_contracts`: parties, service type, pricing model, currency, rates, result definition, schedule, immutable terms snapshot and lifecycle timestamps.
- `contract_invoices`: issued amount due, tax/discount and invoice status.
- `payment_transactions`: payment operator references, idempotency key, provider-confirmed state and amount. Never store card or bank credentials.
- `contract_settlement_allocations`: expert, SARINA, AI provider, organization and refund allocations.
- `contract_audit_events`: internal lifecycle audit trail.

## Security boundaries
- Farmer may create only a draft owned by their own SARINA user record.
- Farmer and assigned expert may read their contract and related invoices, payment records and settlement summaries.
- Clients cannot accept offers, issue invoices, confirm payments, change transaction state, create allocations or execute payouts directly.
- Those transitions require trusted server-side functions with verified identity, role, idempotency and provider signatures.
- No client-editable metadata or user profile field may grant admin, reviewer or finance authority.
- Payment credentials remain with the payment provider; SARINA stores only opaque references and minimum necessary status metadata.

## Release boundary
Migration 015 is a database foundation, not a live payment integration. Payment provider onboarding, signed webhooks, trusted acceptance endpoints, invoice generation, settlement execution, tax/legal templates and country-specific payment rails remain gated follow-up work. Do not claim that a contract is legally signed or money transferred until the relevant trusted process confirms it.

## Farmer workspace pilot UI
The farm card now exposes a bilingual contract panel. A farmer can create a private draft for a verified human expert or a SARINA AI service, choose a pricing model, currency and base amount, and optionally describe an outcome-based clause. Drafts are listed by farm. This UI deliberately does not offer acceptance, invoice issuance, payment confirmation or payout controls; those actions require trusted server-side workflows.

Migration 016 links each contract to its farm and optionally to the originating expert request. The insert policy checks that the signed-in farmer owns the linked farm and that a selected human expert is verified.


## Contract acceptance workflow (migration 017)
- A farmer can move their own draft to `proposed`; the offer records the current immutable `terms_snapshot` and version in the audit trail.
- For human-expert and hybrid contracts, the assigned verified expert and farmer each accept independently. The contract becomes `accepted` only after both accept the same stored version.
- For SARINA AI-only contracts, farmer acceptance is sufficient because there is no human expert counterparty.
- Either required party may cancel a draft or proposed offer. The transition is atomic under a row lock and writes an audit event.
- All transitions are performed by the authenticated `sarina-contract-workflow` Edge Function. The database RPC is executable only by `service_role`; clients cannot update contract lifecycle columns directly.
- Farmer workspace exposes propose/accept/cancel actions. The verified expert workspace lists offers and exposes accept/decline (recorded as cancellation).
- Invoice creation and payment are intentionally not triggered by acceptance yet. They remain a separate next stage, after contract acceptance is validated in a real browser session.
