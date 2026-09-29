// Admin approval for an Excel row that has no valid VIN (Check 2 "⚠ No valid VIN in Excel").
// POST   /api/excel-fixes  { batch_id, sheet_name, row_no, vin, remark }  → the row uses this VIN, status Complete (by admin)
// DELETE /api/excel-fixes  { batch_id, sheet_name, row_no }                → remove the approval
// The VIN must be the file name VIN of a PDF in the same month folder. Every change is written to record_history.
import { bump } from '../../lib/cache.js';
import { VIN_RE, bad, json, normalizeVin } from '../../lib/server.js';

async function excelRow(db, b) {
  return db.prepare(`SELECT * FROM reference_rows WHERE batch_id = ? AND sheet_name = ? AND row_no = ? AND sheet = 'install_invalid'`)
    .bind(Number(b.batch_id), String(b.sheet_name ?? ''), Number(b.row_no)).first();
}

export async function onRequestPost({ request, env }) {
  const db = env.DB;
  const b = await request.json().catch(() => ({}));
  const vin = normalizeVin(b.vin);
  const remark = String(b.remark || '').replace(/\s+/g, ' ').trim();
  if (!VIN_RE.test(vin)) return bad('VIN must be 17 characters (letters except I, O, Q and digits)');
  if (remark.length < 3 || remark.length > 500) return bad('Please write a remark (3–500 characters)');
  const row = await excelRow(db, b);
  if (!row) return bad('This Excel row has no invalid VIN any more — re-open Excel Check', 404);
  const pdf = await db.prepare(`SELECT vin, pdf_file_id, pdf_name FROM records WHERE batch_id = ? AND (file_vin = ?2 OR (file_vin = '' AND vin = ?2)) AND file_status <> 'deleted'`)
    .bind(row.batch_id, vin).first();
  if (!pdf) return bad(`No PDF in this month folder has ${vin} in its file name`);
  const taken = await db.prepare(`SELECT row_no FROM reference_rows WHERE batch_id = ? AND sheet = 'install' AND vin = ?`).bind(row.batch_id, vin).first();
  if (taken) return bad(`${vin} is already on Excel row ${taken.row_no}`, 409);
  const other = await db.prepare(`SELECT row_no FROM excel_fixes WHERE batch_id = ? AND vin = ? AND NOT (sheet_name = ? AND row_no = ?)`)
    .bind(row.batch_id, vin, row.sheet_name, row.row_no).first();
  if (other) return bad(`${vin} is already approved for Excel row ${other.row_no}`, 409);
  const ip = request.headers.get('cf-connecting-ip') || '';
  await db.batch([
    db.prepare(`INSERT INTO excel_fixes (batch_id, sheet_name, row_no, excel_vin_raw, customer_name, vin, remark, pdf_file_id, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (batch_id, sheet_name, row_no) DO UPDATE SET vin = excluded.vin, remark = excluded.remark,
        pdf_file_id = excluded.pdf_file_id, excel_vin_raw = excluded.excel_vin_raw, customer_name = excluded.customer_name,
        ip = excluded.ip, at = datetime('now')`)
      .bind(row.batch_id, row.sheet_name, row.row_no, row.vin, row.customer_name, vin, remark, pdf.pdf_file_id, ip),
    db.prepare(`INSERT INTO record_history (vin, batch_id, field, action, old_value, new_value, note, ip) VALUES (?, ?, 'excel_vin', 'approve', ?, ?, ?, ?)`)
      .bind(pdf.vin, row.batch_id, row.vin || '(empty)', vin, `Excel row ${row.row_no}: ${remark}`, ip),
    bump(db),
  ]);
  return json({ ok: true, vin, pdf_vin: pdf.vin });
}

export async function onRequestDelete({ request, env }) {
  const db = env.DB;
  const b = await request.json().catch(() => ({}));
  const fix = await db.prepare('SELECT * FROM excel_fixes WHERE batch_id = ? AND sheet_name = ? AND row_no = ?')
    .bind(Number(b.batch_id), String(b.sheet_name ?? ''), Number(b.row_no)).first();
  if (!fix) return bad('No approval for this Excel row', 404);
  const ip = request.headers.get('cf-connecting-ip') || '';
  await db.batch([
    db.prepare('DELETE FROM excel_fixes WHERE id = ?').bind(fix.id),
    db.prepare(`INSERT INTO record_history (vin, batch_id, field, action, old_value, new_value, note, ip) VALUES (?, ?, 'excel_vin', 'unapprove', ?, ?, ?, ?)`)
      .bind(fix.vin, fix.batch_id, fix.vin, fix.excel_vin_raw || '(empty)', `Excel row ${fix.row_no}: approval removed`, ip),
    bump(db),
  ]);
  return json({ ok: true });
}
