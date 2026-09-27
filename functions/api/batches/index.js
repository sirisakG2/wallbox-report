// GET  /api/batches  → all months with counts
// POST /api/batches  → create or reopen (same folder) a month batch; returns processed file ids for resume
import { excelProblems } from '../../../lib/excel-problems.js';
import { OTHER_PROBLEMS_SQL, bad, folderIdFromUrl, json } from '../../../lib/server.js';

export async function onRequestGet({ request, env }) {
  // ?folder=<url or id> → that month's stored files, to compare with what is in Drive now.
  const folder = new URL(request.url).searchParams.get('folder');
  if (folder) {
    const folderId = folderIdFromUrl(folder);
    const batch = folderId && await env.DB.prepare('SELECT * FROM batches WHERE folder_id = ?').bind(folderId).first();
    if (!batch) return json({ batch: null, files: [] });
    const { results } = await env.DB.prepare(
      `SELECT f.file_id, f.name, f.status, f.modified, f.processed_at, r.vin, r.file_status
       FROM batch_files f LEFT JOIN records r ON r.pdf_file_id = f.file_id WHERE f.batch_id = ?`).bind(batch.id).all();
    return json({ batch, files: results });
  }

  const { results } = await env.DB.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM records r WHERE r.batch_id = b.id) AS record_count,
      (SELECT COUNT(*) FROM records r WHERE r.batch_id = b.id AND r.vin_photo_match = 0) AS ocr_mismatch_count,
      (SELECT COUNT(*) FROM issues i WHERE i.batch_id = b.id AND i.resolved = 0 AND i.${OTHER_PROBLEMS_SQL}) AS open_issue_count,
      (SELECT COUNT(*) FROM reference_rows f WHERE f.batch_id = b.id AND f.sheet = 'install') AS reference_count,
      (SELECT COUNT(*) FROM reference_rows f JOIN records r ON r.vin = f.vin
         WHERE f.batch_id = b.id AND f.sheet = 'install') AS matched_count,
      (SELECT COUNT(*) FROM batch_files x WHERE x.batch_id = b.id AND x.status != 'replaced') AS processed_count,
      (SELECT COUNT(*) FROM records r WHERE r.batch_id = b.id AND r.file_status = 'deleted') AS deleted_count,
      (SELECT COUNT(*) FROM records r WHERE r.batch_id = b.id AND r.file_status = 'updated') AS updated_count
    FROM batches b ORDER BY b.month DESC, b.id DESC`).all();
  const xp = await excelProblems(env.DB);
  for (const b of results) b.excel_problem_count = xp.filter((x) => x.batch_id === b.id).length;
  return json({ batches: results, excel_problems: xp.length });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body) return bad('Invalid JSON');
  const folderId = folderIdFromUrl(body.folderUrl);
  if (!folderId) return bad('Invalid Google Drive folder URL');
  if (!/^\d{4}-\d{2}$/.test(body.month || '')) return bad('Month must be YYYY-MM');

  await env.DB.prepare(`
    INSERT INTO batches (month, folder_id, folder_url, folder_name, reference_name, pdf_count, status)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'running')
    ON CONFLICT(folder_id) DO UPDATE SET
      month = excluded.month, folder_url = excluded.folder_url, folder_name = excluded.folder_name,
      reference_name = excluded.reference_name, pdf_count = excluded.pdf_count,
      status = 'running', updated_at = datetime('now')`)
    .bind(body.month, folderId, String(body.folderUrl), String(body.folderName || ''),
      String(body.referenceName || ''), Number(body.pdfCount) || 0)
    .run();

  const batch = await env.DB.prepare('SELECT * FROM batches WHERE folder_id = ?').bind(folderId).first();
  const { results } = await env.DB.prepare('SELECT file_id FROM batch_files WHERE batch_id = ?').bind(batch.id).all();
  // Files worth another try: failed files, and saved records whose VIN photo reading errored
  // (e.g. AI quota ran out). Photos the AI already judged unreadable are not retried.
  const { results: retry } = await env.DB.prepare(`
    SELECT file_id FROM batch_files WHERE batch_id = ?1 AND status = 'error'
    UNION
    SELECT r.pdf_file_id FROM records r WHERE r.batch_id = ?1 AND r.vin_photo_match IS NULL
      AND EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = ?1 AND i.pdf_file_id = r.pdf_file_id
        AND i.type = 'ocr_failed' AND i.detail LIKE 'OCR failed:%')`)
    .bind(batch.id).all();
  return json({ batch, doneFileIds: results.map((r) => r.file_id), retryFileIds: retry.map((r) => r.file_id) });
}
