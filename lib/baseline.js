// Check 2 — the submission Excel of the month folder is the baseline; the Excel VIN is the key.
// For every Excel install row:
//   1. find the PDF in the SAME month folder whose FILE NAME has this VIN  → "Found PDF file"
//   2. in that PDF, check the VIN photo and the paper VIN box show the same VIN
//   3. customer name and installation date are compared too, but with low priority.
// Result level:  1 · Match 3/3 (file + photo + paper)   2 · File + Photo (paper differs)
//                3 · File only (photo unread / different)   nopdf · no PDF file with this VIN in the folder
//                novin · the Excel row has no valid VIN (empty / text / typo) — kept so the row count equals the Excel
// % match = file name 40 + photo 30 + paper 15 + name 10 + date 5 (case number is shown, not scored).
import { nameSimilarity, normName } from '../public/lib/names.js';

export const WEIGHTS = { vin_file: 40, vin_photo: 30, vin_paper: 15, name: 10, date: 5 };
export const BANDS = { l1: '① Match 3/3', l2: '② File + Photo', l3: '③ File only', nopdf: 'No PDF file', novin: 'No valid VIN in Excel', noexcel: 'Not in Excel' };

const job = (s) => String(s || '').replace(/\s/g, '').toUpperCase();

export function scoreMatch(ref, rec) {
  if (!rec) return { score: 0, band: 'nopdf', level: 0, parts: null };
  const photoVin = rec.vin_confirmed && rec.file_vin ? rec.file_vin : rec.vin_picture;
  const nameSim = rec.name_confirmed ? 100 : nameSimilarity(rec.customer_name, ref.customer_name);
  const days = rec.install_date && ref.install_date
    ? Math.round(Math.abs(Date.parse(rec.install_date) - Date.parse(ref.install_date)) / 86400000) : null;
  const fileVin = rec.file_vin || rec.vin;
  const parts = {
    vin_file: fileVin === ref.vin,
    vin_photo: photoVin === ref.vin,
    vin_paper: (rec.paper_confirmed && rec.file_vin ? rec.file_vin : rec.paper_vin) === ref.vin,
    name: nameSim,
    case: !!job(ref.case_number) && job(ref.case_number) === job(rec.job_number),
    date_days: days,
  };
  const score = Math.round(
    WEIGHTS.vin_file * parts.vin_file + WEIGHTS.vin_photo * parts.vin_photo + WEIGHTS.vin_paper * parts.vin_paper
    + (WEIGHTS.name * nameSim) / 100
    + (days === 0 ? WEIGHTS.date : days !== null && days <= 3 ? WEIGHTS.date / 2 : 0));
  const level = parts.vin_file && parts.vin_photo ? (parts.vin_paper ? 1 : 2) : 3;
  return { score, band: `l${level}`, level, parts };
}

