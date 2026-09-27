// Problems found in the submission Excel itself (source: ② Check Excel):
//   excel_no_vin      — the VIN cell holds text, not a VIN (e.g. "ติดตั้งก่อนรับรถ" = installed before the car was
//                       delivered). Suggest the PDF with the most similar customer name.
//   excel_bad_vin     — the VIN cell looks like a VIN but is not valid (typo, wrong length). Suggest the closest PDF VIN.
//   excel_other_month — a PDF's VIN is not in its own month's Excel but in another month's Excel.
import { nameSimilarity, normName } from '../public/lib/names.js';

function distance(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export async function excelProblems(db, batchId = null) {
  const inBatch = batchId ? 'AND f.batch_id = ?' : '';
  const bind = batchId ? [batchId] : [];
  const [bad, recs, other] = await Promise.all([
    db.prepare(`SELECT f.*, b.month, b.reference_file_id FROM reference_rows f JOIN batches b ON b.id = f.batch_id
      WHERE f.sheet = 'install_invalid' ${inBatch} ORDER BY f.batch_id, f.row_no`).bind(...bind).all(),
    db.prepare(`SELECT r.vin, r.batch_id, r.customer_name, r.pdf_file_id, r.pdf_name, r.install_date, b.month
      FROM records r JOIN batches b ON b.id = r.batch_id`).all(),
    db.prepare(`SELECT r.vin, r.batch_id, r.customer_name, r.pdf_file_id, r.pdf_name, b.month AS pdf_month,
        f.row_no, f.sheet_name, f.customer_name AS excel_name, b2.month AS excel_month, b2.reference_file_id
      FROM records r JOIN batches b ON b.id = r.batch_id
      JOIN reference_rows f ON f.vin = r.vin AND f.sheet = 'install' AND f.batch_id != r.batch_id
      JOIN batches b2 ON b2.id = f.batch_id
      WHERE NOT EXISTS (SELECT 1 FROM reference_rows g WHERE g.vin = r.vin AND g.batch_id = r.batch_id AND g.sheet = 'install')
      ${batchId ? 'AND r.batch_id = ?' : ''}`).bind(...bind).all(),
  ]);

  // Cheap lookups (Workers have a small CPU budget): exact normalised name, VIN by prefix.
  const byName = new Map();
  const byPrefix = new Map();
  for (const r of recs.results) {
    const n = normName(r.customer_name);
    if (n && !byName.has(n)) byName.set(n, r);
    const k = n.slice(0, 3);
    if (k) (byPrefix.get(k) || byPrefix.set(k, []).get(k)).push(r);
  }
  const list = [];
  for (const f of bad.results) {
    const looksVin = /^[A-Za-z0-9\s-]{14,20}$/.test(f.vin) && /\d/.test(f.vin);
    let suggestion = null;
    if (looksVin) {
      const v = f.vin.toUpperCase().replace(/[^A-Z0-9]/g, '');
      let best = null;
      for (const r of recs.results) {
        if (r.vin.slice(0, 8) !== v.slice(0, 8)) continue; // same maker/model prefix only
        const d = distance(v, r.vin);
        if (!best || d < best.d) best = { d, r };
      }
      if (best && best.d <= 3) suggestion = { ...best.r, how: `closest VIN (${best.d} character${best.d > 1 ? 's' : ''} different)` };
    }
    if (!suggestion && f.customer_name) {
      const n = normName(f.customer_name);
      const exact = byName.get(n);
      if (exact) suggestion = { ...exact, how: 'same customer name (100%)' };
      else {
        let best = null;
        for (const r of byPrefix.get(n.slice(0, 3)) || []) { const sc = nameSimilarity(f.customer_name, r.customer_name); if (!best || sc > best.s) best = { s: sc, r }; }
        if (best && best.s >= 85) suggestion = { ...best.r, how: `same customer name (${best.s}%)` };
      }
    }
    list.push({
      type: looksVin ? 'excel_bad_vin' : 'excel_no_vin', month: f.month, batch_id: f.batch_id,
      sheet_name: f.sheet_name, row_no: f.row_no, excel_file_id: f.reference_file_id,
      excel_vin: f.vin, customer_name: f.customer_name, case_number: f.case_number, install_date: f.install_date,
      suggestion,
      detail: looksVin
        ? `Excel row ${f.row_no}: VIN "${f.vin}" is not a valid VIN`
        : `Excel row ${f.row_no}: the VIN cell says "${f.vin}" instead of a VIN`,
    });
  }
  for (const o of other.results) {
    list.push({
      type: 'excel_other_month', month: o.pdf_month, batch_id: o.batch_id,
      sheet_name: o.sheet_name, row_no: o.row_no, excel_file_id: o.reference_file_id,
      excel_vin: o.vin, customer_name: o.excel_name, suggestion: { ...o, month: o.pdf_month, how: 'PDF with this VIN' },
      detail: `PDF is in the ${o.pdf_month} folder, but its VIN is in the ${o.excel_month} Excel (row ${o.row_no})`,
    });
  }
  return list;
}
