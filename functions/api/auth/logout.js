// POST /api/auth/logout — clears the session cookie.
import { json, sessionCookie } from '../../../lib/server.js';

export async function onRequestPost() {
  const res = json({ ok: true });
  res.headers.append('set-cookie', sessionCookie('', 0));
  return res;
}
