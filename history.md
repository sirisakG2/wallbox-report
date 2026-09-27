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
| 07dbcc8 | Free VIN reader replaced: PaddleOCR (PP-OCRv4) running in the browser on any PC (Dell/Windows or Mac), no Chrome setting, no Apple engine. Tested on 113 June photos: 91 confirmed free, 8 charger photos, 14 to AI; ~0.9 s/photo in the browser. When the AI allowance runs out the import continues with free-only work and leaves AI-needing files for the next run. |
| 618f999 | Installation date fixed: one date reader for all formats (Thai/Western year, "26 พ.ค. 2569", "8/6/2569", "31-05-69", Thai digits), same reader for the submission Excel; "Suspicious date" check (>3 months before / >1 month after the imported month, or future); "Edit date" in record details and "Fix date" in Issues. Parser now uses form landmarks (works for A4, A3, and A4-form-on-A3 layouts, labels wrapping onto two lines, forms with labels as graphics); scans with a garbage text layer go to AI; new "PDF may be edited" check (page-header job ≠ table job). Regression on 143 real PDFs: all fields found, 0 stored values changed. |
| 2d536db | Confidence % for VIN and installation date on every record (with reasons): 100% = PDF text, VIN photo and submission Excel agree, or admin confirmed. Records filter "Needs review (<95%)" sorted lowest first; review panel with Open PDF / Confirm / Correct for VIN and date, next record opens automatically; dashboard "To review" count; Excel export gets VIN %, Date %, Needs review and reasons columns. |
| ff7a66a | Re-importing a folder (retry or "Re-process all") never undoes admin review: corrected/confirmed VIN and date, admin notes and resolved issues are kept; a file re-read with a different unconfirmed VIN replaces its old record instead of leaving a duplicate. |
| 06225d0 | Folder changes: "Check folder" compares Drive with the last import — New / Updated (same name, newer modified date, or re-uploaded under a new file id) / Deleted (no longer in the folder) / Unchanged. Updated PDFs are read again (admin review kept) and marked "Updated dd/mm"; deleted PDFs keep their record, marked "Deleted dd/mm" (mark removed if the file returns). Shown in Records (pill + filter), record details, import summary, month cards and Excel export. |
| next | VIN check by 3 sources, file name is the reference: file name VIN (record key) · VIN photo (must confirm it) · paper VIN box (low priority). KPI levels ① Match 3/3 · ② File = Photo (paper differs) · ③ Not matched (photo does not confirm the file name). Free reader and AI now check the photo against the file name VIN first. Dashboard 3 KPI cards, Records "VIN check" column + filter, record panel shows the 3 sources, summary and export updated. Existing June + May data back-filled: 13 records re-keyed from paper/temporary IDs to the file name VIN, 69 more photos confirmed free. |

## Data — June 2026 (503 PDFs)
- First import: 485 records saved; stopped reading photos when the free Workers AI allowance (10,000 neurons/day) ran out.
- Free pass on the Mac (Apple text recognition): 68 more VIN photos confirmed, 5 charger photos flagged.
- Date fix: 7 numeric dates read, 33 reports of other layouts re-read (18 edited reports all built on old job XPENG2509015 printed 25/9/2025), 2 suspicious years flagged (2566, 2568).
- Now: 383 VIN photos ✔ (82 free), 5 records without date, 18 "PDF may be edited", 19 files queued for AI retry.

## Open items
- June: 19 files queued for AI (unclear photos + scanned pages) — rerun import with "Retry unread / failed" after 07:00; then fix remaining dates with "Fix date".
- Review the 18 "PDF may be edited" reports with the installer.
- First import on a new PC downloads ~26 MB (free reader models, cached afterwards).
- Decide: PDF install date is often 1–15 days later than the submission Excel — allow a tolerance in Compare or keep strict?

## Notes
- Password: keep current (do not change).
- Wrangler for this project uses its own login: `XDG_CONFIG_HOME=$HOME/.wrangler-anotai`.
