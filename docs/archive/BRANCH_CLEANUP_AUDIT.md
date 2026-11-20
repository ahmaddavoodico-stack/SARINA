# Legacy branch cleanup audit

Date: 2026-11-21

## Scope and current state

- Repository: `ahmaddavoodico-stack/SARINA`
- Target working branch: `develop`
- Intended steady state: `main` and `develop` only.
- Branches observed at audit start: 61 total (59 side branches plus main/develop).
- Open pull requests observed: 0.
- Recursive Git tree inspection was completed for all 59 side-branch HEADs; all returned trees reported `truncated: false`.
- This is a **tree-level inventory**, not yet a full semantic/code review of every differing blob. Do not interpret it as proof that all feature behavior has been merged.

## Findings requiring preservation or review

1. Several legacy branches contain an older standalone application under `app/` or `public/app/`, plus an older migration sequence (`database/migrations/005-028`, and communication/voice migrations `032-036`). These are not the same paths as the current app and must not be discarded without a deliberate product/architecture decision. Relevant branch refs include:
   - `feature/phone-otp-auth`
   - `feature/sarina-communication-gateway`
   - `feature/sarina-pwa-app-icons`
   - `integration/marketplace-and-communications-workspace`
   - `test/sarina-multi-role-integration`

2. `feature/sarina-jobs-mvp` contains a standalone jobs migration. Its exact SQL was copied into `docs/archive/deferred-migrations/legacy_sarina_jobs_mvp_005.sql`; it remains deferred and must not be run as an active migration until schema dependencies, RLS, grants, and migration ordering are reviewed.

3. `feature/sarina-installable-education-release` contains an alternate education access-policy migration. Its exact SQL was copied into `docs/archive/deferred-migrations/legacy_education_access_policies_20261120020000.sql`; it remains deferred pending comparison with the active education migration and policy review.

4. Organization-review, role-check, specialist-pricing, and productivity-oversight migration blobs discovered on some branches match blobs already present in the current develop tree under different migration filenames. Do not add duplicate copies to the active migration directory.

5. `fix/main-pwa-icons-install` contains unique PWA image assets (`public/sarina-icon-192.webp`, `public/sarina-icon-512.webp`) and `wrangler.jsonc`. Preserve these for review; do not assume they replace the approved SARINA brand icon without visual verification.

6. Multiple branches differ in shared application files (including `src/App.tsx`, dashboards, workspace components, styles, package manifests, and SARINA Central Intelligence functions). A path/blob comparison alone cannot establish that these changes are obsolete or already represented. Semantic diff and tests are still required before deletion.

## Safe handling rules

- Keep SQL discovered only in legacy branches under `docs/archive/deferred-migrations/` until dependency/order/security review is complete.
- Keep old app snapshots and unique PWA assets available until product owners decide whether to migrate or retire them.
- Do not delete `main` or `develop`.
- Do not claim branch cleanup is complete until side branches are removed and GitHub reports exactly two branches.
- No production deployment is implied by this audit.

## Side-branch refs at audit time

