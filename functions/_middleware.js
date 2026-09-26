// Protects every /api route (except /api/version) with Cloudflare Access.
// Local dev (localhost) is allowed without Access.
import { bad, verifyAccessJwt } from '../lib/server.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/') || url.pathname === '/api/version') return next();

  const host = url.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return next();

  try {
    const token = request.headers.get('Cf-Access-Jwt-Assertion') || getCookie(request, 'CF_Authorization');
    const email = await verifyAccessJwt(token, env);
    context.data.email = email;
  } catch (e) {
    return bad(`Unauthorized: ${e.message}. Open the app through Cloudflare Access.`, 401);
  }
  return next();
}

function getCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : '';
}