// Baseline rows for one month's Excel (or all months), with the matched PDF and the % match.
// Uses the shared loaded dataset (lib/dataset.js) — no extra D1 reads.
export async function buildBaseline(db, batchId = null) {
  const { loadAll } = await import('./dataset.js');
  const data = await loadAll(db);
  const batchById = new Map(data.batches.map((b) => [b.id, b]));
  // Every install row of the Excel, including rows without a valid VIN (sheet 'install_invalid').
  const refs = data.refs.filter((f) => (f.sheet === 'install' || f.sheet === 'install_invalid') && (!batchId || f.batch_id === batchId))
    .sort((a, b) => a.batch_id - b.batch_id || a.row_no - b.row_no);
  // PDFs per month folder, by the VIN in the FILE NAME (records without a file name VIN are not indexed).
  const byFile = new Map();      // `${batch}|${vin}` → record
  const byContent = new Map();   // `${batch}|${vin}` → record whose photo / paper shows the VIN (hint only)
  const anyMonth = new Map();    // vin → record in any month (hint only)
  for (const r of data.records) {
    if (r.file_status === 'deleted') continue;
    const fv = r.file_vin || (r.vin_from_filename ? '' : r.vin);
    if (fv && !byFile.has(`${r.batch_id}|${fv}`)) byFile.set(`${r.batch_id}|${fv}`, r);
    for (const v of [r.vin_picture, r.paper_vin]) if (v && !byContent.has(`${r.batch_id}|${v}`)) byContent.set(`${r.batch_id}|${v}`, r);
    if (fv && !anyMonth.has(fv)) anyMonth.set(fv, r);
  }
  // Same-folder PDFs by customer name, to suggest the PDF for an Excel row without a valid VIN.
  const byName = new Map();
  for (const r of data.records) {
    if (r.file_status === 'deleted') continue;
    const k = `${r.batch_id}|${normName(r.customer_name)}`;
    if (normName(r.customer_name) && !byName.has(k)) byName.set(k, r);
  }
  const matched = new Set();
  const rows = refs.map((f) => {
    if (f.sheet === 'install_invalid') {
      const b = batchById.get(f.batch_id);
      const sug = byName.get(`${f.batch_id}|${normName(f.customer_name)}`);
      if (sug) matched.add(sug.vin);
      const why = !f.vin ? 'VIN cell is empty' : /^[A-Za-z0-9\s-]{14,20}$/.test(f.vin) && /\d/.test(f.vin) ? `"${f.vin}" is not a valid VIN` : `VIN cell says "${f.vin}"`;
      return {
        batch_id: f.batch_id, month: b?.month || '', excel_file_id: b?.reference_file_id || '', sheet_name: f.sheet_name, row_no: f.row_no,
        vin: f.vin, customer_name: f.customer_name, case_number: f.case_number, install_date: f.install_date, invalid_vin: true,
        excel_month_ok: f.install_date && b?.month ? f.install_date.slice(0, 7) === b.month : null, pdf_month_ok: null,
        record: null, suggestion: sug || null,
        hint: `${why}${sug ? ` — PDF with the same customer name: "${sug.pdf_name}" (VIN ${sug.vin})` : ' — no PDF with the same customer name'}`,
        score: 0, band: 'novin', level: 0, parts: null,
      };
    }
    const rec = byFile.get(`${f.batch_id}|${f.vin}`) || null;
    if (rec) matched.add(rec.vin);
    const b = batchById.get(f.batch_id);
    // No PDF file with this VIN in the folder: say where it may be.
    let hint = '';
    if (!rec) {
      const inside = byContent.get(`${f.batch_id}|${f.vin}`);
      const other = anyMonth.get(f.vin);
      if (inside) hint = `PDF "${inside.pdf_name}" shows this VIN in its ${inside.vin_picture === f.vin ? 'photo' : 'paper box'} — but its file name VIN is ${inside.file_vin || inside.vin}${inside.vin_confirmed ? " (corrected by admin)" : ""}`;
      else if (other) hint = `PDF is in the ${other.month} folder`;
    }
    return {
      batch_id: f.batch_id, month: b?.month || '', excel_file_id: b?.reference_file_id || '', sheet_name: f.sheet_name, row_no: f.row_no,
      vin: f.vin, customer_name: f.customer_name, case_number: f.case_number, install_date: f.install_date,
      // Installation month must be the folder month — for the Excel date and for the PDF date.
      excel_month_ok: f.install_date && b?.month ? f.install_date.slice(0, 7) === b.month : null,
      pdf_month_ok: rec && rec.install_date && b?.month && !rec.date_confirmed ? rec.install_date.slice(0, 7) === b.month : null,
      record: rec, hint, ...scoreMatch(f, rec),
    };
  });
  // PDFs (of this month, or all) that no Excel row points to.
  const pdfOnly = data.records.filter((r) => !matched.has(r.vin) && r.file_status !== 'deleted' && (!batchId || r.batch_id === batchId));
  const facets = { l1: 0, l2: 0, l3: 0, nopdf: 0, novin: 0, wrongmonth: 0 };
  for (const r of rows) { facets[r.band]++; if (r.excel_month_ok === false || r.pdf_month_ok === false) facets.wrongmonth++; }
  return { rows, pdfOnly, facets };
}
