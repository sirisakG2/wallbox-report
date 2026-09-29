// GET /api/stats?batch= — dashboard totals across all months, or one month (from the cached dataset).
import { needsReview } from '../../lib/confidence.js';
import { buildBaseline } from '../../lib/baseline.js';
import { loadAll } from '../../lib/dataset.js';
import { OTHER_PROBLEM_TYPES, json } from '../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const batch = Number(new URL(request.url).searchParams.get('batch')) || null;
  const data = await loadAll(env.DB);
  const inScope = (x) => !batch || x.batch_id === batch;
  const scored = data.records.filter(inScope);
  const refs = data.refs.filter(inScope);
  const installVins = new Set(refs.filter((f) => f.sheet === 'install').map((f) => f.vin));
  const recVins = new Set(scored.map((r) => r.vin));
  const byMonth = new Map();
  for (const r of scored) if (r.install_date) byMonth.set(r.install_date.slice(0, 7), (byMonth.get(r.install_date.slice(0, 7)) || 0) + 1);
  const vin_levels = { 1: 0, 2: 0, 3: 0 };
  const excel = { match: 0, close: 0, different: 0, missing: 0 };
  for (const r of scored) { vin_levels[r.vin_level]++; excel[r.excel_status]++; }
  const base = await buildBaseline(env.DB, batch);
  return json({
    months: batch ? 1 : data.batches.length,
    records: scored.length,
    ocr_match: scored.filter((r) => r.vin_photo_match === 1).length,
    ocr_mismatch: scored.filter((r) => r.vin_photo_match === 0).length,
    ocr_unread: scored.filter((r) => r.vin_photo_match == null).length,
    open_issues: data.issues.filter((i) => inScope(i) && !i.resolved && OTHER_PROBLEM_TYPES.includes(i.type)).length,
    reference_rows: refs.filter((f) => f.sheet === 'install' || f.sheet === 'install_invalid').length,
    matched: [...installVins].filter((v) => recVins.has(v)).length,
    to_review: scored.filter(needsReview).length,
    full_conf: scored.filter((r) => r.vin_level === 1 && r.date_conf === 100).length,
    vin_levels, excel,
    date_wrong_month: scored.filter((r) => r.date_month_ok === false).length,
    date_missing: scored.filter((r) => !r.install_date).length,
    baseline: { ...base.facets, pdfonly: base.pdfOnly.length, excel_rows: base.rows.length },
    byInstallMonth: [...byMonth].sort().map(([ym, n]) => ({ ym, n })),
  });
}
