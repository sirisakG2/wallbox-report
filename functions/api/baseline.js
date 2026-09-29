// GET /api/baseline?batch=&band=(l1|l2|l3|nopdf|novin|admin|pdfonly|wrongmonth)&page=1&size=50   (size=all for export)
// Check 2: every Excel install row is the baseline, matched with the PDF record of the same VIN.
import { buildBaseline } from '../../lib/baseline.js';
import { json } from '../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const p = new URL(request.url).searchParams;
  const batch = Number(p.get('batch')) || null;
  const { rows, pdfOnly, facets } = await buildBaseline(env.DB, batch);
  const band = p.get('band') || '';
  const list = band === 'pdfonly' ? pdfOnly
    : band === 'wrongmonth' ? rows.filter((r) => r.excel_month_ok === false || r.pdf_month_ok === false)
    : band === 'admin' ? rows.filter((r) => r.complete_by === 'admin')
    : band ? rows.filter((r) => r.band === band) : rows;
  if (band && band !== 'pdfonly') list.sort((a, b) => a.batch_id - b.batch_id || a.row_no - b.row_no);
  const all = p.get('size') === 'all';
  const size = all ? list.length || 1 : Math.min(Math.max(Number(p.get('size')) || 50, 1), 500);
  const page = all ? 1 : Math.max(Number(p.get('page')) || 1, 1);
  return json({
    total: list.length, page, size, band,
    facets: { ...facets, pdfonly: pdfOnly.length, excel_rows: rows.length },
    rows: list.slice((page - 1) * size, page * size),
  });
}
