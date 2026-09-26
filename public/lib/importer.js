// Import pipeline for one Drive folder (= one month):
// list → reference xlsx → for each PDF: download → MuPDF page-1 parse (worker) → Workers AI OCR → save to D1.
import { api } from './api.js';
import { parseReference } from './reference.js';
import { cleanThai, nameFromFileName, normalizeVin, parseThaiDate, VIN_RE, vinFromFileName } from './parse.js';

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
class PdfPool {
  constructor(size) {
    this.size = size;
    this.workers = [];
    this.idle = [];
    this.waiters = [];
    this.pending = new Map();
    this.seq = 0;
  }
  async start() {
    const boot = [];
    for (let i = 0; i < this.size; i++) {
      const w = new Worker(new URL('./pdf-worker.js', import.meta.url), { type: 'module' });
      boot.push(new Promise((resolve, reject) => {
        w.onerror = (e) => reject(new Error(`PDF engine failed to load: ${e.message || 'network error'}`));
        w.onmessage = ({ data }) => {
          if (data.ready) { w.onmessage = (ev) => this.onMessage(w, ev.data); resolve(); }
        };
      }));
      this.workers.push(w);
    }
    await Promise.all(boot);
    this.idle = [...this.workers];
  }
  onMessage(w, data) {
    const p = this.pending.get(data.id);
    this.pending.delete(data.id);
    this.release(w);
    if (!p) return;
    if (data.ok) p.resolve(data); else p.reject(new Error(data.error));
  }
  release(w) {
    const next = this.waiters.shift();
    if (next) next(w); else this.idle.push(w);
  }
  acquire() {
    const w = this.idle.pop();
    return w ? Promise.resolve(w) : new Promise((r) => this.waiters.push(r));
  }
  async parse(buffer) {
    const w = await this.acquire();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      w.postMessage({ id, buffer }, [buffer]);
    });
  }
  stop() { this.workers.forEach((w) => w.terminate()); }
}

