// Free VIN photo check on this computer (PaddleOCR in background workers) — no Cloudflare AI neurons.
// Works on any PC and browser without settings. First use downloads ~26 MB of models/runtime
// from the jsDelivr CDN; the browser caches them afterwards.

const WORKERS = 2;
let pool = null;
let status = null; // Promise<{ available, reason }>
let seq = 0;

function spawn() {
  const w = new Worker(new URL('./ocr-worker.js', import.meta.url), { type: 'module' });
  const pending = new Map();
  w.onmessage = ({ data }) => { const p = pending.get(data.id); pending.delete(data.id); p?.(data); };
  w.onerror = (e) => { for (const p of pending.values()) p({ ok: false, error: e.message || 'OCR worker crashed' }); pending.clear(); };
  const call = (msg, transfer = []) => new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    w.postMessage({ ...msg, id }, transfer);
  });
  return { w, call, busy: 0 };
}

export function freeOcrStatus() {
  if (!status) {
    pool = Array.from({ length: WORKERS }, spawn);
    status = pool[0].call({ type: 'status' }).then((r) => (r.ok
      ? { available: true, reason: '' }
      : { available: false, reason: r.error || 'free reader failed to load' }));
  }
  return status;
}

// Returns { result: 'match' | 'charger' | 'unknown', text }.
export async function freeReadVin(jpegBytes, expectedVin) {
  if (!(await freeOcrStatus()).available) return { result: 'unknown', text: '' };
  const worker = pool.reduce((a, b) => (b.busy < a.busy ? b : a));
  worker.busy++;
  try {
    const copy = jpegBytes.slice(); // the caller still needs the JPEG if AI is used afterwards
    const r = await worker.call({ type: 'read', jpeg: copy, expected: expectedVin }, [copy.buffer]);
    return r.ok ? { result: r.result, text: r.text } : { result: 'unknown', text: '' };
  } finally {
    worker.busy--;
  }
}
