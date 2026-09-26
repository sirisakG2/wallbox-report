// PATCH /api/records/:vin { install_date: "YYYY-MM-DD" } — admin correction of the installation date.
// Keeps the original reading in notes and resolves the record's date issues.
import { bad, json } from '../../../lib/server.js';

export async function onRequestPatch({ params, request, env }) {
  const vin = String(params.vin || '').toUpperCase();
  const body = await request.json().catch(() => ({}));
  const iso = String(body.install_date || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const valid = m && new Date(`${iso}T00:00:00Z`).getUTCDate() === Number(m[3]) && +m[1] >= 2015 && +m[1] <= 2100;
  if (!valid) return bad('Date must be a real date as YYYY-MM-DD');

  const rec = await env.DB.prepare('SELECT vin, install_date, install_date_raw, notes FROM records WHERE vin = ?').bind(vin).first();
  if (!rec) return bad('Record not found', 404);
  const note = `Date corrected by admin: ${rec.install_date || 'unreadable'} → ${iso} (PDF says "${rec.install_date_raw}")`;
  await env.DB.batch([
    env.DB.prepare(`UPDATE records SET install_date = ?, notes = CASE WHEN notes = '' THEN ? ELSE notes || '; ' || ? END,
      updated_at = datetime('now') WHERE vin = ?`).bind(iso, note, note, vin),
    env.DB.prepare(`UPDATE issues SET resolved = 1 WHERE vin = ? AND type IN ('bad_date', 'suspicious_date')`).bind(vin),
  ]);
  return json({ ok: true });
}
