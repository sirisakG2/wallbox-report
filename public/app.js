// Admin console: Dashboard · Import month · Records · Compare · Issues · Months · Export
import { api } from './lib/api.js';
import { planFolder, runImport, suggestMonth } from './lib/importer.js';
import { freeOcrStatus } from './lib/free-ocr.js';
import { downloadWorkbook } from './lib/report.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $('#view');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtMonth = (ym, long = false) => { const m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? `${(long ? MONTHS_LONG : MONTHS_EN)[+m[2] - 1]} ${m[1]}` : ym || ''; };
const pdfUrl = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
const excelUrl = (id) => (id ? `https://drive.google.com/file/d/${encodeURIComponent(id)}/view` : '');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const ICON = {
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px;vertical-align:-2px"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
};

function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

function matchPill(v) {
  if (v === 1) return '<span class="pill ok">Match</span>';
  if (v === 0) return '<span class="pill bad">Mismatch</span>';
  return '<span class="pill warn">Not read</span>';
}
const LEVEL = { 1: ['ok', '① Match 3/3'], 2: ['warn', '② File = Photo'], 3: ['bad', '③ Not matched'] };
function vinLevelPill(level) {
  const [tone, label] = LEVEL[level] || ['neutral', '–'];
  return `<span class="pill ${tone} plain lvl">${label}</span>`;
}
const XL = { match: ['ok', 'Match'], close: ['warn', 'Close'], different: ['bad', 'Different'], missing: ['bad', 'Not in Excel'] };
function excelPill(status, score, withPct = true) {
  const [tone, label] = XL[status] || ['neutral', '–'];
  return `<span class="pill ${tone} plain lvl">${label}${withPct && status !== 'missing' ? ` ${score}%` : ''}</span>`;
}
const BAND = { full: ['ok', '100%'], high: ['ok', '90–99%'], medium: ['warn', '70–89%'], low: ['bad', 'Below 70%'], nopdf: ['bad', 'No PDF'], pdfonly: ['info', 'PDF not in Excel'], noexcel: ['bad', 'Not in Excel'] };
function matchPct(score, band) {
  const [tone] = BAND[band] || ['neutral'];
  if (band === 'nopdf' || band === 'noexcel') return `<span class="pill ${tone} plain lvl">${BAND[band][1]}</span>`;
  return `<span class="pill ${tone} plain conf">${score}%</span>`;
}
const tick = (ok, pts) => (ok ? `<span class="ok-mark" title="+${pts}">✔</span>` : '<span class="bad-mark">✘</span>');
function dateMark(days) {
  if (days === 0) return '<span class="ok-mark" title="+20">✔</span>';
  if (days !== null && days <= 3) return `<span class="warn-mark" title="+10">${days}d</span>`;
  return days === null ? '<span class="faint">–</span>' : `<span class="bad-mark">${days}d</span>`;
}
function fileStatusPill(r) {
  if (r.file_status === 'updated') return `<span class="pill info" title="PDF changed in Drive and was read again">Updated ${esc(fmtDate(r.file_status_at))}</span>`;
  if (r.file_status === 'deleted') return `<span class="pill bad" title="PDF is no longer in the Drive folder — record kept">Deleted ${esc(fmtDate(r.file_status_at))}</span>`;
  return '';
}
function confPill(score, big = false) {
  const tone = score >= 95 ? 'ok' : score >= 80 ? 'warn' : 'bad';
  return `<span class="pill ${tone} plain conf${big ? ' conf-big' : ''}">${score}%</span>`;
}
function readByPill(v) {
  if (v === 'free') return '<span class="pill ok plain">Free</span>';
  if (v === 'ai') return '<span class="pill info plain">AI</span>';
  return '<span class="faint">–</span>';
}
function flagCell(v) {
  if (v === 1) return '<span class="pill ok plain">✔</span>';
  if (v === 0) return '<span class="pill bad plain">✘</span>';
  return '<span class="faint">–</span>';
}
const STATUS_PILL = { done: 'ok', partial: 'warn', running: 'info' };
const ISSUE_LABEL = {
  duplicate_vin: ['Duplicate VIN', 'warn'], filename_vin: ['File name VIN', 'info'], ocr_mismatch: ['VIN photo mismatch', 'bad'],
  ocr_failed: ['VIN photo unread', 'warn'], bad_date: ['Bad date', 'bad'], missing_vin: ['Missing VIN', 'bad'],
  scanned_page: ['Scanned page', 'info'], error: ['Error', 'bad'], vin_photo_wrong: ['Charger photo in VIN slot', 'warn'],
  edited_pdf: ['PDF may be edited', 'bad'], suspicious_date: ['Suspicious date', 'warn'], file_updated: ['PDF updated in Drive', 'info'],
};
const OTHER_TYPES = ['edited_pdf', 'duplicate_vin', 'scanned_page', 'vin_photo_wrong', 'error', 'file_updated'];
const issuePill = (t) => { const [l, c] = ISSUE_LABEL[t] || [t, 'neutral']; return `<span class="pill ${c}">${esc(l)}</span>`; };

// ---------- state & routing ----------
const state = { batches: [], importing: null };

async function loadBatches() {
  const { batches } = await api('/api/batches');
  state.batches = batches;
  $('#cMonths').textContent = batches.length;
  $('#cRecords').textContent = fmtN(batches.reduce((a, b) => a + b.record_count, 0));
  const open = batches.reduce((a, b) => a + b.open_issue_count, 0);
  $('#cIssues').textContent = fmtN(open);
  $('#cIssues').classList.toggle('alert', open > 0);
  return batches;
}

function monthOptions(selected, { all = true } = {}) {
  return (all ? `<option value="">All months</option>` : '') + state.batches
    .map((b) => `<option value="${b.id}" ${String(selected) === String(b.id) ? 'selected' : ''}>${esc(fmtMonth(b.month, true))}</option>`).join('');
}

function parseHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  return { name: path || 'dashboard', params: new URLSearchParams(qs || '') };
}
function go(name, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString();
  location.hash = `#/${name}${qs ? `?${qs}` : ''}`;
}

const VIEWS = {
  dashboard: renderDashboard, import: renderImport, 'check-pdf': renderCheckPdf, 'check-excel': renderCheckExcel,
  records: renderRecords, compare: renderCompare, issues: renderIssues, months: renderMonths, export: renderExport,
};

async function route() {
  const { name, params } = parseHash();
  const fn = VIEWS[name] || renderDashboard;
  const tabName = name === 'compare' ? 'check-excel' : VIEWS[name] ? name : 'dashboard';
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === tabName));
  // A running import keeps going when switching tabs; renderImport re-attaches its view.
  $$('.drawer, .drawer-backdrop').forEach((x) => x.remove());
  try {
    await loadBatches();
    await fn(params);
  } catch (e) {
    view.innerHTML = `<div class="card card-pad"><h2>Something went wrong</h2><p class="muted">${esc(e.message)}</p></div>`;
  }
}

