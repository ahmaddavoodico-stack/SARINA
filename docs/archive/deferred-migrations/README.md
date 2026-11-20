# Deferred education access-policy migration

Source: `fix/pwa-android-install-criteria`.

This is a later, idempotent form of the education public-read and owner-activity policy migration. It is preserved here rather than placed in `supabase/migrations` because the current active migration sequence contains an earlier policy migration timestamped before the education schema migration. Before activating this candidate, inspect the target Supabase migration history and schema, then reconcile the ordering and policy state. Do not apply blindly.
