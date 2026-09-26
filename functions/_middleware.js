// Protects every /api route with the admin password session.
// Open: /api/version, /api/auth/* (login, logout, session). Local dev (localhost) needs no login.
import { SESSION_COOKIE, bad, getCookie, isValidSession } from '../lib/server.js';

const OPEN = new Set(['/api/version', '/api/auth/login', '/api/auth/logout', '/api/auth/session']);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/') || OPEN.has(url.pathname)) return next();
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return next();

  if (!(await isValidSession(getCookie(request, SESSION_COOKIE), env))) {
    return bad('Please sign in', 401);
  }
  return next();
}
