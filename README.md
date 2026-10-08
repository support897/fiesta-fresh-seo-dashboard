# Fiesta Fresh — SEO & AI Visibility Dashboard

How the world finds Fiesta Fresh Cleaning. Live numbers, same scoreboards the night workers use.

## What it is

- Static site (no build step): `index.html` + `styles.css` + `app.js` + `config.js`.
- Backend: Supabase (Postgres + Auth + Edge Functions).
- The app ONLY reads. Night workers write rows with the service key (see below).

## Deploy

1. `schema.sql` — run once in the Supabase SQL editor (creates tables, RLS, seed data).
2. Edge Functions — create in Dashboard → Edge Functions, pasting the code from
   `edge-function-verify-owner-password.ts` and `edge-function-set-owner-password.ts`.
   Set the `SUPABASE_ANON_KEY` secret on each function.
3. `config.js` — replace `__PROJECT_REF__` and `__ANON_KEY__` with the real values.
4. Host this folder as a static site (Vercel / Pages). No build step.

## Login

- **Email login** (for setup): magic link through Supabase Auth.
- **Phone password**: set once inside the app (Settings, needs email login). The server stores
  only `salt` + `SHA-256(salt + password)` in the one-row `owner_secret` table (RLS on, no
  policies — only Edge Functions with the service role can touch it). Wrong password is refused.
  A successful password login unlocks the same dashboard.

## Worker writes

Night workers use `workers/db.py` (kept in the project workspace, not in this repo) with a
locked service-key file (`{"url": ..., "service_role_key": ...}`, chmod 600, never committed):

```python
from db import insert
insert("metric_snapshots", {"day": "2026-10-09", "kind": "seo_page1", "value": 3, "label": "3 of 14"})
insert("nightly_logs", {"worker": "seo", "day": "2026-10-09", "summary": "...", "details": {...}})
```

Unknown values: `value: None, label: "could not verify"`. Never a fake zero.

## File manifest (v1, 2026-10-09)

index.html, styles.css, app.js, config.js, schema.sql,
edge-function-verify-owner-password.ts, edge-function-set-owner-password.ts,
README.md, .gitignore
