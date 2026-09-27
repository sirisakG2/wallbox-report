// Check 2 — the submission Excel is the baseline.
// Every Excel install row (row number, VIN, customer name, case number, installation date) is matched
// to the PDF record from Check 1 with the same VIN (file name VIN, else photo VIN, else paper VIN),
// and each field is compared to give a % match:
//   VIN in file name 15 · VIN in photo 15 · VIN in paper box 10 · customer name 25 × similarity
//   case number = PDF job number 15 · installation date: same day 20, ≤3 days 10
import { nameSimilarity } from '../public/lib/names.js';

export const WEIGHTS = { vin_file: 15, vin_photo: 15, vin_paper: 10, name: 25, case: 15, date: 20 };
export const BANDS = { full: '100%', high: '90–99%', medium: '70–89%', low: 'Below 70%', nopdf: 'No PDF' };

const job = (s) => String(s || '').replace(/\s/g, '').toUpperCase();

export function scoreMatch(ref, rec) {
  if (!rec) return { score: 0, band: 'nopdf', parts: null };
  const photoVin = rec.vin_confirmed && rec.file_vin ? rec.file_vin : rec.vin_picture;
  const nameSim = rec.name_confirmed ? 100 : nameSimilarity(rec.customer_name, ref.customer_name);
  const days = rec.install_date && ref.install_date
    ? Math.round(Math.abs(Date.parse(rec.install_date) - Date.parse(ref.install_date)) / 86400000) : null;
  const parts = {
    vin_file: rec.file_vin === ref.vin,
    vin_photo: photoVin === ref.vin,
    vin_paper: rec.paper_vin === ref.vin,
    name: nameSim,
    case: !!job(ref.case_number) && job(ref.case_number) === job(rec.job_number),
    date_days: days,
  };
  const score = Math.round(
    WEIGHTS.vin_file * parts.vin_file + WEIGHTS.vin_photo * parts.vin_photo + WEIGHTS.vin_paper * parts.vin_paper
    + (WEIGHTS.name * nameSim) / 100 + WEIGHTS.case * parts.case
    + (days === 0 ? WEIGHTS.date : days !== null && days <= 3 ? WEIGHTS.date / 2 : 0));
  const band = score >= 100 ? 'full' : score >= 90 ? 'high' : score >= 70 ? 'medium' : 'low';
  return { score, band, parts };
}

// PDF records indexed by every VIN they carry, strongest source first.
export function indexRecords(records) {
  const byFile = new Map(), byPhoto = new Map(), byPaper = new Map();
  for (const r of records) {
    if (r.file_vin && !byFile.has(r.file_vin)) byFile.set(r.file_vin, r);
    if (r.vin_picture && !byPhoto.has(r.vin_picture)) byPhoto.set(r.vin_picture, r);
    if (r.paper_vin && !byPaper.has(r.paper_vin)) byPaper.set(r.paper_vin, r);
    if (!byFile.has(r.vin)) byFile.set(r.vin, r);
  }
  return (vin) => byFile.get(vin) || byPhoto.get(vin) || byPaper.get(vin) || null;
}

// Baseline rows for one month's Excel (or all months), with the matched PDF and the % match.
// Uses the shared loaded dataset (lib/dataset.js) — no extra D1 reads.
export async function buildBaseline(db, batchId = null) {
  const { loadAll } = await import('./dataset.js');
  const data = await loadAll(db);
  const batchById = new Map(data.batches.map((b) => [b.id, b]));
  const refs = data.refs.filter((f) => f.sheet === 'install' && (!batchId || f.batch_id === batchId))
    .sort((a, b) => a.batch_id - b.batch_id || a.row_no - b.row_no);
  const find = indexRecords(data.records);
  const matched = new Set();
  const rows = refs.map((f) => {
    const rec = find(f.vin);
    if (rec) matched.add(rec.vin);
    const b = batchById.get(f.batch_id);
    return {
      batch_id: f.batch_id, month: b?.month || '', excel_file_id: b?.reference_file_id || '', sheet_name: f.sheet_name, row_no: f.row_no,
      vin: f.vin, customer_name: f.customer_name, case_number: f.case_number, install_date: f.install_date,
      record: rec, ...scoreMatch(f, rec),
    };
  });
  // PDFs (of this month, or all) that no Excel row points to.
  const pdfOnly = data.records.filter((r) => !matched.has(r.vin) && (!batchId || r.batch_id === batchId));
  const facets = { full: 0, high: 0, medium: 0, low: 0, nopdf: 0 };
  for (const r of rows) facets[r.band]++;
  return { rows, pdfOnly, facets };
}
