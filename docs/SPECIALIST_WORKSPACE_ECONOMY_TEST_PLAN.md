# Specialist Workspace Economy — Test Plan and Handoff

## Current implementation

- Verified specialists can read their configured monthly credit allowance, subscription status, current ledger balance, ledger history, and reward request states.
- Central admins can configure workspace pricing, monthly included credits, credit unit price, AI price per 1,000 tokens, reward multiplier, grace period, and overage policy.
- Central admins can create reward rules for published products. Creating a rule designates that product as a SARINA premium product through an admin-only database function.
- Reward requests are limited by database-side checks: verified/active expert-to-farm relationship, published SARINA-premium product, active reward rule, matching base reward units, completed farm improvement action, same-farm post-action measurement, and configured minimum number of post-action measurements.
- Reward approval is central-admin-only. The configured reward multiplier is applied server-side and a positive ledger entry is written with an idempotency key. Declines do not write credit.
- The specialist credit ledger remains append-only from client roles.

## Safety gates

- Real billing is disabled in the UI and database. A database constraint rejects billing_enabled=true until a deliberate future migration removes that guard after payment-provider integration and tests.
- No automatic monthly allowance issuance or AI token debit is active yet. The UI shows the configured allowance separately from the actual ledger balance.
- No automatic payment, overage charge, or client-side credit-ledger mutation is implemented.
- Reward evidence text is submitted by a user and must be reviewed as untrusted evidence by the central admin.

## Manual acceptance tests

1. Sign in as central admin; open **اقتصاد متخصصان و اعتبار سبز**.
2. Update the configurable prices and included monthly credits; save; verify the row in specialist_workspace_pricing.
3. Attempt to enable billing; verify the UI does not permit it and the database rejects a direct billing_enabled=true update.
4. Publish a marketplace product; create a reward rule using its product UUID. Verify marketplace_products.is_sarina_premium=true and the active rule exists.
5. Sign in as a verified specialist with an active contract for a farm. Confirm the pricing, ledger, and rule list load.
6. Submit a reward request with a completed action and post-action measurement(s) for that same farm. Confirm status is pending and no credit is added yet.
7. Verify invalid requests fail: non-premium/unpublished product, inactive rule, mismatched credit units, action not completed, action from another farm, missing measurement, pre-action measurement, or insufficient post-action measurements.
8. As central admin, approve the request. Verify status becomes credited, awarded units use the configured multiplier, and exactly one positive ledger row is created.
9. Decline a second pending request. Verify no ledger row is created.
10. Attempt direct client insert/update/delete on specialist_workspace_credit_ledger; all must be denied by grants/RLS.

## Known follow-up work

- Replace UUID entry fields in the specialist reward form with farm/action/measurement pickers backed by the verified-expert views.
- Add a server-side monthly allowance issuance job with idempotent ledger entries.
- Connect AI token metering to a trusted server-side debit function; never debit from the browser.
- Connect a payment provider, webhook verification, subscription lifecycle, and reconciliation before enabling billing.
- Review product premium designation and reward-rule lifecycle with the marketplace product governance workflow.
- Complete and test the remaining specialist assistant capabilities: richer case-context synthesis, actual vision model integration for image analysis, grounded source catalog and confidence, saved expert reports, scheduled notifications, and consent-based de-identified cross-farm learning.
- The current evidence threshold counts measurements for the same farm observed after the completed action timestamp; it does not yet match individual metric codes to a product-specific expected outcome. Admin review remains mandatory.

## Build and deployment status

- The latest GitHub commit status reported a Vercel build-rate-limit failure. This is an external build quota restriction, not a confirmed source-code build failure.
- GitHub Actions workflow runs were not returned for the latest commits. A successful build/deployment has therefore not been verified.
- Run the repository build and the acceptance tests above when the Vercel/GitHub build capacity is available.
