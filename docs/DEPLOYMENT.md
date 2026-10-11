# Deployment

You have your own hosting. Two supported options — pick one.

## Option A — Docker Compose (recommended)
Requirements: a Linux server (2 vCPU, 4 GB RAM, 40 GB disk is plenty to start), Docker + Docker Compose, a domain such as `ai.vibestraveleg.com`.

```bash
sudo mkdir -p /opt/vibes-ai && sudo chown $USER /opt/vibes-ai
git clone git@github.com:<company>/vibes-ai.git /opt/vibes-ai
cd /opt/vibes-ai
cp .env.example .env && nano .env      # see "Environment" below; also set POSTGRES_PASSWORD
docker compose up -d --build
docker compose exec app npx tsx scripts/seed.ts   # prints the first CEO password once
```

## Option B — Plain Node.js (if Docker is not available)
Node 22, PostgreSQL 16 (with the `pgvector` extension available for Phase 2), and a process manager (systemd or PM2).
```bash
npm ci && npm run db:migrate && npm run db:seed && npm run build
pm2 start npm --name vibes-ai -- start && pm2 save
```

## HTTPS (required — Meta webhooks only work over HTTPS)
Example with Caddy (`/etc/caddy/Caddyfile`):
```
ai.vibestraveleg.com {
  reverse_proxy 127.0.0.1:3000
}
```
Nginx works too; proxy to `127.0.0.1:3000` and set `client_max_body_size 60m;` for package uploads.

## Environment (`.env` on the server only)
| Variable | Needed for |
|---|---|
| `DATABASE_URL`, `SESSION_SECRET` (`openssl rand -base64 48`) | Always |
| `APP_URL` | Signed document links sent to customers |
| `STORAGE_DIR` | Uploaded package files (back this up) |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Real AI replies + package extraction |
| `FLEXIVI_MODE=live`, `FLEXIVI_BASE_URL`, `FLEXIVI_API_KEY`, `FLEXIVI_HMAC_SECRET` | After the FlexiVi API passes its acceptance tests |
| `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ACCESS_TOKEN` | Messenger + Instagram |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Cloud API |

After changing `.env`: `docker compose up -d app` (or `pm2 restart vibes-ai`).

## Meta webhook (Phase 4)
In the Meta App dashboard → Webhooks: callback URL `https://ai.vibestraveleg.com/api/webhooks/meta`, verify token = `META_VERIFY_TOKEN`. Subscribe WhatsApp `messages`, Page `messages`, Instagram `messages`. Every request is checked with `META_APP_SECRET`; unsigned requests are rejected and logged.

Until Claude is configured, real incoming messages are **not** auto-answered; they go to a human in the inbox.

## Health check
`GET /api/health` → `{"ok":true,"db":"up"}`. Point your uptime monitor at it.
