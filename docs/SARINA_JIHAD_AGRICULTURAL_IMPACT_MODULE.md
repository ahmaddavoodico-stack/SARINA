# SARINA Jihad Agricultural Impact & Support Module

**Status:** Architecture/design baseline (not a production implementation)  
**Audit date:** 2026-11-22  
**Repository:** `ahmaddavoodico-stack/SARINA`  
**Supabase project:** `wwgkiclcpgpdktneovrx`

## 1. Product objective

Create an institutional operating layer that closes the loop:

**farmer identity → farm and specialist case → institutional support → farmer/expert action → measured outcome → institutional learning and recognition.**

The module must let an authorized agricultural authority find a farmer through a SARINA public identifier, see a concise and consent-authorized profile, understand which verified specialist is supporting the farmer, review support delivered, compare measured productivity over time, issue applicable directives, follow execution, and recognize verified contributions by farmers and specialists.

It is not a government registry replacement, a new farmer CRM, or a claim of live integration with Ministry/Jihad systems. Official identifiers and external integrations are linked only when the relevant authority supplies/approves the interface and the farmer has the required notice/consent or legal basis.

## 2. Production infrastructure audit (read-only)

### 2.1 Platform state

- Supabase project status: `ACTIVE_HEALTHY`.
- PostgreSQL engine: 17; reported database version 17.11.0.019.
- Latest migration visible in remote migration history: `20261122152754 expert_profile_avatars`.
- The repository's `main` contains the farmer companion, expert secretary, farmer–expert workspace and Jihad regional workspace surfaces.
- The Jihad regional page currently uses local hard-coded demonstration rows and metrics. It explicitly labels itself as a design preview and does not read production records.
- The productivity oversight workspace already queries productivity outcome reviews and candidate signals and invokes the existing evaluation/context-analysis RPCs. It is a separate operational foundation, not yet a complete Jihad support-program workspace.

### 2.2 Existing schema that should be reused

| Existing table / component | Current role | Reuse in this module |
|---|---|---|
| `users` | SARINA person identity, auth mapping, home region | Canonical farmer identity; do not duplicate user accounts |
| `farms` | Farmer-owned farms, organization link and home region | Farm and beneficiary scope |
| `expert_profiles`, `expert_requests`, `expert_request_assignments` | Verified specialist profiles and farmer cases/assignments | Specialist currently helping a farmer |
| `expert_recommendation_actions`, `expert_recommendation_reviews` | Approved plans, farmer action and specialist follow-up review | Evidence of advice, execution and review |
| `institutional_service_requests`, `institutional_request_events` | Farmer requests to an organization and request timeline | Service intake and request-level institutional communication |
| `organizations`, `organization_members`, `organization_capabilities`, `organization_access_scopes` | Organization governance, memberships, capability and scope checks | Authority tenant and least-privilege access |
| `farm_productivity_baselines`, `farm_productivity_measurements`, `farm_productivity_context_observations` | Baseline, measurements and confounding context | Productivity evidence and trend |
| `farm_productivity_authority_consents` | Farm + organization + farmer-granted scoped authority access | Consent gate for institutional productivity access |
| `farm_productivity_outcome_reviews` | Human-reviewed outcome, attribution confidence and follow-up | Institutional outcome review |
| `expert_impact_records`, `expert_impact_assessments`, `expert_impact_signals` | Specialist impact submissions and assessed evidence | Specialist contribution and recognition evidence |
| `expert_recognition_requests`, `expert_recognition_awards` | Specialist recognition workflow and awards | Reuse for expert recognition; do not create a parallel expert-award store |
| `JihadRegionalWorkspace.tsx` | Regional oversight design preview | Replace hard-coded sample data with scoped production queries |
| `ProductivityOversightWorkspace.tsx` | Live productivity review interface | Extend/reuse its review concepts, not duplicate evaluation engine |

### 2.3 Current data footprint

Read-only counts at audit time:

