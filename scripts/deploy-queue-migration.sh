#!/usr/bin/env bash
#
# Applies supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql
# to the self-hosted production database on fablabserver.
#
# Run it from a shell that already has working SSH access to the server:
#
#   ./scripts/deploy-queue-migration.sh --dry-run   # applies, diffs, rolls back
#   ./scripts/deploy-queue-migration.sh             # applies for real
#
# The dry run executes the entire migration inside a transaction that ends in
# ROLLBACK, so it proves the migration applies against the real schema without
# leaving anything behind. Run it first; only run the real apply if it passes.
#
# The migration itself is transactional and refuses to commit unless the
# post-migration privilege checks pass, so a partial apply is not possible.

set -euo pipefail

SSH_TARGET="${SSH_TARGET:-fablab@ssh.otamaps.fi}"
SSH_OPTS=(-o "ProxyCommand=cloudflared access ssh --hostname %h")
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

MIGRATION="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations/20260817002500_queue_config_and_trust_weighting.sql"
DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

if [[ ! -f "$MIGRATION" ]]; then
  echo "migration not found: $MIGRATION" >&2
  exit 1
fi

payload=$(cat "$MIGRATION")

if [[ $DRY_RUN -eq 1 ]]; then
  # Strip the trailing NOTIFY (it must not run in a rolled-back transaction)
  # and swap the final COMMIT for a ROLLBACK.
  payload="${payload%%notify pgrst*}"
  payload="${payload/$'\ncommit;'/$'\n'}"
  payload=$(printf '%s\n%s\n' "$payload" "rollback;")
  echo ">>> DRY RUN: applying inside a transaction that will be rolled back"
else
  echo ">>> APPLYING FOR REAL"
fi

printf '%s' "$payload" | ssh "${SSH_OPTS[@]}" "$SSH_TARGET" \
  "docker exec -i '$DB_CONTAINER' psql -v ON_ERROR_STOP=1 -U '$DB_USER' -d '$DB_NAME' -f -"

if [[ $DRY_RUN -eq 1 ]]; then
  echo ">>> Dry run finished. Nothing was committed."
  exit 0
fi

echo ">>> Verifying the deployed contract"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" \
  "docker exec -i '$DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -c \"
     select schema_version, report_opens_at, report_closes_at, slot_minutes,
            report_weekdays, min_community_reports
     from public.get_queue_statuses();
     select proname, pg_get_function_identity_arguments(oid) as args
     from pg_proc where proname in
       ('get_queue_statuses','get_admin_queue_activity','record_canteen_queue_report')
     order by proname, args;\""

echo ">>> Done. get_queue_statuses() returns no rows when run as a role without a"
echo ">>> JWT, which is expected; the signature listing above is the real check."
