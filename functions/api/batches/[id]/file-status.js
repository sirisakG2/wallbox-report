// POST /api/batches/:id/file-status { deleted: [fileIds], restored: [fileIds] }
// Marks records whose PDF was removed from the Drive folder as "deleted" (the data is kept), and
// clears that mark when the PDF is back.
import { bad, json, runBatched } from '../../../../lib/server.js';

export async function onRequestPost({ params, request, env }) {
  const batchId = Number(params.id);
  const body = await request.json().catch(() => ({}));
  const deleted = (body.deleted || []).map(String).slice(0, 5000);
  const restored = (body.restored || []).map(String).slice(0, 5000);
  if (!deleted.length && !restored.length) return bad('Nothing to update');
  const stmts = [];
  for (const id of deleted) {
    stmts.push(env.DB.prepare(`UPDATE records SET file_status = 'deleted', file_status_at = datetime('now')
      WHERE pdf_file_id = ? AND batch_id = ? AND file_status != 'deleted'`).bind(id, batchId));
  }
  for (const id of restored) {
    stmts.push(env.DB.prepare(`UPDATE records SET file_status = '', file_status_at = datetime('now')
      WHERE pdf_file_id = ? AND batch_id = ? AND file_status = 'deleted'`).bind(id, batchId));
  }
  await runBatched(env.DB, stmts);
  return json({ deleted: deleted.length, restored: restored.length });
}