| Entity | Rows |
|---|---:|
| SARINA users | 6 |
| Farms | 0 |
| Expert profiles | 1 |
| Expert requests | 0 |
| Organizations | 0 |
| Organization memberships | 0 |
| Organization access scopes | 0 |
| Institutional service requests | 0 |
| Authority productivity consents | 0 |
| Productivity baselines | 0 |
| Productivity measurements | 0 |
| Productivity outcome reviews | 0 |
| Expert impact records | 0 |
| Expert recognition awards | 0 |

This is an early-stage dataset, not evidence that the workflows have passed realistic role-switched testing. There are no organization/farm/request fixtures in the live database to prove county/province isolation or end-to-end institutional access. Do not fabricate live dashboard totals from empty tables.

### 2.4 Authorization and security observations

Positive foundations:
- RLS is enabled on the core user, farm, organization, institutional request, productivity, consent and specialist-impact tables.
- Institutional request reads are scoped through `organization_has_scoped_access(..., 'service.requests.manage', ...)`.
- Authority productivity access is gated by an active farm/organization consent and organization scope checks.
- Productivity outcome reviews have distinct farmer, active-expert, organization-authority and SARINA-admin read paths.
- Organization membership and capability tables already exist.
- The health advisor returned no lints at audit time.

Items to resolve or test before pilot:
1. The security advisor reports 17 RLS-enabled tables without policies. Some may intentionally be service-only/default-deny; classify each table and explicitly document intended access rather than blanket-opening them.
2. The security advisor reports multiple SECURITY DEFINER functions executable by `authenticated`, including productivity evaluation/context-analysis RPCs and the recently added avatar RPC. Review each function body, caller checks, search_path and grants. For this module, prefer SECURITY INVOKER; where a SECURITY DEFINER transaction is essential, put it behind strict identity, capability, organization-scope and consent checks, pin an empty/search_path, revoke PUBLIC/anon and grant only the intended role.
3. Performance advisor reports 33 multiple-permissive-policy findings, including existing farm, organization and productivity tables. Consolidate only after behavior tests; do not alter broad existing policies without regression coverage.
4. Auth leaked-password protection is reported disabled; track as a platform security configuration task.
5. `public.spatial_ref_sys` has RLS disabled. Confirm extension ownership/exposure and expected public read-only use; do not blindly enable RLS on the PostGIS catalog.
6. Role-switched positive and negative tests are not proven by the current empty production data. Use an isolated test environment or transactionally cleaned fixtures before pilot.

### 2.5 Identified model gaps

- `users` has no SARINA public farmer code. Do not overload UUID, phone, email or a sequential database ID as a human-facing identifier.
- Existing authority consent is farm-specific and organization-specific, which is good for farm metrics, but a farmer identity card needs its own controlled sharing scope. A farmer can own multiple farms.
- `organization_access_scopes` currently exposes global/country/user/farm scopes but no province/county/service-center hierarchy. The `organization_has_scoped_access` helper currently checks only global, country, user and farm scopes. Although `users.home_region_id` and `farms.home_region_id` reference `deployment_regions`, that table contains deployment/hosting-region metadata (region code, display name, hosting country and status), not a parent-child administrative geography. It must not be repurposed as the Jihad province/county tree. The Jihad UI models national/province/county/service-center levels, but the backend cannot enforce those levels yet.
- Existing institutional requests record a service request, not the full lifecycle and accounting of a grant/subsidy/equipment/training support item.
- Existing productivity records measure outcomes, but there is no dedicated versioned authority directive workflow with target audience, acknowledgment, implementation and expiry.
- Specialist awards exist; a corresponding farmer recognition workflow is not yet represented by the same award tables.

## 3. Target architecture

### 3.1 Identity: SARINA Farmer Code

Add a `farmer_public_identifiers` registry:
- `id` UUID primary key.
- `user_id` FK to `users`, unique for active primary identifier.
- `public_code` unique, opaque, random, human-readable format such as `SRN-7K4M-92PX`; generated server-side with collision retry and check character.
- `status`: active, suspended, retired.
- `issued_at`, `issued_by`, `created_at`, `updated_at`.
- Never encode region, year, row number, phone, national ID or other personal data in the code.
- The code is a lookup handle, not an authentication credential. Searching it still requires an authenticated organization member with the relevant capability and geographic scope.
- Farmer may rotate/retire the code after compromise; old codes remain non-reusable and audit-linked.

