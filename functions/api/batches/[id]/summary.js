// GET /api/batches/:id/summary — import result table for one month, computed live from D1.
import { CONFIDENCE_COLUMNS, withConfidence } from '../../../../lib/confidence.js';
import { bad, json } from '../../../../lib/server.js';

// Workers AI error when the daily free neuron allocation is used up (code 4006).
const QUOTA = `(i.detail LIKE '%4006%' OR i.detail LIKE '%allocation%')`;

export async function onRequestGet({ params, env }) {
  const id = Number(params.id);
  const batch = await env.DB.prepare('SELECT * FROM batches WHERE id = ?').bind(id).first();
  if (!batch) return bad('Batch not found', 404);

  const row = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1) AS saved,
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1 AND vin_photo_match = 1) AS vin_match,
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1 AND vin_photo_match = 0) AS vin_mismatch,
      (SELECT COUNT(*) FROM records r WHERE r.batch_id = ?1 AND r.vin_photo_match IS NULL AND EXISTS
         (SELECT 1 FROM issues i WHERE i.batch_id = ?1 AND i.pdf_file_id = r.pdf_file_id AND i.type = 'ocr_failed' AND ${QUOTA})) AS unread_quota,
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1 AND vin_photo_match IS NULL) AS unread_all,
      (SELECT COUNT(*) FROM batch_files WHERE batch_id = ?1 AND status = 'error') AS failed,
      (SELECT COUNT(*) FROM batch_files f WHERE f.batch_id = ?1 AND f.status = 'error' AND EXISTS
         (SELECT 1 FROM issues i WHERE i.batch_id = ?1 AND i.pdf_file_id = f.file_id AND i.type = 'error' AND ${QUOTA})) AS failed_quota,
      (SELECT COUNT(*) FROM batch_files WHERE batch_id = ?1 AND status = 'duplicate') AS duplicates,
      (SELECT COUNT(*) FROM batch_files WHERE batch_id = ?1 AND status != 'replaced') AS processed,
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1 AND file_status = 'updated') AS updated_files,
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1 AND file_status = 'deleted') AS deleted_files,
      (SELECT COUNT(*) FROM issues WHERE batch_id = ?1 AND type = 'scanned_page') AS scanned,
      (SELECT COUNT(*) FROM issues WHERE batch_id = ?1 AND type = 'missing_vin') AS missing_vin,
      (SELECT COUNT(*) FROM issues WHERE batch_id = ?1 AND type = 'bad_date') AS bad_date,
      (SELECT COUNT(*) FROM issues WHERE batch_id = ?1 AND type = 'vin_photo_wrong') AS charger_photo,
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1 AND vin_read_by = 'free') AS read_free,
      (SELECT COUNT(*) FROM records WHERE batch_id = ?1 AND vin_read_by = 'ai') AS read_ai,
      (SELECT COUNT(*) FROM issues WHERE batch_id = ?1 AND ${QUOTA.replace(/i\./g, '')}) AS quota_hits`)
    .bind(id).first();

  const { results: recs } = await env.DB.prepare(`SELECT r.*, ${CONFIDENCE_COLUMNS} FROM records r WHERE r.batch_id = ?`).bind(id).all();
  const levels = { 1: 0, 2: 0, 3: 0 };
  const excel = { match: 0, close: 0, different: 0, missing: 0 };
  for (const r of recs) { const x = withConfidence(r); levels[x.vin_level]++; excel[x.excel_status]++; }
  return json({
    batch,
    counts: { ...row, unread_other: row.unread_all - row.unread_quota, vin_l1: levels[1], vin_l2: levels[2], vin_l3: levels[3],
      xl_match: excel.match, xl_close: excel.close, xl_diff: excel.different, xl_missing: excel.missing },
    quotaReached: row.quota_hits > 0,
  });
}
