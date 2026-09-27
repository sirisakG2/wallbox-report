// Import pipeline for one Drive folder (= one month):
// list → reference xlsx → for each PDF: download → MuPDF page-1 parse (worker) → Workers AI OCR → save to D1.
import { api } from './api.js';
import { freeOcrStatus, freeReadVin } from './free-ocr.js';
import { looksGarbled } from './names.js';
import { parseReference } from './reference.js';
import { cleanThai, nameFromFileName, normalizeVin, parseAnyDate, VIN_RE, vinFromFileName } from './parse.js';

const THAI_MONTH_NAMES = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// "06 Report งานติดตั้งเดือน มิถุนายน วางบิล ก.ค.26" → "2026-06"
export function suggestMonth(title, now = new Date()) {
  const t = String(title || '');
  let month = THAI_MONTH_NAMES.findIndex((m) => t.includes(m)) + 1;
  if (!month) month = EN_MONTHS.findIndex((m) => t.toLowerCase().includes(m)) + 1;
  if (!month) { const m = t.match(/^\s*(\d{1,2})\b/); if (m && +m[1] >= 1 && +m[1] <= 12) month = +m[1]; }
  let year = now.getFullYear();
  const y4 = t.match(/\b(20\d{2}|25\d{2})\b/);
  const y2 = t.match(/\.(\d{2})\b/);
  if (y4) year = +y4[1] > 2400 ? +y4[1] - 543 : +y4[1];
  else if (y2) year = +y2[1] >= 60 ? 2500 + +y2[1] - 543 : 2000 + +y2[1]; // "ก.ค.69" = BE, "ก.ค.26" = CE
  if (!month) month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

// ---------- MuPDF worker pool ----------
// A worker is replaced after a very large PDF or a memory error: WASM memory never shrinks, so a
// worker that once held a 400 MB file would keep that memory for the rest of the import.
const RECYCLE_BYTES = 120 * 1024 * 1024;

class PdfPool {
  constructor(size) {
    this.size = size;
    this.idle = [];
    this.waiters = [];
    this.all = new Set();
    this.seq = 0;
  }
  spawn() {
    return new Promise((resolve, reject) => {
      const w = new Worker(new URL('./pdf-worker.js', import.meta.url), { type: 'module' });
      w.onerror = (e) => reject(new Error(`PDF engine failed to load: ${e.message || 'network error'}`));
      w.onmessage = ({ data }) => { if (data.ready) { w.onmessage = null; this.all.add(w); resolve(w); } };
    });
  }
  async start() {
    this.idle = await Promise.all(Array.from({ length: this.size }, () => this.spawn()));
  }
  release(w) {
    const next = this.waiters.shift();
    if (next) next(w); else this.idle.push(w);
  }
  acquire() {
    const w = this.idle.pop();
    return w ? Promise.resolve(w) : new Promise((r) => this.waiters.push(r));
  }
  async replace(w) {
    this.all.delete(w);
    w.terminate();
    try { this.release(await this.spawn()); } catch { /* pool shrinks by one */ }
  }
  async parse(buffer) {
    const w = await this.acquire();
    const id = ++this.seq;
    const big = buffer.byteLength > RECYCLE_BYTES;
    const data = await new Promise((resolve) => {
      w.onmessage = ({ data: d }) => { if (d.id === id) resolve(d); };
      w.onerror = (e) => resolve({ ok: false, error: e.message || 'PDF worker crashed' });
      w.postMessage({ id, buffer }, [buffer]);
    });
    w.onmessage = null;
    w.onerror = null;
    const memoryError = !data.ok && /malloc|memory|out of bounds|abort/i.test(data.error);
    if (big || memoryError) this.replace(w); else this.release(w);
    if (!data.ok) throw new Error(data.error);
    return data;
  }
  stop() { this.all.forEach((w) => w.terminate()); this.all.clear(); }
}

async function withRetry(fn, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      err = e;
      if (e.name === 'AbortError' || e instanceof QuotaError) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw err;
}

async function download(fileId, signal, onBytes) {
  const res = await fetch(`/api/drive/file?id=${encodeURIComponent(fileId)}`, { signal, cache: 'no-store' });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Download failed (${res.status})`);
  }
  const total = Number(res.headers.get('x-file-size')) || 0;
  if (onBytes) onBytes.version = { modified: res.headers.get('x-file-modified') || '', size: total };
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onBytes?.(value.length, total);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out.buffer;
}

export class QuotaError extends Error {}

async function ocr(mode, jpeg, expected, signal, opts = {}) {
  if (opts.aiBlocked) throw new QuotaError('Daily free Workers AI allowance (10,000 neurons) is used up');
  const q = new URLSearchParams({ mode });
  if (expected) q.set('expected', expected);
  const res = await fetch(`/api/ocr?${q}`, { method: 'POST', body: jpeg, signal, headers: { 'content-type': 'image/jpeg' } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j.error || `OCR failed (${res.status})`;
    if (/4006|allocation/i.test(msg)) throw new QuotaError('Daily free Workers AI allowance (10,000 neurons) is used up');
    throw new Error(msg);
  }
  return j;
}

// Is an installation date plausible for the imported month? Returns a reason or ''.
// Allowed: from 3 months before the month to 1 month after it, and never in the future.
export function dateProblem(iso, month) {
  const d = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(d)) return '';
  if (d > Date.now() + 86400000) return 'is in the future';
  const m = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!m) return '';
  const from = Date.UTC(+m[1], +m[2] - 1 - 3, 1);
  const to = Date.UTC(+m[1], +m[2] + 1, 0);
  return d < from || d > to ? `is far from the imported month ${month}` : '';
}

// Turns one PDF into { record, issues }.
async function processPdf(file, pool, opts, signal, onBytes) {
  const issues = [];
  const buffer = await withRetry(() => download(file.id, signal, onBytes));
  if (onBytes?.version) Object.assign(file, onBytes.version);
  const parsed = await pool.parse(buffer);

  let f = parsed.fields;
  // Three VIN sources: file name (reference) · photo (must confirm it) · paper VIN box (low priority).
  const fileVin = VIN_RE.test(vinFromFileName(file.name)) ? vinFromFileName(file.name) : '';
  const paperOf = (x) => (VIN_RE.test(normalizeVin(x)) ? normalizeVin(x) : '');
  let vinPicture = '';
  let ocrRaw = '';
  let readBy = '';
  let chargerPhoto = false;
  const notes = [];

  if (parsed.scanned && !opts.ocr) {
    f = {};
    notes.push('Page 1 is a scanned image — AI reading was switched off');
    issues.push({ type: 'scanned_page', detail: 'Page 1 has no text layer and AI reading was off; only the file name was used.' });
  } else if (parsed.scanned) {
    const r = await withRetry(() => ocr('page', parsed.pageJpeg, fileVin, signal, opts));
    f = { ...r.fields };
    f.install_date = parseAnyDate(f.install_date_raw);
    vinPicture = f.vin_picture || '';
    readBy = vinPicture ? 'ai' : '';
    ocrRaw = r.raw;
    opts.stats && opts.stats.aiCalls++;
    notes.push('Page 1 is a scanned image — all fields read by AI, please verify');
    issues.push({ type: 'scanned_page', detail: 'Page 1 has no text layer; fields were read by AI from the image.' });
  } else if (opts.ocr && parsed.vinJpeg) {
    try {
      // 1) Free on-device check; 2) Workers AI only when the free reader can't confirm the VIN.
      const cands = [...new Set([fileVin, paperOf(f.vin)].filter(Boolean))];
      const free = await freeReadVin(parsed.vinJpeg, cands).catch(() => ({ result: 'unknown', text: '' }));
      if (free.result === 'match') {
        vinPicture = free.vin;
        readBy = 'free';
        ocrRaw = free.text;
      } else if (free.result === 'charger') {
        chargerPhoto = true;
        ocrRaw = free.text;
        issues.push({ type: 'vin_photo_wrong', detail: 'The VIN photo slot shows the charger label, not the car VIN' });
      } else {
        const r = await withRetry(() => ocr('vin', parsed.vinJpeg, fileVin || paperOf(f.vin), signal, opts));
        vinPicture = r.vin;
        readBy = r.vin ? 'ai' : '';
        ocrRaw = r.raw;
        opts.stats && opts.stats.aiCalls++;
      }
    } catch (e) {
      if (e.name === 'AbortError' || e instanceof QuotaError) throw e;
      issues.push({ type: 'ocr_failed', detail: e.message });
    }
  } else if (opts.ocr) {
    issues.push({ type: 'ocr_failed', detail: 'No VIN photo found on page 1' });
  }

  const paperVin = paperOf(f.vin);
  // Record key: the file name VIN; without one, the photo VIN, then the paper VIN.
  const vin = fileVin || vinPicture || paperVin;
  if (!vin) throw new Error(`No valid VIN in the file name, photo or form ("${f.vin || ''}")`);
  if (!fileVin) {
    issues.push({ type: 'missing_vin', detail: `No valid VIN in the file name — using the ${vinPicture ? 'photo' : 'paper'} VIN ${vin}` });
    notes.push('No VIN in file name');
  }
  if (paperVin && paperVin !== vin) {
    issues.push({ type: 'filename_vin', detail: `Paper VIN box says ${paperVin}, file name says ${vin}` });
  } else if (!paperVin) {
    notes.push(`Paper VIN box not readable ("${f.vin || ''}")`);
  }

  let match = null;
  if (vinPicture) {
    match = vinPicture === vin ? 1 : 0;
    if (!match) issues.push({ type: 'ocr_mismatch', detail: `VIN photo reads ${vinPicture}, file name says ${vin}` });
  } else if (opts.ocr && !chargerPhoto && !issues.some((i) => i.type === 'ocr_failed')) {
    issues.push({ type: 'ocr_failed', detail: `VIN photo could not be read${ocrRaw ? ` (AI: "${ocrRaw.slice(0, 80)}")` : ''}` });
  }

  if (!f.install_date) issues.push({ type: 'bad_date', detail: `Installation date not readable: "${f.install_date_raw || ''}"` });
  else {
    const why = dateProblem(f.install_date, opts.month);
    if (why) issues.push({ type: 'suspicious_date', detail: `Installation date ${f.install_date} ("${f.install_date_raw}") ${why} — check the year/month` });
  }

  // Reused/edited report: the job number printed in the page header differs from the table,
  // or the table labels are graphics with values typed over them.
  const tableJob = String(f.job_number || '').replace(/\s/g, '').toUpperCase();
  if (f.header_job && tableJob && f.header_job !== tableJob) {
    issues.push({ type: 'edited_pdf', detail: `Page header shows job ${f.header_job} but the table says ${tableJob} — the report may have been reused/edited` });
  } else if (f.layout === 'no-labels') {
    issues.push({ type: 'edited_pdf', detail: 'Table labels are not text (values typed over the form) — check this report' });
  }

  // AI reading of Thai names on scanned pages is not exact; the file name is typed by the installer.
  let customer = cleanThai(f.customer_name || '');
  const fileName = nameFromFileName(file.name);
  if (parsed.scanned && fileName) {
    if (customer && customer !== fileName) notes.push(`AI read name as "${customer}"`);
    customer = fileName;
  }
  if (customer && fileName && looksGarbled(customer)) {
    notes.push(`PDF name unreadable ("${customer.slice(0, 40)}") — name taken from file name`);
    customer = fileName;
  }
  customer = customer || fileName;
  const record = {
    vin,
    file_vin: fileVin,
    paper_vin: paperVin,
    install_date: f.install_date || '',
    install_date_raw: f.install_date_raw || '',
    job_number: String(f.job_number || '').replace(/\s/g, ''),
    charger_code: f.charger_code || '',
    customer_name: customer,
    phone: f.phone || '',
    region: f.region || '',
    site_type: f.site_type || '',
    serial: String(f.serial || '').replace(/\s/g, ''),
    report_printed_at: f.report_printed_at || '',
    job_url: f.job_url || '',
    pdf_name: file.name,
    pdf_file_id: file.id,
    vin_picture: vinPicture,
    vin_photo_match: match,
    vin_read_by: readBy,
    ocr_raw: String(ocrRaw || '').slice(0, 500),
    notes: notes.join('; '),
  };
  for (const is of issues) is.vin = vin;
  return { record, issues };
}

// Compares the Drive folder with what was imported before:
//   new       — never imported
//   updated   — same file with a newer modified date, or a file re-uploaded under the same name
//   deleted   — imported before, no longer in the folder (record kept, marked "Deleted")
//   restored  — marked deleted before, back in the folder
//   unchanged — nothing to do
const nameKey = (n) => String(n || '').normalize('NFC').trim().toLowerCase();
const toMs = (s) => (s ? Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s.replace(' ', 'T')}Z`) : NaN);