Optional later mapping table `farmer_external_registry_links`:
- SARINA user ID, authority namespace, encrypted external identifier or keyed HMAC lookup, verification status, verification source, consent/legal-basis reference and timestamps.
- Never store raw national identity numbers in ordinary profile JSON or expose them in search results.
- External official identifier linking is a separately permissioned step and is not a prerequisite for a SARINA public code.

### 3.2 Organizational geography and delegated access

Extend the existing scope system rather than inventing a second role model:
- Create a separate `agricultural_admin_regions` table for the official administrative geography; do not use `deployment_regions`, which is for deployment/hosting regions. Include `id`, `parent_region_id`, `region_level` (national/province/county/service_center), `official_code`, `display_name`, `country_id`, `authority_namespace`, `status`, validity dates and source/version metadata. Enforce unique official codes within their authority namespace and valid parent-level relationships.
- Add `farms.admin_region_id` to link each farm to a verified agricultural administrative region. Keep existing `home_region_id` semantics unchanged until its deployment-region purpose is separately resolved.
- Add nullable `target_admin_region_id` to `organization_access_scopes` and explicit scope types: national, province, county, service_center, assigned_farm, assigned_farmer, expert_case.
- Resolve descendants through a trusted server-side recursive hierarchy query; never accept a client-supplied list of arbitrary region descendants.
- Update `organization_has_scoped_access` to evaluate capability + active membership + administrative-region ancestry + target user/farm + country. Fail closed if a region is missing or ambiguous.
- Add capability codes (names are proposed): `farmer.identity.read`, `farmer.profile.summary.read`, `oversight.productivity.read`, `oversight.support.read`, `oversight.support.manage`, `oversight.directive.publish`, `oversight.directive.review`, `oversight.recognition.issue`, `oversight.expert.read`, `oversight.reports.export`.
- Separate authority users from SARINA platform administrators. A platform admin is not automatically an authority employee; organization access requires active membership and capability.
- A service-center officer sees only assigned service-center/farmer scope. County and province roles see descendants only within their granted scope. National role receives aggregate-first access; row-level farmer identity is a separate capability.

### 3.3 Consent and purpose limitation

Keep the existing `farm_productivity_authority_consents` as the consent gate for farm productivity. Extend the consent vocabulary only through a reviewed migration if additional scopes are needed.

Introduce a farmer-level sharing record (proposed `farmer_authority_consents`) for identity summary and case linkage:
- `user_id`, `organization_id`, `consent_scope`, `purpose_code`, `status`, `granted_at`, `expires_at`, `revoked_at`, `consent_version`, `granted_by_user_id`.
- Granular scopes: identity summary, farm summary, assigned specialist, institutional support history, productivity metrics, outcome summary, directive delivery.
- Consent is not bundled into generic signup. Show the organization name, fields, purpose, duration and withdrawal method.
- Withdrawal blocks future access immediately; legally required audit records remain minimal and immutable.
- Where an official mandate provides another lawful basis, record the basis and approval reference; do not silently treat it as farmer consent.

### 3.4 Support registry

Add `institutional_support_records` as a ledger of support actually approved/delivered, linked to existing institutional service requests when applicable:
- `id`, `organization_id`, `beneficiary_user_id`, nullable `farm_id`, optional `service_request_id`.
- `support_code`, `category` (financial, input, equipment, water, training, insurance, technical_visit, infrastructure, other).
- `title`, `description`, `quantity`, `unit_code`, `estimated_value`, `currency_code`, `funding_source`.
- `status`: proposed, approved, allocated, partially_delivered, delivered, completed, cancelled, disputed.
- `approved_at`, `delivered_at`, `period_start`, `period_end`, `official_reference`, `evidence_refs`, `created_by`, `updated_at`.
- Keep planned allocation distinct from verified delivery. Only approved/delivered states count in impact summaries. Financial values require explicit currency and period; never sum incomparable currencies.
- Append lifecycle changes to `institutional_support_events` (actor, old/new state, reason, timestamp, evidence reference); no destructive overwrite of historical events.

