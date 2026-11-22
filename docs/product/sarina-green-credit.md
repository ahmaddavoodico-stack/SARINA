# SARINA Green Credit — Product and UI Specification

Status: approved visual direction; UI preview implementation only. No live balance, ledger, purchase reward, or AI usage metering is connected yet.

## Product purpose
Show farmers the value and remaining amount of their monthly free AI conversation allowance in a calm, attractive, agriculture-native way. Encourage thoughtful use without shaming farmers or turning essential guidance into a purchase-gated service.

## UI principles
- Persian-first, responsive card in the farmer home dashboard.
- Natural greens, warm soil/cream surfaces, seedling/leaf imagery and clear readable numbers.
- Show base free allowance, consumed amount, remaining amount, renewal timing, and optional bonus credit separately.
- Label illustrative balances as a preview until a secure live ledger is connected.
- A product call-to-action may open the marketplace, but must not imply that buying is required to retain base access.
- Bonus amounts and eligibility must be shown before purchase; never promise a reward that has not been recorded.
- Consumption should eventually be metered by actual model usage/cost (including input/output tokens and any tool charges), not raw message count.
- Keep AI conversation credits separate from human expert consultation fees.

## Economic and fairness rules
1. Every farmer receives a free base allowance without purchase conditions.
2. SARINA-branded products may grant clearly disclosed bonus credits under published rules.
3. The free base allowance must not be withheld or reduced because a farmer does not buy products.
4. Product recommendations remain agronomically independent; credit rewards must not distort advice.
5. When the base allowance is low or exhausted, explain the status respectfully and offer efficient-use tips; do not pressure the farmer to purchase.
6. Any future limits, reset policy, expiry, rollover, refunds/reversals and anti-abuse rules must be defined before production activation.

## Current implementation boundary
The React card uses sample values (1,000 base units, 280 used, 720 remaining, 12 days to renewal, 48 conversations, and an illustrative +200-unit reward) strictly as visual placeholders. Do not represent these as actual user balances. Live data requires a separately reviewed database ledger, authenticated server-side accounting, idempotent reward events, ownership/RLS policies, and verified model-usage metering. No database migration or payment integration is included in this UI-only change.
