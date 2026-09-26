// GET /api/issues?batch=&type=&resolved=0|1
import { json } from '../../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const where = [];
  const vals = [];
  if (Number(p.get('batch'))) { where.push('i.batch_id = ?'); vals.push(Number(p.get('batch'))); }
  if (p.get('type')) { where.push('i.type = ?'); vals.push(p.get('type')); }
  if (p.get('resolved') === '0' || p.get('resolved') === '1') { where.push('i.resolved = ?'); vals.push(Number(p.get('resolved'))); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT i.*, b.month FROM issues i JOIN batches b ON b.id = i.batch_id ${w} ORDER BY i.resolved, i.type, i.id LIMIT 5000`)
    .bind(...vals).all();
  return json({ issues: results });
}