### 3.5 Directives and recommendations

Add versioned `institutional_directives` and `institutional_directive_assignments`:
- Directive fields: issuer organization, official reference, title, body, category, crop/region/season applicability, priority, effective date, expiry date, source document, version, status (draft, approved, published, superseded, withdrawn), author and approver.
- Assignment target: region, farmer, farm, expert profile or existing expert request. Store the target kind and validated target IDs; reject incompatible combinations.
- Assignment lifecycle: published, delivered, read, acknowledged, action_planned, in_progress, completed, not_applicable, needs_clarification, overdue.
- Farmer sees plain-language actionable instructions. Assigned specialist sees technical source, applicability, caveats and asks for clarification when conditions differ.
- A general directive is not automatically a farm-specific prescription. Specialist must confirm/adapt it for a particular case where professional judgment is required.
- Preserve each version and delivery event. A withdrawn directive remains in history with a clear warning; it is not silently deleted.

### 3.6 Productivity and impact

Reuse existing baselines, measurements, context observations and outcome reviews. Do not create a second measurement engine.
- Dashboard presents baseline and follow-up period side by side, metric value, unit, source, quality, confidence and evidence.
- Include yield, marketable yield/loss rate, revenue/cost/margin, water per unit of product, fertilizer/input use, soil/water indicators, crop health and resilience where data exists.
- Compare only compatible crop/variety/production system, unit, period and geographic cohort.
- Show confounding factors (weather, irrigation volume/quality, pests, diseases, input changes, crop stage, cultivar, labor) from `farm_productivity_context_observations`.
- Preserve existing attribution confidence values: insufficient, low, medium, high (or the exact canonical enum/check constraint in the database). A before/after difference is an observed change, not proof that a specific subsidy or specialist caused it.
- Use labels: observed improvement, no material change, decline, mixed result, insufficient evidence. Never convert missing data into zero or a low score.
- Authority aggregate reporting must suppress small cohorts where an individual could be inferred.

### 3.7 Recognition

- Reuse `expert_recognition_requests` and `expert_recognition_awards` for specialists. Authority-issued specialist recognition must use the existing organization capability and scoped access checks.
- Add a separate `farmer_recognition_records` workflow for farmer recognition, linked to user/farm and reviewed evidence. Fields include award category, title, citation, issuer, evidence refs, approval, issued/revoked timestamps and public verification token.
- Recognition is evidence-based and explainable: resource efficiency, sustained improvement, adoption/innovation, resilience, cooperation/data quality.
- No single opaque productivity score should determine awards. Include human review, conflict-of-interest declaration, correction/appeal and revocation history.
- Recognition should not expose a farmer's private performance or farm data publicly without separate explicit publication consent.

### 3.8 Audit trail

Add an append-only `institutional_access_audit_events` table for sensitive reads, exports and mutations:
- actor user, organization, action, resource type/id, purpose code, scope decision, timestamp, request correlation ID, minimal metadata.
- Do not store raw farmer message bodies, national identifiers, attachment contents or secret values.
- Record who searched a farmer code, opened a profile, exported a report, changed support status, published a directive or issued an award.
- Access to the audit log itself is separately restricted and monitored.

## 4. User experiences

### 4.1 Farmer view
- “شناسه سارینای من” with copy/share controls and explanation that it is not a password or national ID.
- Consent center listing each organization, data categories, purpose, duration and revoke action.
- My support: what was approved, what was actually delivered, dates, provider and official reference.
- My specialist: assigned verified specialist, case status, latest recommendation and review status.
- Directives: plain-language instructions, source, effective period, acknowledgement, question and completion feedback.
- My progress: measured trends with dates, units, sources and confidence; no fabricated percentages.
- Recognition: private record and optional public certificate only with publication consent.

