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
- Weekly sales tasks are currently managed in this marketplace workspace. Merging them into the farmer's unified farm-work planner, with shared weekly workload balancing, is a follow-on integration.
- Payment remains unconfigured and no order is represented as paid. No buyer is contacted, no offer is sent, and no booking/contract is created automatically.
