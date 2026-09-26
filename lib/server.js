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

// ---------- Cloudflare Access JWT verification ----------
let jwksCache = { team: null, keys: null, at: 0 };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeys(team) {
  if (jwksCache.team === team && jwksCache.keys && Date.now() - jwksCache.at < 3600_000) return jwksCache.keys;
  const res = await fetch(`https://${team}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('Cannot load Access certs');
  const { keys } = await res.json();
  jwksCache = { team, keys, at: Date.now() };
  return keys;
}

// Returns the authenticated email, or throws.
export async function verifyAccessJwt(token, env) {
  const team = String(env.ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const aud = String(env.ACCESS_AUD || '');
  if (!team || !aud) throw new Error('Access not configured');
  const [h, p, sig] = String(token || '').split('.');
  if (!h || !p || !sig) throw new Error('Missing token');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  const jwk = (await getKeys(team)).find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('Bad signature');
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(aud)) throw new Error('Wrong audience');
  if (payload.exp && payload.exp * 1000 < Date.now()) throw new Error('Expired');
  return payload.email || '';
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
