# SARINA Marketplace Commerce Completion Workstream

**Audit date:** 2026-11-25  
**Implementation branch:** `feature/marketplace-commerce-completion`  
**Base branch:** `feature/farmer-portal-foundation` (`56ce1125a7d7ddae8f0a4d06a95c018ce549063c`)  
**Scope:** Controlled completion of the farmer-facing marketplace and seller workflows.  
**Status:** Phase 0 live audit completed; implementation not yet released.

## 1. Product outcome

Deliver one SARINA agricultural marketplace with two supply channels:

1. `farmer_products`: crops and farm-produced goods listed by verified farmer sellers.
2. `company_supplies`: inputs, equipment and agricultural technology listed by verified companies and eligible specialist/individual sellers.

A SARINA user may be a buyer and may apply for one or more permitted seller types. Seller verification, product compliance review, orders and payments remain distinct server-governed states.

The farmer-facing journey must ultimately connect to the single SARINA conversation experience. The marketplace workspace is a useful structured surface for browsing and managing trade, not a separate AI identity or a competing conversation channel.

## 2. Verified live database baseline

Connected Supabase project: `wwgkiclcpgpdktneovrx`  
Project status: `ACTIVE_HEALTHY`; PostgreSQL 17.11.

A read-only live query on 2026-11-25 confirmed 19 `marketplace_*` tables and RLS enabled on all 19:

- `marketplace_categories`
- `marketplace_sellers`
- `marketplace_products`
- `marketplace_cart_items`
- `marketplace_orders`
- `marketplace_order_items`
- `marketplace_invoices`
- `marketplace_payment_events`
- `marketplace_shipments`
- `marketplace_quote_requests`
- `marketplace_seller_change_requests`
- `marketplace_product_external_links`
- `marketplace_sales_leads`
- `marketplace_sales_tasks`
- `marketplace_product_service_needs`
- `marketplace_price_observations`
- `marketplace_trade_cost_models`
- `marketplace_trade_routes`
- `marketplace_trade_checklist_items`

The 14 active categories are split into 5 farmer-produce categories and 9 supplier-goods categories. Exact read-only row counts for the ten core marketplace tables at audit time:

| Table | Rows |
|---|---:|
| marketplace_categories | 14 |
| marketplace_sellers | 0 |
| marketplace_products | 0 |
| marketplace_cart_items | 0 |
| marketplace_orders | 0 |
| marketplace_order_items | 0 |
| marketplace_invoices | 0 |
| marketplace_payment_events | 0 |
| marketplace_shipments | 0 |
| marketplace_quote_requests | 0 |

No seller, product, cart, order, invoice, payment, shipment or quote-request data was created or changed during this audit.

Live marketplace RPCs include:

- `create_marketplace_order`
- `cancel_marketplace_order`
- `create_marketplace_quote_request`
- `list_my_marketplace_seller_change_requests`
- `submit_marketplace_seller_change_request`
- `review_marketplace_seller_change_request`

The order and quote RPCs use `SECURITY DEFINER`, require `auth.uid()`, resolve the active SARINA profile and enforce seller/product/order constraints. Their authenticated execution is reported by Supabase Advisors. This must be reviewed and regression-tested, not mechanically removed: the RPC boundary is intentionally used to keep clients from writing totals, invoice snapshots, payment state and inventory reservations directly. Anonymous execution must remain denied.

The `marketplace_seller_change_requests` table has RLS enabled with no direct table policies and is designed for RPC-only access. Do not add broad client policies merely to silence the informational advisor.

## 3. Verified code and branch baseline

