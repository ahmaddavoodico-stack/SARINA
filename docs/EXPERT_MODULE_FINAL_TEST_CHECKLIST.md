# SARINA — Expert Module Final Test & Release Checklist

> Purpose: resume the expert-module work from the current checkpoint without relying on chat history.
> Branch: `feature/expert-case-assistant-availability`
> PR: #37 — Add expert case assistant, availability and consent-based handover
> Rule: **Do not merge into `main` until the required tests pass and the Vercel build/deployment can be verified.**
> Status at creation: planned / not yet verified. Mark items complete only after evidence is checked.

## 1. Final code review — expert case assistant
- [ ] Review the expert case assistant workflow and its case-state transitions.
- [ ] Check incomplete-information checklist, follow-up behavior, reminders and escalation for unanswered cases.
- [ ] Check error handling, duplicate submissions, idempotency and edge cases.
- [ ] Confirm the UI communicates case status and next actions clearly.

## 2. Final code review — expert availability and calendar
- [ ] Review availability, leave/vacation and calendar behavior.
- [ ] Verify capacity limits and prevention of bookings/assignments during unavailable periods.
- [ ] Check timezone/date boundaries and overlapping availability entries.
- [ ] Verify alternative-expert suggestions do not silently reassign a case.

## 3. Database migration consistency
- [ ] Compare migration files in the feature branch with the migration history recorded in Supabase.
- [ ] Identify any migration-history drift, duplicate versions or migrations that could be applied twice.
- [ ] Confirm dependencies and execution order between expert-module migrations.
- [ ] Do not edit migration history or run corrective production SQL until the exact discrepancy and safe remediation are established.

## 4. Vercel build and deployment gate
- [ ] Check whether the Vercel deployment/build restriction has been lifted.
- [ ] Run the applicable production build and inspect the full logs.
- [ ] Resolve build, environment-variable, routing and deployment errors.
- [ ] Verify the deployed preview/production target before proceeding to release approval.

## 5. Security and role-permission tests
- [ ] Test farmer, expert and administrator access boundaries.
- [ ] Verify row-level security (RLS) policies for all expert-module tables.
- [ ] Review security of the handover response function, including authorization and execution privileges.
- [ ] Confirm users cannot read or modify another user's cases, availability or handover records without authorization.
- [ ] Review relevant Supabase security-advisor findings and distinguish module-related issues from unrelated project warnings.

## 6. Consent-based case handover
- [ ] Test the full handover request and response lifecycle.
- [ ] Confirm the farmer's explicit consent is required before case information is transferred.
- [ ] Confirm the replacement expert must accept before the handover is completed.
- [ ] Test rejection, expiry, cancellation, duplicate requests and failed-transfer paths.
- [ ] Verify auditability and that the original case remains safe if handover fails.

## 7. Reminders and scheduled jobs
- [ ] Verify the expert-case reminder scheduler/cron job is active and correctly configured.
- [ ] Test due reminders, retries, duplicate prevention and failure logging.
- [ ] Confirm reminders respect case status, expert availability and relevant timezones.

## 8. App download / installation and application icon review
- [ ] Inspect the current app download/install entry points and determine exactly what is offered (PWA install, APK, or another package); do not label a web install as an APK download.
- [ ] Verify every download/install link resolves to the intended current build and does not point to an obsolete or missing artifact.
- [ ] Test the install flow on a supported Android device/browser and verify the installed app launches correctly.
- [ ] Inspect the web app manifest and icon declarations, including required sizes, purpose values and maskable-icon behavior where applicable.
- [ ] Verify the installed home-screen icon uses the approved symbolic SARINA logo: preserve the people-and-leaves symbol and core brand colors; the word “SARINA” is not required on the app icon.
- [ ] Check icon appearance at launcher size, adaptive/masked crops, splash/loading surfaces and browser install prompts.
- [ ] Confirm the full logo with the SARINA wordmark remains available in brand locations such as login and introduction screens.
- [ ] Check version/build consistency, cache behavior and that an update does not leave users with a stale icon or install target.

## 9. Final verification and merge decision
- [ ] Run the relevant automated tests and record results.
- [ ] Complete manual acceptance tests for the expert workflow, permissions, handover, reminders, installation and icon.
- [ ] Review CI checks and PR #37 review threads/comments.
- [ ] Confirm all blocking findings are resolved or explicitly documented and accepted.
- [ ] Only after successful verification, obtain release approval and merge the feature into `main`.
- [ ] After merge, verify the resulting deployment and perform a short smoke test.

## Working notes
- Current checkpoint: today's planned work is the final review of the expert case assistant/availability implementation and migration consistency.
- Tomorrow's continuation: begin with the Vercel restriction/build status, then execute the tests above.
- No production database mutation and no merge to `main` is authorized merely by creating this checklist.
- Record evidence beside each completed item (test name, log, commit, migration version, or screenshot/reference).
