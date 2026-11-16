# SARINA Agricultural Marketplace (V1)

## Product scope

The marketplace is one commercial system with two distinct supply channels:

1. **Farmers' products** (farmer_products): harvested produce and farm-produced goods offered by the producer.
2. **Company and supplier store** (company_supplies): fertilizers and soil amendments, crop protection, seeds, seedlings, irrigation equipment, machinery, tools and agricultural technology.

A SARINA account can be a buyer and one or both seller types. Seller identity and seller verification are separate from the user's general SARINA roles.

## Six implementation stages

### 1. Seller and organization foundation
- A farmer seller profile is owned by one SARINA user.
- A company seller profile is owned by a user acting through an existing organization membership.
- Seller applications start as pending. The client cannot set verification status or verification notes.
- Only verified sellers can publish products and receive checkout orders.
- Seller profile verification is an administrative decision, not a self-selected role.

### 2. Catalog and product management
- Categories are scoped to one of the two market sections.
- Product records include seller, category, specifications, unit, currency, pricing model, minimum order, stock, origin, quality grade, images, publication status and regulatory metadata.
- Fixed-price products can enter the cart. Quote-only products use a separate quote request workflow.
- The category crop_protection always requires regulatory verification before publication. Any product marked regulated also requires that review. Client users cannot set regulatory_status or its review timestamp.
- Farmer-reported origin and quality are labelled as seller-provided information, not independently certified.

### 3. Search and discovery
- The workspace has separate entry points for farmer produce and supplier goods.
- Buyers can search the currently loaded catalog and filter by category.
- Product cards show seller identity, category, price model, unit, minimum order and available stock.
- The current catalog is a first usable slice; faceted filters, geographic delivery coverage and relevance ranking remain future iterations.

### 4. Cart, quote requests, orders and invoices
- Cart rows are private to the buyer.
- Checkout is one seller per order, preventing a single order from mixing different sellers, currencies or fulfillment obligations.
- create_marketplace_order validates the authenticated SARINA profile, seller verification, product publication, pricing, minimum order, stock and shipping details. It snapshots product details and creates the order, line items and a draft invoice atomically.
- Inventory is reserved for 30 minutes while an unpaid order is awaiting payment. A later checkout releases expired reservations; the buyer can also cancel an unpaid order, which releases its reservation.
- Quote requests are separate from paid orders and retain buyer/seller participation boundaries.
- Invoices are draft records. Tax treatment is deliberately marked not_configured; a zero placeholder is not a tax exemption.

### 5. Payment, shipment and delivery
- Orders carry independent order, payment and fulfillment states.
- Payment events are server-only records with provider event IDs and idempotency uniqueness.
- No payment provider or webhook has been configured. The UI does not mark orders paid and no payment success is simulated.
- Shipment records can be entered by the seller only after a trusted payment event has confirmed payment. The buyer and seller can read shipment tracking.
- Shipping prices and country-specific tax rules are not yet calculated; the initial shipping amount is zero placeholder, not a quote.

### 6. SARINA intelligence and commercial integration
- The marketplace is reachable as a separate workspace from all role workspaces.
- The product and seller records provide a future basis for farm-context-aware product discovery, product comparisons and produce-to-buyer matching.
- Commercial ranking must remain distinct from agronomic suitability. Paid placement or seller sponsorship must never be presented as scientific endorsement.
- SARINA's farmer AI guidance remains free under the existing readiness-gate policy. Marketplace sales are a separate commercial channel.

## Database objects

- marketplace_categories
- marketplace_sellers
- marketplace_products
- marketplace_cart_items
- marketplace_orders
- marketplace_order_items
- marketplace_invoices
- marketplace_payment_events
- marketplace_shipments
- marketplace_quote_requests

Private helper functions in the private schema are used by RLS policies. Public checkout and quote RPCs require an authenticated user and verify the corresponding SARINA profile. The checkout and cancel RPCs use carefully scoped SECURITY DEFINER execution because the client must not write order totals, line-item snapshots, invoices, payment status or inventory reservations directly.

## Access and safety boundaries

- RLS is enabled on every marketplace table.
- Public catalog reads are limited to published products from verified sellers; seller contact and verification records are not exposed to anonymous users.
- Seller management is owner-scoped. A company seller additionally requires active membership in the linked organization.
- Seller verification and product regulatory review are not client-editable.
- Buyers can read only their own orders, invoices, cart, quote requests and shipment details. Sellers can read only orders and quote requests addressed to their own seller profile.
- Payment events are server-only. Clients cannot create payment confirmations, issue invoices, alter order totals or execute payouts.
- Product stock and order quantities are validated in the database, not trusted from the browser.

## Deployment and validation status