- The repository default branch at audit time is `feature/farmer-portal-foundation`.
- That branch contains the marketplace product specification but does not contain the farmer marketplace UI component or specialist store workspace.
- `main` contains a read-only `MarketplaceWorkspace` catalog component and a `SpecialistStoreWorkspace` seller-management component. These are useful reference implementations, but they are not present in the selected base branch and must be ported selectively with review.
- PR #92 was merged into `main` and explicitly adds only a verified-seller, read-only farmer catalog. It does not add checkout, payments, seller onboarding or marketplace writes.
- The older `integration/marketplace-and-communications-workspace` branch contains a broader vanilla-JS marketplace workflow, but the prior audit recorded significant divergence (37 commits ahead and 70 behind `main`). Do not merge this branch wholesale. Reuse only individually reviewed behavior and SQL contracts.
- PR #83's merged readiness audit recorded that the old marketplace UI covers basic seller registration, product management, cart, single-seller checkout, quote requests and shipment entry, while admin review, media uploads, product specifications, ratings, multilingual coverage and payment settlement remain incomplete.
- PR #143 remains an open draft on the same base branch and establishes the single farmer-facing SARINA conversation and orchestration design. This workstream must not create a second AI/chat identity.

## 4. Phase 0 — completed audit

- Confirmed live Supabase project health and PostgreSQL version.
- Confirmed 19 marketplace tables and RLS enabled on every one.
- Counted core marketplace records without exposing personal data.
- Inspected live marketplace RPC definitions and current advisor findings.
- Compared the repository default branch, `main`, the marketplace integration branch and merged PRs.
- Created this isolated implementation branch from the current default branch.

No live schema, RLS policy, grant, RPC, Storage bucket, secret, production setting, payment configuration or deployment was changed.

## 5. Implementation plan and acceptance gates

### Phase 1 — source-of-truth and seller operations

1. Reconcile live marketplace migration history with migration files committed to the implementation branch. Restore missing historical migration source files before adding new DDL; do not rewrite applied migration versions.
2. Verify and test the permitted seller types: farmer, company, individual and specialist. Enforce that farmer sellers publish only to `farmer_products`, while company/specialist/individual sellers publish only to `company_supplies`, according to the existing database contract.
3. Implement a secure seller-review workspace for authorized administrators. It must list pending applications and provide explicit approve/reject/suspend actions through narrow server-side operations. General user roles or client-editable metadata must never grant review authority.
4. Add a seller-owned product management experience for farmers and supplier sellers. Preserve pending verification, draft/published states and regulated-product review gates.

**Acceptance:** seller ownership and seller type cannot be forged; only verified sellers can publish; farmer/company product sections cannot be crossed; privileged review actions are server-authorized and audited.

### Phase 2 — catalog and product content

1. Integrate the verified-seller catalog into the selected base branch.
2. Support product name, description, structured specifications, unit, currency, pricing model, minimum order, available stock, origin, quality grade, product images and seller-provided evidence.
3. Add private Storage upload paths with file-type/size validation and owner-scoped Storage policies. Never rely on arbitrary remote image URLs as the only media workflow.
4. Preserve the regulatory gate for crop protection and all products marked regulated.
5. Clearly distinguish seller-provided origin/quality from independently verified claims.

**Acceptance:** only published products of verified sellers are public; unreviewed regulated products are not publishable; product media is private until published and cannot be overwritten by another seller.

### Phase 3 — buyer experience and commerce lifecycle

1. Add buyer cart actions for fixed-price products.
2. Keep quote-only products on a separate quote-request path.
3. Checkout one seller per order, using the existing atomic `create_marketplace_order` RPC.
4. Show order number, draft invoice status, reservation expiry and explicit unpaid status.
5. Add buyer cancellation through `cancel_marketplace_order` and seller order/quote response views.
6. Add shipment tracking only after a trusted payment event confirms payment.

**Acceptance:** no mixed-seller checkout; no stock oversell under concurrent checkout; idempotent/atomic order creation; cancellation releases reservations; clients cannot mark invoices paid or create payment events.

### Phase 4 — admin, trust and operations

1. Build the narrow admin seller/product review surface.
2. Add buyer/seller order status and support workflows.
3. Add audit trail, abuse reporting and dispute/return states before broad public launch.
4. Add product ratings/reviews only with purchase/transaction eligibility and moderation.
5. Add localization for Persian, Arabic and English, then expand other languages.

