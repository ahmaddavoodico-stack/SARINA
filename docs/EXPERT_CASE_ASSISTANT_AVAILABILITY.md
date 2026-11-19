# Expert case assistant and availability

## Case assistant
- A database trigger creates an assistant intake record whenever a farmer creates an expert request.
- The farmer immediately receives an in-app receipt notification; the assigned expert receives a new-case notification.
- The assistant tracks intake, initial review, missing information, waiting for expert opinion and expert-reviewed states.
- The expert can record a structured summary and missing-information checklist. This release does not claim autonomous agronomic diagnosis or AI-generated conclusions; the expert remains responsible for all technical advice.
- A status change notifies the farmer through the existing recipient-scoped case notification channel. When information is missing, the notification includes the exact missing-information checklist so the farmer can respond in the existing case conversation.
- An hourly `pg_cron` job checks stale cases. It sends the assigned expert a reminder no more than once per 24 hours, up to three reminders; if the case remains unattended, it escalates to global SARINA administrators. The scheduler and notification function run server-side.

## Availability and leave
- Experts can set available/busy/away, pause new referrals, set vacation windows, capacity and a suggested verified substitute.
- A scheduled vacation automatically stops blocking referrals after its end time, unless the expert has separately enabled the manual pause flag. Referral capacity is enforced in the database and serialized per expert to prevent concurrent over-assignment.
- Suggested substitutes must be verified and cannot be the current expert.
- Availability does not silently reassign open cases.

## Consent-based handover
1. The current assigned verified expert requests a handover to another verified expert.
2. The farmer receives a consent request and can accept or decline.
3. On consent, the substitute receives an offered assignment.
4. Only after the substitute accepts does a database trigger revoke the previous assignment and update the request owner.
5. If the farmer or substitute declines, the current assignment remains active.
- Handover state and notifications are persisted for audit.
- Farmer consent is checked in the database RPC; clients cannot directly update handover status.

## Security boundaries
- RLS restricts availability writes to the profile owner.
- Assistant case data is visible only to the farmer and assigned verified expert; updates are restricted to the current assigned expert.
- Handover reads are restricted to the farmer and the two involved experts. Creation is restricted to the currently assigned verified expert. Consent is handled by a function that validates the authenticated SARINA user.
- No service-role key is used in the browser.
- Automated receipt is an in-app notification, not an outbound SMS/email or a chat message. No outbound messaging provider is configured by this change.
