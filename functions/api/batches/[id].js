// PATCH  /api/batches/:id  → update month / status
// DELETE /api/batches/:id  → delete the month and everything imported with it
import { bad, json } from '../../../lib/server.js';

export async function onRequestPatch({ params, request, env }) {
  const id = Number(params.id);
  const body = await request.json().catch(() => ({}));
  const sets = [];
  const vals = [];
  if (body.month !== undefined) {
    if (!/^\d{4}-\d{2}$/.test(body.month)) return bad('Month must be YYYY-MM');
    sets.push('month = ?'); vals.push(body.month);
  }
  if (body.status !== undefined) {
    if (!['running', 'done', 'partial'].includes(body.status)) return bad('Invalid status');
    sets.push('status = ?'); vals.push(body.status);
  }
  if (!sets.length) return bad('Nothing to update');
  await env.DB.prepare(`UPDATE batches SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(...vals, id).run();
  return json({ ok: true });
}

export async function onRequestDelete({ params, env }) {
  const id = Number(params.id);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM records WHERE batch_id = ?').bind(id),
    env.DB.prepare('DELETE FROM reference_rows WHERE batch_id = ?').bind(id),
    env.DB.prepare('DELETE FROM issues WHERE batch_id = ?').bind(id),
    env.DB.prepare('DELETE FROM batch_files WHERE batch_id = ?').bind(id),
    env.DB.prepare('DELETE FROM batches WHERE id = ?').bind(id),
  ]);
  return json({ ok: true });
}