**Acceptance:** private contact and verification details are not exposed publicly; only participants can see order data; moderation and dispute actions are traceable.

### Phase 5 — payments, logistics and settlement

1. Select payment provider(s) only after supported country and legal/business availability are confirmed.
2. Implement signed server-side webhooks, event idempotency, refunds and chargebacks.
3. Define tax treatment, shipping quotes, delivery obligations and country-specific seller requirements.
4. Implement settlement and payout only after legal, finance and provider readiness review.

**Acceptance:** no client can mark a payment successful; money movement is based only on verified provider events; tax and shipping placeholders are never represented as actual quotes or exemptions.

### Phase 6 — SARINA intelligence and controlled launch

1. Route farmer chat requests such as “find fertilizer for my farm” to catalog discovery while preserving SARINA as the single conversational identity.
2. Support “I have produce to sell” as a guided intake that creates a draft farmer-product listing, not an automatically published product.
3. Match buyer requests to produce listings using explicit quantity, region, quality and delivery constraints.
4. Keep commercial ranking separate from agronomic suitability; paid placement must never be framed as scientific endorsement.
5. Use Activepieces for bounded notifications and workflow orchestration only after the event contract, idempotency and secret configuration are verified. Use Manus for human-reviewed multi-step market research; do not grant it direct unrestricted database access.
6. Pilot with limited verified sellers and product categories before expanding capacity.

**Acceptance:** every chat-triggered action is permission-checked and confirmed where consequential; product listings remain drafts until seller review; specialist/agronomic advice is not influenced by paid ranking; no false payment, shipment or publication success is shown.

## 6. Global security and release rules

- RLS and least-privilege grants remain mandatory for all exposed tables and Storage objects.
- Never expose service-role keys, provider secrets or unrestricted SQL to the browser or external models.
- Do not weaken existing ownership checks to silence linter findings.
- Preserve RPC-only operations for orders, payment events, invoice snapshots and seller-change requests where intended.
- Add regression tests for anonymous access, cross-user access, seller ownership, product-section boundaries, regulated products, concurrent stock reservation, cancellation and payment-event authenticity.
- Verify the selected GitHub branch, build and browser flows before marking work complete.
- Distinguish designed, coded, committed, tested, accepted and deployed states.
- No merge to the base/default branch, no production database migration, no payment activation and no deployment without the relevant tests and explicit release approval.

## 7. Immediate next implementation slice

The first code slice after this audit should be a controlled port of the verified-seller catalog and seller product-management experience into this branch, with a farmer seller path added using the existing `farmer` seller type and `farmer_products` market section. Before enabling any write UI, verify the exact current RLS/grants and the schema migration source. Buyer cart/checkout follows only after the catalog and seller paths pass security and UI tests.


## 8. Implementation progress — 2026-11-25

### Code now present on the isolated feature branch

- Added the verified-seller catalog to the current farmer portal navigation.
- Added two catalog sections: farmer-produced goods and supplier/company supplies.
- Added a farmer seller application and product-management workspace. Seller status is not supplied by the browser; the database default creates applications as `pending`.
- Added specialist supplier storefront management in the expert workspace, gated by the existing `users.has_shop` flag.
- Added company supplier storefront management in the organization portal. Eligible organizations are retrieved through the authenticated `list_my_marketplace_organizations` RPC, and seller creation is checked against active organization membership.
- Farmer product drafts capture category, description, origin country/region, variety, seller-reported quality grade, harvest date, unit, currency, pricing model, minimum order, stock and an optional HTTPS image reference.
- Added buyer cart actions for fixed-price products, minimum-order and available-stock checks, seller-specific checkout through `create_marketplace_order`, unpaid-order cancellation through `cancel_marketplace_order`, and quote requests through `create_marketplace_quote_request`.
- Added buyer views for cart, order history and quote-request status, with explicit unpaid and unconfigured shipping/tax notices.
- Added seller responses to quote requests using only the existing permitted `status` and `seller_response` columns.
- Added a read-only marketplace privilege regression SQL test.

### Migration source recovery

