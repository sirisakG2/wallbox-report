// How sure the app is about each record's VIN and installation date (0–100 %), with reasons.
// 100 % means every independent source agrees (PDF text, VIN photo, submission Excel) or an admin
// confirmed it. Anything below 95 % is shown as "needs review".

export const REVIEW_BELOW = 95;

// Extra columns the scoring needs, for SELECT … FROM records r.
export const CONFIDENCE_COLUMNS = `
  (SELECT f.install_date FROM reference_rows f WHERE f.vin = r.vin AND f.sheet = 'install' ORDER BY f.id LIMIT 1) AS ref_date,
  EXISTS (SELECT 1 FROM reference_rows f WHERE f.vin = r.vin) AS in_reference,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'missing_vin') AS vin_from_filename,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'filename_vin') AS filename_differs,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'edited_pdf') AS edited_pdf,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'scanned_page') AS scanned,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'suspicious_date' AND i.resolved = 0) AS suspicious_date`;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function sameChars(a, b) {
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) n++;
  return n;
}

export function vinConfidence(r) {
  if (r.vin_confirmed) return { score: 100, reasons: ['Confirmed by admin'] };
  const reasons = [];
  let s;
  if (r.vin_photo_match === 1) {
    s = 100;
    reasons.push(`VIN photo shows the same VIN (${r.vin_read_by === 'free' ? 'free reader' : 'AI'})`);
  } else if (r.vin_photo_match === 0) {
    const same = sameChars(String(r.vin_picture || ''), r.vin);
    s = (90 * same) / 17;
    reasons.push(`VIN photo reads ${r.vin_picture} — ${17 - same} character(s) differ`);
  } else {
    s = 75;
    reasons.push('VIN photo not read — PDF text only');
  }
  if (r.vin_from_filename) { s = Math.min(s, 60); reasons.push('VIN not readable in the PDF — taken from the file name'); }
  if (r.filename_differs) { s -= 20; reasons.push('File name VIN differs from the PDF'); }
  if (r.scanned && r.vin_photo_match !== 1) { s -= 10; reasons.push('Scanned page — read by AI'); }
  if (r.edited_pdf) { s -= 15; reasons.push('PDF may be edited'); }
  if (r.in_reference) { if (s < 100) s += 5; reasons.push('VIN is in the submission Excel'); }
  else { s -= 10; reasons.push('VIN not in the submission Excel'); }
  return { score: clamp(s), reasons };
}

export function dateConfidence(r) {
  if (r.date_confirmed) return { score: 100, reasons: ['Confirmed by admin'] };
  if (!r.install_date) return { score: 0, reasons: [`Date not readable ("${r.install_date_raw || ''}")`] };
  const reasons = [];
  let s = r.scanned ? 70 : 90;
  reasons.push(r.scanned ? 'Read by AI from a scanned page' : 'Read from the PDF text');
  if (r.ref_date) {
    const days = Math.round(Math.abs(Date.parse(r.install_date) - Date.parse(r.ref_date)) / 86400000);
    if (days === 0) { s += 10; reasons.push('Same date as the submission Excel'); }
    else if (days <= 3) { s -= 10; reasons.push(`Submission Excel says ${r.ref_date} (${days} day${days > 1 ? 's' : ''} apart)`); }
    else { s -= 30; reasons.push(`Submission Excel says ${r.ref_date} (${days} days apart)`); }
  } else {
    reasons.push('No date in the submission Excel to compare');
  }
  if (r.suspicious_date) { s -= 40; reasons.push('Date is far from the imported month'); }
  if (r.edited_pdf) { s -= 15; reasons.push('PDF may be edited'); }
  return { score: clamp(s), reasons };
}

// Adds vin_conf, vin_conf_reasons, date_conf, date_conf_reasons to a record row.
export function withConfidence(r) {
  const v = vinConfidence(r);
  const d = dateConfidence(r);
  return { ...r, vin_conf: v.score, vin_conf_reasons: v.reasons, date_conf: d.score, date_conf_reasons: d.reasons };
}
