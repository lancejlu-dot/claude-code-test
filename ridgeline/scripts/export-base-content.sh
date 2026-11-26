#!/usr/bin/env bash
# Regenerates src/lib/demo/base-content.json (used by demo mode) from the base-content migration.
set -euo pipefail
ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql:///postgres}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; DB="ridgeline_content_$$"
psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -qc "drop database if exists $DB with (force)" >/dev/null' EXIT
URL="${ADMIN_URL%/*}/$DB"
psql "$URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/00_auth_stub.sql" >/dev/null
for f in "$ROOT"/supabase/migrations/*.sql; do psql "$URL" -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1; done
psql "$URL" -At -c "select jsonb_pretty(jsonb_build_object(
 'categories', (select jsonb_agg(to_jsonb(c) order by sort_order) from (select id, slug, name, description, icon, hidden_fields, tracks_distance, active, sort_order from activity_categories) c),
 'regions', (select jsonb_agg(to_jsonb(r) order by kind, sort_order) from (select id, parent_id, kind, name, slug, active, sort_order from regions) r),
 'faqs', (select jsonb_agg(to_jsonb(f) order by sort_order) from (select id, category, question, answer, sort_order, published, show_on_home from faqs) f),
 'policies', (select jsonb_agg(to_jsonb(p) order by sort_order) from (select slug, title, summary, body, legal_reviewed, published, sort_order, updated_at from policy_pages) p),
 'settings', (select jsonb_object_agg(key, value) from site_settings where key in ('brand','homepage'))))" > "$ROOT/src/lib/demo/base-content.json"
echo "Wrote src/lib/demo/base-content.json"
