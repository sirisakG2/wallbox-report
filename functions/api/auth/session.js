// GET /api/auth/session → { authenticated }
import { SESSION_COOKIE, getCookie, isValidSession, json } from '../../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const host = new URL(request.url).hostname;
  const local = host === 'localhost' || host === '127.0.0.1';
  return json({ authenticated: local || (await isValidSession(getCookie(request, SESSION_COOKIE), env)), local });
}
