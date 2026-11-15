#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL in a secure shell environment; do not commit it}"
command -v supabase >/dev/null || { echo "Supabase CLI is required." >&2; exit 1; }
command -v sha256sum >/dev/null || { echo "sha256sum is required." >&2; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${1:-backup/supabase-$STAMP}"
mkdir -p "$OUT_DIR"
chmod 700 "$OUT_DIR"

echo "Exporting roles, schema and data to $OUT_DIR"
supabase db dump --remote="$SUPABASE_DB_URL" -f "$OUT_DIR/roles.sql" --role-only
supabase db dump --remote="$SUPABASE_DB_URL" -f "$OUT_DIR/schema.sql"
supabase db dump --remote="$SUPABASE_DB_URL" -f "$OUT_DIR/data.sql" --use-copy --data-only

for file in roles.sql schema.sql data.sql; do
  test -s "$OUT_DIR/$file" || { echo "Missing or empty export: $file" >&2; exit 1; }
done

(
  cd "$OUT_DIR"
  sha256sum roles.sql schema.sql data.sql > SHA256SUMS
  {
    echo "created_at_utc=$STAMP"
    echo "project_ref=wwgkiclcpgpdktneovrx"
    echo "postgres_engine=17"
    echo "export_method=supabase db dump"
    echo "auth_users_must_be_verified_after_export=true"
    echo "storage_objects_must_be_exported_separately=true"
  } > MANIFEST.txt
)

echo "Database export files and checksums created."
echo "NEXT: verify Auth coverage, export Storage object bytes and function secrets/config separately."
echo "Do not upload this directory to GitHub. Copy it encrypted to a second independent backup location."
