# FlexiVi → Vibes AI Integration Specification (v1)

**Audience:** FlexiVi development team
**Status:** Proposed contract. Vibes AI already ships a client for this contract (`src/lib/flexivi/live.ts`) and runs on clearly labeled mock data (`src/lib/flexivi/mock.ts`) until these endpoints exist and pass the acceptance tests below.

Vibes AI only **reads** from FlexiVi in v1. No booking, payment or applicant data is written to FlexiVi.

---

## 1. Transport & security

| Item | Requirement |
|---|---|
| Base URL | `https://api.flexivi.<domain>/v1` (HTTPS only, TLS 1.2+) |
| Auth | `Authorization: Bearer <API_KEY>` — a dedicated **read-only** key for Vibes AI, revocable, rotatable without downtime (support 2 active keys during rotation) |
| Request signing (recommended) | `X-Vibes-Timestamp: <unix seconds>` and `X-Vibes-Signature: hex(HMAC_SHA256(secret, "<timestamp>.GET.<path-with-query>"))`. Reject if the timestamp is more than 300 s old. |
| Network | Optionally allow-list the Vibes AI server IP |
| Rate limit | At least 10 req/s per key. Return `429` with `Retry-After` when exceeded |
| Timeouts | Respond within 3 s (p95). Vibes AI times out at 8 s and retries once on 5xx/network errors |
| Format | JSON, UTF-8. Dates `YYYY-MM-DD`, timestamps ISO-8601 with timezone |
| Logging | Log key id, path, status, latency. **Do not** log the Authorization header |

## 2. Response envelope (every endpoint)

```json
{
  "data": { },
  "verified_at": "2026-10-11T09:30:00+03:00",
  "source": "embassy_portal | vfs | manual | ...",
  "request_id": "uuid"
}
```

`verified_at` is **mandatory**: when FlexiVi last confirmed this data with the official source. Vibes AI refuses to present appointment availability older than `FLEXIVI_AVAILABILITY_MAX_AGE_MIN` (default 30 minutes) as live, and escalates to a human instead.

Errors:

```json
{ "error": { "code": "NOT_FOUND | INVALID_PARAMS | UNAUTHORIZED | RATE_LIMITED | UPSTREAM_UNAVAILABLE", "message": "..." }, "request_id": "uuid" }
```

| HTTP | Meaning |
|---|---|
| 200 | OK |
| 400 | Invalid parameters |
| 401/403 | Bad or revoked key / signature |
| 404 | Destination, category or center not supported |
| 429 | Rate limited |
| 503 | FlexiVi or the upstream embassy source is unavailable |

## 3. Codes

* `destination`: ISO-3166 alpha-2 (`DE`, `FR`, `IT`, `US`, …)
* `category`: `TOURISM`, `BUSINESS`, `VISIT_FAMILY`, `STUDY`, `WORK`, `TRANSIT`, `MEDICAL` (FlexiVi may add more; Vibes AI reads them from `/categories`)
* `nationality`, `residence`: ISO-3166 alpha-2 (default `EG`)

## 4. Endpoints

### 4.1 `GET /v1/health`
Returns `200` with `{ "data": { "status": "ok" }, "verified_at": "<now>" }`. Used by "Test connection" in Vibes AI.

### 4.2 `GET /v1/destinations`
```json
{ "data": [ { "code": "DE", "nameAr": "ألمانيا", "nameEn": "Germany", "categories": ["TOURISM", "BUSINESS"] } ], "verified_at": "..." }
```

### 4.3 `GET /v1/destinations/{code}/categories`
```json
{ "data": [ { "code": "TOURISM", "nameAr": "سياحة", "nameEn": "Tourism" } ], "verified_at": "..." }
```

### 4.4 `GET /v1/destinations/{code}/centers?city=Cairo`
```json
{ "data": [ { "id": "DE-CAI-VFS", "destinationCode": "DE", "name": "VFS Global Germany — Cairo", "city": "Cairo", "address": "...", "provider": "VFS" } ], "verified_at": "..." }
```

### 4.5 `GET /v1/requirements?destination=DE&category=TOURISM&nationality=EG&residence=EG`
```json
{
  "data": {
    "destinationCode": "DE", "category": "TOURISM", "nationality": "EG", "residence": "EG",
    "requirements": [
      { "id": "passport", "titleAr": "جواز سفر ساري ٦ شهور", "titleEn": "Passport valid 6 months", "mandatory": true, "notes": "..." }
    ],
    "effectiveFrom": "2026-09-01",
    "sourceName": "German Embassy Cairo",
    "sourceUrl": "https://..."
  },
  "verified_at": "..."
}
```
If requirements are incomplete or under review, return `200` with `"data": { ..., "status": "UNDER_REVIEW" }` — Vibes AI will escalate to a visa specialist.

### 4.6 `GET /v1/availability?destination=DE&category=TOURISM&center_id=DE-CAI-VFS&city=Cairo`
`center_id` and `city` optional. Returns one item per matching center.
```json
{
  "data": [
    { "destinationCode": "DE", "category": "TOURISM", "centerId": "DE-CAI-VFS",
      "earliestDate": "2026-10-23",
      "slots": [ { "date": "2026-10-23", "slotsLeft": 3 }, { "date": "2026-10-26", "slotsLeft": null } ] }
  ],
  "verified_at": "2026-10-11T09:30:00+03:00"
}
```
`earliestDate: null` = no slots. `slotsLeft: null` = available, count unknown. **Never return cached data with a fresh `verified_at`.**

### 4.7 `GET /v1/fees?destination=DE&category=TOURISM`
```json
{
  "data": {
    "destinationCode": "DE", "category": "TOURISM",
    "officialFee": { "amount": 90, "currency": "EUR" },
    "centerFee": { "amount": 1200, "currency": "EGP" },
    "serviceFee": { "amount": 1500, "currency": "EGP" },
    "processingDays": { "min": 10, "max": 15 }
  },
  "verified_at": "..."
}
```
Any unknown fee → `null` (Vibes AI then says it will confirm with a specialist; it never estimates).

### 4.8 (Phase 3b, optional) `POST /v1/inquiries`
Create a visa inquiry in FlexiVi from a Vibes AI lead. Disabled in Vibes AI until explicitly authorized.
```json
{ "destination": "DE", "category": "TOURISM", "customer": { "name": "...", "phone": "+20..." }, "preferredDates": ["2026-11"], "vibesLeadId": "uuid" }
```
Must be idempotent on `vibesLeadId`.

**Not in scope:** appointment booking, payments, uploading applicant documents. These stay disabled until separately specified and authorized.

## 5. Acceptance tests (before Vibes AI is switched to LIVE)

1. `/health` returns 200 with the production key; returns 401 with a revoked key.
2. Each endpoint above returns the documented shape for `DE/TOURISM` and one more destination.
3. `verified_at` on `/availability` changes when FlexiVi re-checks the source, and is older than now when served from cache.
4. Wrong signature or a timestamp older than 300 s → 401.
5. 11 requests in one second → at least one 429 with `Retry-After`.
6. Upstream outage → 503 (not stale data with a fresh `verified_at`).

When all pass: set `FLEXIVI_MODE=live`, `FLEXIVI_BASE_URL`, `FLEXIVI_API_KEY`, `FLEXIVI_HMAC_SECRET` on the Vibes AI server, press **Test connection** in *FlexiVi Visa Center*. The status shows **LIVE** only after an authenticated call succeeds.

## 6. Contacts & change control
Breaking changes go to `/v2`. Additive fields are allowed in `/v1`. Notify Vibes AI 14 days before deprecations.
