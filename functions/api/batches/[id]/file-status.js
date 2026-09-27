// POST /api/batches/:id/file-status { deleted: [fileIds], restored: [fileIds] }
// Marks records whose PDF was removed from the Drive folder as "deleted" (the data is kept), and
// clears that mark when the PDF is back.
import { bump } from '../../../../lib/cache.js';
import { bad, json, runBatched } from '../../../../lib/server.js';

export async function onRequestPost({ params, request, env }) {
  const batchId = Number(params.id);
  const body = await request.json().catch(() => ({}));
  const deleted = (body.deleted || []).map(String).slice(0, 5000);
  const restored = (body.restored || []).map(String).slice(0, 5000);
  if (!deleted.length && !restored.length) return bad('Nothing to update');
  const stmts = [];
  const hist = (id, action, note) => env.DB.prepare(`INSERT INTO record_history (vin, batch_id, field, action, old_value, new_value, note)
    SELECT vin, batch_id, 'file', ?, pdf_file_id, pdf_file_id, ? FROM records WHERE pdf_file_id = ? AND batch_id = ?`).bind(action, note, id, batchId);
  for (const id of deleted) {
    stmts.push(hist(id, 'deleted', 'PDF no longer in the Drive folder — record kept'));
    stmts.push(env.DB.prepare(`UPDATE records SET file_status = 'deleted', file_status_at = datetime('now')
      WHERE pdf_file_id = ? AND batch_id = ? AND file_status != 'deleted'`).bind(id, batchId));
  }
  for (const id of restored) {
    stmts.push(hist(id, 'restored', 'PDF is back in the Drive folder'));
    stmts.push(env.DB.prepare(`UPDATE records SET file_status = '', file_status_at = datetime('now')
      WHERE pdf_file_id = ? AND batch_id = ? AND file_status = 'deleted'`).bind(id, batchId));
  }
  stmts.push(bump(env.DB));
  await runBatched(env.DB, stmts);
  return json({ deleted: deleted.length, restored: restored.length });
}
