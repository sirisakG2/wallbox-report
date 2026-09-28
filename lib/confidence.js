// How sure the app is about each record's VIN (level 1–3) and installation date (0–100 %), with reasons.

import { nameSimilarity } from '../public/lib/names.js';
import { scoreMatch } from './baseline.js';

export const REVIEW_BELOW = 95;

// Extra columns the scoring needs, for SELECT … FROM records r.
export const CONFIDENCE_COLUMNS = `
  (SELECT f.install_date FROM reference_rows f WHERE f.vin = r.vin AND f.sheet = 'install' ORDER BY f.id LIMIT 1) AS ref_date,
  (SELECT f.customer_name FROM reference_rows f WHERE f.vin = r.vin AND f.sheet = 'install' ORDER BY f.id LIMIT 1) AS ref_name,
  (SELECT f.row_no FROM reference_rows f WHERE f.vin = r.vin AND f.sheet = 'install' ORDER BY f.id LIMIT 1) AS ref_row,
  (SELECT f.case_number FROM reference_rows f WHERE f.vin = r.vin AND f.sheet = 'install' ORDER BY f.id LIMIT 1) AS ref_case,
  (SELECT f.sheet_name FROM reference_rows f WHERE f.vin = r.vin AND f.sheet = 'install' ORDER BY f.id LIMIT 1) AS ref_sheet_name,
  (SELECT b2.reference_file_id FROM reference_rows f JOIN batches b2 ON b2.id = f.batch_id WHERE f.vin = r.vin ORDER BY f.sheet = 'install' DESC, f.id LIMIT 1) AS ref_file_id,
  (SELECT b2.month FROM reference_rows f JOIN batches b2 ON b2.id = f.batch_id WHERE f.vin = r.vin ORDER BY f.sheet = 'install' DESC, f.id LIMIT 1) AS ref_month,
  (SELECT b3.reference_file_id FROM batches b3 WHERE b3.id = r.batch_id) AS month_ref_file_id,
  EXISTS (SELECT 1 FROM reference_rows f WHERE f.vin = r.vin AND f.sheet = 'install') AS in_install_sheet,
  EXISTS (SELECT 1 FROM reference_rows f WHERE f.vin = r.vin) AS in_reference,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'missing_vin') AS vin_from_filename,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'filename_vin') AS filename_differs,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'edited_pdf') AS edited_pdf,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'scanned_page') AS scanned,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'suspicious_date' AND i.resolved = 0) AS suspicious_date,
  EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = r.batch_id AND i.pdf_file_id = r.pdf_file_id AND i.type = 'vin_photo_wrong') AS charger_photo`;

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

function sameChars(a, b) {
  let n = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) n++;
  return n;
}

// VIN check — three sources, the file name is the reference:
//   file name VIN (high priority) · photo VIN (must confirm the file name) · paper VIN (form box, low priority)
//   Level 1 "Match 3/3"   file = photo = paper
//   Level 2 "File = Photo" photo confirms the file name, paper VIN differs or is missing
//   Level 3 "Not matched"  photo does not confirm the file name (differs / unreadable / no file VIN)
export const VIN_LEVELS = { 1: 'Match 3/3', 2: 'File = Photo', 3: 'Not matched' };

export function vinConfidence(r) {
  const file = r.file_vin || '';
  const paper = r.paper_vin || '';
  let photo = r.vin_picture || '';
  const reasons = [];
  if (r.vin_confirmed && file) { photo = file; reasons.push('Photo checked and confirmed by admin'); }

  let level;
  let score;
  if (file && photo === file) {
    level = paper === file ? 1 : 2;
    score = level === 1 ? 100 : 90;
    reasons.push(`Photo shows the file name VIN${r.vin_read_by === 'free' ? ' (free reader)' : r.vin_read_by === 'ai' ? ' (AI)' : ''}`);
    reasons.push(paper === file ? 'Paper VIN box matches' : paper ? `Paper VIN box says ${paper}` : 'Paper VIN box not readable');
  } else {
    level = 3;
    if (!file) { score = 40; reasons.push('No valid VIN in the file name'); }
    else if (photo) { score = 30; reasons.push(`Photo reads ${photo}, file name says ${file}`); }
    else { score = 50; reasons.push(r.charger_photo ? 'VIN photo slot shows the charger label' : 'VIN photo not readable'); }
    if (paper && file) reasons.push(paper === file ? 'Paper VIN box matches the file name' : `Paper VIN box says ${paper}`);
  }
  if (r.edited_pdf) reasons.push('PDF may be edited');
  reasons.push(r.in_reference ? 'VIN is in the submission Excel' : 'VIN not in the submission Excel');
  return { level, label: VIN_LEVELS[level], score, reasons };
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
  const fm = folderMonthOk(r.install_date, r.month);
  if (fm === false) { s -= 25; reasons.push(`Not in the folder month (${r.month}) — installed ${r.install_date.slice(0, 7)}`); }
  if (r.suspicious_date) { s -= 40; reasons.push('Date is far from the imported month'); }
  if (r.edited_pdf) { s -= 15; reasons.push('PDF may be edited'); }
  return { score: clamp(s), reasons };
}