- `chore/github-actions-build-validation` — `6e97fb5231828afa858f5af780f9ed2d40bb76f5`
- `chore/report-npm-audit-findings` — `aeaedd92b131d49da9b5ae51a0a2cda7250e4ea8`
- `feat/admin-user-management` — `83be18925b98206dc479f84aab5e4561950acb3b`
- `feat/ai-cost-credit-controls-foundation` — `a5a8c3f5801de19ad2e778ec05510919b1b258a7`
- `feat/expert-dashboard-mvp` — `1cd5242c3f0cb8a6d0f7ae984797c9b83a498d97`
- `feat/expert-workspace-main-integration` — `9e5ff53bb2d2ed071872d5d1059f28d0792ce383`
- `feat/pwa-first-version` — `592de4e1478becfeeb8459c9d73155fe8d3a5691`
- `feat/role-selection-onboarding` — `7a950d957ba639901299377781cef25ba0ef09e1`
- `feat/sarina-pwa-installable` — `5c1ab83022836983d393f75bea8a54e87d4dff7c`
- `feature/automatic-pwa-updates` — `7eef6ef0b604f7ddaca6073fd8dbcd3ec4b502e1`
- `feature/expert-case-assistant-availability` — `670bc18e5c66ead56cd4dbb088abd42a8e6e0aa4`
- `feature/expert-workflow-security` — `1dea14a68db4955c67fd5cb933f6fd189a037eff`
- `feature/farm-productivity-intelligence-foundation` — `b74698c3c0235958dbff32a83bdb254f262428c6`
- `feature/farm-productivity-system` — `9008c7716f384d60263cdf22292abc1b1d12fa19`
- `feature/farmer-portal-foundation` — `d993f6d0f8a13466269ba20ada2e2a6d8f86b0fd`
- `feature/farmer-specialist-completion-phase` — `919f380c5f3b43d90f7dc9da82abd65916088957`
- `feature/global-auth-language` — `92bfd47a9a772c5d92febd3328bf5ef363fb0000`
- `feature/infrastructure-bridge-governance` — `93a5fc2b3eeadb5b17adca81a77fc3b4f15653a0`
- `feature/organization-onboarding` — `eed7932b7d709a93e5c7f87a131d105db33232bb`
- `feature/phone-otp-auth` — `78a447154a1a0da0a86ab92b9ebf5c55db807f28`
- `feature/productivity-contextual-analysis` — `bd4c1f13c769540ac31728b118269973fe3066c7`
- `feature/productivity-evaluation-engine` — `81a040e9cf8363a69183b5ee6c6874fd38e626a6`
- `feature/productivity-impact-and-authority-oversight` — `d327be98e1d9dfd9650737bff002d25d2eaead59`
- `feature/regional-autonomy-data-governance` — `57d798af5308da6b3484f0e6b2566a8205577678`
- `feature/sarina-communication-gateway` — `d0ad2bf4cee5e2104195d1588e0da455b2521b63`
- `feature/sarina-connect-lightweight-core` — `5958d72ecedc8b259d4cf5db90458ce16a2937eb`
- `feature/sarina-connect-otp-foundation` — `bcc28f7e3646d428ce0cf4ac631c861ef920de45`
- `feature/sarina-install-entrypoint` — `1178643396e400623237e1a45f15d79e744b5e51`
- `feature/sarina-installable-education-release` — `ba660894391d67d7a88dc4e4a1915065442d4d34`
- `feature/sarina-jobs-mvp` — `0a54d1267e72865875c7266db225fad167221a8d`
- `feature/sarina-pwa-app-icons` — `188fca5b7c8cdf5fb045c03ce61c899379b70143`
- `feature/specialist-assistant-workspace` — `cfba51639a5328f5480e5223a25412bbf308b000`
- `feature/specialist-case-assistant-intelligence` — `5a6261b05380b5b5a1e5dd183caace90f3465317`
- `feature/specialist-credit-admin-and-dashboard` — `8c58fa6f2984b6c441f6d7921503b4be8496e3a7`
- `feature/specialist-productivity-dashboard` — `ad44d5f6a9e2fee1a6641ec4325ddc833e397f6a`
- `feature/specialist-workspace-economy` — `3d45f2fac845a997e778d396b08efdd5480e1c58`
- `fix/auth-profile-auto-provisioning` — `b554fe6b5484071df74d0e81d163c88a1499a837`
- `fix/ci-lockfile-workflows` — `77893cae7d08f5c4f7302a6c3a50e334eadb3b49`
- `fix/main-pwa-icons-install` — `2b53caf5aa62d264c1e8612338b1ecaca5203c49`
- `fix/productivity-migration-version` — `ca8838c9de7ecaf9d6f6a93aa8edd378ace20bdc`
- `fix/pwa-android-install-criteria` — `24ced556a89329b5116702a54b3ee8a04eb816b7`
- `fix/pwa-install-default-branch` — `b4d9d163285585549cf65e4e7bb61db5ffd307db`
- `fix/role-selection-onboarding` — `074855dde40d4f01fd33a2e0e03815de8906ce92`
- `fix/specialist-economy-typescript-newline` — `21848fa3eb969521454f3d886448132d4d8bd847`
- `fix/vite-security-update` — `82746d405c3b0e3d364a9152e2fb5e4f1f00dc5e`
- `fix/vite-security-update-v2` — `0077fa51738196c5b733901561eb25b79e1053a4`
- `integration/admin-role-management` — `e9c037f2b752918dad604ba6691a21c2a5dd55ef`
- `integration/admin-role-management-v2` — `e5147e332bb0086a2a0aba1af54d71b4705e86d8`
- `integration/admin-role-management-v3` — `49b483140f3f9833e9d1887b336c05a8535c3139`
- `integration/admin-role-management-v4` — `fe84ed2a45721a8cf57f5ad9bf644056786214cf`
- `integration/marketplace-and-communications-workspace` — `1a2bcd1a394a95c75ae751ad409ba1e5ccdafcdc`
- `integration/organization-onboarding-role-selection` — `4daaf57bbd670288d8a98af1b817d8a428d077bc`
- `integration/phone-otp-authentication` — `d6ffe1f7bd7daa46abcb7beffbb86062adf6eb76`
- `integration/specialist-productivity-workspace` — `4405c20cd70d116b262c8f61aac7605dc06f37fa`
- `integration/specialist-productivity-workspace-v2` — `250baf502410bb0f1be82e1192d3599da737b4fe`
- `integration/specialist-productivity-workspace-v3` — `1994bf26df49cefbb0ce75fcfe3df37183264ac1`
- `test/sarina-multi-role-integration` — `f20d41f6f5196c3b327ee6e78e5b0ce01dc0fe5e`
- `test/vercel-deploy-check-20261117` — `49e884ac62b0d14b56535b0bb095308407469b00`
- `test/vercel-quota-check-20261120` — `352c4ef88a5e34f5b56ab95c1bf27f561a4f9f0b`

## Completion status

- [x] Enumerate all branches.
- [x] Inspect recursive file trees for all side branches.
- [x] Confirm zero open PRs at audit time.
- [x] Archive the legacy jobs SQL outside the active migration directory.
- [x] Archive the alternate legacy education-policy SQL outside the active migration directory.
- [ ] Complete semantic review of every differing file/blob.
- [ ] Preserve any remaining approved unique artifacts in develop/archive.
- [ ] Run relevant build, test, and migration checks.
- [ ] Delete side branches only after preservation and verification.
- [ ] Verify that only main and develop remain.

**Important:** the available GitHub connection exposes branch creation/ref updates and GET-only fetch, but no branch-delete operation. Therefore this workflow cannot yet remove the 59 side branches through the currently available GitHub actions. Do not substitute closing PRs or renaming branches and call that deletion.
