// PATCH /api/records/:vin — admin review after opening the PDF.
//   { install_date: "YYYY-MM-DD" }  correct the installation date (→ date confirmed)
//   { confirm_date: true }           date is right as read (→ 100 %)
//   { new_vin: "L1NN…" }             correct the VIN (primary key; must not exist yet) (→ VIN confirmed)
//   { confirm_vin: true }            VIN is right as read (→ 100 %)
// The original reading is kept in notes; related date/VIN issues are resolved.
import { VIN_RE, bad, json, normalizeVin } from '../../../lib/server.js';

const noteSql = `notes = CASE WHEN notes = '' THEN ?1 ELSE notes || '; ' || ?1 END`;

export async function onRequestPatch({ params, request, env }) {
  const vin = String(params.vin || '').toUpperCase();
  const body = await request.json().catch(() => ({}));
  const rec = await env.DB.prepare('SELECT vin, install_date, install_date_raw, batch_id FROM records WHERE vin = ?').bind(vin).first();
  if (!rec) return bad('Record not found', 404);
  const db = env.DB;
  const stmts = [];

  if (body.install_date !== undefined) {
    const iso = String(body.install_date || '');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    const valid = m && new Date(`${iso}T00:00:00Z`).getUTCDate() === Number(m[3]) && +m[1] >= 2015 && +m[1] <= 2100;
    if (!valid) return bad('Date must be a real date as YYYY-MM-DD');
    const note = `Date corrected by admin: ${rec.install_date || 'unreadable'} → ${iso} (PDF says "${rec.install_date_raw}")`;
    stmts.push(db.prepare(`UPDATE records SET install_date = ?2, date_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?3`).bind(note, iso, vin));
  }
  if (body.confirm_date) {
    if (!rec.install_date) return bad('There is no date to confirm — enter the correct date instead');
    stmts.push(db.prepare(`UPDATE records SET date_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?2`)
      .bind(`Date ${rec.install_date} confirmed by admin`, vin));
  }
  if (body.install_date !== undefined || body.confirm_date) {
    stmts.push(db.prepare(`UPDATE issues SET resolved = 1 WHERE vin = ? AND type IN ('bad_date', 'suspicious_date')`).bind(vin));
  }

  let finalVin = vin;
  if (body.new_vin !== undefined) {
    const nv = normalizeVin(body.new_vin);
    if (!VIN_RE.test(nv)) return bad('VIN must be 17 characters (letters except I, O, Q and digits)');
    if (nv !== vin) {
      const clash = await db.prepare('SELECT vin FROM records WHERE vin = ?').bind(nv).first();
      if (clash) return bad(`VIN ${nv} already exists as another record`, 409);
      stmts.push(db.prepare(`UPDATE records SET vin = ?2, vin_confirmed = 1, vin_photo_match = CASE WHEN vin_picture = ?2 THEN 1 ELSE vin_photo_match END,
        ${noteSql}, updated_at = datetime('now') WHERE vin = ?3`).bind(`VIN corrected by admin: ${vin} → ${nv}`, nv, vin));
      stmts.push(db.prepare('UPDATE issues SET vin = ? WHERE vin = ?').bind(nv, vin));
      finalVin = nv;
    } else {
      stmts.push(db.prepare(`UPDATE records SET vin_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?2`).bind(`VIN ${vin} confirmed by admin`, vin));
    }
  }
  if (body.confirm_vin) {
    stmts.push(db.prepare(`UPDATE records SET vin_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?2`).bind(`VIN ${vin} confirmed by admin`, vin));
  }
  if (body.new_vin !== undefined || body.confirm_vin) {
    stmts.push(db.prepare(`UPDATE issues SET resolved = 1 WHERE vin = ? AND type IN ('ocr_mismatch', 'ocr_failed', 'missing_vin', 'filename_vin')`).bind(finalVin));
  }

  if (!stmts.length) return bad('Nothing to update');
  await db.batch(stmts);
  return json({ ok: true, vin: finalVin });
}