### 4.2 Specialist view
- Case-specific official directives relevant to assigned farmer/farm.
- Ability to mark applicable/not applicable, add technical adaptation, request clarification and create a linked recommendation.
- Existing recommendation lifecycle remains canonical; specialist must not edit the original official directive.
- Outcome follow-up and evidence submission linked to the case and impact record.

### 4.3 Authority portal
- Search by SARINA farmer code; official registry link only if verified and authorized.
- Farmer summary card: display name or privacy-preserving label, region, farm summary, active specialist/case, current consent status and data freshness.
- Support ledger: allocated vs delivered vs completed.
- Productivity view: baseline/follow-up, context, evidence quality and attribution confidence.
- Directive center: draft/review/publish, targeting, acknowledgement and overdue tracking.
- Recognition queue: nominate/review/approve farmer and expert recognition.
- Reports: regional and program aggregates with cohort suppression, filters, period and export audit.
- Regional navigation must be derived from authenticated server-side scope. The UI cannot grant itself national/province/county access by changing a selector.

## 5. Core workflows

### A. Register and identify a farmer
1. Farmer completes SARINA profile and at least one farm record.
2. Server issues a random public code and stores the user mapping.
3. Farmer reviews identity-sharing consent for a named organization and purpose.
4. Authority user searches code; backend checks active membership, capability, region scope and consent/legal basis.
5. The UI returns only permitted summary fields and logs the access.

### B. Record support and assess impact
1. Authority creates a support record, optionally linked to a service request.
2. Approval and delivery are separate events with evidence.
3. Specialist assignment and recommendations remain linked to the canonical expert case.
4. Baseline and contextual factors are recorded before or at support start where possible.
5. Follow-up measurements are recorded with source and quality.
6. Existing evaluation engine raises a signal; human reviewer confirms classification and attribution confidence.
7. Authority sees observed change and support history, not an unsupported causal claim.

### C. Issue and follow a directive
1. Authorized official drafts directive with source and effective dates.
2. A second authorized approver reviews where policy requires.
3. Publisher selects region/farm/farmer/expert targets within own scope.
4. Farmer and assigned specialist receive the directive through SARINA notification surfaces.
5. Specialist adapts it to the case where necessary and records an expert recommendation.
6. Farmer acknowledges, asks questions and reports execution.
7. Specialist reviews outcome; authority sees status and evidence quality.

### D. Recognize performance
1. System may surface candidate cases from verified evidence.
2. Human reviewer examines evidence and attribution.
3. Authority with recognition capability issues a farmer recognition record; specialist award uses existing expert award workflow.
4. Farmer/specialist can challenge factual errors.
5. Public verification is optional and requires explicit publication consent.

## 6. Proposed data/API boundaries

- Frontend reads only through authenticated Supabase client queries protected by RLS or through narrowly scoped authenticated Edge Functions.
- Do not put service-role keys in browser code.
- Use atomic server-side operations for issuing codes, creating support records with first event, publishing directives with assignments, and issuing awards.
- Every mutation derives actor identity from the authenticated session; do not trust client-supplied `user_id`, organization ID, role, region or recipient.
- Idempotency keys are required for external sync and delivery retry.
- External Jihad/Ministry adapters must be separate from the core data model. A failed external connection must not interrupt in-app records.
- Regional replication/sync must use the existing regional sync architecture and selective ownership rules; never copy all farmer PII to every region.

## 7. Delivery plan

### Phase 0 — prerequisites and authorization proof
- Confirm official organization identity and authority representation for pilot.
- Create organization, active members, capabilities and region scopes.
- Define canonical region tree and map Jihad province/county/service-center codes to it.
- Test current productivity consent flow and organization scope helpers.
- Build isolated fixtures for farmer, two farms, two organizations, two regions, two specialists and cross-region negative cases.

### Phase 1 — farmer identity and authorized profile
- Add farmer public identifier issuance/rotation.
- Add farmer-level consent center and identity summary endpoint.
- Add target-region scope to organization scope model and update helper.
- Replace the Jihad UI demo banner/data with live, empty-state-safe search and profile summary.

