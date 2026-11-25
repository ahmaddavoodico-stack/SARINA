# Marketplace commerce mainline rollout

Updated: 2026-11-25

## Mainline delivery
- Marketplace commerce was ported onto a branch created directly from `main`, avoiding unrelated history from the earlier farmer-portal feature branch.
- PR #145 merged into `main` as commit `96728c1a8e2968eecc8555ad820d63a2105bd4a0`.
- PR #144 was closed as superseded.
- The current mainline includes farmer catalog, buyer cart/orders, farmer seller workspace, specialist seller workspace, company storefront, and central admin review UI.
- The main application passes the authenticated SARINA user ID to the marketplace workspace.

## Primary Supabase migration
- Migration source: `supabase/migrations/20261125145024_marketplace_admin_review_workflow.sql`.
- Applied to project `wwgkiclcpgpdktneovrx` on 2026-11-25.
- The migration-history version recorded by Supabase is `20261125145024`; the repository filename is aligned to that exact version to avoid a future CLI replay caused by filename drift.
- The migration adds three RPCs: `admin_list_marketplace_review_queue`, `admin_review_marketplace_seller`, and `admin_review_marketplace_product`.
- RPCs are SECURITY DEFINER with fixed `search_path=pg_catalog, public, private`; anon execution is revoked; authenticated execution is granted but each function independently requires `private.is_sarina_admin()`.
- Seller/product state mutation and audit log insertion occur in the same transaction. Rejecting a regulated product moves it back to draft. Seller approval does not automatically publish products.

## Live validation
- Supabase migration history contains the previously applied marketplace migrations 019–027 and 035–042, plus the new admin review migration. The earlier missing-source concern was a repository source-history gap, not missing live migration records.
- Read-only regression script `supabase/tests/marketplace_admin_review_privilege_regression.sql` completed without exception.
- Post-migration function inspection confirmed all three RPCs are SECURITY DEFINER, have the fixed search path, are not executable by anon, and are executable by authenticated users (with the in-function admin gate).
- Live marketplace record counts at validation time: sellers 0, products 0, orders 0, cart items 0, quote requests 0. No seed records or test commerce transactions were created.
- Existing product RLS policies were rechecked: only verified sellers can publish; regulated and crop-protection listings require `regulatory_status='verified'`; public catalog reads require published status and verified seller.

## CI / deployment status
- GitHub Actions PWA build run #1214 passed on main head `36ecc02058f27aecebbf1b4673abb77b27bb0aa9`.
- A separate workflow run #432 was still in progress at the time of this update.
- Vercel status check was pending on that exact main head; do not claim production deployment until the provider confirms it.

## Remaining operational limitations
- No marketplace-specific Storage bucket or media upload pipeline is configured; product forms accept HTTPS image references only.
- Quote requests support seller text responses; structured quote offers and buyer acceptance/conversion are not implemented.
- Checkout creates unpaid orders only. Payment provider/webhooks, tax, shipping calculation, payouts and refunds are not enabled.
- Authenticated browser E2E acceptance across farmer, specialist, company, buyer and admin roles remains outstanding.
- No live seller or product has been added. The storefront is structurally integrated, but will remain empty until an eligible seller is approved and publishes a product.

## Safety
- No existing user, organization, farmer, specialist, farm, or marketplace business data was changed.
- No payments, payouts, external messages, or irreversible commerce actions were initiated.
