// GET /api/compare?batch=<id>  (omit batch for all months)
import { buildCompare } from '../../lib/db.js';
import { json } from '../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const batch = Number(new URL(request.url).searchParams.get('batch')) || null;
  return json(await buildCompare(env.DB, batch));
}
