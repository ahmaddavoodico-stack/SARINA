# Specialist Storefront Workstream

## Scope delivered
- The specialist dashboard now exposes **فروشگاه من** only when the specialist selected that they have a shop during signup. The preference is read from `public.users.has_shop`, with auth metadata as a fallback.
- The specialist storefront uses a dedicated `specialist` seller type rather than overloading farmer or company seller identities.
- Specialists can submit a seller/store profile for review. New seller records are always created with `verification_status = 'pending'`; the client cannot self-verify.
- A specialist can save product drafts, edit product details and pricing, set minimum order and stock, add an HTTP(S) image URL, and request publication after seller verification.
- Published specialist products use the existing `company_supplies` marketplace catalog and are discoverable through the existing public marketplace.
- The workspace shows the specialist's own received marketplace orders under the existing seller-scoped RLS policy.
- Crop-protection category is excluded from this first specialist product form because its regulatory review workflow must be completed before publication.

## Database and access controls
- Applied migrations:
  - `specialist_individual_marketplace_seller_access` (initial seller catalog mapping)
  - `specialist_seller_type_and_signup_policy` (dedicated specialist seller type, table constraints, seller insert/update policies, catalog section mapping)
- Specialist seller creation is enforced at the database boundary: the authenticated owner must match the SARINA user, have an `expert_profiles` row, and have `public.users.has_shop = true`.
- Specialist sellers can only publish into `company_supplies`; they cannot publish into the farmer-produce section.
- Existing seller verification and product-publication rules remain in force. A pending seller cannot publish products.
- Existing marketplace checkout/payment remains unchanged; online payment is not enabled by this work.

## Validation status
- Confirmed both migrations are recorded by Supabase.
- Confirmed the specialist seller constraints include the dedicated `specialist` value.
- Confirmed the live marketplace has active categories in `company_supplies`.
- Confirmed the specialist dashboard conditionally renders the store tab and mounts the new workspace.
- Confirmed the component uses seller-owned product/order queries and validates fixed-price stock.
- Not yet verified: real specialist account signup, seller application, product draft/publication, public catalog display, and seller order visibility in a browser session.
- Vercel reports `build-rate-limit` for the latest main commit, so no successful preview/production build or browser acceptance test is claimed.
