#!/usr/bin/env bash
# Safe production update: backup → pull the tagged release → rebuild → migrate → health check.
# Usage: ./scripts/update.sh v0.2.0      (or "main" to deploy the latest main)
set -euo pipefail
cd "$(dirname "$0")/.."
REF="${1:?usage: update.sh <tag-or-branch>}"
PREV="$(git rev-parse HEAD)"

./scripts/backup.sh
git fetch --tags origin
git checkout "$REF" && { [ "$REF" = "main" ] && git pull --ff-only origin main || true; }
docker compose up -d --build app   # migrations run automatically on start

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null; then echo "✅ Updated to $REF"; exit 0; fi; sleep 3
done
echo "❌ Health check failed — rolling back code to $PREV"
git checkout "$PREV" && docker compose up -d --build app
echo "If the failed version ran a DB migration, restore the backup made a moment ago (see docs/BACKUP.md)."
exit 1
