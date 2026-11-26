# SARINA Unified Communication Center — Approved Visual Direction

Status: approved concept reference (2026-11-26)

The user explicitly approved the generated SARINA chat concept as the intended visual direction for the unified communication center.

## Required visual composition
- A polished, spacious chat window with a distinctive SARINA frame.
- White and natural green palette, rounded corners, fine green outline, soft layered shadow.
- Branded header with SARINA identity and clear conversation identity/actions.
- RTL-first Persian layout, with conversation navigation on the right side of the chat experience.
- Main message area with familiar messenger bubbles and a roomy composer for supported message types.
- A compact floating SARINA launcher centered horizontally at the very bottom of the page.
- The launcher is visible to all user roles; activating it opens the larger communication window.
- Remove the existing farmer chat box from the middle of the page; it must not remain as a duplicate interface.
- Responsive behavior: large usable surface on mobile and tablet/desktop, respecting safe areas and available viewport height.

## Functional and safety constraints
- This is the approved visual target, not authorization to deploy to production.
- Do not fabricate contacts, messages, unread counts, delivery/read states, or conversation categories.
- Use canonical existing consultation/message sources and enforce server-side authorization.
- Preserve existing voice controls and the current guide/help capability where appropriate; do not let them compete with the unified inbox.
- Keep human consultations distinct from AI assistant history.
- Do not create a parallel generic message store or weaken RLS.
- Keep translation integration pending until the existing translator service is located and verified; preserve original messages.
- Build on the existing SARINA companion and communication architecture; do not create a parallel command center.
- Implement on the approved feature branch, validate responsive/mobile behavior, and submit for review. Do not merge or deploy without explicit approval.

## Acceptance criteria
1. Launcher is centered at the bottom on mobile and desktop.
2. The launcher is initially compact; the large panel opens only after activation.
3. The panel is substantially larger than the current 365px-wide companion panel.
4. The approved frame, branding, message composition and RTL layout are recognizable.
5. The previous farmer chat presentation in the middle of the page is removed without leaving duplicate chat surfaces.
6. No fake data or unsupported messaging capabilities are presented.