// Excel check — look the file name VIN up in the submission Excel (column H "Vinno") and compare the
// PDF customer name with the Excel name (column D). Score = name similarity; 0 when the VIN is absent.
export const EXCEL_STATUS = { match: 'Match', close: 'Close', different: 'Different', missing: 'Not in Excel' };

export function excelCheck(r) {
  if (!r.in_install_sheet) {
    const reasons = [`VIN ${r.vin} not found in the submission Excel`];
    if (r.in_reference) reasons.push('It is on the "charger only" sheet (no installation)');
    return { status: 'missing', score: 0, reasons };
  }
  const where = `Excel ${r.ref_sheet_name ? `sheet "${r.ref_sheet_name}" ` : ''}row ${r.ref_row || '?'}`;
  if (r.name_confirmed) {
    const sim = nameSimilarity(r.customer_name, r.ref_name);
    return { status: 'match', score: 100, reasons: [`VIN found (${where})`, `PDF name: ${r.customer_name || '–'}`, `Excel name: ${r.ref_name || '–'}`,
      `Name checked and confirmed by admin${sim < 95 ? ` (Excel spelling differs, ${sim}%)` : ''}`] };
  }
  const score = nameSimilarity(r.customer_name, r.ref_name);
  const status = score >= 95 ? 'match' : score >= 80 ? 'close' : 'different';
  const reasons = [
    `VIN found (${where})`,
    `PDF name: ${r.customer_name || '–'}`,
    `Excel name: ${r.ref_name || '–'}`,
    status === 'match' ? 'Names match' : status === 'close' ? `Names nearly match (${score}%) — small spelling difference` : `Names differ (${score}%)`,
  ];
  return { status, score, reasons };
}

// Installation month must equal the folder (imported) month. true / false / null (no date or month).
export function folderMonthOk(isoDate, month) {
  if (!isoDate || !month) return null;
  return String(isoDate).slice(0, 7) === month;
}

// Adds VIN level, Excel check and date confidence (with reasons) to a record row.
export function withConfidence(r) {
  const v = vinConfidence(r);
  const d = dateConfidence(r);
  const x = excelCheck(r);
  // Check 2 (Excel baseline) for the Excel row with this VIN.
  const b = r.in_install_sheet
    ? scoreMatch({ vin: r.vin, customer_name: r.ref_name, case_number: r.ref_case, install_date: r.ref_date }, r)
    : { score: 0, band: 'noexcel', parts: null };
  return {
    xl_score: b.score, xl_band: b.band, xl_parts: b.parts,
    ...r, vin_level: v.level, vin_level_label: v.label, vin_conf: v.score, vin_conf_reasons: v.reasons,
    excel_status: x.status, excel_label: EXCEL_STATUS[x.status], excel_conf: x.score, excel_reasons: x.reasons,
    date_conf: d.score, date_conf_reasons: d.reasons,
    // Admin-confirmed dates are accepted even when they are in another month (decision kept in History).
    date_month_ok: r.date_confirmed ? null : folderMonthOk(r.install_date, r.month),
  };
}

// Needs an admin look: Check 1 level 3 (photo does not confirm the file name VIN), Check 2 below 70 %
// or not in the Excel, installation date below 95 %, missing, or not in the folder month.
export const needsReview = (r) => r.vin_level === 3 || r.xl_band === 'low' || r.xl_band === 'noexcel' || r.date_conf < REVIEW_BELOW
  || r.date_month_ok === false || !r.install_date;
