// Customer-name similarity (0–100) for Thai / English names.
// Ignores titles (คุณ, นาย, นาง, นางสาว, น.ส., Mr, …), spaces, punctuation and zero-width characters;
// "person / company" names are compared part by part and the best pair wins; a full name contained
// in the other (e.g. PDF has "name / company", Excel has only the name) counts as a match.

const TITLES = /^(คุณ|นางสาว|นาง|นาย|น\.ส\.|นส\.|ด\.ช\.|ด\.ญ\.|ดร\.|mr\.?|mrs\.?|ms\.?|miss|dr\.?)\s*/i;

export function normName(s) {
  // U+FFFD appears where a PDF font has no character mapping — treat it as unknown and drop it.
  let n = String(s || '').normalize('NFC').replace(/ํา/g, 'ำ').replace(/[​-‍﻿�]/g, '')
    .trim().toLowerCase();
  for (let i = 0; i < 2; i++) n = n.replace(TITLES, '');
  return n.replace(/[\s().,_\-'"]/g, '');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Thai tone marks, ์ (thanthakhat), ็ and ํ — often dropped or mistyped; not a different name.
const stripMarks = (s) => s.replace(/[\u0E47-\u0E4E]/g, '');

function pairScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (stripMarks(a) === stripMarks(b)) return 97;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length >= 6 && long.includes(short)) return 97;
  return Math.round(100 * (1 - levenshtein(a, b) / Math.max(a.length, b.length)));
}

// Parts of a name: the whole text and each side of "/", with titles stripped.
function parts(s) {
  const raw = String(s || '');
  return [...new Set([raw, ...raw.split(/\s*\/\s*/)].map(normName).filter((x) => x.length >= 2))];
}

// Words of a name part (titles stripped), for partial-name matching ("ธนบดี" vs "ธนบดี ศิริสุขเกษม").
function words(s) {
  let n = String(s || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\uFFFD]/g, '').trim().toLowerCase();
  for (let i = 0; i < 2; i++) n = n.replace(TITLES, '');
  return n.split(/[\s/]+/).map(normName).filter((w) => w.length >= 2);
}

export function nameSimilarity(a, b) {
  let best = 0;
  for (const x of parts(a)) for (const y of parts(b)) best = Math.max(best, pairScore(x, y));
  if (best < 85) {
    // Partial name: every word of the shorter name is found (nearly) in the longer one → 85 ("close").
    const [wa, wb] = [words(a), words(b)];
    const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
    if (short.length && long.length > short.length && short.every((w) => long.some((v) => pairScore(w, v) >= 80))) best = 85;
  }
  return best;
}

// A name read from a PDF text layer is garbage when it is mostly not Thai/Latin letters or has
// unmapped characters — then the name typed in the file name is more reliable.
export function looksGarbled(s) {
  const t = String(s || '');
  if (!t.trim()) return true;
  const letters = (t.match(/[\u0E01-\u0E4E]|[A-Za-z]/g) || []).length;
  const odd = (t.match(/[\uFFFD\\{}|~^;%]/g) || []).length;
  return odd >= 2 || letters / t.replace(/\s/g, '').length < 0.7;
}
