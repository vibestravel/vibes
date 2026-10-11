# VIBES AI — Your Intelligent Travel Team

Internal AI sales & customer-service platform for **Vibes Travel Egypt**: one inbox for WhatsApp, Instagram and Messenger, an AI assistant that speaks natural Egyptian Arabic and English, a CRM, a travel-package library, and live visa data from FlexiVi.

> **Honesty rules built into the code:** the assistant only quotes approved packages and FlexiVi data returned by server-side tools; demo/mock data is labeled and never shown to real customers; dashboard numbers come only from tracked records.

## What works today (Phase 1 + parts of 2–4)

| Area | Status |
|---|---|
| Login, 5 roles, department scoping, audit log | ✅ Working |
| CEO dashboard (date filters, real metrics only) | ✅ Working |
| Unified inbox — AI / Human / Paused modes, human takeover, de-duplication, one-reply lock | ✅ Working |
| AI engine — Claude with server-side tools (packages, knowledge, FlexiVi, CRM, handoff) | ✅ Built — needs `ANTHROPIC_API_KEY` |
| Demo engine (rule-based, labeled) for the simulator when no AI key is set | ✅ Working |
| Conversation simulator with tool trace | ✅ Working |
| CRM — customers, leads, pipeline board, scoring, notes, follow-up reminders | ✅ Working |
| Package library — bulk upload PDF/DOCX/PPTX/XLSX, text extraction, AI structured extraction, review → approve → archive, auto-archive on expiry, delivery history | ✅ Working (AI extraction needs the key; OCR = Phase 2) |
| Knowledge base (approval, internal-only entries never shown to customers) | ✅ Basic |
| AI Personality Studio (draft → test in simulator → publish) | ✅ Working |
| FlexiVi connector — mock (labeled) + live client per `docs/FLEXIVI_API_SPEC.md`, freshness checks, rate limit, test button, embassy monitor | ✅ Built — **LIVE only after the FlexiVi API exists and the test passes** |
| Meta webhook — signature check, WhatsApp/Messenger/Instagram DM parsing, replies via Graph API | ✅ Built, **not connected** (needs Meta credentials; Phase 4) |
| Comment automation, OCR, pgvector semantic search, follow-up automation, 50 test scenarios, Zoho sync | ⏳ Next phases — see `docs/ROADMAP.md` |

## Stack
Next.js 15 (App Router, server actions) · TypeScript · Tailwind CSS 4 · PostgreSQL 16 · Drizzle ORM · Anthropic API · Meta Graph API.

*Drizzle was used instead of Prisma: same PostgreSQL schema and migrations, no native engine binaries to download, which keeps builds and deploys simpler.*

## Run locally
```bash
cp .env.example .env            # fill DATABASE_URL + SESSION_SECRET at minimum
npm install
npm run db:migrate
SEED_ADMIN_PASSWORD='choose-a-strong-one' npm run db:seed
npm run db:seed:demo            # optional, local only: one labeled demo package
npm run dev                     # http://localhost:3000
```
Login: `m.farid@vibestraveleg.com` (or `SEED_ADMIN_EMAIL`) with the password you set.

## Tests
```bash
npm test        # 12 end-to-end tests against the database (flows, safety rules, webhooks, extraction)
npx tsc --noEmit
```

## Documentation
* `docs/DEPLOYMENT.md` — putting it on your hosting (Docker Compose or plain Node), HTTPS, Meta webhook
* `docs/BACKUP.md` — automatic daily backups, off-site copy, restore drill
* `docs/UPDATES.md` — GitHub workflow, releases, safe updates and rollback
* `docs/FLEXIVI_API_SPEC.md` — exact API the FlexiVi team needs to expose
* `docs/ROADMAP.md` — what is next, phase by phase

## Secrets
All credentials live in the server's `.env` file only. Never commit `.env`, never paste production keys into chats or tickets.
