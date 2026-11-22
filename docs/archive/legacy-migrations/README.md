# Archived legacy communication migrations

These SQL files were recovered from the historical `feature/sarina-communication-gateway` branch and are preserved for reference only.

**Do not execute these files as Supabase migrations.** They target the earlier `expert_consultation_messages`, `expert_consultations`, and related schema. SARINA Connect now has a separately approved lightweight core and channel-adapter architecture. Any reuse of voice notes, realtime messages, or audio sessions must be ported and reviewed against the current schema and security model first.

The files are retained to avoid losing potentially useful behavior and policy work while preventing them from being mistaken for active migrations.
