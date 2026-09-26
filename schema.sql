-- Wall Box Installation Records — D1 schema
-- Apply: wrangler d1 execute wallbox --remote --file schema.sql

-- One imported Google Drive folder = one month.
CREATE TABLE IF NOT EXISTS batches (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  month         TEXT NOT NULL,              -- YYYY-MM
  folder_id     TEXT NOT NULL UNIQUE,       -- re-import of same folder updates this batch
  folder_url    TEXT NOT NULL,
  folder_name   TEXT NOT NULL DEFAULT '',
  reference_name TEXT NOT NULL DEFAULT '',  -- submission xlsx found in the folder
  pdf_count     INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'running', -- running | done | partial
  imported_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per installation PDF. VIN is the primary key across all months.
CREATE TABLE IF NOT EXISTS records (
  vin               TEXT PRIMARY KEY,
  batch_id          INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  install_date      TEXT NOT NULL DEFAULT '',  -- ISO YYYY-MM-DD
  install_date_raw  TEXT NOT NULL DEFAULT '',  -- as printed, e.g. "26 พ.ค. 2569"
  job_number        TEXT NOT NULL DEFAULT '',
  charger_code      TEXT NOT NULL DEFAULT '',
  customer_name     TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  region            TEXT NOT NULL DEFAULT '',
  site_type         TEXT NOT NULL DEFAULT '',
  serial            TEXT NOT NULL DEFAULT '',
  report_printed_at TEXT NOT NULL DEFAULT '',
  job_url           TEXT NOT NULL DEFAULT '',
  pdf_name          TEXT NOT NULL DEFAULT '',
  pdf_file_id       TEXT NOT NULL DEFAULT '',
  vin_picture       TEXT NOT NULL DEFAULT '',  -- VIN read from the VIN photo (OCR)
  vin_photo_match   INTEGER,                   -- 1 match, 0 mismatch, NULL not read
  ocr_raw           TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_records_batch ON records(batch_id);
CREATE INDEX IF NOT EXISTS idx_records_date ON records(install_date);
CREATE INDEX IF NOT EXISTS idx_records_file ON records(pdf_file_id);

-- Rows of the submission Excel kept in the folder (reference only, never edited).
CREATE TABLE IF NOT EXISTS reference_rows (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id      INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  sheet         TEXT NOT NULL,              -- install | charger_only
  vin           TEXT NOT NULL,
  case_number   TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  install_date  TEXT NOT NULL DEFAULT '',   -- ISO
  charger_model TEXT NOT NULL DEFAULT '',
  car_model     TEXT NOT NULL DEFAULT '',
  serial        TEXT NOT NULL DEFAULT '',
  team          TEXT NOT NULL DEFAULT '',
  po_ref        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ref_batch ON reference_rows(batch_id);
CREATE INDEX IF NOT EXISTS idx_ref_vin ON reference_rows(vin);

-- Problems found during import.
CREATE TABLE IF NOT EXISTS issues (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id   INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  vin        TEXT NOT NULL DEFAULT '',
  pdf_name   TEXT NOT NULL DEFAULT '',
  pdf_file_id TEXT NOT NULL DEFAULT '',
  type       TEXT NOT NULL,   -- duplicate_vin | filename_vin | ocr_mismatch | ocr_failed | bad_date | error
  detail     TEXT NOT NULL DEFAULT '',
  resolved   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_issues_batch ON issues(batch_id);

-- Files processed per batch (lets an interrupted import resume, incl. duplicates/errors).
CREATE TABLE IF NOT EXISTS batch_files (
  batch_id  INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  file_id   TEXT NOT NULL,
  name      TEXT NOT NULL DEFAULT '',
  status    TEXT NOT NULL,   -- saved | duplicate | error
  PRIMARY KEY (batch_id, file_id)
);

-- Failed admin logins (brute-force guard).
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_login_ip ON login_attempts(ip, at);
