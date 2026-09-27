// GET /api/stats — dashboard totals across all months (from the cached dataset).
import { needsReview } from '../../lib/confidence.js';
import { buildBaseline } from '../../lib/baseline.js';
import { loadAll } from '../../lib/dataset.js';
import { OTHER_PROBLEM_TYPES, json } from '../../lib/server.js';

export async function onRequestGet({ env }) {
  const data = await loadAll(env.DB);
  const scored = data.records;
  const installVins = new Set(data.refs.filter((f) => f.sheet === 'install').map((f) => f.vin));
  const recVins = new Set(scored.map((r) => r.vin));
  const byMonth = new Map();
  for (const r of scored) if (r.install_date) byMonth.set(r.install_date.slice(0, 7), (byMonth.get(r.install_date.slice(0, 7)) || 0) + 1);
  const vin_levels = { 1: 0, 2: 0, 3: 0 };
  const excel = { match: 0, close: 0, different: 0, missing: 0 };
  for (const r of scored) { vin_levels[r.vin_level]++; excel[r.excel_status]++; }
  const base = await buildBaseline(env.DB);
  return json({
    months: data.batches.length,
    records: scored.length,
    ocr_match: scored.filter((r) => r.vin_photo_match === 1).length,
    ocr_mismatch: scored.filter((r) => r.vin_photo_match === 0).length,
    ocr_unread: scored.filter((r) => r.vin_photo_match == null).length,
    open_issues: data.issues.filter((i) => !i.resolved && OTHER_PROBLEM_TYPES.includes(i.type)).length,
    reference_rows: data.refs.filter((f) => f.sheet === 'install').length,
    matched: [...installVins].filter((v) => recVins.has(v)).length,
    to_review: scored.filter(needsReview).length,
    full_conf: scored.filter((r) => r.vin_level === 1 && r.date_conf === 100).length,
    vin_levels, excel,
    baseline: { ...base.facets, pdfonly: base.pdfOnly.length, excel_rows: base.rows.length },
    byInstallMonth: [...byMonth].sort().map(([ym, n]) => ({ ym, n })),
  });
}
