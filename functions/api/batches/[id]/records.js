// POST /api/batches/:id/records — save a chunk of processed PDFs.
// Body: { items: [{ file: {id, name}, record: {...} | null, issues: [{type, detail, vin}] }] }
// VIN is the primary key: if the VIN already exists from a different PDF (same or other month),
// the original is kept and a duplicate_vin issue is logged (can be replaced from the Issues tab).
import { upsertRecord } from '../../../../lib/db.js';
import { bad, json, runBatched } from '../../../../lib/server.js';

export async function onRequestPost({ params, request, env }) {
  const batchId = Number(params.id);
  const body = await request.json().catch(() => null);
  const items = body?.items;
  if (!Array.isArray(items) || !items.length || items.length > 100) return bad('items must be 1–100 entries');
  const batch = await env.DB.prepare('SELECT id FROM batches WHERE id = ?').bind(batchId).first();
  if (!batch) return bad('Batch not found', 404);

  const vins = [...new Set(items.map((i) => i.record?.vin).filter(Boolean))];
  const existing = new Map();
  if (vins.length) {
    const { results } = await env.DB.prepare(
      `SELECT r.vin, r.batch_id, r.pdf_file_id, r.pdf_name, b.month FROM records r JOIN batches b ON b.id = r.batch_id
       WHERE r.vin IN (${vins.map(() => '?').join(',')})`).bind(...vins).all();
    for (const row of results) existing.set(row.vin, row);
  }

  const db = env.DB;
  const stmts = [];
  const fileIds = items.map((i) => i.file.id);
  // Re-processing a file replaces the issues it produced earlier.
  stmts.push(db.prepare(`DELETE FROM issues WHERE batch_id = ? AND pdf_file_id IN (${fileIds.map(() => '?').join(',')})`)
    .bind(batchId, ...fileIds));

  let saved = 0, duplicates = 0, errors = 0;
  for (const item of items) {
    const { file, record } = item;
    const issues = [...(item.issues || [])];
    let status = 'error';

    if (record?.vin) {
      const prev = existing.get(record.vin);
      if (!prev || prev.pdf_file_id === file.id) {
        stmts.push(upsertRecord(db, batchId, record));
        existing.set(record.vin, { vin: record.vin, batch_id: batchId, pdf_file_id: file.id, pdf_name: file.name });
        status = 'saved'; saved++;
      } else {
        issues.push({
          type: 'duplicate_vin',
          vin: record.vin,
          detail: JSON.stringify({
            message: `VIN already recorded from "${prev.pdf_name}"${prev.month ? ` (${prev.month})` : ''}`,
            existing: prev,
            record,
          }),
        });
        status = 'duplicate'; duplicates++;
      }
    } else {
      errors++;
    }

    for (const is of issues) {
      stmts.push(db.prepare('INSERT INTO issues (batch_id, vin, pdf_name, pdf_file_id, type, detail) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(batchId, String(is.vin || record?.vin || ''), file.name, file.id, is.type, String(is.detail || '')));
    }
    stmts.push(db.prepare(`INSERT INTO batch_files (batch_id, file_id, name, status) VALUES (?, ?, ?, ?)
      ON CONFLICT(batch_id, file_id) DO UPDATE SET status = excluded.status, name = excluded.name`)
      .bind(batchId, file.id, file.name, status));
  }

  await runBatched(db, stmts);
  return json({ saved, duplicates, errors });
}