### Phase 2 — support registry
- Add support ledger and append-only support events.
- Connect service requests to approved/delivered support where relevant.
- Add authority support dashboard and farmer support history.

### Phase 3 — directive workflow
- Add directive/version/assignment tables and notification integration.
- Add authority author/reviewer/publisher controls.
- Add farmer and specialist delivery, acknowledgement, adaptation and completion views.

### Phase 4 — impact and recognition
- Integrate existing productivity baseline/measurement/context/review data.
- Add impact report with confidence and cohort protections.
- Add farmer recognition; extend existing specialist recognition operations only where required.

### Phase 5 — pilot and integration
- Run county-level pilot with verified authority users and real consent.
- Measure request-to-response time, support delivery rate, directive acknowledgement, follow-up completion, data completeness, measured outcomes and unresolved cases.
- Integrate official registries only after API/data-sharing agreement and a tested adapter.

## 8. Security and acceptance tests

Required positive tests:
- Farmer can view their own public code, consents, support history and directives.
- Active assigned specialist sees only the linked case and applicable directive.
- Authority member with a valid region scope and capability sees only consented farmers/farms in scope.
- County member can see its own county and allowed descendants, not sibling counties.
- Province member can see permitted province descendants, not another province.
- A national aggregate report contains no identity fields unless the user separately has identity-level capability and legal basis.
- Authority action is logged with actor, organization, resource and purpose.

Required negative tests:
- Guessing a farmer code without login or scope reveals nothing.
- A valid organization member without the required capability cannot read identity/productivity/support details.
- An organization with no active farmer consent cannot read consent-gated productivity data.
- Revoked/expired consent immediately blocks future reads.
- A specialist not assigned to the case cannot see private case details.
- A farmer cannot change their user ID, region, official identifier mapping or support status through client writes.
- A county user cannot switch the UI selector to national/province and gain access.
- A directive publisher cannot target outside their own scope.
- A support record cannot count as delivered until delivery evidence/state is recorded.
- Incomplete data cannot produce a zero score or a causal impact claim.
- Duplicate webhook/retry does not create duplicate support events, directive deliveries or external registry links.

Release acceptance:
- RLS and grants reviewed for every new table/view/RPC.
- No browser exposure of service-role secrets.
- Role-switched tests pass in an isolated test environment.
- Empty production state renders meaningful zero/empty states, not sample statistics.
- Security/performance advisors rerun; new findings are resolved or documented.
- Main branch CI/build is green. Preview and Production deployment states are reported separately and only claimed after verification.

## 9. Explicit non-goals for the first pilot

- No automatic connection to Jihad/Ministry databases without an approved interface and agreement.
- No national ID collection as a condition for a SARINA code.
- No public leaderboard of farmers or specialists.
- No fully automated eligibility, subsidy allocation, causal attribution or disciplinary scoring.
- No AI-generated official directive without authorized human approval.
- No bulk sharing of private farmer conversations or raw attachments with authorities.
- No use of demonstration values as live KPIs.

## 10. Decision summary

Build the Jihad module as an institutional layer over the existing SARINA farmer, farm, specialist, service-request and productivity systems. Add only the missing primitives: opaque farmer public identity, region-aware organization scope, farmer-level consent, support ledger, versioned directives, farmer recognition and access audit. Keep existing expert recognition and productivity engines canonical. The first release should be a county pilot with a verified authority tenant and fully tested scope/consent rules.


---

## 11. Phase 1 implementation record — 2026-11-22

The first identity and consent foundation has now been applied to the active Supabase project and implemented in the farmer UI.

### Applied remote migrations

| Version | Migration |
|---|---|
| `20261122160504` | `sarina_farmer_identity_authority_scope_foundation` |
| `20261122160526` | `sarina_farmer_consent_scope_and_revocation_guard` |
| `20261122160624` | `sarina_farmer_consent_scope_and_revocation_guard_v2` |
| `20261122160654` | `sarina_farmer_identifier_role_guard` |
| `20261122160807` | `sarina_farmer_consent_actor_index` |
| `20261122160954` | `sarina_jihad_authority_capability_catalog` |
| `20261122161100` | `sarina_guard_farm_administrative_region_assignment` |
| `20261122161154` | `sarina_admin_region_scope_fk_index` |
| `20261122161306` | `sarina_admin_region_hierarchy_integrity_guard` |

