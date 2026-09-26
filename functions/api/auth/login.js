// POST /api/auth/login { password } → sets the session cookie.
// Brute-force guard: 8 failed attempts per IP within 15 minutes locks that IP for 15 minutes.
import { bad, json, makeSession, safeEqual, sessionCookie, SESSION_DAYS } from '../../../lib/server.js';

const WINDOW_MIN = 15;
const MAX_FAILS = 8;

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return bad('Login is not configured (ADMIN_PASSWORD / SESSION_SECRET secrets missing)', 500);
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const since = `-${WINDOW_MIN} minutes`;
  const { n } = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > datetime('now', ?)`).bind(ip, since).first();
  if (n >= MAX_FAILS) return bad(`Too many attempts. Try again in ${WINDOW_MIN} minutes.`, 429);

  const body = await request.json().catch(() => ({}));
  if (!(await safeEqual(body.password || '', env.ADMIN_PASSWORD))) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_attempts (ip) VALUES (?)').bind(ip),
      env.DB.prepare(`DELETE FROM login_attempts WHERE at < datetime('now', '-1 day')`),
    ]);
    await new Promise((r) => setTimeout(r, 600));
    return bad('Wrong password', 401);
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  const res = json({ ok: true });
  res.headers.append('set-cookie', sessionCookie(await makeSession(env), SESSION_DAYS * 86400));
  return res;
}
