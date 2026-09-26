# Wall Box Installation Records — Xpeng Thailand

Admin web app that turns a month of EV wall-box installation report PDFs (one Google Drive folder per
month) into records keyed by **VIN**, reads the VIN from the VIN photo with AI, and cross-checks
everything against the submission Excel kept in the same folder. All months accumulate in one database;
any month (or all) can be exported to Excel.

**Stack:** Cloudflare Pages (static admin UI + Pages Functions) · D1 (SQLite) · Workers AI
(`@cf/meta/llama-4-scout-17b-16e-instruct` vision) · MuPDF WASM in the browser · ExcelJS.
Auto-deploys from GitHub `main`.

## How it works
1. **Import month** — paste the Drive folder URL (shared as *Anyone with the link*). The app lists
   files, stores the reference Excel rows, then for every PDF:
   downloads it via `/api/drive/file` → parses **page 1** with MuPDF in a Web Worker → sends the
   VIN photo to `/api/ocr` → saves the record to D1. Imports are resumable: running the same URL
   again only processes files not yet done.
2. Page 1 without a text layer (scanned/flattened) is read entirely by AI and flagged
   `scanned_page` for checking; the customer name then comes from the file name.
3. **Compare** joins records with the reference Excel by VIN (date, job ↔ case number, serial, name).
4. **Issues** lists duplicates, VIN-photo mismatches, scanned pages, errors; duplicates can be
   swapped in with *Use this PDF*.

Why MuPDF and not pdf.js: the report fonts map Thai tone-mark glyphs to U+0000 in their ToUnicode
tables; pdf.js loses them (`ติดตัง`), MuPDF recovers them (`ติดตั้ง`).

## Layout
```
public/            admin UI (index.html, app.js, styles.css, lib/*)
  lib/parse.js     page-1 parser (labels, Thai date, VIN helpers)
  lib/pdf-worker.js MuPDF worker
  lib/importer.js  import pipeline
  lib/reference.js submission Excel reader
  lib/report.js    Excel export
functions/api/     Pages Functions (drive proxy, OCR, D1 CRUD, compare, stats, version)
functions/_middleware.js  admin session check for /api/*
lib/               shared server helpers
schema.sql         D1 schema
```

## Setup (one time)
```bash
wrangler login                       # Cloudflare account sirisak.anotai@gmail.com
wrangler d1 create wallbox           # put the database_id into wrangler.toml
npm run db:init                      # create tables in the remote D1
```
Cloudflare dashboard → Workers & Pages → Create → Pages → **Connect to Git** →
`sirisakG2/wallbox-report`, production branch `main`, build command *(none)*, output directory `public`.
Bindings (`DB`, `AI`) and variables come from `wrangler.toml`.

**Admin login** (the app holds customer names/phones) — two Pages secrets:
```bash
wrangler pages secret put ADMIN_PASSWORD --project-name wallbox-report   # the password you sign in with
openssl rand -base64 48 | wrangler pages secret put SESSION_SECRET --project-name wallbox-report
```
Secrets take effect on the next deployment (push a commit or retry the latest deployment).
Sessions last 7 days; 8 failed logins per IP in 15 minutes lock that IP for 15 minutes.
Every `/api` route except `/api/version` and `/api/auth/*` requires the session cookie.

Custom domain: `wallbox.anotai.net` (Pages → Custom domains, plus DNS `CNAME wallbox → wallbox-report.pages.dev`, proxied).

**This Mac:** wrangler for this project uses its own login —
`export XDG_CONFIG_HOME="$HOME/.wrangler-anotai" CLOUDFLARE_ACCOUNT_ID=be60b81c92e36a9d54fb6e7b5977365b`
before wrangler commands (the default wrangler login belongs to another account).

## Deploy
`git push` to `main` = deploy. Never run `wrangler pages deploy` on this Git-connected project.
Check `/api/version` (or the footer) shows the new commit.

## Local development
```bash
npm run db:init:local
npm run dev                          # http://localhost:8788 — no login locally; D1 local, Workers AI remote (billed)
npm run check                        # syntax-check all JS
```

## Schema changes
`CREATE TABLE IF NOT EXISTS` does not add new columns to live tables — run the `ALTER TABLE` on the
remote DB (`wrangler d1 execute wallbox --remote --command "…"`) and update `schema.sql` too.
