// GET /api/records?batch=&q=&match=(0|1|null)&from=&to=&conf=(review|full)&vinlevel=(1|2|3)&fstatus=(updated|deleted)&page=1&size=50   (size=all for export)
// Every record carries vin_conf / date_conf (0–100) with reasons. conf=review lists records below
// 95 % (lowest first) so an admin can open the PDF and confirm or correct them.
import { CONFIDENCE_COLUMNS, needsReview, withConfidence } from '../../../lib/confidence.js';
import { json } from '../../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const where = [];
  const vals = [];
  const batch = Number(p.get('batch'));
  if (batch) { where.push('r.batch_id = ?'); vals.push(batch); }
  const q = (p.get('q') || '').trim();
  if (q) {
    where.push('(r.vin LIKE ? OR r.customer_name LIKE ? OR r.job_number LIKE ? OR r.serial LIKE ? OR r.phone LIKE ? OR r.vin_picture LIKE ?)');
    vals.push(...Array(6).fill(`%${q}%`));
  }
  const match = p.get('match');
  if (match === '0' || match === '1') { where.push('r.vin_photo_match = ?'); vals.push(Number(match)); }
  if (match === 'null') where.push('r.vin_photo_match IS NULL');
  if (p.get('from')) { where.push('r.install_date >= ?'); vals.push(p.get('from')); }
  if (p.get('to')) { where.push('r.install_date <= ?'); vals.push(p.get('to')); }
  const fstatus = p.get('fstatus');
  if (fstatus === 'updated' || fstatus === 'deleted') { where.push('r.file_status = ?'); vals.push(fstatus); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { results } = await env.DB.prepare(
    `SELECT r.*, b.month, ${CONFIDENCE_COLUMNS} FROM records r JOIN batches b ON b.id = r.batch_id ${w}
     ORDER BY r.install_date DESC, r.vin`).bind(...vals).all();
  let rows = results.map(withConfidence);

  const conf = p.get('conf');
  if (conf === 'review') {
    rows = rows.filter(needsReview)
      .sort((a, b) => b.vin_level - a.vin_level || a.date_conf - b.date_conf);
  } else if (conf === 'full') {
    rows = rows.filter((r) => r.vin_level === 1 && r.date_conf === 100);
  }
  const level = Number(p.get('vinlevel'));
  if (level >= 1 && level <= 3) rows = rows.filter((r) => r.vin_level === level);

  const total = rows.length;
  const all = p.get('size') === 'all';
  const size = all ? total || 1 : Math.min(Math.max(Number(p.get('size')) || 50, 1), 500);
  const page = all ? 1 : Math.max(Number(p.get('page')) || 1, 1);
  return json({ total, page, size, records: rows.slice((page - 1) * size, page * size) });
}
