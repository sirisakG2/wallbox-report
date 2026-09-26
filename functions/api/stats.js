// GET /api/stats — dashboard totals across all months
import { json } from '../../lib/server.js';

export async function onRequestGet({ env }) {
  const row = await env.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM batches) AS months,
      (SELECT COUNT(*) FROM records) AS records,
      (SELECT COUNT(*) FROM records WHERE vin_photo_match = 1) AS ocr_match,
      (SELECT COUNT(*) FROM records WHERE vin_photo_match = 0) AS ocr_mismatch,
      (SELECT COUNT(*) FROM records WHERE vin_photo_match IS NULL) AS ocr_unread,
      (SELECT COUNT(*) FROM issues WHERE resolved = 0) AS open_issues,
      (SELECT COUNT(*) FROM reference_rows WHERE sheet = 'install') AS reference_rows,
      (SELECT COUNT(DISTINCT f.vin) FROM reference_rows f JOIN records r ON r.vin = f.vin WHERE f.sheet = 'install') AS matched
  `).first();
  const { results: byMonth } = await env.DB.prepare(
    `SELECT substr(install_date, 1, 7) AS ym, COUNT(*) AS n FROM records WHERE install_date != '' GROUP BY ym ORDER BY ym`).all();
  return json({ ...row, byInstallMonth: byMonth });
}
