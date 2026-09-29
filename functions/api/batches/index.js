// GET  /api/batches  → all months with counts
// POST /api/batches  → create or reopen (same folder) a month batch; returns processed file ids for resume
import { bump } from '../../../lib/cache.js';
import { loadAll } from '../../../lib/dataset.js';
import { OTHER_PROBLEM_TYPES, bad, folderIdFromUrl, json } from '../../../lib/server.js';

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

  // Everything computed from the cached dataset (one D1 row read per call while nothing changed).
  const data = await loadAll(env.DB);
  const installKey = new Set(data.refs.filter((f) => f.sheet === 'install').map((f) => `${f.batch_id}|${f.vin}`));
  const installVins = new Set(data.refs.filter((f) => f.sheet === 'install').map((f) => f.vin));
  const recVins = new Set(data.records.map((r) => r.vin));
  const results = [...data.batches].sort((x, y) => y.month.localeCompare(x.month) || y.id - x.id).map((b) => {
    const recs = data.records.filter((r) => r.batch_id === b.id);
    const refs = data.refs.filter((f) => f.batch_id === b.id);
    const files = data.files.filter((f) => f.batch_id === b.id && f.status !== 'replaced');
    const excelProblems = refs.filter((f) => f.sheet === 'install_invalid').length
      + recs.filter((r) => !installKey.has(`${b.id}|${r.vin}`) && installVins.has(r.vin)).length;
    return {
      ...b,
      record_count: recs.length,
      ocr_mismatch_count: recs.filter((r) => r.vin_photo_match === 0).length,
      open_issue_count: data.issues.filter((i) => i.batch_id === b.id && !i.resolved && OTHER_PROBLEM_TYPES.includes(i.type)).length,
      // All Excel install rows, incl. rows without a valid VIN — same count as the Excel.
      reference_count: refs.filter((f) => f.sheet === 'install' || f.sheet === 'install_invalid').length,
      matched_count: refs.filter((f) => f.sheet === 'install' && recVins.has(f.vin)).length,
      processed_count: files.length,
      deleted_count: recs.filter((r) => r.file_status === 'deleted').length,
      updated_count: recs.filter((r) => r.file_status === 'updated').length,
      excel_problem_count: excelProblems,
      date_wrong_month_count: recs.filter((r) => r.date_month_ok === false).length,
      date_missing_count: recs.filter((r) => !r.install_date).length,
      // VIN photo not confirmed (level ③, not confirmed by admin, not a scanned page) — "Re-read not-matched photos".
      vin_reread_count: recs.filter((r) => r.vin_level === 3 && !r.vin_confirmed && !r.scanned).length,
    };
  });
  return json({ batches: results, excel_problems: results.reduce((a2, x) => a2 + x.excel_problem_count, 0) });
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

  await bump(env.DB).run();
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
  // Files whose VIN photo does not confirm the file name (unread or different) and no admin has confirmed —
  // read again with the free reader first, AI only when it still cannot confirm. Scanned pages are skipped.
  const { results: reread } = await env.DB.prepare(`
    SELECT r.pdf_file_id AS file_id FROM records r WHERE r.batch_id = ?1 AND r.vin_confirmed = 0
      AND (r.vin_picture = '' OR r.vin_picture <> r.vin)
      AND NOT EXISTS (SELECT 1 FROM issues i WHERE i.batch_id = ?1 AND i.pdf_file_id = r.pdf_file_id AND i.type = 'scanned_page')`)
    .bind(batch.id).all();
  return json({ batch, doneFileIds: results.map((r) => r.file_id), retryFileIds: retry.map((r) => r.file_id),
    rereadFileIds: reread.map((r) => r.file_id) });
}
