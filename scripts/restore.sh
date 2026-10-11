#!/usr/bin/env bash
# Restore a backup made by backup.sh.  Usage: ./scripts/restore.sh backups/vibes-ai_2026-10-11_0315.tar.gz
# ⚠️ Replaces the current database and uploaded files. The app is stopped during restore.
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="${1:?usage: restore.sh <backup.tar.gz>}"
[ -f "$FILE.sha256" ] && sha256sum -c "$FILE.sha256"
set -a; [ -f .env ] && . ./.env; set +a
read -r -p "This will REPLACE the live database and files with $FILE. Type RESTORE to continue: " ok
[ "$ok" = "RESTORE" ] || { echo "aborted"; exit 1; }

TMP="$(mktemp -d)"; tar -xzf "$FILE" -C "$TMP"; DIR="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d)"
if [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then
  docker compose stop app
  docker compose exec -T db pg_restore -U "${POSTGRES_USER:-vibes}" -d vibes_ai --clean --if-exists < "$DIR/db.dump"
  docker compose start app
  docker compose cp "$DIR/storage/." app:/data/storage
else
  pg_restore -d "$DATABASE_URL" --clean --if-exists "$DIR/db.dump"
  rsync -a --delete "$DIR/storage/" "${STORAGE_DIR:-./storage}/"
fi
rm -rf "$TMP"; echo "Restore complete."
