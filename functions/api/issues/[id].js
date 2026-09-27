// PATCH /api/issues/:id  { resolved: 0|1 }
// POST  /api/issues/:id  { action: "replace" } — for duplicate_vin: replace the stored record with this PDF's data
import { bump } from '../../../lib/cache.js';
import { upsertRecord } from '../../../lib/db.js';
import { bad, json } from '../../../lib/server.js';

export async function onRequestPatch({ params, request, env }) {
  const body = await request.json().catch(() => ({}));
  await env.DB.batch([
    env.DB.prepare('UPDATE issues SET resolved = ? WHERE id = ?').bind(body.resolved ? 1 : 0, Number(params.id)),
    bump(env.DB),
  ]);
  return json({ ok: true });
}

export async function onRequestPost({ params, request, env }) {
  const body = await request.json().catch(() => ({}));
  if (body.action !== 'replace') return bad('Unknown action');
  const issue = await env.DB.prepare('SELECT * FROM issues WHERE id = ?').bind(Number(params.id)).first();
  if (!issue || issue.type !== 'duplicate_vin') return bad('Only duplicate VIN issues can be replaced');
  let detail;
  try { detail = JSON.parse(issue.detail); } catch { return bad('Issue has no record data'); }
  if (!detail?.record?.vin) return bad('Issue has no record data');

  const prev = detail.existing || {};
  await env.DB.batch([
    upsertRecord(env.DB, issue.batch_id, detail.record),
    env.DB.prepare('UPDATE issues SET resolved = 1 WHERE id = ?').bind(issue.id),
    env.DB.prepare(`UPDATE batch_files SET status = 'saved' WHERE batch_id = ? AND file_id = ?`).bind(issue.batch_id, issue.pdf_file_id),
    // The replaced PDF becomes the duplicate now.
    env.DB.prepare(`UPDATE batch_files SET status = 'duplicate' WHERE batch_id = ? AND file_id = ?`)
      .bind(prev.batch_id ?? -1, prev.pdf_file_id ?? ''),
    bump(env.DB),
  ]);
  return json({ ok: true });
}
