// Admin review of one record, after opening the PDF / the submission Excel.
// PATCH /api/records/:vin
//   { install_date: "YYYY-MM-DD" }  correct the installation date        (→ date confirmed)
//   { confirm_date: true }           the date is right as read            (→ 100 %)
//   { new_vin: "L1NN…" }             correct the VIN (primary key; must not exist yet)
//   { confirm_vin: true }            the photo shows this VIN             (→ confirmed)
//   { customer_name: "…" }           correct the customer name            (→ name confirmed)
//   { confirm_name: true }           the customer name is right as read   (→ 100 %)
// Every change is written to record_history (old → new value, time, IP); related issues are resolved.
// GET /api/records/:vin → { record, history }
import { bump } from '../../../lib/cache.js';
import { VIN_RE, bad, json, normalizeVin } from '../../../lib/server.js';

const noteSql = `notes = CASE WHEN notes = '' THEN ?1 ELSE notes || '; ' || ?1 END`;

export async function onRequestGet({ params, env }) {
  const vin = String(params.vin || '').toUpperCase();
  const record = await env.DB.prepare('SELECT * FROM records WHERE vin = ?').bind(vin).first();
  const { results: history } = await env.DB.prepare(
    'SELECT * FROM record_history WHERE vin = ? ORDER BY at DESC, id DESC LIMIT 200').bind(vin).all();
  return json({ record, history });
}

export async function onRequestPatch({ params, request, env }) {
  const vin = String(params.vin || '').toUpperCase();
  const body = await request.json().catch(() => ({}));
  const rec = await env.DB.prepare('SELECT * FROM records WHERE vin = ?').bind(vin).first();
  if (!rec) return bad('Record not found', 404);
  const db = env.DB;
  const ip = request.headers.get('cf-connecting-ip') || '';
  const stmts = [];
  const log = (field, action, oldValue, newValue, note = '', key = vin) => stmts.push(db.prepare(
    `INSERT INTO record_history (vin, batch_id, field, action, old_value, new_value, note, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(key, rec.batch_id, field, action, String(oldValue ?? ''), String(newValue ?? ''), note, ip));

  // ---- installation date
  if (body.install_date !== undefined) {
    const iso = String(body.install_date || '');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    const valid = m && new Date(`${iso}T00:00:00Z`).getUTCDate() === Number(m[3]) && +m[1] >= 2015 && +m[1] <= 2100;
    if (!valid) return bad('Date must be a real date as YYYY-MM-DD');
    const note = `Date corrected by admin: ${rec.install_date || 'unreadable'} → ${iso} (PDF says "${rec.install_date_raw}")`;
    stmts.push(db.prepare(`UPDATE records SET install_date = ?2, date_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?3`).bind(note, iso, vin));
    log('install_date', 'correct', rec.install_date, iso, `PDF says "${rec.install_date_raw}"`);
  }
  if (body.confirm_date) {
    if (!rec.install_date) return bad('There is no date to confirm — enter the correct date instead');
    stmts.push(db.prepare(`UPDATE records SET date_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?2`)
      .bind(`Date ${rec.install_date} confirmed by admin`, vin));
    log('install_date', 'confirm', rec.install_date, rec.install_date);
  }
  if (body.install_date !== undefined || body.confirm_date) {
    stmts.push(db.prepare(`UPDATE issues SET resolved = 1 WHERE vin = ? AND type IN ('bad_date', 'suspicious_date')`).bind(vin));
  }

  // ---- customer name
  if (body.customer_name !== undefined) {
    const name = String(body.customer_name || '').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 200) return bad('Customer name must be 2–200 characters');
    const note = `Name corrected by admin: "${rec.customer_name}" → "${name}"`;
    stmts.push(db.prepare(`UPDATE records SET customer_name = ?2, name_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?3`).bind(note, name, vin));
    log('customer_name', 'correct', rec.customer_name, name, body.source ? `Taken from ${body.source}` : '');
  }
  if (body.confirm_name) {
    stmts.push(db.prepare(`UPDATE records SET name_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?2`)
      .bind(`Name "${rec.customer_name}" confirmed by admin`, vin));
    log('customer_name', 'confirm', rec.customer_name, rec.customer_name);
  }

  // ---- VIN (last, because it can change the key)
  let finalVin = vin;
  if (body.new_vin !== undefined) {
    const nv = normalizeVin(body.new_vin);
    if (!VIN_RE.test(nv)) return bad('VIN must be 17 characters (letters except I, O, Q and digits)');
    if (nv !== vin) {
      const clash = await db.prepare('SELECT vin FROM records WHERE vin = ?').bind(nv).first();
      if (clash) return bad(`VIN ${nv} already exists as another record`, 409);
      log('vin', 'correct', vin, nv, '', nv);
      stmts.push(db.prepare(`UPDATE records SET vin = ?2, file_vin = ?2, vin_confirmed = 1, vin_photo_match = CASE WHEN vin_picture = ?2 THEN 1 ELSE vin_photo_match END,
        ${noteSql}, updated_at = datetime('now') WHERE vin = ?3`).bind(`VIN corrected by admin: ${vin} → ${nv}`, nv, vin));
      stmts.push(db.prepare('UPDATE issues SET vin = ? WHERE vin = ?').bind(nv, vin));
      stmts.push(db.prepare('UPDATE record_history SET vin = ? WHERE vin = ?').bind(nv, vin));
      finalVin = nv;
    } else {
      stmts.push(db.prepare(`UPDATE records SET vin_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?2`).bind(`VIN ${vin} confirmed by admin`, vin));
      log('vin', 'confirm', vin, vin);
    }
  }
  if (body.confirm_vin) {
    stmts.push(db.prepare(`UPDATE records SET vin_confirmed = 1, ${noteSql}, updated_at = datetime('now') WHERE vin = ?2`).bind(`VIN ${vin} confirmed by admin`, vin));
    log('vin', 'confirm', vin, vin, 'Photo shows this VIN');
  }
  if (body.new_vin !== undefined || body.confirm_vin) {
    stmts.push(db.prepare(`UPDATE issues SET resolved = 1 WHERE vin = ? AND type IN ('ocr_mismatch', 'ocr_failed', 'missing_vin', 'filename_vin')`).bind(finalVin));
  }

  if (!stmts.length) return bad('Nothing to update');
  stmts.push(bump(db));
  await db.batch(stmts);
  return json({ ok: true, vin: finalVin });
}
