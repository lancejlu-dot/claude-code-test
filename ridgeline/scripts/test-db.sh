#!/usr/bin/env bash
# Applies all migrations to a throwaway database and runs the SQL rule tests.
# Usage: DATABASE_ADMIN_URL=postgres://postgres@localhost:5432/postgres npm run test:db
set -euo pipefail
ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql:///postgres}"
DB="ridgeline_test_$$"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
trap 'psql "$ADMIN_URL" -qc "drop database if exists $DB with (force)" >/dev/null' EXIT
URL="${ADMIN_URL%/*}/$DB"
run() { psql "$URL" -v ON_ERROR_STOP=1 -q -f "$1" >/dev/null; }
run "$ROOT/supabase/tests/00_auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrate: $(basename "$f")"; run "$f"; done
echo "seed: seed.sql"; run "$ROOT/supabase/seed.sql"
status=0
for f in "$ROOT"/supabase/tests/[1-9]*.sql; do
  if out=$(psql "$URL" -v ON_ERROR_STOP=1 -q -f "$f" 2>&1); then
    echo "PASS $(basename "$f")"; echo "$out" | grep -E "^ok|NOTICE" | sed 's/^psql:[^ ]* NOTICE:  /  /' || true
  else
    echo "FAIL $(basename "$f")"; echo "$out" | tail -15; status=1
  fi
done
exit $status
