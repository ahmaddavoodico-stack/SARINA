# SARINA Professional Achievement & Recognition
## Product requirement and phased delivery

**Status:** Product requirement approved; database foundation v1 added. This document describes intended product capabilities, not a claim that every workflow or partner integration is already live.

## Purpose
Turn expert participation into a durable professional value proposition: experts can build a verified record of work, demonstrate measurable outcomes, receive fair recognition for exceptional contribution, and use a portable portfolio to attract future collaboration.

This capability is a strategic recruitment and retention engine for the SARINA expert network—not merely a star-rating feature.

## Product areas
1. **Expert Portfolio** — profile, verified credentials, specialties, completed consultations, evidence-backed case studies, innovations, achievements, downloadable/shareable CV.
2. **Impact Assessment** — compare baseline and follow-up outcomes; assess technical, economic, innovation, social and sustainability dimensions; record confidence in attributing outcomes to expert contribution; disclose confounding factors.
3. **Awards & Credentials** — SARINA recognition, independent-panel recognition, and partner-issued credentials with unique IDs and public verification.
4. **Opportunity & Collaboration Graph** — route relevant cases, research collaborations, field pilots, mentoring, training and institutional opportunities to experts based on verified capabilities and demonstrated impact.

## Evidence and fairness principles
- Never rank experts solely by case count, response speed or a single satisfaction score.
- Capture the initial condition, recommended intervention, execution context, follow-up result, timeframe and evidence provenance.
- Where feasible, compare before/after values and include weather, soil/water, input quality, farm size, season and other confounders.
- Separate observed outcome from causal attribution. Show attribution confidence: insufficient, low, moderate or high.
- Include farmer feedback as one signal, not the sole verdict.
- Keep raw farm data private. Public portfolio items require explicit beneficiary consent and minimization/redaction of identifying details.
- Distinguish expert's own contribution from team, farmer, AI and external factors.
- AI may help summarize evidence and flag candidate achievements; exceptional awards require human review and an auditable decision.
- Do not imply guaranteed yield gains, income gains or a guaranteed award.

## Recognition ladder
- **Professional Appreciation** — consistent, responsible and high-quality contribution.
- **Impact Recognition** — documented, meaningful improvement with credible evidence.
- **Innovation Recognition** — original or adapted method with evidence of usefulness and transferability.
- **Special Honor** — rare, high-impact contribution with independent human review.

Each issued credential should include a unique award code, award level, concise citation, issue date, issuer identity, evidence basis and verification route. Revocation/correction must be possible and auditable.

### Issuer integrity
- SARINA may issue its own recognition.
- An independent panel may be named only after it actually exists and has reviewed the case.
- A partner organization may be named as issuer/endorser only after written authorization and actual participation. Logos, signatures or endorsement language from FAO, agricultural authorities, NGOs or other bodies must never be fabricated or implied.
- A partner-issued award requires an authorization reference in the system.

## Data foundation delivered in migration 013
- expert_impact_records: expert-owned draft records for case outcomes and innovations, including baseline/outcome metrics, context, contribution, evidence references and beneficiary-consent timestamp.
- expert_impact_assessments: internal scoring and attribution review; not accessible to client roles.
- expert_recognition_awards: system-controlled awards with issuer type, authorization reference, status and unique verification token.
- Owners can read their own impact records and awards; authenticated clients can create/update only draft impact records. Assessment and award issuance are not self-service.

The migration intentionally does not expose assessment scores or award issuance to client-side writes. Submission workflow, evaluator permissions, storage evidence upload, public verification endpoint and PDF generation remain subsequent implementation work.

## Recruitment catalogue: promise and truth labels
Every catalogue capability must be tagged:
- **Available now** — demonstrably working in the current release.
- **In development** — implementation has started; not yet generally usable.
- **Planned vision** — strategic direction; no delivery promise or date implied.

Lead with outcomes and opportunities, not a feature inventory. Candidate recruitment themes:
1. Build a professional identity and portable evidence-based CV.
2. Make field impact visible and fairly recognized.
3. Find relevant paid and unpaid collaboration opportunities (only describe compensation when a real model exists).
4. Contribute innovations and retain attribution/credit for original work.
5. Access a cross-disciplinary network and real agricultural cases.
6. Help shape an international agricultural intelligence network.

## Measuring what attracts experts
Create a recruitment experiment log for each catalogue version and outreach cohort. Track audience segment and geography; source/channel and catalogue version; delivered/opened/viewed and landing-page visits where measurable and consented; registrations and applications started/completed; verified profiles; first meaningful action; 30/90-day activation and retention; and qualitative reasons for interest, hesitation and refusal.

Use unique campaign/section codes or tagged links to attribute interest to a specific proposition. Ask a short optional question at signup: “What made you interested in SARINA?” with selectable reasons and an open-text option. Compare conversion by segment and message, not just raw clicks. Protect privacy and comply with applicable consent requirements.

Practical prioritization score: (Reach × Conversion lift × Strategic value × Confidence) / Delivery effort. Keep inputs visible; treat early sample sizes as directional, not statistically conclusive. Re-test winning themes with different expert segments.

## Delivery sequence
### Phase 1 — foundation
- Database entities and ownership controls (migration 013).
- Define evidence and assessment vocabulary.
- Keep expert verification separate from self-selected expert role.
### Phase 2 — expert-facing MVP
- Portfolio dashboard and editable professional profile.
- Case/innovation draft submission.
- Attach evidence with consent and privacy controls.
- Human evaluator workflow and reasoned feedback.
- Downloadable CV with explicit verification labels.
### Phase 3 — recognition
- Panel review and conflict-of-interest declarations.
- Award issue/revoke lifecycle, unique credential page and QR verification.
- Partner authorization registry and approved issuer workflow.
### Phase 4 — recruitment and growth
- Multilingual catalogue and segment-specific landing pages.
- Campaign attribution and funnel analytics.
- Collaboration/opportunity matching and transparent opportunity terms.

## Success metrics
- qualified expert applicants per outreach cohort;
- verified profile completion;
- time from registration to first meaningful contribution;
- proportion of cases with follow-up evidence;
- share of experts with at least one evidence-backed portfolio item;
- expert 30/90-day retention;
- farmer-reported usefulness and independently reviewed impact;
- catalogue conversion by proposition and expert segment.

## Non-goals for the first release
- Automatic public ranking of experts.
- AI-only award decisions.
- Unverified third-party endorsements.
- Guaranteed income, guaranteed customer volume or guaranteed awards.
- Publishing farmer/farm data without explicit consent.

## Access-control hardening follow-up (migration 014)
A follow-up migration explicitly revokes inherited/default table privileges from PUBLIC and anon, then grants only the intended authenticated access: owner-scoped draft evidence reads/inserts/updates (excluding delete) and owner-scoped award reads. Internal assessments remain inaccessible to client roles. RLS policies continue to enforce row ownership.