The branch now restores the available applied migration sources:

- Marketplace foundation and policy migrations 019–027 from the older integration branch.
- `20261121195239_marketplace_client_privilege_hardening`.
- The two specialist seller migrations, with filenames aligned to their actually applied migration versions `20261123173027` and `20261123173155`.

**Source-history gap remains:** live migration history includes migrations 035–042 (including `039_link_sales_tasks_to_farm_planner`), but the corresponding source files were not found in the reviewed default, main, integration or marketplace feature branches. Do not run a new marketplace schema migration or treat the local migration directory as fully reconciled until these missing historical sources are recovered or a separately reviewed schema-baseline strategy is approved. The existing live schema was not changed.

### Live validation completed

- The read-only `supabase/tests/marketplace_privilege_regression.sql` assertions were executed against the connected live project and completed without an exception.
- The assertions confirmed all 19 marketplace tables have RLS enabled, the expected anonymous catalog-only read grants, no anonymous checkout/quote/cancel RPC execution, and no anon/authenticated `TRUNCATE`, `MAINTAIN`, `REFERENCES` or `TRIGGER` privileges on the marketplace tables.
- Seller/product RLS policies, product-section helper, column grants and relevant constraints were inspected read-only.
- The seller verification status column defaults to `pending` and is not client-insertable; the farmer seller UI therefore omits it.
- GitHub Actions PWA build passed on head commit `0bee37bb3b70d0f66d51c9589f4a6b66809209b6` (run #1186), including farmer, specialist and company seller workspaces. Vercel preview status remains pending; no deployed preview or production release is claimed.
- No authenticated browser workflow has been exercised with a real test buyer/seller account.

### Remaining release blockers

1. No seller-verification admin RPC or Edge Function exists in the live project. Do not add a client-side verification action. Build a narrow authenticated admin review endpoint with explicit admin authorization and an audit record.
2. No marketplace-specific Storage bucket exists in the live project and no product-media upload workflow has been implemented. The current farmer product form accepts an optional HTTPS image reference only.
3. No payment provider/webhook, real tax calculation, shipping quote or payout/settlement integration is configured. The current checkout creates an unpaid order and a draft invoice only.
4. Seller profiles and product tables are empty in the live project; no catalog item or seller has been seeded.
5. Complete browser end-to-end tests are still required for farmer application, product draft, admin approval, publication, cart, quote response, checkout, cancellation and participant-only order visibility.

The current code is a first usable commerce workflow slice, not a production-ready marketplace. Keep PR #144 draft and isolated until the remaining security, browser and operational gates pass.


### Admin review implementation slice — 2026-11-25

- Added a source migration, `20261125030000_marketplace_admin_review_workflow.sql`, defining three authenticated, central-admin-gated RPCs: review queue listing, seller verification/rejection, and regulated-product review.
- Seller and product status changes plus their audit rows are performed inside one database function call/transaction. Product rejection forces the listing back to draft; product approval does not publish it automatically.
- Added `MarketplaceAdminReviewWorkspace.tsx` and exposed it in the central admin workspace. It is wired to the RPC names above and reports clearly when the migration is not yet installed.
- Added read-only privilege regression assertions in `supabase/tests/marketplace_admin_review_privilege_regression.sql`.
- Important: these are **source changes only**. The migration has not been applied to live Supabase; no admin review RPC is claimed operational yet. The migration-history/source reconciliation and isolated database validation remain prerequisites. Do not approve or publish real sellers/products until the migration is reviewed, applied to a test environment, and the regression and authenticated E2E tests pass.
- The farmer portal already exposes a dedicated “بازارگاه کشاورزی” navigation entry, and its workspace includes catalog, cart/orders, and “محصولات من” tabs. The remaining release gates are secure admin backend activation, browser E2E, and preview validation.

- Follow-up build validation: GitHub Actions PWA build run #1194 passed on head `996c9a26fb1e3769b416c0e1f0d772aafab8ef3a`, including the new admin review UI and migration source. Vercel check remains pending; no preview deployment is confirmed.
