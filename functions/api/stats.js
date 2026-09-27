// GET /api/stats — dashboard totals across all months
import { CONFIDENCE_COLUMNS, needsReview, withConfidence } from '../../lib/confidence.js';
import { buildBaseline } from '../../lib/baseline.js';
import { OTHER_PROBLEMS_SQL, json } from '../../lib/server.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM batches) AS months,
      (SELECT COUNT(*) FROM records) AS records,
      (SELECT COUNT(*) FROM records WHERE vin_photo_match = 1) AS ocr_match,
      (SELECT COUNT(*) FROM records WHERE vin_photo_match = 0) AS ocr_mismatch,
      (SELECT COUNT(*) FROM records WHERE vin_photo_match IS NULL) AS ocr_unread,
      (SELECT COUNT(*) FROM issues WHERE resolved = 0 AND ${OTHER_PROBLEMS_SQL}) AS open_issues,
      (SELECT COUNT(*) FROM reference_rows WHERE sheet = 'install') AS reference_rows,
      (SELECT COUNT(DISTINCT f.vin) FROM reference_rows f JOIN records r ON r.vin = f.vin WHERE f.sheet = 'install') AS matched
  `).first();
  const { results: byMonth } = await env.DB.prepare(
    `SELECT substr(install_date, 1, 7) AS ym, COUNT(*) AS n FROM records WHERE install_date != '' GROUP BY ym ORDER BY ym`).all();
  const { results: recs } = await env.DB.prepare(`SELECT r.*, ${CONFIDENCE_COLUMNS} FROM records r`).all();
  const scored = recs.map(withConfidence);
  const to_review = scored.filter(needsReview).length;
  const full_conf = scored.filter((r) => r.vin_level === 1 && r.date_conf === 100).length;
  const vin_levels = { 1: 0, 2: 0, 3: 0 };
  const excel = { match: 0, close: 0, different: 0, missing: 0 };
  for (const r of scored) { vin_levels[r.vin_level]++; excel[r.excel_status]++; }
  const base = await buildBaseline(env.DB);
  const baseline = { ...base.facets, pdfonly: base.pdfOnly.length, excel_rows: base.rows.length };
  return json({ ...row, to_review, full_conf, vin_levels, excel, baseline, byInstallMonth: byMonth });
}
