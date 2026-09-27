// POST /api/batches/:id/records — save a chunk of processed PDFs.
// Body: { items: [{ file: {id, name, modified, size}, record: {...} | null, issues: [{type, detail, vin}],
//                   update?: true (PDF changed in Drive), replaces?: <old file id> (re-uploaded under a new id) }] }
// VIN is the primary key: if the VIN already exists from a different PDF (same or other month),
// the original is kept and a duplicate_vin issue is logged (can be replaced from the Issues tab).
// Re-reading a file never undoes admin review: a confirmed/corrected VIN or date, admin notes and
// resolved issues are carried over to the new reading (also to a re-uploaded copy that replaces it).
import { upsertRecord } from '../../../../lib/db.js';
import { bad, json, runBatched } from '../../../../lib/server.js';

export async function onRequestPost({ params, request, env }) {
  const batchId = Number(params.id);
  const body = await request.json().catch(() => null);
  const items = body?.items;
  if (!Array.isArray(items) || !items.length || items.length > 100) return bad('items must be 1–100 entries');
  const batch = await env.DB.prepare('SELECT id FROM batches WHERE id = ?').bind(batchId).first();
  if (!batch) return bad('Batch not found', 404);

  const db = env.DB;
  const stmts = [];
  const fileIds = items.map((i) => i.file.id);
  const inFiles = fileIds.map(() => '?').join(',');
  const replaced = items.map((i) => i.replaces).filter(Boolean);
  const allIds = [...fileIds, ...replaced];
  const inAll = allIds.map(() => '?').join(',');

  // Records these files produced before, and what an admin already decided for them.
  const { results: reviewed } = await db.prepare(
    `SELECT vin, file_vin, pdf_file_id, vin_confirmed, date_confirmed, install_date, notes FROM records
     WHERE pdf_file_id IN (${inAll})`)
    .bind(...allIds).all();
  const byFile = new Map(reviewed.map((r) => [r.pdf_file_id, r]));
  const { results: resolvedRows } = await db.prepare(
    `SELECT pdf_file_id, type FROM issues WHERE batch_id = ? AND resolved = 1 AND pdf_file_id IN (${inAll})`)
    .bind(batchId, ...allIds).all();
  // A re-uploaded file inherits what was resolved on the file it replaces.
  const oldToNew = new Map(items.filter((i) => i.replaces).map((i) => [i.replaces, i.file.id]));
  const wasResolved = new Set(resolvedRows.map((r) => `${oldToNew.get(r.pdf_file_id) || r.pdf_file_id}|${r.type}`));

  for (const item of items) {
    const prev = item.record && (byFile.get(item.file.id) || (item.replaces && byFile.get(item.replaces)));
    if (!prev) continue;
    const r = item.record;
    if (prev.vin_confirmed && prev.vin !== r.vin) {
      r.vin = prev.vin; // admin-corrected VIN stays
      if (prev.file_vin) r.file_vin = prev.file_vin;
      r.vin_photo_match = r.vin_picture ? (r.vin_picture === r.vin ? 1 : 0) : null;
      for (const is of item.issues || []) is.vin = prev.vin;
    }
    if (prev.date_confirmed) r.install_date = prev.install_date;
    const adminNotes = String(prev.notes || '').split('; ').filter((n) => n.includes('by admin'));
    if (adminNotes.length) r.notes = [r.notes, ...adminNotes].filter(Boolean).join('; ');
  }

  // Re-processing a file replaces the issues it produced earlier (resolved ones stay resolved).
  stmts.push(db.prepare(`DELETE FROM issues WHERE batch_id = ? AND pdf_file_id IN (${inAll})`).bind(batchId, ...allIds));

  const vins = [...new Set(items.map((i) => i.record?.vin).filter(Boolean))];
  const existing = new Map();
  if (vins.length) {
    const { results } = await db.prepare(
      `SELECT r.vin, r.batch_id, r.pdf_file_id, r.pdf_name, b.month FROM records r JOIN batches b ON b.id = r.batch_id
       WHERE r.vin IN (${vins.map(() => '?').join(',')})`).bind(...vins).all();
    for (const row of results) existing.set(row.vin, row);
  }

  let saved = 0, duplicates = 0, errors = 0;
  for (const item of items) {
    const { file, record } = item;
    const issues = [...(item.issues || [])];
    let status = 'error';

    if (record?.vin) {
      const prev = existing.get(record.vin);
      if (!prev || prev.pdf_file_id === file.id || (item.replaces && prev.pdf_file_id === item.replaces)) {
        // Same file previously read with a different (unconfirmed) VIN: the new reading replaces it.
        const beforeId = byFile.has(file.id) ? file.id : item.replaces;
        const before = beforeId && byFile.get(beforeId);
        if (before && before.vin !== record.vin && !before.vin_confirmed) {
          stmts.push(db.prepare('DELETE FROM records WHERE vin = ? AND pdf_file_id = ?').bind(before.vin, beforeId));
        }
        stmts.push(upsertRecord(db, batchId, record));
        if (item.update) {
          stmts.push(db.prepare(`UPDATE records SET file_status = 'updated', file_status_at = datetime('now') WHERE vin = ?`).bind(record.vin));
        }
        if (item.replaces) {
          stmts.push(db.prepare(`UPDATE batch_files SET status = 'replaced' WHERE batch_id = ? AND file_id = ?`).bind(batchId, item.replaces));
        }
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
      stmts.push(db.prepare('INSERT INTO issues (batch_id, vin, pdf_name, pdf_file_id, type, detail, resolved) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(batchId, String(is.vin || record?.vin || ''), file.name, file.id, is.type, String(is.detail || ''),
          wasResolved.has(`${file.id}|${is.type}`) ? 1 : 0));
    }
    stmts.push(db.prepare(`INSERT INTO batch_files (batch_id, file_id, name, status, modified, size, processed_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(batch_id, file_id) DO UPDATE SET status = excluded.status, name = excluded.name,
        modified = excluded.modified, size = excluded.size, processed_at = excluded.processed_at`)
      .bind(batchId, file.id, file.name, status, String(file.modified || ''), Number(file.size) || 0));
  }

  await runBatched(db, stmts);
  return json({ saved, duplicates, errors });
}