async function withRetry(fn, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      err = e;
      if (e.name === 'AbortError') throw e;
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

async function ocr(mode, jpeg, expected, signal) {
  const q = new URLSearchParams({ mode });
  if (expected) q.set('expected', expected);
  const res = await fetch(`/api/ocr?${q}`, { method: 'POST', body: jpeg, signal, headers: { 'content-type': 'image/jpeg' } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `OCR failed (${res.status})`);
  return j;
}

// Turns one PDF into { record, issues }.
async function processPdf(file, pool, opts, signal, onBytes) {
  const issues = [];
  const buffer = await withRetry(() => download(file.id, signal, onBytes));
  const parsed = await pool.parse(buffer);

  let f = parsed.fields;
  let vinPicture = '';
  let ocrRaw = '';
  const notes = [];

  if (parsed.scanned && !opts.ocr) {
    f = {};
    notes.push('Page 1 is a scanned image — AI reading was switched off');
    issues.push({ type: 'scanned_page', detail: 'Page 1 has no text layer and AI reading was off; only the file name was used.' });
  } else if (parsed.scanned) {
    const r = await withRetry(() => ocr('page', parsed.pageJpeg, '', signal));
    f = { ...r.fields };
    f.install_date = parseThaiDate(f.install_date_raw);
    vinPicture = f.vin_picture || '';
    ocrRaw = r.raw;
    notes.push('Page 1 is a scanned image — all fields read by AI, please verify');
    issues.push({ type: 'scanned_page', detail: 'Page 1 has no text layer; fields were read by AI from the image.' });
  } else if (opts.ocr && parsed.vinJpeg) {
    try {
      const r = await withRetry(() => ocr('vin', parsed.vinJpeg, f.vin, signal));
      vinPicture = r.vin;
      ocrRaw = r.raw;
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      issues.push({ type: 'ocr_failed', detail: e.message });
    }
  } else if (opts.ocr) {
    issues.push({ type: 'ocr_failed', detail: 'No VIN photo found on page 1' });
  }

  const fileVin = vinFromFileName(file.name);
  let vin = normalizeVin(f.vin);
  if (!VIN_RE.test(vin)) {
    if (VIN_RE.test(fileVin)) {
      issues.push({ type: 'missing_vin', detail: `No valid VIN on page 1 ("${f.vin || ''}"); used VIN from file name` });
      notes.push('VIN taken from file name');
      vin = fileVin;
    } else {
      throw new Error(`No valid VIN in PDF or file name ("${f.vin || ''}")`);
    }
  } else if (fileVin && fileVin !== vin) {
    issues.push({ type: 'filename_vin', detail: `File name VIN ${fileVin} ≠ PDF VIN ${vin}` });
  }

  let match = null;
  if (vinPicture) {
    match = vinPicture === vin ? 1 : 0;
    if (!match) issues.push({ type: 'ocr_mismatch', detail: `VIN photo reads ${vinPicture}, PDF says ${vin}` });
  } else if (opts.ocr && !issues.some((i) => i.type === 'ocr_failed')) {
    issues.push({ type: 'ocr_failed', detail: `VIN photo could not be read${ocrRaw ? ` (AI: "${ocrRaw.slice(0, 80)}")` : ''}` });
  }

  if (!f.install_date) issues.push({ type: 'bad_date', detail: `Installation date not readable: "${f.install_date_raw || ''}"` });

  // AI reading of Thai names on scanned pages is not exact; the file name is typed by the installer.
  let customer = cleanThai(f.customer_name || '');
  const fileName = nameFromFileName(file.name);
  if (parsed.scanned && fileName) {
    if (customer && customer !== fileName) notes.push(`AI read name as "${customer}"`);
    customer = fileName;
  }
  customer = customer || fileName;
  const record = {
    vin,
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
    ocr_raw: String(ocrRaw || '').slice(0, 500),
    notes: notes.join('; '),
  };
  for (const is of issues) is.vin = vin;
  return { record, issues };
}

// Runs a whole import. `ui` receives progress callbacks.
export async function runImport({ folder, month, reprocess = false, ocr: useOcr = true, limit = 0, concurrency = 3 }, ui, signal) {
  const pdfs = folder.files.filter((f) => f.type === 'pdf');
  const refFile = folder.files.find((f) => f.type === 'xlsx');

  const { batch, doneFileIds } = await api('/api/batches', {
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
  let queue = pdfs.filter((f) => !done.has(f.id));
  if (limit > 0) queue = queue.slice(0, limit);
  const stats = { total: queue.length, done: 0, saved: 0, duplicates: 0, errors: 0, issues: 0, bytes: 0 };
  ui.progress(stats);
  if (!queue.length) {
    ui.log('Nothing new to process.', 'ok');
    await api(`/api/batches/${batch.id}`, { method: 'PATCH', body: { status: 'done' } });
    return { batch, stats };
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

  let next = 0;
  const workerLoop = async () => {
    while (next < queue.length) {
      if (signal.aborted) return;
      const file = queue[next++];
      let item;
      try {
        const { record, issues } = await processPdf(file, pool, { ocr: useOcr }, signal, (n) => { stats.bytes += n; ui.progress(stats); });
        item = { file, record, issues };
        stats.issues += issues.length;
        const flags = issues.map((i) => i.type).join(', ');
        ui.log(`${record.vin} · ${record.install_date || '?'} · ${file.name}${flags ? ` — ${flags}` : ''}`, flags ? 'warn' : 'ok');
      } catch (e) {
        if (e.name === 'AbortError') return;
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

  const status = signal.aborted || stats.done < stats.total ? 'partial' : 'done';
  await api(`/api/batches/${batch.id}`, { method: 'PATCH', body: { status } });
  ui.log(status === 'done' ? 'Import finished.' : 'Import stopped — run again with the same URL to resume.', status === 'done' ? 'ok' : 'warn');
  return { batch, stats };
}