### Delivered in this phase

- `farmer_public_identifiers`: opaque, random SARINA farmer code, one active code per farmer, retained retired-code history, and no client-side insert/update/delete.
- `ensure_my_sarina_farmer_identifier()`: authenticated, active farmer-role-only issuance; the code is not an authentication factor or official government identifier.
- `farmer_authority_consents`: organization-specific purpose-limited scopes, expiration, farmer-readable history, and a server-side revocation RPC. Direct client updates are revoked so the consent history cannot be rewritten.
- `agricultural_admin_regions`: a separate official-geography hierarchy with parent-level, country, namespace and cycle validation. It is deliberately separate from `deployment_regions`.
- `farms.admin_region_id` and `organization_access_scopes.target_admin_region_id`: links for later verified region assignment and regional access. A database trigger prevents ordinary authenticated users from assigning or changing a farm's administrative region; only an authorized SARINA administrator or trusted service context can do so.
- `organization_has_scoped_access`: region-descendant and assigned-farm scope support, with membership/capability checks and an empty function search path.
- `organization_capabilities` now accepts the first Jihad identity, support, directive, recognition and reporting capability codes; the catalog is constrained rather than arbitrary free text.
- `lookup_farmer_by_public_code(...)`: organization-scoped lookup that requires the `farmer.identity.read` capability and an active farmer consent containing `identity_summary`. Farm count and region names are returned only when `farm_summary` is also consented and the organization has `oversight.farm.read` in scope.
- `FarmerIdentityCard`: farmer-facing code display/copy and a granular consent center, mounted in the farmer's Jihad-services page.

### Verification performed

- The active farmer's identifier issuance RPC succeeded inside a transaction; the transaction was rolled back.
- An expert-role negative test confirmed the farmer identifier RPC rejects non-farmer roles.
- A temporary country → national → province → county → district → service-center hierarchy passed validation; invalid parent-level and cycle attempts were rejected. All test rows were rolled back.
- An end-to-end transactional acceptance test created temporary farmer/authority users, two sibling counties and two farms; it proved the assigned county was visible, the sibling county was denied, identity-only consent did not expose farm data, farm-summary consent exposed only the scoped farm, and revocation immediately blocked lookup. The entire transaction was rolled back.
- A separate role-switched test confirmed a farmer cannot set `farms.admin_region_id` during insert or update. Both attempts were rejected and the transaction was rolled back.
- Privilege checks confirmed anon cannot execute the identifier or lookup RPCs; authenticated users cannot directly insert identifiers or directly rewrite consent rows.
- After rollback, the live database still has zero farmer identifiers, zero consent rows, zero farms, zero organizations and zero seeded administrative regions. No synthetic user, consent, organization or geography data was retained.
- The performance advisor's new unindexed consent-actor and administrative-region-scope foreign keys were addressed with dedicated indexes. Remaining unused indexes are expected while these tables have no operational rows.
- The health advisor returned no findings.

### Pilot prerequisites still open

- No verified Jihad organization, organization membership or organization capability records currently exist in the live project. Therefore, a positive organization lookup and region-isolation test cannot yet be performed against real organization fixtures.
- The official province/county/service-center source and its versioned codes must be supplied/approved before importing any administrative geography. No sample geography was seeded.
- Farm administrative-region assignment and organization regional scopes still need an authorized administration workflow.
- The Jihad regional dashboard remains a clearly labeled design preview. It has not yet been replaced with live organization data.
- Support ledger, directive publishing/acknowledgment, productivity impact reporting and farmer recognition are subsequent implementation phases.
- Vercel Preview/Production deployment is not claimed; the account's build-rate quota remains an independent deployment constraint.