- Supabase migrations 019_agricultural_marketplace_foundation through 023_marketplace_policy_consolidation have been applied to project wwgkiclcpgpdktneovrx.
- The app workspace module is app/marketplace.js, mounted from the authenticated main workspace.
- Database verification confirmed all ten marketplace tables have RLS enabled, public catalog/category read grants exist, anonymous seller-table reads are revoked, and anonymous execution of checkout/quote RPCs is denied.
- Security advisors still report authenticated execution of the three intentionally exposed SECURITY DEFINER marketplace RPCs. They validate auth.uid(), resolve the active SARINA profile, and restrict operations to that buyer's own cart/order. This is a deliberate server-enforced transaction boundary; do not weaken the checks to silence the lint.
- Existing unrelated project advisor findings (including legacy RLS-without-policy tables, PostGIS extension placement, and spatial_ref_sys) were not changed as part of this marketplace work.
- Browser sign-in, seller verification, real checkout, payment-provider webhooks and end-to-end delivery have not yet been tested. The current Vercel preview may not include this branch's latest changes because of the previously reported build rate limit.


## SARINA Marketing & Sales Intelligence — first implementation slice
- The marketplace now has a dedicated **Marketing & Sales** workspace connected to each seller profile and its products.
- Seller-owned sales leads capture prospective buyer/center, buyer category, destination, product fit, required quantity, indicative price, public source URL, optional contact details, source type, verification state, sales stage and next follow-up.
- Sales tasks capture weekly commercial work such as market research, pricing, buyer outreach, follow-up, quality checks, standards, grading, packaging, storage, transport, export documents, contracts and delivery.
- Product external links support websites, social pages, product pages and catalogs. Public display is opt-in per link and is restricted by RLS to published products from verified sellers.
- Product-specific service needs cover laboratory testing, inspection, certification, grading, packaging, storage, domestic/international transport, customs, export documents, insurance and processing. The UI reuses active `organization_services` entries rather than creating a duplicate provider directory.
- RLS is enabled on all four new tables. Sales leads, tasks and service needs are private to the seller owner. External links are private by default; public reads require explicit `is_public`, a published product and a verified seller.
- Create operations are queued in user-scoped browser local storage while offline and retried after reconnection. Status edits currently require connectivity; authenticated API responses are not cached.
- This is a workflow/data foundation, not yet autonomous global buyer discovery. Leads are currently entered by the seller or recorded from external research; source provenance and verification status are retained. Automated public-market research, buyer matching, live price feeds, AI-generated marketing copy, outreach messaging and contract execution remain later phases.
- Service provider suggestions are limited to active services already registered in SARINA. A missing directory entry is not treated as proof that no provider exists in the real market.
- Weekly sales tasks can be linked to a farmer-owned farm and appear alongside agricultural work in the unified weekly planner. Cross-task workload balancing and automatic scheduling remain future work.
- Payment remains unconfigured and no order is represented as paid. No buyer is contacted, no offer is sent, and no booking/contract is created automatically.


### Unified farmer weekly planner integration
- Sales tasks may be linked to one of the farmer's own farms. The farm ownership is checked by RLS; a seller cannot attach a task to another user's farm.
- Linked sales tasks with a due date appear alongside agricultural work in the existing farm weekly planner. Farmers can start, complete, defer or cancel them from the same weekly view.
- Tasks without a linked farm or due date remain available in the Marketing & Sales workspace and do not appear in a farm-specific weekly plan.
- The sales planner and farm planner use separate records and status vocabularies, but now share the same weekly view. Full workload optimization and automatic scheduling are not yet enabled.


### Database hardening follow-up
- Migration 040 adds child-side indexes for the new product/service foreign keys and consolidates external-link SELECT authorization into one policy. This keeps owner access to private links while allowing anonymous reads only for links explicitly marked public on published products from verified sellers.
- The new sales-intelligence tables have RLS enabled. The current security advisor run reports no new security findings for these tables. Performance advisor still reports the new indexes as unused because the tables are not yet populated/queried in live seller sessions; they are retained for the expected access paths.


### Market price evidence and export route planning
- Sellers can privately record dated market price observations with destination market, source name/link, currency, unit and trade basis. Observations are seller-entered evidence, not a live market feed; source verification remains explicit.
- The unit-cost calculator includes farm/purchase cost, grading, packaging, testing/certification, storage, inland and international transport, customs, insurance, other costs, risk reserve, platform fee and target margin. It stores the calculation assumptions and distinguishes the resulting estimate from an observed market quote.
- Each destination route stores destination country, target buyer segment, shipment mode, optional Incoterm and HS code, target quantity and notes.
- Route creation seeds a checklist for buyer requirements, destination product rules, tests/certificates, phytosanitary requirements where applicable, grading, packaging/labeling, storage/cold chain, transport, customs documents, insurance and delivery terms. Items begin as “to check”; they are prompts for verification, not declarations that every item is legally required.
- Checklist status can be updated by the seller. Country-specific legal, phytosanitary, customs, tax, tariff, currency and Incoterm details must be confirmed against current official sources and qualified service providers.
- These features are integrated into the existing Marketing & Sales workspace. New records can be queued locally while offline and synced after reconnection; seller data remains private under RLS.

### Institutional pilot preparation
- A Persian-language, non-official pilot proposal is maintained at docs/partnership/jahad-agriculture-pilot-proposal-fa.md.
- It requests an initial technical review and a small voluntary pilot, not a pre-assumed endorsement. It defines possible roles, evaluation indicators, data safeguards, deliverables and a first-meeting agenda.
- Any use of an institution's name, logo, or endorsement language requires prior written permission. No government organization is represented as a SARINA partner until formally approved.
