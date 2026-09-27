// D1 helpers shared by several Pages Functions.
import { nameSimilarity } from '../public/lib/names.js';

export const RECORD_FIELDS = [
  'file_vin', 'paper_vin', 'install_date', 'install_date_raw', 'job_number', 'charger_code', 'customer_name', 'phone', 'region',
  'site_type', 'serial', 'report_printed_at', 'job_url', 'pdf_name', 'pdf_file_id', 'vin_picture',
  'vin_photo_match', 'vin_read_by', 'ocr_raw', 'notes',
];

export function upsertRecord(db, batchId, r) {
  const cols = ['vin', 'batch_id', ...RECORD_FIELDS];
  const vals = [r.vin, batchId, ...RECORD_FIELDS.map((f) => (f === 'vin_photo_match' ? r[f] ?? null : String(r[f] ?? '')))];
  return db.prepare(`
    INSERT INTO records (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
    ON CONFLICT(vin) DO UPDATE SET ${cols.slice(1).map((c) => `${c} = excluded.${c}`).join(', ')},
      updated_at = datetime('now')`).bind(...vals);
}

// ---------- PDF records vs submission Excel (reference) ----------
const digits = (s) => String(s || '').replace(/\D/g, '');
const norm = (s) => String(s || '').trim().toUpperCase().replace(/\s/g, '');

function flag(a, b, eq) {
  if (!a || !b) return null; // cannot compare
  return eq(a, b) ? 1 : 0;
}

export function compareRow(rec, ref) {
  return {
    date_match: flag(rec?.install_date, ref?.install_date, (a, b) => a === b),
    job_match: flag(norm(rec?.job_number), norm(ref?.case_number), (a, b) => a === b),
    serial_match: flag(digits(rec?.serial), digits(ref?.serial), (a, b) => a === b),
    name_match: flag(rec?.customer_name, ref?.customer_name, (a, b) => nameSimilarity(a, b) >= 95),
    name_score: rec?.customer_name && ref?.customer_name ? nameSimilarity(rec.customer_name, ref.customer_name) : null,
  };
}

// Builds the comparison for one batch (or all batches when batchId is null).
export async function buildCompare(db, batchId) {
  const where = batchId ? 'WHERE r.batch_id = ?' : '';
  const whereF = batchId ? 'WHERE f.batch_id = ?' : '';
  const bind = batchId ? [batchId] : [];
  const [recs, refs] = await Promise.all([
    db.prepare(`SELECT r.*, b.month FROM records r JOIN batches b ON b.id = r.batch_id ${where}`).bind(...bind).all(),
    db.prepare(`SELECT f.*, b.month FROM reference_rows f JOIN batches b ON b.id = f.batch_id ${whereF} ORDER BY f.id`).bind(...bind).all(),
  ]);
  const install = new Map();
  const chargerOnly = new Map();
  for (const f of refs.results) {
    const m = f.sheet === 'install' ? install : chargerOnly;
    if (!m.has(f.vin)) m.set(f.vin, f);
  }

  const rows = [];
  const seen = new Set();
  for (const r of recs.results) {
    seen.add(r.vin);
    const ref = install.get(r.vin);
    const status = ref ? 'Both' : chargerOnly.has(r.vin) ? 'Charger-only sheet' : 'PDF only';
    rows.push({ vin: r.vin, status, month: r.month, record: r, reference: ref || chargerOnly.get(r.vin) || null,
      ...(ref ? compareRow(r, ref) : {}) });
  }

  // Reference rows with no PDF in scope — the PDF may still exist in another month.
  const missing = [...install.values()].filter((f) => !seen.has(f.vin));
  const elsewhere = new Map();
  for (let i = 0; i < missing.length; i += 90) {
    const chunk = missing.slice(i, i + 90).map((f) => f.vin);
    const { results } = await db.prepare(
      `SELECT r.*, b.month FROM records r JOIN batches b ON b.id = r.batch_id WHERE r.vin IN (${chunk.map(() => '?').join(',')})`)
      .bind(...chunk).all();
    for (const r of results) elsewhere.set(r.vin, r);
  }
  for (const f of missing) {
    const other = elsewhere.get(f.vin);
    rows.push({ vin: f.vin, status: other ? 'PDF in other month' : 'Reference only', month: f.month,
      record: other || null, reference: f, ...(other ? compareRow(other, f) : {}) });
  }

  rows.sort((a, b) => a.status.localeCompare(b.status) || a.vin.localeCompare(b.vin));
  const summary = {};
  for (const r of rows) summary[r.status] = (summary[r.status] || 0) + 1;
  for (const k of ['date_match', 'job_match', 'serial_match', 'name_match']) {
    summary[`${k}_fail`] = rows.filter((r) => r[k] === 0).length;
  }
  return { rows, summary };
}
