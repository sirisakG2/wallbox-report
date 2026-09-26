# History — Wall Box Installation Records (Xpeng Thailand)

Live: https://wallbox.anotai.net (also wallbox-report.pages.dev) · Repo: sirisakG2/wallbox-report

## 26 Sep 2026

| Commit | Change |
|---|---|
| `cbc1798` | First version: admin app (Dashboard, Import month, Records, Compare, Issues, Months, Export), black theme + light toggle, XPENG header, footer "Aum · Xpeng (Thailand)". PDFs read with MuPDF (keeps Thai tone marks), VIN photo read by Workers AI, data in D1, reference Excel kept for comparison. |
| `44e48e6` | Connected to D1 database `wallbox` on Cloudflare account sirisak.anotai. |
| `a8b5cee` | Password login instead of Cloudflare Zero Trust (7-day session, lockout after 8 wrong tries / 15 min). |
| `ed81ce2` | README updated; custom domain wallbox.anotai.net. |
| `0cf6bb2` | Import summary per month (7-row result table, rows link to records/issues). |
| `d536026` | Free on-device VIN reader first, AI only for unclear photos; charger photo in VIN slot flagged; pause cleanly at AI daily limit; "Retry unread / failed"; 5 files in parallel; "Read by" (Free/AI) column. |
| `d1feb95` | Fixed memory leak that made files fail after a very large (410 MB) PDF. |

## Data — June 2026 (503 PDFs)
- First import: 485 records saved; stopped reading photos when the free Workers AI allowance (10,000 neurons/day) ran out.
- Free pass on the Mac (Apple text recognition): 68 more VIN photos confirmed, 5 charger photos flagged.
- Now: 369 VIN photos ✔ (301 AI + 68 free), 36 ✘ to check, 2 duplicate VINs.

## Open items
- June: 24 files still need AI (8 unclear photos, 16 scanned pages) — rerun import with "Retry unread / failed" after 07:00.
- Free reader in the web app needs Chrome flag `chrome://flags/#enable-experimental-web-platform-features`.
- Decide: PDF install date is often 1–15 days later than the submission Excel — allow a tolerance in Compare or keep strict?

## Notes
- Password: keep current (do not change).
- Wrangler for this project uses its own login: `XDG_CONFIG_HOME=$HOME/.wrangler-anotai`.
