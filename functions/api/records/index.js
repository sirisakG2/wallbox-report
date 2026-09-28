// GET /api/records?batch=&q=&match=(0|1|null)&from=&to=&conf=(review|full)&vinlevel=(1|2|3)
//   &excel=(match|close|different|missing)&xlband=(full|high|medium|low|noexcel)&fstatus=(updated|deleted)&datemonth=(wrong|missing)&page=1&size=50
// (size=all for export). Rows come from the cached dataset (lib/dataset.js) and are filtered in memory.
import { needsReview } from '../../../lib/confidence.js';
import { loadAll } from '../../../lib/dataset.js';
import { json } from '../../../lib/server.js';

const SEARCH = ['vin', 'customer_name', 'job_number', 'serial', 'phone', 'vin_picture', 'file_vin', 'paper_vin'];

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const { records } = await loadAll(env.DB);
  let rows = records;
  const batch = Number(p.get('batch'));
  if (batch) rows = rows.filter((r) => r.batch_id === batch);
  const q = (p.get('q') || '').trim().toLowerCase();
  if (q) rows = rows.filter((r) => SEARCH.some((k) => String(r[k] || '').toLowerCase().includes(q)));
  const match = p.get('match');
  if (match === '0' || match === '1') rows = rows.filter((r) => r.vin_photo_match === Number(match));
  if (match === 'null') rows = rows.filter((r) => r.vin_photo_match == null);
  if (p.get('from')) rows = rows.filter((r) => r.install_date >= p.get('from'));
  if (p.get('to')) rows = rows.filter((r) => r.install_date && r.install_date <= p.get('to'));
  const dm = p.get('datemonth');
  if (dm === 'wrong') rows = rows.filter((r) => r.date_month_ok === false);
  if (dm === 'missing') rows = rows.filter((r) => !r.install_date);
  const fstatus = p.get('fstatus');
  if (fstatus === 'updated' || fstatus === 'deleted') rows = rows.filter((r) => r.file_status === fstatus);
  rows = [...rows].sort((a, b) => (b.install_date || '').localeCompare(a.install_date || '') || a.vin.localeCompare(b.vin));

  // Counts per check result for the rows matching the other filters (for the filter chips).
  const facets = { vin: { 1: 0, 2: 0, 3: 0 }, excel: { match: 0, close: 0, different: 0, missing: 0 }, xl: { full: 0, high: 0, medium: 0, low: 0, noexcel: 0 }, review: 0, date_wrong: 0, date_missing: 0 };
  for (const r of rows) {
    facets.vin[r.vin_level]++; facets.excel[r.excel_status]++; facets.xl[r.xl_band]++;
    if (needsReview(r)) facets.review++;
    if (r.date_month_ok === false) facets.date_wrong++;
    if (!r.install_date) facets.date_missing++;
  }

  const conf = p.get('conf');
  if (conf === 'review') {
    rows = rows.filter(needsReview).sort((a, b) => b.vin_level - a.vin_level || a.date_conf - b.date_conf);
  } else if (conf === 'full') {
    rows = rows.filter((r) => r.vin_level === 1 && r.date_conf === 100);
  }
  const excel = p.get('excel');
  if (['match', 'close', 'different', 'missing'].includes(excel)) rows = rows.filter((r) => r.excel_status === excel);
  const xlband = p.get('xlband');
  if (['full', 'high', 'medium', 'low', 'noexcel'].includes(xlband)) rows = rows.filter((r) => r.xl_band === xlband);
  const level = Number(p.get('vinlevel'));
  if (level >= 1 && level <= 3) rows = rows.filter((r) => r.vin_level === level);

  const total = rows.length;
  const all = p.get('size') === 'all';
  const size = all ? total || 1 : Math.min(Math.max(Number(p.get('size')) || 50, 1), 500);
  const page = all ? 1 : Math.max(Number(p.get('page')) || 1, 1);
  return json({ total, page, size, facets, records: rows.slice((page - 1) * size, page * size) });
}
