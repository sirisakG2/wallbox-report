// GET /api/excel-problems?batch= — problems in the submission Excel itself (source: ② Check Excel).
import { excelProblems } from '../../lib/excel-problems.js';
import { json } from '../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const batch = Number(new URL(request.url).searchParams.get('batch')) || null;
  return json({ problems: await excelProblems(env.DB, batch) });
}
