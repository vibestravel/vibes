#!/usr/bin/env bash
# Vibes AI backup: database dump + uploaded files → ./backups/<timestamp>/
# Keeps the last $KEEP_DAYS days locally. Optionally copies to off-site storage (rclone remote).
# Cron (daily 03:15 Cairo):  15 3 * * * cd /opt/vibes-ai && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; [ -f .env ] && . ./.env; set +a

KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="backups/$STAMP"
mkdir -p "$OUT"

if docker compose ps db >/dev/null 2>&1 && [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then
  docker compose exec -T db pg_dump -U "${POSTGRES_USER:-vibes}" -Fc vibes_ai > "$OUT/db.dump"
  docker compose cp app:/data/storage "$OUT/storage" >/dev/null
else
  pg_dump -Fc "$DATABASE_URL" > "$OUT/db.dump"
  cp -a "${STORAGE_DIR:-./storage}" "$OUT/storage"
fi
tar -czf "backups/vibes-ai_$STAMP.tar.gz" -C backups "$STAMP" && rm -rf "$OUT"
sha256sum "backups/vibes-ai_$STAMP.tar.gz" > "backups/vibes-ai_$STAMP.tar.gz.sha256"
echo "[$(date)] backup OK: backups/vibes-ai_$STAMP.tar.gz ($(du -h "backups/vibes-ai_$STAMP.tar.gz" | cut -f1))"

# off-site copy (set BACKUP_REMOTE, e.g. "gdrive:vibes-ai-backups" after `rclone config`)
if [ -n "${BACKUP_REMOTE:-}" ]; then
  rclone copy "backups/vibes-ai_$STAMP.tar.gz" "$BACKUP_REMOTE" && rclone copy "backups/vibes-ai_$STAMP.tar.gz.sha256" "$BACKUP_REMOTE"
  echo "[$(date)] off-site copy OK → $BACKUP_REMOTE"
fi
find backups -name 'vibes-ai_*.tar.gz*' -mtime +"$KEEP_DAYS" -delete
