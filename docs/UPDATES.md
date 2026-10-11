# Updates & GitHub workflow

## Repository
Private repository on the company GitHub organization, e.g. `github.com/<company>/vibes-ai`.
* Owners: CEO + one technical admin. Everyone else gets access per person and is removed when they leave.
* Turn on: branch protection for `main` (pull request + passing CI required), Dependabot alerts, secret scanning.
* `.env`, `storage/` and `backups/` are git-ignored — never commit them.

## Branches
* `main` — always deployable.
* `feature/<short-name>` — one change per branch, merged into `main` through a pull request.
* CI (`.github/workflows/ci.yml`) runs type checks, the end-to-end tests and a production build on every pull request.

## Releases
When `main` is ready to go live, tag it:
```bash
git tag -a v0.2.0 -m "Phase 2: OCR + semantic search"
git push origin v0.2.0
```
Version numbers: `MAJOR.MINOR.PATCH` — patch for fixes, minor for new features.

## Deploying an update
On the server:
```bash
cd /opt/vibes-ai
./scripts/update.sh v0.2.0
```
The script: backs up → checks out the tag → rebuilds → applies database migrations automatically → waits for `/api/health`. If the health check fails it switches the code back to the previous version.

## Database changes
1. Edit `src/db/schema.ts`.
2. `npm run db:generate -- --name <what-changed>` → creates a SQL file in `drizzle/`.
3. Review the SQL, commit it with the code. It runs automatically on deploy.
Never edit a migration that has already been deployed; add a new one.

## Rollback
* Code only: `./scripts/update.sh <previous-tag>`.
* If the bad version changed the database: `./scripts/restore.sh <the backup taken just before the update>`, then deploy the previous tag.