export async function planFolder(pdfs, stored) {
  const live = stored.filter((f) => f.status !== 'replaced');
  const byId = new Map(live.map((f) => [f.file_id, f]));
  const byName = new Map(live.map((f) => [nameKey(f.name), f]));
  const inFolder = new Set(pdfs.map((f) => f.id));
  const plan = { new: [], updated: [], unchanged: [], deleted: [], restored: [] };
  const sameDay = [];
  for (const f of pdfs) {
    const s = byId.get(f.id);
    if (s) {
      if (s.file_status === 'deleted') plan.restored.push(f.id);
      const readAt = s.modified || s.processed_at;
      const readDay = readAt ? new Date(toMs(readAt)).toISOString().slice(0, 10) : '';
      if (f.modifiedDay && readDay && f.modifiedDay > readDay) plan.updated.push({ file: f, vin: s.vin, why: `modified ${f.modifiedDay}` });
      else if (f.modifiedDay && readDay && f.modifiedDay === readDay) sameDay.push({ f, s, readAt });
      else plan.unchanged.push(f);
      continue;
    }
    const old = byName.get(nameKey(f.name));
    if (old && !inFolder.has(old.file_id)) plan.updated.push({ file: f, replaces: old.file_id, vin: old.vin, why: 're-uploaded' });
    else plan.new.push(f);
  }
  // Same day as the version we read: ask Drive for the exact time.
  await Promise.all(sameDay.map(async ({ f, s, readAt }) => {
    try {
      const h = await api(`/api/drive/file?id=${encodeURIComponent(f.id)}&head=1`);
      if (h.modified && toMs(h.modified) > toMs(readAt) + 60000) plan.updated.push({ file: f, vin: s.vin, why: `modified ${h.modified.slice(0, 16).replace('T', ' ')}` });
      else plan.unchanged.push(f);
    } catch { plan.unchanged.push(f); }
  }));
  const replacedIds = new Set(plan.updated.map((u) => u.replaces).filter(Boolean));
  for (const s of live) {
    if (!inFolder.has(s.file_id) && !replacedIds.has(s.file_id) && s.file_status !== 'deleted') plan.deleted.push(s);
  }
  return plan;
}

