# Backups

What is backed up: the PostgreSQL database (customers, conversations, leads, packages, settings, audit log) **and** the uploaded files folder (`STORAGE_DIR`). Both are needed for a full restore.

## Daily automatic backup
```bash
crontab -e
# every day at 03:15 server time
15 3 * * * cd /opt/vibes-ai && ./scripts/backup.sh >> backups/backup.log 2>&1
```
Each run creates `backups/vibes-ai_<date>_<time>.tar.gz` plus a `.sha256` checksum, and deletes local copies older than `KEEP_DAYS` (default 14).

## Off-site copy (strongly recommended)
A backup on the same server does not survive a server loss. Install `rclone`, run `rclone config` once to connect Google Drive, S3, Backblaze or similar, then add to `.env`:
```
BACKUP_REMOTE="gdrive:vibes-ai-backups"
```
The script copies every new backup there automatically.

## Restore
```bash
./scripts/restore.sh backups/vibes-ai_2026-10-11_0315.tar.gz
```
It verifies the checksum, asks you to type `RESTORE`, stops the app, restores database and files, and starts the app again.

## Monthly restore drill (10 minutes)
Restore the latest backup on a test machine or a copy of the database and log in. A backup that has never been restored is not a backup.

## Before every update
`scripts/update.sh` takes a fresh backup automatically before it changes anything.
