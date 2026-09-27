// Shared helpers for Pages Functions (imported relatively; not routed).

export const APP_VERSION = '1.0.0';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function bad(message, status = 400) {
  return json({ error: message }, status);
}

export const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;

// VINs never contain I, O or Q — OCR and typing often confuse them with 1 and 0.
export function normalizeVin(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/I/g, '1')
    .replace(/[OQ]/g, '0');
}

export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

// ---------- Admin session (password login) ----------
// Cookie value: "<expiresAtMs>.<base64url HMAC-SHA256(expiresAtMs)>" signed with SESSION_SECRET.
export const SESSION_COOKIE = 'wb_session';
export const SESSION_DAYS = 7;

function b64url(bytes) {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

// Constant-time string comparison (compares HMACs so lengths never leak).
export async function safeEqual(a, b) {
  const k = 'compare';
  const [x, y] = await Promise.all([hmac(k, String(a)), hmac(k, String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0 && x.length === y.length;
}

export async function makeSession(env) {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  return `${exp}.${await hmac(env.SESSION_SECRET, `session:${exp}`)}`;
}

export async function isValidSession(value, env) {
  if (!env.SESSION_SECRET || !value) return false;
  const [exp, sig] = String(value).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(env.SESSION_SECRET, `session:${exp}`));
}

export function getCookie(request, name) {
  const m = (request.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : '';
}

export function sessionCookie(value, maxAge) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

// Run D1 statements in chunks to stay under per-batch limits.
export async function runBatched(db, statements, size = 50) {
  for (let i = 0; i < statements.length; i += size) {
    await db.batch(statements.slice(i, i + size));
  }
}

export function folderIdFromUrl(input) {
  const s = String(input || '').trim();
  const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) || s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  return DRIVE_ID_RE.test(s) ? s : null;
}

function distance(a, b) {
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
  return d;
}

export function pickVin(text, expected) {
  const cands = new Set();
  for (const tok of String(text).split(/[\s,;:|"'`]+/)) {
    const n = normalizeVin(tok);
    if (n.length === 17 && VIN_RE.test(n)) cands.add(n);
    else if (n.length > 17) for (let i = 0; i + 17 <= n.length; i++) {
      const w = n.slice(i, i + 17);
      if (w.startsWith('L') && VIN_RE.test(w)) cands.add(w);
    }
  }
  const list = [...cands];
  if (!list.length) return '';
  const exp = normalizeVin(expected);
  if (exp.length === 17) list.sort((a, b) => distance(a, exp) - distance(b, exp));
  return list[0];
}

const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// Drive's "last modified" label → YYYY-MM-DD (day precision). Formats: "10:23 AM" (today),
// "Jun 29" (this year), "Dec 3, 2024" / "12/3/24" (older).
export function labelToDate(label, now = new Date()) {
  const s = String(label || '').trim();
  const iso = (d) => d.toISOString().slice(0, 10);
  if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(s)) return iso(now);
  let m = s.match(/^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?$/);
  if (m && m[1] in MON) {
    let d = new Date(Date.UTC(m[3] ? +m[3] : now.getUTCFullYear(), MON[m[1]], +m[2]));
    if (!m[3] && d > now) d = new Date(Date.UTC(now.getUTCFullYear() - 1, MON[m[1]], +m[2]));
    return iso(d);
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return iso(new Date(Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1] - 1, +m[2])));
  return '';
}