// Runs a whole import. `ui` receives progress callbacks.
export async function runImport({ folder, month, plan = null, reprocess = false, retry = false, ocr: useOcr = true, limit = 0, concurrency = 5 }, ui, signal) {
  const pdfs = folder.files.filter((f) => f.type === 'pdf');
  const refFile = folder.files.find((f) => f.type === 'xlsx');

  const { batch, doneFileIds, retryFileIds } = await api('/api/batches', {
    method: 'POST',
    body: { folderUrl: folder.url, month, folderName: folder.title, referenceName: refFile?.name || '', pdfCount: pdfs.length },
  });
  ui.log(`Month ${batch.month} · batch #${batch.id} · ${pdfs.length} PDFs${doneFileIds.length ? ` · ${doneFileIds.length} already processed` : ''}`);

  if (refFile) {
    try {
      ui.log(`Reading reference Excel "${refFile.name}"…`);
      const buf = await withRetry(() => download(refFile.id, signal));
      const { rows, sheets } = await parseReference(window.ExcelJS, buf);
      await api(`/api/batches/${batch.id}/reference`, { method: 'POST', body: { name: refFile.name, rows } });
      ui.log(`Reference saved: ${sheets.map((s) => `${s.name} (${s.rows})`).join(', ')}`, 'ok');
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      ui.log(`Reference Excel could not be read: ${e.message}`, 'err');
    }
  } else {
    ui.log('No reference Excel found in the folder', 'warn');
  }

  const done = new Set(reprocess ? [] : doneFileIds);
  const inFolder = new Set(pdfs.map((f) => f.id));
  if (retry && !reprocess) {
    const ids = retryFileIds.filter((id) => inFolder.has(id));
    for (const id of ids) done.delete(id);
    ui.log(`Retrying ${ids.length} file(s) with an unread VIN photo or an error`);
  }
  // Files changed in Drive since they were read.
  const updates = new Map((plan?.updated || []).map((u) => [u.file.id, u]));
  for (const id of updates.keys()) done.delete(id);
  if (updates.size) ui.log(`Updated in Drive since the last import: ${updates.size} file(s) — they will be read again`, 'warn');
  let queue = pdfs.filter((f) => !done.has(f.id));
  if (limit > 0) queue = queue.slice(0, limit);
  const stats = { total: queue.length, done: 0, saved: 0, duplicates: 0, errors: 0, issues: 0, bytes: 0, aiCalls: 0, free: 0, deferred: 0 };
  let quotaHit = false;
  ui.progress(stats);
  if (!queue.length) {
    ui.log('Nothing new to process.', 'ok');
    await api(`/api/batches/${batch.id}`, { method: 'PATCH', body: { status: 'done' } });
    return { batch, stats };
  }

  if (useOcr) {
    const fs = await freeOcrStatus();
    ui.log(fs.available ? 'Free VIN reader: ON — AI is used only when it cannot confirm a photo' : `Free VIN reader: OFF (${fs.reason}) — every VIN photo uses AI`, fs.available ? 'ok' : 'warn');
  }
  ui.log('Loading PDF engine…');
  const pool = new PdfPool(Math.max(1, Math.min(concurrency, navigator.hardwareConcurrency || 2)));
  await pool.start();

  let pendingSave = [];
  const flush = async () => {
    if (!pendingSave.length) return;
    const items = pendingSave;
    pendingSave = [];
    const r = await withRetry(() => api(`/api/batches/${batch.id}/records`, { method: 'POST', body: { items } }));
    stats.saved += r.saved;
    stats.duplicates += r.duplicates;
    ui.progress(stats);
  };

  // Shared by all files: once the AI allowance is used up, no further AI calls are attempted.
  const aiOpts = { ocr: useOcr, stats, aiBlocked: false, month: batch.month };

  let next = 0;
  const workerLoop = async () => {
    while (next < queue.length) {
      if (signal.aborted) return;
      const file = queue[next++];
      let item;
      try {
        const { record, issues } = await processPdf(file, pool, aiOpts, signal, (n) => { stats.bytes += n; ui.progress(stats); });
        if (record.vin_read_by === 'free') stats.free++;
        const u = updates.get(file.id);
        item = { file, record, issues, ...(u ? { update: true, replaces: u.replaces } : {}) };
        if (u) issues.push({ type: 'file_updated', vin: record.vin, detail: `PDF ${u.why === 're-uploaded' ? 're-uploaded' : 'changed'} in Drive (${u.why}) — read again` });
        stats.issues += issues.length;
        const flags = issues.map((i) => i.type).join(', ');
        ui.log(`${record.vin} · ${record.install_date || '?'} · ${file.name}${flags ? ` — ${flags}` : ''}`, flags ? 'warn' : 'ok');
      } catch (e) {
        if (e.name === 'AbortError') return;
        if (e instanceof QuotaError) {
          // Leave this file unprocessed (the next run picks it up) and keep going with free-only work.
          if (!quotaHit) ui.log(`${e.message}. Continuing with free reading only — files that need AI are left for the next run (after 07:00 Thailand).`, 'err');
          quotaHit = true;
          aiOpts.aiBlocked = true;
          stats.deferred++;
          stats.done++;
          ui.progress(stats);
          continue;
        }
        stats.errors++;
        item = { file, record: null, issues: [{ type: 'error', detail: e.message, vin: vinFromFileName(file.name) }] };
        ui.log(`✘ ${file.name}: ${e.message}`, 'err');
      }
      stats.done++;
      ui.progress(stats);
      pendingSave.push(item);
      if (pendingSave.length >= 10) await flush();
    }
  };

  try {
    await Promise.all(Array.from({ length: concurrency }, workerLoop));
    await flush();
  } finally {
    pool.stop();
  }

  // PDFs removed from / back in the Drive folder.
  const deleted = (plan?.deleted || []).map((d) => d.file_id);
  const restored = plan?.restored || [];
  if (deleted.length || restored.length) {
    await api(`/api/batches/${batch.id}/file-status`, { method: 'POST', body: { deleted, restored } });
    if (deleted.length) ui.log(`${deleted.length} PDF(s) no longer in the folder — records kept and marked "Deleted"`, 'warn');
    if (restored.length) ui.log(`${restored.length} PDF(s) are back in the folder — "Deleted" mark removed`, 'ok');
  }

  const status = signal.aborted || stats.done < stats.total || stats.deferred ? 'partial' : 'done';
  await api(`/api/batches/${batch.id}`, { method: 'PATCH', body: { status } });
  if (useOcr) ui.log(`VIN photos confirmed free: ${stats.free} · AI calls: ${stats.aiCalls}${stats.deferred ? ` · left for next run (need AI): ${stats.deferred}` : ''}`, 'ok');
  ui.log(status === 'done' ? 'Import finished.' : 'Import stopped — run again with the same URL to resume.', status === 'done' ? 'ok' : 'warn');
  return { batch, stats, quotaHit };
}
