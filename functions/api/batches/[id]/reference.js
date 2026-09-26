// POST /api/batches/:id/reference — replace the stored submission-Excel rows for this month.
// Body: { name, rows: [{sheet, vin, case_number, customer_name, install_date, charger_model, car_model, serial, team, po_ref}] }
import { bad, json, runBatched } from '../../../../lib/server.js';

const COLS = ['sheet', 'vin', 'case_number', 'customer_name', 'install_date', 'charger_model', 'car_model', 'serial', 'team', 'po_ref'];

export async function onRequestPost({ params, request, env }) {
  const batchId = Number(params.id);
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.rows)) return bad('rows required');
  if (body.rows.length > 5000) return bad('Too many rows');

  const db = env.DB;
  const stmts = [
    db.prepare('DELETE FROM reference_rows WHERE batch_id = ?').bind(batchId),
    db.prepare(`UPDATE batches SET reference_name = ?, updated_at = datetime('now') WHERE id = ?`).bind(String(body.name || ''), batchId),
  ];
  for (const r of body.rows) {
    if (!r.vin || !['install', 'charger_only'].includes(r.sheet)) continue;
    stmts.push(db.prepare(`INSERT INTO reference_rows (batch_id, ${COLS.join(', ')}) VALUES (?, ${COLS.map(() => '?').join(', ')})`)
      .bind(batchId, ...COLS.map((c) => String(r[c] ?? ''))));
  }
  await runBatched(db, stmts);
  return json({ saved: stmts.length - 2 });
}