// ---------- Dashboard ----------
async function renderDashboard() {
  const s = await api('/api/stats');
  const b = state.batches;
  const maxBar = Math.max(1, ...s.byInstallMonth.map((x) => x.n));
  view.innerHTML = `
    <div class="view-head">
      <div><h1>Dashboard</h1><p>All imported months at a glance.</p></div>
      <button class="btn primary lg" data-go="import">${ICON.play} Import a month</button>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><h2><span class="tab-num">1</span> Check PDF — file name VIN vs VIN photo vs paper VIN box</h2><span class="faint">file name is the reference</span></div>
      <div class="grid cols-3 card-pad">
        ${[1, 2, 3].map((l) => {
          const n = s.vin_levels[l];
          const desc = { 1: 'File name = photo = paper VIN box', 2: 'Photo confirms the file name — paper VIN box differs', 3: 'Photo does not confirm the file name — check the PDF' }[l];
          const tone = { 1: 'ok', 2: 'warn', 3: 'bad' }[l];
          return `<a class="card kpi kpi-link level-card ${tone}" href="#/check-pdf?vinlevel=${l}" style="box-shadow:none;background:var(--surface-2)">
            <div class="label">${LEVEL[l][1]}</div>
            <div class="value">${fmtN(n)} <span class="level-pct">${pct(n, s.records)}%</span></div>
            <div class="meter"><i style="width:${pct(n, s.records)}%"></i></div>
            <div class="sub" style="margin-top:8px">${desc}</div></a>`;
        }).join('')}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><h2><span class="tab-num">2</span> Check Excel — Excel rows as baseline, looked up in the PDFs</h2><span class="faint">% match = VIN (file · photo · paper) + name + case number + date</span></div>
      <div class="grid cols-5 card-pad">
        ${[['full', 'Everything matches'], ['high', 'Nearly everything matches'], ['medium', 'Some fields differ — check'], ['low', 'Many fields differ'], ['nopdf', 'Excel row with no PDF']].map(([k, desc]) => {
          const n = s.baseline[k];
          const tone = BAND[k][0];
          return `<a class="card kpi kpi-link level-card ${tone}" href="#/check-excel?band=${k}" style="box-shadow:none;background:var(--surface-2)">
            <div class="label">${BAND[k][1]}</div>
            <div class="value">${fmtN(n)} <span class="level-pct">${pct(n, s.baseline.excel_rows)}%</span></div>
            <div class="meter"><i style="width:${pct(n, s.baseline.excel_rows)}%"></i></div>
            <div class="sub" style="margin-top:8px">${desc}</div></a>`;
        }).join('')}
      </div>
      <div class="legend" style="border-top:1px solid var(--border);border-bottom:0">${fmtN(s.baseline.excel_rows)} Excel rows · <a href="#/check-excel?band=pdfonly">${fmtN(s.baseline.pdfonly)} PDFs not in any Excel</a></div>
    </div>
    <div class="grid cols-4">
      <div class="card kpi accent"><div class="label">Records</div><div class="value">${fmtN(s.records)}</div><div class="sub">unique VINs · ${fmtN(s.months)} month${s.months === 1 ? '' : 's'}</div></div>
      <a class="card kpi kpi-link" href="#/records?conf=review"><div class="label">To review</div><div class="value" style="color:${s.to_review ? 'var(--warn)' : 'inherit'}">${fmtN(s.to_review)}</div><div class="sub">VIN or date below 95% · ${fmtN(s.full_conf)} at 100%</div></a>
      <div class="card kpi"><div class="label">In reference Excel</div><div class="value">${pct(s.matched, s.reference_rows)}%</div><div class="sub">${fmtN(s.matched)} of ${fmtN(s.reference_rows)} rows have a PDF</div></div>
      <a class="card kpi kpi-link" href="#/issues"><div class="label">Other problems</div><div class="value" style="color:${s.open_issues ? 'var(--warn)' : 'inherit'}">${fmtN(s.open_issues)}</div><div class="sub">edited PDF, duplicates, scans…</div></a>
    </div>

    <div class="grid cols-2 section-gap">
      <div class="card">
        <div class="card-head"><h2>Imported months</h2><button class="btn sm" data-go="months">Manage</button></div>
        <div class="card-pad">
          ${b.length ? `<div class="months">${b.map(monthCard).join('')}</div>` : `<div class="empty">No months imported yet.<br><br><button class="btn primary" data-go="import">Import the first month</button></div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h2>Installations by install date</h2><span class="faint">records per month</span></div>
        <div class="card-pad">
          ${s.byInstallMonth.length ? `<div class="bars">${s.byInstallMonth.slice(-12).map((x) => `
            <div class="bar" title="${esc(fmtMonth(x.ym, true))}: ${x.n}">
              <span class="v">${x.n}</span>
              <div class="col" style="height:${Math.max(4, (x.n / maxBar) * 110)}px"></div>
              <span class="k">${esc(fmtMonth(x.ym))}</span>
            </div>`).join('')}</div>` : '<div class="empty">No data yet</div>'}
        </div>
      </div>
    </div>`;
}

function monthCard(b) {
  const done = pct(b.processed_count, b.pdf_count);
  return `
    <div class="card month-card" style="box-shadow:none;background:var(--surface-2)">
      <div class="top">
        <div><h3>${esc(fmtMonth(b.month, true))}</h3><div class="folder" title="${esc(b.folder_name)}">${esc(b.folder_name || b.folder_url)}</div></div>
        <span class="pill ${STATUS_PILL[b.status] || 'neutral'}">${esc(b.status)}</span>
      </div>
      <div class="stats">
        <div class="stat"><b>${fmtN(b.record_count)}</b><span>Records</span></div>
        <div class="stat"><b>${fmtN(b.pdf_count)}</b><span>PDFs</span></div>
        <div class="stat"><b style="color:${b.ocr_mismatch_count ? 'var(--bad)' : 'inherit'}">${fmtN(b.ocr_mismatch_count)}</b><span>VIN ✘</span></div>
        <div class="stat"><b style="color:${b.open_issue_count ? 'var(--warn)' : 'inherit'}">${fmtN(b.open_issue_count)}</b><span>Problems</span></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:6px"><span>Processed ${fmtN(b.processed_count)} / ${fmtN(b.pdf_count)}${b.updated_count ? ` · <span style="color:var(--info)">${fmtN(b.updated_count)} updated</span>` : ''}${b.deleted_count ? ` · <span style="color:var(--bad)">${fmtN(b.deleted_count)} deleted</span>` : ''}</span><span>Reference match ${b.reference_count ? pct(b.matched_count, b.reference_count) : 0}%</span></div>
        <div class="meter"><i style="width:${done}%"></i></div>
      </div>
      <div class="row-actions">
        <button class="btn sm primary" data-summary="${b.id}">Summary</button>
        <button class="btn sm" data-go="records" data-batch="${b.id}">All PDFs</button>
        <button class="btn sm" data-go="check-pdf" data-batch="${b.id}">Check PDF</button>
        <button class="btn sm" data-go="check-excel" data-batch="${b.id}">Check Excel</button>
        <button class="btn sm" data-go="issues" data-batch="${b.id}">Other problems</button>
        <button class="btn sm" data-export="${b.id}">${ICON.download} Excel</button>
      </div>
    </div>`;
}

// ---------- Import ----------
function renderImport(params) {
  if (state.importing) { view.replaceChildren(state.importing.el); return; }
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="view-head"><div><h1>Import month</h1><p>Paste the Google Drive folder of one month. Every PDF becomes one record (VIN = key); the Excel in the folder is kept as reference.</p></div></div>
    <div class="card import-hero">
      <div class="import-row">
        <div class="field"><label for="folderUrl">Google Drive folder URL</label>
          <input class="input lg" id="folderUrl" placeholder="https://drive.google.com/drive/folders/…" value="${esc(params.get('url') || '')}" autocomplete="off" spellcheck="false"></div>
        <button class="btn lg" id="checkBtn">${ICON.search} Check folder</button>
      </div>
      <div id="folderBox" hidden>
        <div class="folder-info">
          <div class="info-tile"><span class="label-sm">Folder</span><strong id="fTitle"></strong></div>
          <div class="info-tile"><span class="label-sm">PDF files</span><strong id="fPdfs" class="num"></strong></div>
          <div class="info-tile"><span class="label-sm">Reference Excel</span><strong id="fRef"></strong></div>
          <div class="info-tile"><span class="label-sm">Month</span><input type="month" class="input" id="fMonth" style="height:32px;width:100%;margin-top:2px"></div>
        </div>
        <div id="fExisting" class="muted" style="margin-top:14px" hidden></div>
        <div id="changes" style="margin-top:14px"></div>
        <div id="freeStatus" style="margin-top:14px"></div>
        <div class="options">
          <label class="check"><input type="checkbox" id="optOcr" checked> Read VIN photo with AI</label>
          <label class="check" title="Files whose VIN photo was not read (e.g. AI allowance ran out) or that failed"><input type="checkbox" id="optRetry" checked> Retry unread / failed files</label>
          <label class="check"><input type="checkbox" id="optReprocess"> Re-process all files</label>
          <label class="check">Test run — only first <input type="number" class="input" id="optLimit" min="0" value="0" style="width:74px;height:32px"> files <span class="faint">(0 = all)</span></label>
          <div style="flex:1"></div>
          <button class="btn primary lg" id="startBtn">${ICON.play} Start import</button>
          <button class="btn danger lg" id="stopBtn" hidden>${ICON.stop} Stop</button>
        </div>
      </div>
    </div>

    <div class="card progress-card section-gap" id="progressCard" hidden>
      <div class="progress-top">
        <div><h2>Progress</h2><span class="faint" id="pEta"></span></div>
        <div class="progress-big" id="pPct">0%</div>
      </div>
      <div class="progress"><i id="pBar"></i></div>
      <div class="counters">
        <div class="stat"><b id="pDone">0</b><span>Processed</span></div>
        <div class="stat"><b id="pSaved">0</b><span>Saved</span></div>
        <div class="stat"><b id="pDup">0</b><span>Duplicates</span></div>
        <div class="stat"><b id="pIssues">0</b><span>Issues</span></div>
        <div class="stat"><b id="pErr">0</b><span>Errors</span></div>
        <div class="stat"><b id="pMb">0</b><span>MB downloaded</span></div>
      </div>
      <div class="log" id="log"></div>
      <div class="row-actions" style="margin-top:14px" id="doneActions" hidden></div>
    </div>`;
  view.replaceChildren(el);

  let folder = null;
  const urlInput = $('#folderUrl', el);
  const check = async () => {
    const url = urlInput.value.trim();
    if (!url) { urlInput.focus(); return; }
    const btn = $('#checkBtn', el);
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Checking…';
    try {
      const r = await api(`/api/drive/list?folder=${encodeURIComponent(url)}`);
      folder = { ...r, url };
      const pdfs = r.files.filter((f) => f.type === 'pdf');
      const ref = r.files.find((f) => f.type === 'xlsx');
      $('#fTitle', el).textContent = r.title || r.folderId;
      $('#fTitle', el).title = r.title;
      $('#fPdfs', el).textContent = fmtN(pdfs.length);
      $('#fRef', el).textContent = ref ? ref.name : 'None found';
      $('#fRef', el).title = ref?.name || '';
      const existing = state.batches.find((b) => b.folder_id === r.folderId);
      $('#fMonth', el).value = existing?.month || suggestMonth(r.title);
      const ex = $('#fExisting', el);
      ex.hidden = !existing;
      if (existing) ex.innerHTML = `This folder was imported before as <strong>${esc(fmtMonth(existing.month, true))}</strong> — ${fmtN(existing.processed_count)} of ${fmtN(existing.pdf_count)} files processed. Starting again resumes with the remaining files${existing.processed_count ? ' and, with “Retry unread / failed”, re-reads unread VIN photos' : ''}.`;
      $('#folderBox', el).hidden = false;
      folder.plan = null;
      $('#changes', el).innerHTML = '';
      if (existing) {
        $('#changes', el).innerHTML = '<span class="pill neutral">Comparing with the last import…</span>';
        const stored = await api(`/api/batches?folder=${encodeURIComponent(url)}`);
        const plan = await planFolder(pdfs, stored.files);
        folder.plan = plan;
        $('#changes', el).innerHTML = changesPanel(plan);
      }
      $('#freeStatus', el).innerHTML = '<span class="pill neutral">Free VIN reader loading…</span>';
      const fs = await freeOcrStatus();
      $('#freeStatus', el).innerHTML = fs.available
        ? '<span class="pill ok">Free VIN reader ON</span> <span class="muted">VIN photos are read on this computer first; AI is used only for unclear photos.</span>'
        : `<span class="pill warn">Free VIN reader OFF</span> <span class="muted">${esc(fs.reason)} — every VIN photo will use AI.</span>`;
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${ICON.search} Check folder`;
    }
  };
  $('#checkBtn', el).onclick = check;
  urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
  if (params.get('url')) check();

  $('#startBtn', el).onclick = async () => {
    if (!folder) return;
    const month = $('#fMonth', el).value;
    if (!/^\d{4}-\d{2}$/.test(month)) { toast('Choose the month first', 'err'); return; }
    if (!window.ExcelJS) { toast('Excel library is still loading, try again in a moment', 'err'); return; }
    const ctrl = new AbortController();
    state.importing = { el, ctrl };
    $('#startBtn', el).hidden = true;
    $('#stopBtn', el).hidden = false;
    $('#checkBtn', el).disabled = true;
    urlInput.disabled = true;
    $('#progressCard', el).hidden = false;
    $('#doneActions', el).hidden = true;
    $('#log', el).innerHTML = '';
    const t0 = Date.now();

    const ui = {
      log(msg, level = '') {
        const box = $('#log', el);
        const line = document.createElement('div');
        const time = new Date().toLocaleTimeString('en-GB');
        line.innerHTML = `<span class="t">${time}</span><span class="${level}">${esc(msg)}</span>`;
        const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
        box.appendChild(line);
        if (box.children.length > 3000) box.firstChild.remove();
        if (atBottom) box.scrollTop = box.scrollHeight;
      },
      progress(s) {
        const p = s.total ? Math.round((s.done / s.total) * 100) : 100;
        $('#pBar', el).style.width = `${p}%`;
        $('#pPct', el).textContent = `${p}%`;
        $('#pDone', el).textContent = `${fmtN(s.done)} / ${fmtN(s.total)}`;
        $('#pSaved', el).textContent = fmtN(s.saved);
        $('#pDup', el).textContent = fmtN(s.duplicates);
        $('#pIssues', el).textContent = fmtN(s.issues);
        $('#pErr', el).textContent = fmtN(s.errors);
        $('#pMb', el).textContent = fmtN(Math.round(s.bytes / 1048576));
        if (s.done > 2 && s.done < s.total) {
          const left = ((Date.now() - t0) / s.done) * (s.total - s.done);
          $('#pEta', el).textContent = `about ${Math.ceil(left / 60000)} min left`;
        } else $('#pEta', el).textContent = '';
      },
    };

    try {
      const { batch } = await runImport({
        folder, month, plan: folder.plan,
        reprocess: $('#optReprocess', el).checked,
        retry: $('#optRetry', el).checked,
        ocr: $('#optOcr', el).checked,
        limit: Number($('#optLimit', el).value) || 0,
      }, ui, ctrl.signal);
      toast('Import finished');
      const acts = $('#doneActions', el);
      acts.innerHTML = `
        <button class="btn primary" data-summary="${batch.id}">Import summary</button>
        <button class="btn" data-go="records" data-batch="${batch.id}">All PDFs</button>
        <button class="btn" data-go="check-pdf" data-batch="${batch.id}">Check PDF</button>
        <button class="btn" data-go="check-excel" data-batch="${batch.id}">Check Excel</button>
        <button class="btn" data-go="issues" data-batch="${batch.id}">Other problems</button>
        <button class="btn" data-export="${batch.id}">${ICON.download} Download Excel</button>`;
      acts.hidden = false;
      openSummary(batch.id).catch(() => {});
    } catch (e) {
      ui.log(`Import failed: ${e.message}`, 'err');
      toast(e.message, 'err');
    } finally {
      state.importing = null;
      $('#startBtn', el).hidden = false;
      $('#stopBtn', el).hidden = true;
      $('#checkBtn', el).disabled = false;
      urlInput.disabled = false;
      loadBatches().catch(() => {});
    }
  };
  $('#stopBtn', el).onclick = () => {
    state.importing?.ctrl.abort();
    $('#stopBtn', el).disabled = true;
    setTimeout(() => { $('#stopBtn', el).disabled = false; }, 1500);
  };
}

function changesPanel(plan) {
  const list = (items, fmt) => items.length
    ? `<ul class="change-list">${items.slice(0, 12).map((x) => `<li>${fmt(x)}</li>`).join('')}${items.length > 12 ? `<li class="faint">… and ${items.length - 12} more</li>` : ''}</ul>` : '';
  const nothing = !plan.new.length && !plan.updated.length && !plan.deleted.length && !plan.restored.length;
  return `
    <div class="changes">
      <div class="changes-head">Since the last import:
        <span class="pill ${plan.new.length ? 'info' : 'neutral'}">${fmtN(plan.new.length)} new</span>
        <span class="pill ${plan.updated.length ? 'warn' : 'neutral'}">${fmtN(plan.updated.length)} updated</span>
        <span class="pill ${plan.deleted.length ? 'bad' : 'neutral'}">${fmtN(plan.deleted.length)} deleted</span>
        ${plan.restored.length ? `<span class="pill ok">${fmtN(plan.restored.length)} back again</span>` : ''}
        <span class="pill neutral">${fmtN(plan.unchanged.length)} unchanged</span>
        ${nothing ? '<span class="muted">— nothing changed in the folder.</span>' : ''}
      </div>
      ${plan.updated.length ? `<div class="change-block"><b>Updated</b> — read again; admin review is kept, record marked “Updated”${list(plan.updated, (u) => `${esc(u.file.name)} <span class="faint">(${esc(u.why)})</span>`)}</div>` : ''}
      ${plan.deleted.length ? `<div class="change-block"><b>Deleted</b> — no longer in the folder; records are kept and marked “Deleted”${list(plan.deleted, (d) => `${esc(d.name)}${d.vin ? ` <span class="mono faint">${esc(d.vin)}</span>` : ''}`)}</div>` : ''}
      ${plan.new.length ? `<div class="change-block"><b>New</b>${list(plan.new, (f) => esc(f.name))}</div>` : ''}
    </div>`;
}

// ---------- Check 1 · PDF / Check 2 · Excel ----------
function checkChips(view, params, key, options, facets, total) {
  const cur = params.get(key) || '';
  const base = { batch: params.get('batch') || '' };
  return `<div class="chips">
    <button class="chip ${!cur ? 'active' : ''}" data-chip-go="${view}" data-params='${esc(JSON.stringify(base))}'>All <b>${fmtN(total)}</b></button>
    ${options.map(([v, label, n, tone]) => `<button class="chip chip-${tone} ${cur === v ? 'active' : ''}" data-chip-go="${view}" data-params='${esc(JSON.stringify({ ...base, [key]: v }))}'>${label} <b>${fmtN(n)}</b></button>`).join('')}
  </div>`;
}

function wireCheckPage(view, data) {
  $$('[data-chip-go]').forEach((c) => { c.onclick = () => go(c.dataset.chipGo, JSON.parse(c.dataset.params)); });
  $('#ckBatch').onchange = (e) => { const p = parseHash().params; p.set('batch', e.target.value); p.delete('page'); go(view, Object.fromEntries(p)); };
  $$('tbody tr[data-i]').forEach((tr) => { tr.onclick = () => openRecord(data.records[Number(tr.dataset.i)]); });
  const page = data.page;
  const pages = Math.max(1, Math.ceil(data.total / data.size));
  const nav = (n) => { const p = Object.fromEntries(parseHash().params); go(view, { ...p, page: n }); };
  $('#prevP') && ($('#prevP').onclick = () => nav(page - 1));
  $('#nextP') && ($('#nextP').onclick = () => nav(page + 1));
  $('#prevP') && ($('#prevP').disabled = page <= 1);
  $('#nextP') && ($('#nextP').disabled = page >= pages);
}

const pager = (data) => `<div class="pager"><span>${fmtN(data.total)} record${data.total === 1 ? '' : 's'} · page ${data.page} of ${Math.max(1, Math.ceil(data.total / data.size))}</span>
  <div class="row-actions"><button class="btn sm" id="prevP">← Previous</button><button class="btn sm" id="nextP">Next →</button></div></div>`;

async function renderCheckPdf(params) {
  const q = new URLSearchParams({ page: Number(params.get('page')) || 1, size: 50 });
  for (const k of ['batch', 'vinlevel']) if (params.get(k)) q.set(k, params.get(k));
  const data = await api(`/api/records?${q}`);
  const all = await api(`/api/records?${new URLSearchParams({ size: 1, ...(params.get('batch') ? { batch: params.get('batch') } : {}) })}`);
  const f = all.facets.vin;
  view.innerHTML = `
    <div class="view-head"><div><h1><span class="tab-num big">1</span> Check PDF</h1>
      <p>Is the VIN in the <b>file name</b> the same as the VIN <b>inside the PDF</b>? The file name is the reference; the VIN photo must confirm it; the paper VIN box is checked too.</p></div>
      <button class="btn" data-export="${esc(params.get('batch') || '')}" data-kind="check1">${ICON.download} Export Check 1</button></div>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Month</label><select class="select" id="ckBatch">${monthOptions(params.get('batch'))}</select></div>
        <div class="field grow"><label>Result</label>${checkChips('check-pdf', params, 'vinlevel', [
          ['1', '① Match 3/3', f[1], 'ok'], ['2', '② File = Photo', f[2], 'warn'], ['3', '③ Not matched', f[3], 'bad']], null, all.total)}</div>
      </div>
      <div class="legend"><span>${vinLevelPill(1)} file name = photo = paper</span><span>${vinLevelPill(2)} photo confirms file name, paper box differs</span><span>${vinLevelPill(3)} photo does not confirm file name → open the PDF</span></div>
      <div class="table-wrap">
        ${data.records.length ? `<table>
          <thead><tr><th>Month</th><th>VIN in file name</th><th>VIN photo</th><th>Paper VIN box</th><th>Result</th><th>Read by</th><th>Customer</th><th></th></tr></thead>
          <tbody>${data.records.map((r, i) => `
            <tr class="clickable" data-i="${i}">
              <td><span class="month-chip">${esc(fmtMonth(r.month))}</span></td>
              <td class="mono">${esc(r.file_vin) || '<span class="faint">none</span>'}</td>
              <td class="mono ${r.vin_picture && r.vin_picture !== r.file_vin ? 'bad-cell' : ''}">${esc(r.vin_picture) || `<span class="faint">${r.charger_photo ? 'charger photo' : 'not read'}</span>`}</td>
              <td class="mono ${r.paper_vin !== r.file_vin ? 'warn-cell' : ''}">${esc(r.paper_vin) || '<span class="faint">–</span>'}</td>
              <td title="${esc(r.vin_conf_reasons.join(' · '))}">${vinLevelPill(r.vin_level)}</td>
              <td>${readByPill(r.vin_read_by)}</td>
              <td>${esc(r.customer_name)}</td>
              <td style="white-space:nowrap"><a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF ${ICON.ext}</a></td>
            </tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing here.</div>'}
      </div>
      ${pager(data)}
    </div>`;
  wireCheckPage('check-pdf', data);
}

async function renderCheckExcel(params) {
  const batch = params.get('batch') || '';
  const band = params.get('band') || '';
  const q = new URLSearchParams({ page: Number(params.get('page')) || 1, size: 50 });
  if (batch) q.set('batch', batch);
  if (band) q.set('band', band);
  const data = await api(`/api/baseline?${q}`);
  const f = data.facets;
  const monthExcel = state.batches.find((b) => String(b.id) === String(batch));
  const chips = checkChips('check-excel', params, 'band', [
    ['full', '100%', f.full, 'ok'], ['high', '90–99%', f.high, 'ok'], ['medium', '70–89%', f.medium, 'warn'], ['low', 'Below 70%', f.low, 'bad'],
    ['nopdf', 'Excel row · no PDF', f.nopdf, 'bad'], ['pdfonly', 'PDF · not in Excel', f.pdfonly, 'info']], null, f.excel_rows);
  let table;
  if (band === 'pdfonly') {
    table = data.rows.length ? `<table>
      <thead><tr><th>Month</th><th>VIN (PDF file name)</th><th>Customer (PDF)</th><th>Job number</th><th>Install date (PDF)</th><th></th></tr></thead>
      <tbody>${data.rows.map((r, i) => `<tr class="clickable" data-vin="${esc(r.vin)}">
        <td><span class="month-chip">${esc(fmtMonth(r.month))}</span></td><td class="mono">${esc(r.vin)}</td><td>${esc(r.customer_name)}</td>
        <td class="mono">${esc(r.job_number)}</td><td class="num">${esc(fmtDate(r.install_date))}</td>
        <td><a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF ${ICON.ext}</a></td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Every PDF is in the Excel.</div>';
  } else {
    table = data.rows.length ? `<table class="baseline">
      <thead>
        <tr class="group"><th colspan="6">Excel (baseline)</th><th colspan="7">Found in PDF (Check 1 data)</th><th></th></tr>
        <tr><th>Month</th><th>Row</th><th>VIN</th><th>Customer</th><th>Case no.</th><th>Install date</th>
          <th title="VIN in PDF file name (15)">File</th><th title="VIN in PDF photo (15)">Photo</th><th title="VIN in paper box (10)">Paper</th>
          <th title="Customer name similarity (25)">Name</th><th title="Case number = PDF job number (15)">Case</th><th title="Same date 20 · ≤3 days 10">Date</th>
          <th>Match</th><th></th></tr></thead>
      <tbody>${data.rows.map((x) => {
        const r = x.record;
        const pt = x.parts;
        return `<tr class="${r ? 'clickable' : ''}" data-vin="${esc(r?.vin || '')}">
          <td><span class="month-chip">${esc(fmtMonth(x.month))}</span></td>
          <td class="num faint">${esc(x.row_no)}</td>
          <td class="mono">${esc(x.vin)}</td>
          <td>${esc(x.customer_name)}${r && pt.name < 95 ? `<div class="faint" style="font-size:11.5px">PDF: ${esc(r.customer_name)}</div>` : ''}</td>
          <td class="mono">${esc(x.case_number)}${r && !pt.case ? `<div class="faint" style="font-size:11.5px">PDF: ${esc(r.job_number) || '–'}</div>` : ''}</td>
          <td class="num">${esc(fmtDate(x.install_date))}${r && pt.date_days ? `<div class="faint" style="font-size:11.5px">PDF: ${esc(fmtDate(r.install_date)) || '–'}</div>` : ''}</td>
          ${r ? `<td>${tick(pt.vin_file, 15)}</td><td>${tick(pt.vin_photo, 15)}</td><td>${tick(pt.vin_paper, 10)}</td>
            <td class="num ${pt.name >= 95 ? 'ok-mark' : pt.name >= 80 ? 'warn-mark' : 'bad-mark'}">${pt.name}%</td>
            <td>${tick(pt.case, 15)}</td><td>${dateMark(pt.date_days)}</td>`
            : '<td colspan="6"><span class="faint">No PDF with this VIN</span></td>'}
          <td>${matchPct(x.score, x.band)}</td>
          <td style="white-space:nowrap">${r ? `<a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF ${ICON.ext}</a> · ` : ''}${x.excel_file_id ? `<a href="${excelUrl(x.excel_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Excel ${ICON.ext}</a>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">Nothing here.</div>';
  }
  view.innerHTML = `
    <div class="view-head"><div><h1><span class="tab-num big">2</span> Check Excel</h1>
      <p>Each <b>Excel row</b> (row, VIN, customer, case number, install date) is the baseline. The app finds the PDF with the same VIN and checks every field. <b>% match</b> = VIN in file name 15 + photo 15 + paper 10 + name 25 + case number 15 + date 20.</p></div>
      <div class="row-actions">
        ${monthExcel?.reference_file_id ? `<a class="btn" href="${excelUrl(monthExcel.reference_file_id)}" target="_blank" rel="noopener">Open ${esc(fmtMonth(monthExcel.month))} Excel ${ICON.ext}</a>` : ''}
        <button class="btn" data-export="${esc(batch)}" data-kind="check2">${ICON.download} Export Check 2</button></div></div>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Month (Excel)</label><select class="select" id="ckBatch">${monthOptions(batch)}</select></div>
        <div class="field grow"><label>% match</label>${chips}</div>
      </div>
      <div class="table-wrap">${table}</div>
      ${pager({ total: data.total, page: data.page, size: data.size })}
    </div>`;
  wireCheckPage('check-excel', { ...data, records: [] });
  $$('tbody tr[data-vin]').forEach((tr) => {
    if (!tr.dataset.vin) return;
    tr.onclick = async () => {
      const { records } = await api(`/api/records?q=${encodeURIComponent(tr.dataset.vin)}&size=5`);
      const rec = records.find((x) => x.vin === tr.dataset.vin) || records[0];
      if (rec) openRecord(rec);
    };
  });
}

// ---------- Records ----------
async function renderRecords(params) {
  const page = Number(params.get('page')) || 1;
  const q = new URLSearchParams({ page, size: 50 });
  for (const k of ['batch', 'q', 'match', 'from', 'to', 'conf', 'fstatus', 'vinlevel', 'excel', 'xlband']) if (params.get(k)) q.set(k, params.get(k));
  const data = await api(`/api/records?${q}`);
  state.lastRecords = data.records;
  state.reviewMode = params.get('conf') === 'review';
  const pages = Math.max(1, Math.ceil(data.total / data.size));

  view.innerHTML = `
    <div class="view-head"><div><h1>All PDFs</h1><p>Every PDF record with both check results — search anything, filter, and use “Needs review” as the work queue. Click a row to check and confirm.</p></div>
      <button class="btn" data-export="${esc(params.get('batch') || '')}">${ICON.download} Export all sheets</button></div>
    <div class="card">
      <form class="toolbar" id="filters">
        <div class="field"><label>Month</label><select class="select" name="batch">${monthOptions(params.get('batch'))}</select></div>
        <div class="field grow"><label>Search</label><input class="input" name="q" placeholder="VIN, name, job number, serial, phone…" value="${esc(params.get('q') || '')}"></div>
        <div class="field"><label>Confidence</label><select class="select" name="conf">
          ${[['', 'All'], ['review', 'Needs review (<95%)'], ['full', '100% only']].map(([v, l]) => `<option value="${v}" ${(params.get('conf') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>PDF file</label><select class="select" name="fstatus">
          ${[['', 'All'], ['updated', 'Updated'], ['deleted', 'Deleted']].map(([v, l]) => `<option value="${v}" ${(params.get('fstatus') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>② Check Excel</label><select class="select" name="xlband">
          ${[['', 'All'], ['full', '100%'], ['high', '90–99%'], ['medium', '70–89%'], ['low', 'Below 70%'], ['noexcel', 'Not in Excel']].map(([v, l]) => `<option value="${v}" ${(params.get('xlband') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>① Check PDF</label><select class="select" name="vinlevel">
          ${[['', 'All'], ['1', '① Match 3/3'], ['2', '② File = Photo'], ['3', '③ Not matched']].map(([v, l]) => `<option value="${v}" ${(params.get('vinlevel') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>Installed from</label><input class="input" type="date" name="from" value="${esc(params.get('from') || '')}"></div>
        <div class="field"><label>to</label><input class="input" type="date" name="to" value="${esc(params.get('to') || '')}"></div>
        <button class="btn primary" type="submit">Apply</button>
        <button class="btn" type="button" id="clearF">Clear</button>
      </form>
      <div class="table-wrap">
        ${data.records.length ? `<table>
          <thead><tr><th>Month</th><th title="VIN from the file name (reference)">VIN (file name)</th><th>① Check PDF</th><th>② Check Excel</th><th>Photo VIN</th><th>Paper VIN</th><th>Installed</th><th title="How sure the installation date is right">Date %</th><th>Job number</th><th>Customer</th><th>Serial</th><th></th></tr></thead>
          <tbody>${data.records.map((r, i) => `
            <tr class="clickable" data-i="${i}">
              <td><span class="month-chip">${esc(fmtMonth(r.month))}</span></td>
              <td class="mono">${esc(r.file_vin || r.vin)}</td>
              <td title="${esc(r.vin_conf_reasons.join(' · '))}">${vinLevelPill(r.vin_level)}</td>
              <td>${matchPct(r.xl_score, r.xl_band)}</td>
              <td class="mono ${r.vin_picture && r.vin_picture !== r.file_vin ? 'bad-cell' : ''}">${esc(r.vin_picture) || '<span class="faint">not read</span>'}</td>
              <td class="mono ${r.paper_vin !== r.file_vin ? 'warn-cell' : ''}">${esc(r.paper_vin) || '<span class="faint">–</span>'}</td>
              <td class="num">${esc(fmtDate(r.install_date)) || `<span class="pill bad">${esc(r.install_date_raw || 'missing')}</span>`}</td>
              <td title="${esc(r.date_conf_reasons.join(' · '))}">${confPill(r.date_conf)}</td>
              <td class="mono">${esc(r.job_number)}</td>
              <td>${esc(r.customer_name)}</td>
              <td class="mono">${esc(r.serial)}</td>
              <td style="white-space:nowrap">${r.file_status === 'deleted' ? '' : `<a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF ${ICON.ext}</a> `}${fileStatusPill(r)}</td>
            </tr>`).join('')}</tbody></table>` : '<div class="empty">No records match these filters.</div>'}
      </div>
      <div class="pager">
        <span>${fmtN(data.total)} record${data.total === 1 ? '' : 's'} · page ${page} of ${pages}</span>
        <div class="row-actions">
          <button class="btn sm" id="prevP" ${page <= 1 ? 'disabled' : ''}>← Previous</button>
          <button class="btn sm" id="nextP" ${page >= pages ? 'disabled' : ''}>Next →</button>
        </div>
      </div>
    </div>`;

  const f = $('#filters');
  const current = () => Object.fromEntries(new FormData(f));
  f.onsubmit = (e) => { e.preventDefault(); go('records', current()); };
  f.batch.onchange = () => go('records', current());
  f.vinlevel.onchange = () => go('records', current());
  f.xlband.onchange = () => go('records', current());
  f.conf.onchange = () => go('records', current());
  f.fstatus.onchange = () => go('records', current());
  $('#clearF').onclick = () => go('records');
  $('#prevP').onclick = () => go('records', { ...current(), page: page - 1 });
  $('#nextP').onclick = () => go('records', { ...current(), page: page + 1 });
  $$('tbody tr[data-i]').forEach((tr) => { tr.onclick = () => openRecord(data.records[Number(tr.dataset.i)]); });
}

function openRecord(r) {
  const reasons = (list) => `<ul class="reasons">${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
  const review = `
    <div class="review">
      <div class="review-top"><span class="label-sm">Check against the PDF, then confirm or correct</span>
        <a class="btn sm primary" href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener">Open PDF ${ICON.ext}</a></div>
      <div class="review-grid">
        <div class="review-box">
          <div class="review-head"><span>VIN check</span>${vinLevelPill(r.vin_level)}</div>
          <table class="vin-sources">
            <tr><td>File name</td><td class="mono">${esc(r.file_vin) || '<span class="faint">none</span>'}</td><td>reference</td></tr>
            <tr><td>Photo</td><td class="mono">${esc(r.vin_picture) || '<span class="faint">not read</span>'}</td><td>${r.vin_picture && r.vin_picture === r.file_vin ? '<span class="ok-mark">✔</span>' : '<span class="bad-mark">✘</span>'}</td></tr>
            <tr><td>Paper box</td><td class="mono">${esc(r.paper_vin) || '<span class="faint">not read</span>'}</td><td>${r.paper_vin && r.paper_vin === r.file_vin ? '<span class="ok-mark">✔</span>' : '<span class="warn-mark">✘</span>'}</td></tr>
          </table>
          ${reasons(r.vin_conf_reasons)}
          <div class="row-actions">
            ${r.vin_confirmed || !r.file_vin ? '' : `<button class="btn sm" data-confirm-vin="${esc(r.vin)}" title="I checked the photo in the PDF: it shows the file name VIN">✔ Photo shows this VIN</button>`}
            <button class="btn sm" data-correct-vin="${esc(r.vin)}">Correct VIN</button>
          </div>
        </div>
        <div class="review-box">
          <div class="review-head"><span>② Check Excel</span>${matchPct(r.xl_score, r.xl_band)}</div>
          ${r.xl_parts ? `<table class="vin-sources">
            <tr><td>Excel row</td><td colspan="2">${r.ref_sheet_name ? `“${esc(r.ref_sheet_name)}” ` : ''}row ${esc(r.ref_row || '?')}</td></tr>
            <tr><td>VIN (Excel)</td><td class="mono" colspan="2">${esc(r.vin)}</td></tr>
            <tr><td>· file name</td><td class="mono">${esc(r.file_vin) || '–'}</td><td>${tick(r.xl_parts.vin_file, 15)}</td></tr>
            <tr><td>· photo</td><td class="mono">${esc(r.vin_picture) || 'not read'}</td><td>${tick(r.xl_parts.vin_photo, 15)}</td></tr>
            <tr><td>· paper box</td><td class="mono">${esc(r.paper_vin) || '–'}</td><td>${tick(r.xl_parts.vin_paper, 10)}</td></tr>
            <tr><td>Name</td><td>${esc(r.ref_name) || '–'}${r.xl_parts.name < 95 ? `<div class="faint">PDF: ${esc(r.customer_name)}</div>` : ''}</td><td>${r.xl_parts.name}%</td></tr>
            <tr><td>Case no.</td><td class="mono">${esc(r.ref_case) || '–'}${!r.xl_parts.case ? `<div class="faint">PDF: ${esc(r.job_number) || '–'}</div>` : ''}</td><td>${tick(r.xl_parts.case, 15)}</td></tr>
            <tr><td>Date</td><td>${esc(fmtDate(r.ref_date)) || '–'}${r.xl_parts.date_days ? `<div class="faint">PDF: ${esc(fmtDate(r.install_date)) || '–'}</div>` : ''}</td><td>${dateMark(r.xl_parts.date_days)}</td></tr>
          </table>` : `<div class="faint" style="font-size:12.5px">VIN ${esc(r.vin)} is not in the submission Excel.</div>`}
          <div class="row-actions">
            ${excelUrl(r.ref_file_id || r.month_ref_file_id) ? `<a class="btn sm" href="${excelUrl(r.ref_file_id || r.month_ref_file_id)}" target="_blank" rel="noopener">Open Excel ${ICON.ext}</a>` : ''}
            ${r.name_confirmed ? '' : `<button class="btn sm" data-confirm-name="${esc(r.vin)}">✔ Name is correct</button>`}
            <button class="btn sm" data-edit-name="${esc(r.vin)}">Edit name</button>
          </div>
        </div>
        <div class="review-box">
          <div class="review-head"><span>Installation date</span>${confPill(r.date_conf, true)}</div>
          <div class="review-value">${esc(fmtDate(r.install_date)) || '<span class="pill bad">unreadable</span>'} <span class="faint">PDF: ${esc(r.install_date_raw) || '–'}</span></div>
          ${reasons(r.date_conf_reasons)}
          <div class="row-actions">
            ${r.date_confirmed || !r.install_date ? '' : `<button class="btn sm" data-confirm-date="${esc(r.vin)}">✔ Confirm date</button>`}
            <button class="btn sm" data-edit-date="${esc(r.vin)}" data-current="${esc(r.install_date)}">Edit date</button>
          </div>
        </div>
      </div>
    </div>`;
  const rows = [
    ['VIN (primary key)', `<span class="mono">${esc(r.vin)}</span>`],
    ['VIN picture', `<span class="mono">${esc(r.vin_picture) || '–'}</span> ${matchPill(r.vin_photo_match)} ${readByPill(r.vin_read_by)}`],
    ['Installation date', `${esc(fmtDate(r.install_date)) || '<span class="pill bad">unreadable</span>'} <span class="faint">(PDF: ${esc(r.install_date_raw) || '–'})</span>`],
    ['Job number', `<span class="mono">${esc(r.job_number)}</span>`],
    ['Charger / PO code', esc(r.charger_code)],
    ['Customer name', esc(r.customer_name)],
    ['Phone', esc(r.phone)],
    ['Region', esc(r.region)],
    ['Site type', esc(r.site_type)],
    ['Charger serial', `<span class="mono">${esc(r.serial)}</span>`],
    ['Report printed', esc(r.report_printed_at)],
    ['Month', esc(fmtMonth(r.month, true))],
    ['Job URL', r.job_url ? `<a href="${esc(r.job_url)}" target="_blank" rel="noopener">${esc(r.job_url)} ${ICON.ext}</a>` : '–'],
    ['PDF', `<a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener">${esc(r.pdf_name)} ${ICON.ext}</a> ${fileStatusPill(r)}`],
    ['Raw reading', `<span class="mono faint">${esc(r.ocr_raw) || '–'}</span>`],
    ['Notes', esc(r.notes) || '–'],
    ['Last updated', esc(r.updated_at)],
  ];
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  const d = document.createElement('aside');
  d.className = 'drawer';
  d.innerHTML = `
    <div class="drawer-head"><div>
        <div class="month-line"><span class="month-badge">${esc(fmtMonth(r.month, true).toUpperCase())}</span>
          ${r.ref_month && r.ref_month !== r.month ? `<span class="pill warn">In the ${esc(fmtMonth(r.ref_month, true))} Excel</span>` : ''}
          <span class="label-sm">Installation record</span></div>
        <h2>${esc(r.customer_name || r.vin)}</h2>
        <div class="faint" style="font-size:12.5px;margin-top:3px">VIN <span class="mono">${esc(r.vin)}</span></div></div>
      <button class="icon-btn" aria-label="Close">✕</button></div>
    <div class="drawer-body">${review}
      <div class="history" id="recHistory"><div class="label-sm">History</div><div class="faint" style="font-size:12.5px">Loading…</div></div>
      <dl style="margin:0">${rows.map(([k, v]) => `<div class="kv"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`;
  const close = () => { back.remove(); d.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.onclick = close;
  $('.icon-btn', d).onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.append(back, d);
  editContext.set(r.vin, r);
  loadHistory(r.vin, $('#recHistory', d));
}

// ---------- record transaction history ----------
const FIELD_LABEL = { vin: 'VIN', install_date: 'Installation date', customer_name: 'Customer name', file: 'PDF file' };
const ACTION_LABEL = { confirm: 'Confirmed', correct: 'Corrected', updated: 'Updated in Drive', deleted: 'Deleted from Drive', restored: 'Back in Drive' };
// Stored times are UTC ("YYYY-MM-DD HH:MM:SS") → local "dd/mm/yyyy HH:MM".
function localTime(at) {
  const d = new Date(`${String(at).replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return at;
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
async function loadHistory(vin, box) {
  try {
    const { history } = await api(`/api/records/${encodeURIComponent(vin)}`);
    box.innerHTML = `<div class="label-sm">History</div>${history.length ? `<ol class="history-list">${history.map((h) => `
      <li><span class="h-time num">${esc(localTime(h.at))}</span>
        <span><b>${esc(ACTION_LABEL[h.action] || h.action)}</b> ${esc(FIELD_LABEL[h.field] || h.field)}
        ${h.field !== 'file' && h.old_value !== h.new_value ? `: <span class="h-old">${esc(h.field === 'install_date' ? fmtDate(h.old_value) || h.old_value || '–' : h.old_value || '–')}</span> → <span class="h-new">${esc(h.field === 'install_date' ? fmtDate(h.new_value) : h.new_value)}</span>` : h.field !== 'file' ? `: ${esc(h.field === 'install_date' ? fmtDate(h.new_value) : h.new_value)}` : ''}
        ${h.note ? `<span class="faint"> · ${esc(h.note)}</span>` : ''}${h.ip ? `<span class="faint"> · ${esc(h.ip)}</span>` : ''}</span></li>`).join('')}</ol>`
      : '<div class="faint" style="font-size:12.5px">No admin changes yet.</div>'}`;
  } catch { box.innerHTML = '<div class="label-sm">History</div><div class="faint">Could not load history.</div>'; }
}

// ---------- Import summary (per month) ----------
async function openSummary(batchId) {
  const { batch, counts: c, quotaReached } = await api(`/api/batches/${batchId}/summary`);
  const b = String(batch.id);
  const rows = [
    ['Records saved', c.saved, 'neutral', 'One record per PDF, keyed by VIN', ['records', { batch: b }]],
    ['VIN ① Match 3/3', c.vin_l1, 'ok', 'File name = VIN photo = paper VIN box', ['records', { batch: b, vinlevel: '1' }]],
    ['VIN ② File = Photo', c.vin_l2, 'warn', 'Photo confirms the file name; the paper VIN box differs', ['records', { batch: b, vinlevel: '2' }]],
    ['VIN ③ Not matched', c.vin_l3, 'bad', 'Photo does not confirm the file name (differs or not readable) — check the PDF', ['records', { batch: b, vinlevel: '3' }]],
    ['VIN photo not read — AI quota used up', c.unread_quota, 'warn', 'Daily free Workers AI allowance ran out', ['issues', { batch: b, type: 'ocr_failed', q: 'allocation' }]],
    ['Files failed (not saved)', c.failed, 'bad', c.failed_quota ? `${fmtN(c.failed_quota)} of them scanned pages that hit the AI quota` : 'Download or reading errors', ['issues', { batch: b, type: 'error' }]],
    ['Duplicate VIN (same VIN in 2 files)', c.duplicates, 'info', 'Second file kept as an issue — choose which one to keep', ['issues', { batch: b, type: 'duplicate_vin' }]],
  ];
  const mins = Math.max(0, Math.round((new Date(`${batch.updated_at}Z`) - new Date(`${batch.imported_at}Z`)) / 60000));

  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  const d = document.createElement('aside');
  d.className = 'drawer';
  d.style.width = '640px';
  d.innerHTML = `
    <div class="drawer-head"><div><div class="label-sm">Import summary</div><h2>${esc(fmtMonth(batch.month, true))}</h2>
      <div class="faint" style="font-size:12.5px;margin-top:4px">${esc(batch.folder_name)}</div></div>
      <button class="icon-btn" aria-label="Close">✕</button></div>
    <div class="drawer-body">
      <div class="stats" style="margin:16px 0 18px">
        <div class="stat"><b>${fmtN(batch.pdf_count)}</b><span>PDFs in folder</span></div>
        <div class="stat"><b>${fmtN(c.processed)}</b><span>Processed</span></div>
        <div class="stat"><b>${fmtN(c.scanned)}</b><span>Scanned pages</span></div>
        <div class="stat"><b>${mins ? `${mins} min` : '–'}</b><span>Last run</span></div>
      </div>
      ${quotaReached ? `<div class="login-error" style="margin-bottom:16px">The daily free Workers AI allowance (10,000 neurons) ran out during this import. Unread photos and failed scanned pages can be retried after the allowance resets (00:00 UTC = 07:00 Thailand).</div>` : ''}
      <table class="summary-table">
        <thead><tr><th>Result</th><th style="text-align:right">Count</th><th></th></tr></thead>
        <tbody>${rows.map(([label, n, tone, hint, link], i) => `
          <tr class="${n ? 'clickable' : ''}" data-row="${i}">
            <td><div class="stack"><span><i class="tone-dot ${tone}"></i>${esc(label)}</span><small>${esc(hint)}</small></div></td>
            <td class="num" style="text-align:right;font-size:18px;font-weight:650;${n && tone === 'bad' ? 'color:var(--bad)' : n && tone === 'warn' ? 'color:var(--warn)' : ''}">${fmtN(n)}</td>
            <td style="text-align:right">${n ? `<span class="faint">View →</span>` : ''}</td>
          </tr>`).join('')}</tbody>
      </table>
      <div class="kv" style="border:0;margin-top:10px"><dt>Other checks</dt><dd class="muted">${fmtN(c.missing_vin)} VIN taken from file name · ${fmtN(c.bad_date)} unreadable dates · ${fmtN(c.charger_photo)} charger photo in VIN slot</dd></div>
      <div class="kv" style="border:0"><dt>Excel check</dt><dd>
        <a href="#/records?batch=${b}&excel=match" data-close-summary>${excelPill('match', 0, false)} ${fmtN(c.xl_match)}</a> &nbsp;
        <a href="#/records?batch=${b}&excel=close" data-close-summary>${excelPill('close', 0, false)} ${fmtN(c.xl_close)}</a> &nbsp;
        <a href="#/records?batch=${b}&excel=different" data-close-summary>${excelPill('different', 0, false)} ${fmtN(c.xl_diff)}</a> &nbsp;
        <a href="#/records?batch=${b}&excel=missing" data-close-summary>${excelPill('missing', 0, false)} ${fmtN(c.xl_missing)}</a></dd></div>
      <div class="kv" style="border:0"><dt>PDF files</dt><dd>
        <a href="#/records?batch=${b}&fstatus=updated" data-close-summary><span class="pill info plain">Updated ${fmtN(c.updated_files)}</span></a>
        <a href="#/records?batch=${b}&fstatus=deleted" data-close-summary><span class="pill bad plain">Deleted ${fmtN(c.deleted_files)}</span></a></dd></div>
      <div class="kv" style="border:0"><dt>VIN photos read by</dt><dd><span class="pill ok plain">Free ${fmtN(c.read_free)}</span> <span class="pill info plain">AI ${fmtN(c.read_ai)}</span></dd></div>
      <div class="row-actions" style="margin-top:8px">
        <button class="btn" data-sum-go="check-excel">Check Excel</button>
        <button class="btn" data-sum-export>${ICON.download} Download Excel</button>
      </div>
    </div>`;
  const close = () => { back.remove(); d.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.onclick = close;
  $('.icon-btn', d).onclick = close;
  $$('tr[data-row]', d).forEach((tr) => {
    const [, n, , , [view_, params]] = rows[Number(tr.dataset.row)];
    if (n) tr.onclick = () => { close(); go(view_, params); };
  });
  $('[data-sum-go]', d).onclick = () => { close(); go('check-excel', { batch: b }); };
  $$('[data-close-summary]', d).forEach((a) => { a.onclick = close; });
  $('[data-sum-export]', d).onclick = () => exportExcel(b);
  document.addEventListener('keydown', onKey);
  document.body.append(back, d);
}

// ---------- Compare ----------
async function renderCompare(params) {
  const batch = params.get('batch') || '';
  const status = params.get('status') || '';
  const onlyBad = params.get('bad') === '1';
  const data = await api(`/api/compare${batch ? `?batch=${batch}` : ''}`);
  const isBad = (x) => [x.date_match, x.job_match, x.serial_match, x.name_match].includes(0);
  let rows = data.rows;
  if (status) rows = rows.filter((x) => x.status === status);
  if (onlyBad) rows = rows.filter(isBad);
  const statuses = ['Both', 'PDF only', 'Reference only', 'PDF in other month', 'Charger-only sheet'];
  const badCount = data.rows.filter(isBad).length;
  const cell = (flag, a, b, mono = false) => `
    <td class="${flag === 0 ? 'bad-cell' : ''}"><div class="stack ${mono ? 'mono' : ''}"><span>${esc(a) || '<span class="faint">–</span>'}</span><small>${esc(b) || '–'}</small></div></td>`;

  view.innerHTML = `
    <div class="view-head"><div><h1>Compare with reference</h1><p>PDF data vs the submission Excel kept in each folder. Top line = PDF, second line = Excel.</p></div>
      <button class="btn" data-export="${esc(batch)}">${ICON.download} Export Excel</button></div>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Month</label><select class="select" id="cBatch">${monthOptions(batch)}</select></div>
        <div class="field grow"><label>Status</label><div class="chips">
          <button class="chip ${!status && !onlyBad ? 'active' : ''}" data-status="">All <b>${fmtN(data.rows.length)}</b></button>
          ${statuses.filter((s) => data.summary[s]).map((s) => `<button class="chip ${status === s ? 'active' : ''}" data-status="${esc(s)}">${esc(s)} <b>${fmtN(data.summary[s])}</b></button>`).join('')}
          <button class="chip ${onlyBad ? 'active' : ''}" id="onlyBad" style="${badCount ? 'color:var(--bad)' : ''}">Field mismatches <b>${fmtN(badCount)}</b></button>
        </div></div>
      </div>
      <div class="table-wrap">
        ${rows.length ? `<table>
          <thead><tr><th>VIN</th><th>Status</th><th>Date</th><th>Install date</th><th>Job</th><th>Job / Case number</th><th>Serial</th><th>Charger serial</th><th>Name</th><th>Customer</th><th>Month</th></tr></thead>
          <tbody>${rows.slice(0, 2000).map((x) => `
            <tr>
              <td class="mono">${esc(x.vin)}</td>
              <td><span class="pill ${x.status === 'Both' ? 'ok' : x.status === 'Reference only' ? 'bad' : 'warn'}">${esc(x.status)}</span></td>
              <td>${flagCell(x.date_match)}</td>${cell(x.date_match, fmtDate(x.record?.install_date), fmtDate(x.reference?.install_date))}
              <td>${flagCell(x.job_match)}</td>${cell(x.job_match, x.record?.job_number, x.reference?.case_number, true)}
              <td>${flagCell(x.serial_match)}</td>${cell(x.serial_match, x.record?.serial, x.reference?.serial, true)}
              <td>${flagCell(x.name_match)}${x.name_score != null && x.name_match === 0 ? `<div class="faint" style="font-size:11px">${x.name_score}%</div>` : ''}</td>${cell(x.name_match, x.record?.customer_name, x.reference?.customer_name)}
              <td class="faint">${esc(fmtMonth(x.month))}</td>
            </tr>`).join('')}</tbody></table>` : '<div class="empty">Nothing to show.</div>'}
      </div>
      <div class="pager"><span>${fmtN(rows.length)} row${rows.length === 1 ? '' : 's'}${rows.length > 2000 ? ' · showing first 2,000 (export for all)' : ''}</span></div>
    </div>`;
  $('#cBatch').onchange = (e) => go('compare', { batch: e.target.value, status, bad: onlyBad ? '1' : '' });
  $$('.chip[data-status]').forEach((c) => { c.onclick = () => go('compare', { batch, status: c.dataset.status }); });
  $('#onlyBad').onclick = () => go('compare', { batch, bad: onlyBad ? '' : '1' });
}

// ---------- Issues ----------
async function renderIssues(params) {
  const batch = params.get('batch') || '';
  const type = params.get('type') || '';
  const text = params.get('q') || '';
  const showResolved = params.get('resolved') === 'all';
  const q = new URLSearchParams();
  if (batch) q.set('batch', batch);
  if (type) q.set('type', type); else q.set('scope', 'other');
  if (text) q.set('q', text);
  if (!showResolved) q.set('resolved', '0');
  const { issues } = await api(`/api/issues?${q}`);
  const detailText = (i) => { try { const d = JSON.parse(i.detail); return d?.message || i.detail; } catch { return i.detail; } };

  view.innerHTML = `
    <div class="view-head"><div><h1>Other problems</h1><p>Problems that ① Check PDF and ② Check Excel do not show: edited reports, duplicate VINs, scanned pages, charger photo in the VIN slot, failed files and PDFs updated in Drive. Check them and mark resolved.</p></div></div>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Month</label><select class="select" id="iBatch">${monthOptions(batch)}</select></div>
        <div class="field"><label>Type</label><select class="select" id="iType"><option value="">All other problems</option>
          ${OTHER_TYPES.map((k) => `<option value="${k}" ${type === k ? 'selected' : ''}>${ISSUE_LABEL[k][0]}</option>`).join('')}
          ${type && !OTHER_TYPES.includes(type) ? `<option value="${type}" selected>${(ISSUE_LABEL[type] || [type])[0]}</option>` : ''}</select></div>
        ${text ? `<button class="chip active" id="iClearQ" title="Remove text filter">“${esc(text)}” ✕</button>` : ''}
        <label class="check" style="height:40px"><input type="checkbox" id="iResolved" ${showResolved ? 'checked' : ''}> Show resolved</label>
      </div>
      <div class="table-wrap">
        ${issues.length ? `<table>
          <thead><tr><th>Type</th><th>VIN</th><th>Detail</th><th>PDF</th><th>Month</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>${issues.map((i) => `
            <tr style="${i.resolved ? 'opacity:.5' : ''}">
              <td>${issuePill(i.type)}</td>
              <td class="mono">${esc(i.vin)}</td>
              <td style="max-width:520px">${esc(detailText(i))}</td>
              <td>${i.pdf_file_id ? `<a href="${pdfUrl(i.pdf_file_id)}" target="_blank" rel="noopener" title="${esc(i.pdf_name)}">Open ${ICON.ext}</a>` : ''}</td>
              <td class="faint">${esc(fmtMonth(i.month))}</td>
              <td style="text-align:right;white-space:nowrap">
                ${['bad_date', 'suspicious_date'].includes(i.type) && !i.resolved && i.vin ? `<button class="btn sm" data-edit-date="${esc(i.vin)}" data-current="">Fix date</button>` : ''}
                ${i.type === 'duplicate_vin' && !i.resolved ? `<button class="btn sm" data-replace="${i.id}" title="Use this PDF's data for the VIN instead of the stored one">Use this PDF</button>` : ''}
                <button class="btn sm" data-resolve="${i.id}" data-val="${i.resolved ? 0 : 1}">${i.resolved ? 'Reopen' : 'Resolve'}</button>
              </td>
            </tr>`).join('')}</tbody></table>` : '<div class="empty">No other problems — nice.</div>'}
      </div>
      <div class="pager"><span>${fmtN(issues.length)} problem${issues.length === 1 ? '' : 's'}</span></div>
    </div>`;
  const nav = (keepQ = true) => go('issues', { batch: $('#iBatch').value, type: $('#iType').value, q: keepQ ? text : '', resolved: $('#iResolved').checked ? 'all' : '' });
  if (text) $('#iClearQ').onclick = () => nav(false);
  $('#iBatch').onchange = () => nav();
  $('#iType').onchange = () => nav();
  $('#iResolved').onchange = () => nav();
  $$('[data-resolve]').forEach((b) => {
    b.onclick = async () => {
      await api(`/api/issues/${b.dataset.resolve}`, { method: 'PATCH', body: { resolved: Number(b.dataset.val) } });
      route();
    };
  });
  $$('[data-replace]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Replace the stored record for this VIN with the data from this PDF?')) return;
      await api(`/api/issues/${b.dataset.replace}`, { method: 'POST', body: { action: 'replace' } });
      toast('Record replaced');
      route();
    };
  });
}

// ---------- Months ----------
async function renderMonths() {
  const b = state.batches;
  view.innerHTML = `
    <div class="view-head"><div><h1>Months</h1><p>Every imported Drive folder. New URLs add a new month; all data is kept.</p></div>
      <button class="btn primary" data-go="import">${ICON.play} Import a month</button></div>
    <div class="card">
      <div class="table-wrap">
        ${b.length ? `<table>
          <thead><tr><th>Month</th><th>Folder</th><th>PDFs</th><th>Processed</th><th>Records</th><th>VIN ✘</th><th>Problems</th><th>Excel</th><th>Status</th><th>Imported</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${b.map((x) => `
            <tr>
              <td><input type="month" class="input" value="${esc(x.month)}" data-month="${x.id}" style="height:32px;width:150px"></td>
              <td style="max-width:300px"><a href="${esc(x.folder_url)}" target="_blank" rel="noopener">${esc(x.folder_name || x.folder_id)} ${ICON.ext}</a></td>
              <td class="num">${fmtN(x.pdf_count)}</td>
              <td class="num">${fmtN(x.processed_count)}</td>
              <td class="num">${fmtN(x.record_count)}</td>
              <td class="num" style="color:${x.ocr_mismatch_count ? 'var(--bad)' : 'inherit'}">${fmtN(x.ocr_mismatch_count)}</td>
              <td class="num">${fmtN(x.open_issue_count)}</td>
              <td><div class="stack"><span class="num">${fmtN(x.matched_count)} / ${fmtN(x.reference_count)}</span><small title="${esc(x.reference_name)}">${x.reference_file_id ? `<a href="${excelUrl(x.reference_file_id)}" target="_blank" rel="noopener">${esc((x.reference_name || 'Excel').slice(0, 30))} ${ICON.ext}</a>` : esc((x.reference_name || 'no Excel').slice(0, 30))}</small></div></td>
              <td><span class="pill ${STATUS_PILL[x.status] || 'neutral'}">${esc(x.status)}</span></td>
              <td class="faint num">${esc(fmtDate(x.imported_at))}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn sm primary" data-summary="${x.id}">Summary</button>
                <button class="btn sm" data-resume="${esc(x.folder_url)}">${x.status === 'done' ? 'Re-check' : 'Resume'}</button>
                <button class="btn sm" data-export="${x.id}">${ICON.download}</button>
                <button class="btn sm danger" data-del="${x.id}" data-name="${esc(fmtMonth(x.month, true))}">Delete</button>
              </td>
            </tr>`).join('')}</tbody></table>` : '<div class="empty">No months imported yet.</div>'}
      </div>
    </div>`;
  $$('[data-month]').forEach((inp) => {
    inp.onchange = async () => {
      await api(`/api/batches/${inp.dataset.month}`, { method: 'PATCH', body: { month: inp.value } });
      toast('Month updated');
      route();
    };
  });
  $$('[data-resume]').forEach((btn) => { btn.onclick = () => go('import', { url: btn.dataset.resume }); });
  $$('[data-del]').forEach((btn) => {
    btn.onclick = async () => {
      const name = btn.dataset.name;
      const typed = prompt(`Delete ${name} and all its records, reference rows and issues?\nType DELETE to confirm.`);
      if (typed !== 'DELETE') return;
      await api(`/api/batches/${btn.dataset.del}`, { method: 'DELETE' });
      toast(`${name} deleted`);
      route();
    };
  });
}

// ---------- Export ----------
function renderExport(params) {
  view.innerHTML = `
    <div class="view-head"><div><h1>Export</h1><p>Download an Excel file built from the stored data.</p></div></div>
    <div class="grid cols-2">
      <div class="card card-pad">
        <div class="field" style="max-width:360px"><label>Months</label><select class="select" id="eBatch">${monthOptions(params.get('batch'))}</select></div>
        <div class="field" style="max-width:360px;margin-top:16px"><label>What</label><select class="select" id="eKind">
          <option value="all">All sheets</option><option value="check1">① Check PDF only</option><option value="check2">② Check Excel only</option></select></div>
        <div style="margin-top:22px"><button class="btn primary lg" id="eGo">${ICON.download} Download Excel</button></div>
      </div>
      <div class="card card-pad">
        <h2 style="margin:0 0 12px;font-size:15px">Sheets</h2>
        <dl style="margin:0">
          <div class="kv"><dt>PDF</dt><dd>One row per PDF: all fields, ① result, ② % match, date %, links (All sheets)</dd></div>
          <div class="kv"><dt>Check 1 · PDF</dt><dd>VIN in file name vs photo vs paper box, result ①②③ and why</dd></div>
          <div class="kv"><dt>Check 2 · Excel baseline</dt><dd>Every Excel row with ✔/✘ per field and % match</dd></div>
          <div class="kv"><dt>Other problems</dt><dd>Edited PDF, duplicate VIN, scanned page, charger photo, failed files (All sheets)</dd></div>
          <div class="kv" style="border:0"><dt>Summary</dt><dd>Counts for the export</dd></div>
        </dl>
      </div>
    </div>`;
  $('#eGo').onclick = () => exportExcel($('#eBatch').value, $('#eKind').value);
}

async function exportExcel(batchId, kind = 'all') {
  if (!window.ExcelJS) { toast('Excel library is still loading, try again', 'err'); return; }
  const b = state.batches.find((x) => String(x.id) === String(batchId));
  toast('Building Excel…');
  try {
    await downloadWorkbook(window.ExcelJS, {
      batchId: b ? b.id : null,
      label: b ? fmtMonth(b.month, true) : 'All months',
      fileTag: b ? b.month : 'all-months',
      kind,
    });
  } catch (e) {
    toast(`Export failed: ${e.message}`, 'err');
  }
}

// ---------- installation date correction ----------
function editDate(vin, current) {
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  back.style.zIndex = 50;
  const box = document.createElement('div');
  box.className = 'card card-pad date-dialog';
  box.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:17px">Correct installation date</h2>
    <p class="muted" style="margin:0 0 16px">VIN <span class="mono">${esc(vin)}</span> — the original PDF text is kept in the notes.</p>
    <div class="field"><label>Installation date</label><input class="input lg" type="date" id="edDate" value="${esc(current || '')}" min="2015-01-01"></div>
    <div class="row-actions" style="margin-top:18px;justify-content:flex-end">
      <button class="btn" id="edCancel">Cancel</button><button class="btn primary" id="edSave">Save</button></div>`;
  const close = () => { back.remove(); box.remove(); };
  back.onclick = close;
  document.body.append(back, box);
  $('#edCancel', box).onclick = close;
  $('#edDate', box).focus();
  $('#edSave', box).onclick = async () => {
    const v = $('#edDate', box).value;
    if (!v) { toast('Choose a date', 'err'); return; }
    try {
      await api(`/api/records/${encodeURIComponent(vin)}`, { method: 'PATCH', body: { install_date: v } });
      close();
      await afterReview(`Date saved: ${fmtDate(v)}`);
    } catch (err) { toast(err.message, 'err'); }
  };
}

// After a confirm/correct: refresh, and in "Needs review" mode open the next record to check.
async function afterReview(message) {
  $$('.drawer, .drawer-backdrop').forEach((x) => x.remove());
  toast(message);
  await route();
  if (state.reviewMode && parseHash().name === 'records' && state.lastRecords?.length) openRecord(state.lastRecords[0]);
}

async function reviewPatch(vin, body, message) {
  try {
    await api(`/api/records/${encodeURIComponent(vin)}`, { method: 'PATCH', body });
    await afterReview(message);
  } catch (err) { toast(err.message, 'err'); }
}

const editContext = new Map(); // vin → record shown in the drawer (for suggestions in dialogs)

function editName(vin) {
  const r = editContext.get(vin) || {};
  const fromFile = (r.pdf_name || '').replace(/\.pdf$/i, '').replace(/^[A-Za-z0-9]{17}/, '').replace(/\(\d+\)$/, '').replace(/^[\s_\-.]+/, '').trim();
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  back.style.zIndex = 50;
  const box = document.createElement('div');
  box.className = 'card card-pad date-dialog';
  box.style.width = '520px';
  box.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:17px">Customer name</h2>
    <p class="muted" style="margin:0 0 14px">Check the PDF and the Excel, then save the correct name. The change is kept in the history.</p>
    <div class="field"><label>Customer name</label><input class="input lg" id="edName" value="${esc(r.customer_name || '')}" autocomplete="off"></div>
    <div class="row-actions" style="margin-top:10px">
      ${r.ref_name ? `<button class="btn sm" data-fill="${esc(r.ref_name)}" data-src="Excel">Use Excel name: ${esc(r.ref_name)}</button>` : ''}
      ${fromFile && fromFile !== r.customer_name ? `<button class="btn sm" data-fill="${esc(fromFile)}" data-src="file name">Use file name: ${esc(fromFile)}</button>` : ''}
    </div>
    <div class="row-actions" style="margin-top:18px;justify-content:flex-end">
      <button class="btn" id="edCancel">Cancel</button><button class="btn primary" id="edSave">Save</button></div>`;
  const close = () => { back.remove(); box.remove(); };
  back.onclick = close;
  document.body.append(back, box);
  let source = '';
  const inp = $('#edName', box);
  $$('[data-fill]', box).forEach((b) => { b.onclick = () => { inp.value = b.dataset.fill; source = b.dataset.src; inp.focus(); }; });
  inp.oninput = () => { source = ''; };
  inp.focus();
  $('#edCancel', box).onclick = close;
  $('#edSave', box).onclick = async () => {
    const name = inp.value.trim();
    if (name.length < 2) { toast('Enter the customer name', 'err'); return; }
    close();
    await reviewPatch(vin, { customer_name: name, source }, 'Customer name saved');
  };
}

function correctVin(vin) {
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  back.style.zIndex = 50;
  const box = document.createElement('div');
  box.className = 'card card-pad date-dialog';
  box.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:17px">Correct VIN</h2>
    <p class="muted" style="margin:0 0 16px">Type the VIN exactly as on the car / PDF photo. The old VIN is kept in the notes.</p>
    <div class="field"><label>VIN (17 characters)</label><input class="input lg mono" id="edVin" value="${esc(vin)}" maxlength="17" autocomplete="off" spellcheck="false" style="text-transform:uppercase"></div>
    <div class="faint" id="edVinHint" style="margin-top:8px;font-size:12.5px">17 / 17</div>
    <div class="row-actions" style="margin-top:18px;justify-content:flex-end">
      <button class="btn" id="edCancel">Cancel</button><button class="btn primary" id="edSave">Save</button></div>`;
  const close = () => { back.remove(); box.remove(); };
  back.onclick = close;
  document.body.append(back, box);
  const inp = $('#edVin', box);
  inp.oninput = () => { $('#edVinHint', box).textContent = `${inp.value.replace(/[^A-Za-z0-9]/g, '').length} / 17`; };
  inp.focus();
  inp.select();
  $('#edCancel', box).onclick = close;
  $('#edSave', box).onclick = async () => {
    const nv = inp.value.trim().toUpperCase();
    close();
    await reviewPatch(vin, { new_vin: nv }, nv === vin ? `VIN ${vin} confirmed` : `VIN corrected to ${nv}`);
  };
}

// ---------- global wiring ----------
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]');
  if (g) { e.preventDefault(); go(g.dataset.go, g.dataset.batch ? { batch: g.dataset.batch } : {}); return; }
  const cn = e.target.closest('[data-confirm-name]');
  if (cn) { e.preventDefault(); reviewPatch(cn.dataset.confirmName, { confirm_name: true }, 'Customer name confirmed'); return; }
  const en = e.target.closest('[data-edit-name]');
  if (en) { e.preventDefault(); editName(en.dataset.editName); return; }
  const cv = e.target.closest('[data-confirm-vin]');
  if (cv) { e.preventDefault(); reviewPatch(cv.dataset.confirmVin, { confirm_vin: true }, 'VIN confirmed'); return; }
  const cd = e.target.closest('[data-confirm-date]');
  if (cd) { e.preventDefault(); reviewPatch(cd.dataset.confirmDate, { confirm_date: true }, 'Date confirmed'); return; }
  const xv = e.target.closest('[data-correct-vin]');
  if (xv) { e.preventDefault(); correctVin(xv.dataset.correctVin); return; }
  const ed = e.target.closest('[data-edit-date]');
  if (ed) { e.preventDefault(); editDate(ed.dataset.editDate, ed.dataset.current); return; }
  const sm = e.target.closest('[data-summary]');
  if (sm) { e.preventDefault(); openSummary(sm.dataset.summary).catch((err) => toast(err.message, 'err')); return; }
  const x = e.target.closest('[data-export]');
  if (x) { e.preventDefault(); exportExcel(x.dataset.export, x.dataset.kind || 'all'); }
});
$$('.tab').forEach((t) => { t.onclick = () => go(t.dataset.view); });

$('#themeToggle').onclick = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch { /* private mode */ }
};

window.addEventListener('beforeunload', (e) => { if (state.importing) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', route);

// Version footer + "new version" banner
let baseline = null;
async function checkVersion() {
  try {
    const v = await api('/api/version');
    $('#appVersion').textContent = `v${v.appVersion}`;
    const sha = v.commit ? v.commit.slice(0, 7) : 'local';
    $('#gitVersion').textContent = `${v.branch || 'dev'}@${sha}`;
    $('#gitLink').href = v.commit ? `https://github.com/${v.repo}/commit/${v.commit}` : `https://github.com/${v.repo}`;
    if (baseline === null) baseline = v.commit;
    else if (v.commit !== baseline) $('#updateBanner').hidden = false;
  } catch { /* offline */ }
}
checkVersion();
setInterval(checkVersion, 2 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });

// ---------- sign-in ----------
function showLogin(msg = '') {
  document.body.classList.add('locked');
  $('#loginScreen').hidden = false;
  $('#loginError').hidden = !msg;
  $('#loginError').textContent = msg;
  setTimeout(() => $('#password').focus(), 50);
}
function hideLogin() {
  document.body.classList.remove('locked');
  $('#loginScreen').hidden = true;
  $('#password').value = '';
}
window.addEventListener('auth-required', () => showLogin('Your session has ended — please sign in again.'));

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Signing in…';
  try {
    await api('/api/auth/login', { method: 'POST', body: { password: $('#password').value } });
    hideLogin();
    route();
  } catch (err) {
    showLogin(err.message);
    $('#password').select();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign in';
  }
};
$('#logoutBtn').onclick = async () => {
  if (state.importing && !confirm('An import is running. Sign out anyway?')) return;
  state.importing?.ctrl.abort();
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  view.innerHTML = '';
  showLogin();
};

api('/api/auth/session')
  .then((s) => { if (s.authenticated) { if (s.local) $('#logoutBtn').hidden = true; route(); } else showLogin(); })
  .catch(() => showLogin());
