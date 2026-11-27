# SARINA Release Branch Safety

**Verified:** 2026-11-27

## Vercel branch mapping

The connected Vercel project treats GitHub branch `main` as its Production target. A merge into main automatically created a deployment with target `production` and assigned the custom alias `sarina-two.vercel.app`.

Therefore, main is not a safe integration-only branch for unapproved experiments in this repository, even though the application is not yet considered operational by the product team. Vercel's target metadata and alias assignment are the source of truth.

## Current state after the 2026-11-27 merge

- The farm-map and FAQ work was merged into GitHub main.
- Vercel built a Production deployment from merge commit `5a1d80715309856f9bb0d9a0caba804262f1d5a2`.
- Production traffic was rolled back to the prior ready deployment `dpl_7VDsdYwaC6QRF3X4jgh5SGuah9gt`.
- The new deployment remains in Vercel history but is no longer assigned to the custom production alias.
- No Supabase Edge Function deployment was performed.
- The connected Supabase schema migrations were applied; the new map tables remain empty and FAQ contains only its 16 stable topic rows.

## Rules for subsequent work

1. Do not merge another PR into main until the user explicitly approves a Production release.
2. Continue code work on non-main feature branches and leave PRs open/draft for review.
3. Use Vercel Preview deployments for review when the build quota permits; a preview URL is not evidence of Production release.
4. Do not deploy Supabase Edge Functions merely because their source is merged to GitHub.
5. Do not turn on `SCI_FAQ_SIGNALS_ENABLED` or automatic FAQ answers without a separate review of privacy, answer quality and routing thresholds.
6. Before a release, verify the target branch, Vercel project production branch, alias mapping, Supabase migration state and Edge Function versions.

## Operational note

A rollback changes Production traffic but does not undo a Git merge or remove the deployment record. Keep the Git source, Supabase migration history and Vercel alias state as separate verification items.
