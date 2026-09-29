// Admin console: Dashboard · Import month · Records · Compare · Issues · Months · Export
import { api } from './lib/api.js';
import { MANUAL_TITLE, manualHtml } from './lib/manual-th.js';
import { planFolder, runImport, suggestMonth } from './lib/importer.js';
import { freeOcrStatus } from './lib/free-ocr.js';
import { downloadProblemsWorkbook, downloadWorkbook } from './lib/report.js';
import { DATE_PROBLEM_INFO, DATE_PROBLEM_TYPES, EXCEL_PROBLEM_INFO, EXCEL_PROBLEM_TYPES, PROBLEM_INFO, PROBLEM_TYPES, whatHappened } from './lib/problems.js';

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
// PDF VIN check (PDF Data): file name VIN vs photo VIN vs paper VIN box.
const LEVEL = { 1: ['ok', 'All 3 match'], 2: ['warn', 'Paper differs'], 3: ['bad', 'Photo not confirmed'] };
function vinLevelPill(level) {
  const [tone, label] = LEVEL[level] || ['neutral', '–'];
  return `<span class="pill ${tone} plain lvl">${label}</span>`;
}
const XL = { match: ['ok', 'Match'], close: ['warn', 'Close'], different: ['bad', 'Different'], missing: ['bad', 'Not in Excel'] };
function excelPill(status, score, withPct = true) {
  const [tone, label] = XL[status] || ['neutral', '–'];
  return `<span class="pill ${tone} plain lvl">${label}${withPct && status !== 'missing' ? ` ${score}%` : ''}</span>`;
}
// Excel Check result per Excel row (lib/baseline.js): the PDF found by file name in the month folder, then its photo
// and paper VIN. Complete = the photo confirms the VIN (l1, l2 — a wrong paper VIN box is only a note).
const BAND = { l1: ['ok', 'Complete'], l2: ['ok', 'Complete · paper differs'], l3: ['bad', 'Photo not confirmed'], nopdf: ['bad', 'No PDF'], novin: ['bad', '⚠ No valid VIN'], pdfonly: ['info', 'PDF not in Excel'], noexcel: ['bad', 'Not in Excel'] };
function matchPct(score, band) {
  const [tone] = BAND[band] || ['neutral'];
  if (band === 'nopdf' || band === 'novin' || band === 'noexcel' || !BAND[band]) return `<span class="pill ${tone} plain lvl">${BAND[band]?.[1] || '–'}</span>`;
  return `<span class="pill ${tone} plain lvl">${BAND[band][1]} · ${score}%</span>`;
}
// Photo / paper VIN vs the file name VIN, honouring an admin confirmation (shown with an "admin" tag).
const ADMIN_TAG = '<span class="admin-tag" title="Confirmed by admin after checking the PDF (see History)">admin</span>';
const photoOk = (r) => !!r.file_vin && (!!r.vin_confirmed || r.vin_picture === r.file_vin);
const paperOk = (r) => !!r.file_vin && (!!r.paper_confirmed || r.paper_vin === r.file_vin);
function photoCell(r) {
  if (r.vin_confirmed && r.file_vin) return `<td class="mono">${esc(r.file_vin)} ${ADMIN_TAG}</td>`;
  return `<td class="mono ${r.vin_picture && r.vin_picture !== r.file_vin ? 'bad-cell' : ''}">${esc(r.vin_picture) || `<span class="faint">${r.charger_photo ? 'charger photo' : 'not read'}</span>`}</td>`;
}
function paperCell(r) {
  if (r.paper_confirmed && r.file_vin) return `<td class="mono">${esc(r.file_vin)} ${ADMIN_TAG}</td>`;
  return `<td class="mono ${r.paper_vin !== r.file_vin ? 'warn-cell' : ''}">${esc(r.paper_vin) || '<span class="faint">–</span>'}</td>`;
}
const tick = (ok, pts) => (ok ? `<span class="ok-mark" title="+${pts}">✔</span>` : '<span class="bad-mark">✘</span>');
function dateMark(days) {
  if (days === 0) return '<span class="ok-mark" title="+20">✔</span>';
  if (days !== null && days <= 3) return `<span class="warn-mark" title="+10">${days}d</span>`;
  return days === null ? '<span class="faint">–</span>' : `<span class="bad-mark">${days}d</span>`;
}
// Installation date cell: red with "not <month>" when the date is not in the folder month.
function dateCell(iso, raw, folderMonth, okFlag) {
  if (!iso) return `<span class="pill bad">${esc(raw || 'no date')}</span>`;
  const ok = okFlag !== undefined ? okFlag : folderMonth ? iso.slice(0, 7) === folderMonth : null;
  return ok === false
    ? `<span class="date-wrong" title="Installation month is not the folder month ${esc(fmtMonth(folderMonth, true))}">${esc(fmtDate(iso))}<small>not ${esc(fmtMonth(folderMonth))}</small></span>`
    : esc(fmtDate(iso));
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
  const { batches, excel_problems: excelProblemCount = 0 } = await api('/api/batches');
  state.batches = batches;
  $('#cMonths').textContent = batches.length;
  $('#cRecords').textContent = fmtN(batches.reduce((a, b) => a + b.record_count, 0));
  const open = batches.reduce((a, b) => a + b.open_issue_count, 0) + excelProblemCount;
  state.openIssues = open;
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
  dashboard: renderDashboard, import: renderMonthsImport, 'check-excel': renderCheckExcel,
  records: renderRecords, compare: renderCompare, issues: renderIssues, months: renderMonthsImport,
  manual: renderManual,
};

async function route() {
  let { name, params } = parseHash();
  // Old links: "Check PDF" and "All PDFs" are one menu now (PDF Data).
  if (name === 'check-pdf') { name = 'records'; }
  const fn = VIEWS[name] || renderDashboard;
  const tabName = name === 'compare' ? 'check-excel' : name === 'import' ? 'months' : VIEWS[name] ? name : 'dashboard';
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
    <div class="card xl-hero" style="margin-bottom:16px">
      <div class="card-head"><h2><span class="tab-num">1</span> Excel Check — every Excel row checked against its PDF in the month folder</h2>
        <a class="btn sm" href="#/check-excel">Open Excel Check</a></div>
      <div class="xl-hero-top card-pad">
        <div class="xl-big"><div class="label">Excel rows</div><div class="value">${fmtN(s.baseline.excel_rows)}</div><div class="sub">all months · same count as the Excel files</div></div>
        <a class="xl-big ok kpi-link" href="#/check-excel?band=complete"><div class="label">Complete</div><div class="value">${fmtN(s.baseline.complete)} <span class="level-pct">${pct(s.baseline.complete, s.baseline.excel_rows)}%</span></div>
          <div class="sub">by the app ${fmtN(s.baseline.complete - s.baseline.admin)} · <span class="admin-tag">admin</span> ${fmtN(s.baseline.admin)}${s.baseline.l2 ? ` · ${fmtN(s.baseline.l2)} with paper VIN differs` : ''}</div></a>
        <a class="xl-big bad kpi-link" href="#/check-excel?band=open"><div class="label">Needs attention</div><div class="value">${fmtN(s.baseline.excel_rows - s.baseline.complete)} <span class="level-pct">${pct(s.baseline.excel_rows - s.baseline.complete, s.baseline.excel_rows)}%</span></div><div class="sub">see the reasons below</div></a>
      </div>
      <div class="meter xl-meter"><i style="width:${pct(s.baseline.complete, s.baseline.excel_rows)}%"></i></div>
      <div class="grid cols-3 card-pad">
        ${[['l3', 'PDF found, but its VIN photo is unread or shows another VIN — open the PDF and confirm'], ['nopdf', 'No PDF in the month folder has this VIN in its file name'], ['novin', 'The Excel VIN cell is empty or not a VIN — approve a VIN or fix the Excel']].map(([k, desc]) => {
          const n = s.baseline[k];
          return `<a class="card kpi kpi-link level-card ${n ? 'bad' : 'ok'}" href="#/check-excel?band=${k}" style="box-shadow:none;background:var(--surface-2)">
            <div class="label">${BAND[k][1]}</div>
            <div class="value">${fmtN(n)} <span class="level-pct">${pct(n, s.baseline.excel_rows)}%</span></div>
            <div class="sub" style="margin-top:8px">${desc}</div></a>`;
        }).join('')}
      </div>
      <div class="legend" style="border-top:1px solid var(--border);border-bottom:0"><a href="#/check-excel?band=pdfonly">${fmtN(s.baseline.pdfonly)} PDFs are not in any Excel</a></div>
    </div>
    <a class="card date-alert ${s.date_wrong_month + s.date_missing ? 'on' : ''}" href="#/records?datemonth=wrong" style="margin-bottom:16px">
      <div><div class="label">Installation date not in the folder month</div>
        <div class="sub">Every installation should be dated in the month of its folder (e.g. June folder → June date). Click to see them.</div></div>
      <div class="da-num"><b>${fmtN(s.date_wrong_month)}</b><span>other month</span></div>
      <div class="da-num"><b>${fmtN(s.date_missing)}</b><span>no date</span></div>
    </a>
    <div class="grid cols-2">
      <a class="card kpi kpi-link" href="#/issues"><div class="label"><span class="tab-num">2</span> Issues</div><div class="value" style="color:${state.openIssues ? 'var(--warn)' : 'inherit'}">${fmtN(state.openIssues)}</div><div class="sub">open problems to fix or approve — Excel side and PDF side</div></a>
      <div class="card kpi"><div class="label">PDF Data — VIN decoded from each PDF <span class="faint" style="text-transform:none;letter-spacing:0">(supporting)</span></div>
        <div class="pdf-levels">${[1, 2, 3].map((l) => `<a class="kpi-link" href="#/records?vinlevel=${l}"><span class="pill ${LEVEL[l][0]} plain lvl">${LEVEL[l][1]}</span> <b>${fmtN(s.vin_levels[l])}</b></a>`).join('')}</div>
        <div class="sub">${fmtN(s.records)} PDFs · file name VIN vs photo VIN vs paper VIN box</div></div>
    </div>

    <div class="grid cols-2 section-gap">
      <div class="card">
        <div class="card-head"><h2>Imported months</h2><button class="btn sm" data-go="months">Months &amp; Import</button></div>
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
  return `
    <div class="card month-card" style="box-shadow:none;background:var(--surface-2)">
      <div class="top">
        <div><h3>${esc(fmtMonth(b.month, true))}</h3><div class="folder" title="${esc(b.folder_name)}">${esc(b.folder_name || b.folder_url)}</div></div>
        <span class="pill ${STATUS_PILL[b.status] || 'neutral'}">${esc(b.status)}</span>
      </div>
      <div class="stats">
        <div class="stat"><b>${fmtN(b.excel_check.rows)}</b><span>Excel rows</span></div>
        <div class="stat" title="Complete: by the app ${b.excel_check.complete - b.excel_check.admin} · by admin ${b.excel_check.admin}"><b style="color:var(--ok)">${fmtN(b.excel_check.complete)}</b><span>Complete</span></div>
        <div class="stat" title="Photo not confirmed ${b.excel_check.l3} · No PDF ${b.excel_check.nopdf} · No valid VIN ${b.excel_check.novin}"><b style="color:${b.excel_check.rows - b.excel_check.complete ? 'var(--bad)' : 'inherit'}">${fmtN(b.excel_check.rows - b.excel_check.complete)}</b><span>Needs attention</span></div>
        <div class="stat"><b style="color:${b.open_issue_count + (b.excel_problem_count || 0) ? 'var(--warn)' : 'inherit'}">${fmtN(b.open_issue_count + (b.excel_problem_count || 0))}</b><span>Issues</span></div>
        <div class="stat" title="Installation date not in ${esc(fmtMonth(b.month, true))}"><b style="color:${b.date_wrong_month_count ? 'var(--bad)' : 'inherit'}">${fmtN(b.date_wrong_month_count || 0)}</b><span>Date ≠ month</span></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:6px"><span>Processed ${fmtN(b.processed_count)} / ${fmtN(b.pdf_count)}${b.updated_count ? ` · <span style="color:var(--info)">${fmtN(b.updated_count)} updated</span>` : ''}${b.deleted_count ? ` · <span style="color:var(--bad)">${fmtN(b.deleted_count)} deleted</span>` : ''}</span><span>Complete ${pct(b.excel_check.complete, b.excel_check.rows)}%</span></div>
        <div class="meter"><i style="width:${pct(b.excel_check.complete, b.excel_check.rows)}%;background:var(--ok)"></i></div>
      </div>
      <div class="row-actions">
        <button class="btn sm primary" data-summary="${b.id}">Summary</button>
        <button class="btn sm" data-go="check-excel" data-batch="${b.id}">Excel Check</button>
        <button class="btn sm" data-go="issues" data-batch="${b.id}">Issues</button>
        <button class="btn sm" data-go="records" data-batch="${b.id}">PDF Data</button>
        <button class="btn sm" data-export="${b.id}">${ICON.download} Excel</button>
      </div>
    </div>`;
}

// ---------- Import ----------
function renderImport(params, box = view) {
  if (state.importing) { box.replaceChildren(state.importing.el); return; }
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="view-head"><div><h1>Months &amp; Import</h1><p>Import a month: paste the Google Drive folder of one month — every PDF becomes one record (VIN = key) and the Excel in the folder is the reference. Imported months are listed below.</p></div></div>
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
          <label class="check" id="optRereadBox" hidden title="PDF VIN level 3 files (photo not confirmed) not confirmed by an admin: the VIN photo was unread or differs from the file name. Read again with the free reader first, AI only when it still cannot confirm. Admin review is kept."><input type="checkbox" id="optReread"> Re-read VIN photos that are not matched <span class="faint" id="optRereadN"></span></label>
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
  box.replaceChildren(el);

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
      const existing = state.batches.find((b) => b.folder_id === r.folderId);
      // Reference Excel: keep the one this month was imported with; otherwise the first one found.
      const xlsxFiles = r.files.filter((f) => f.type === 'xlsx');
      const ref = xlsxFiles.find((f) => existing && f.id === existing.reference_file_id)
        || xlsxFiles.find((f) => existing && f.name === existing.reference_name) || xlsxFiles[0];
      folder.refFile = ref || null;
      $('#fTitle', el).textContent = r.title || r.folderId;
      $('#fTitle', el).title = r.title;
      $('#fPdfs', el).textContent = fmtN(pdfs.length);
      $('#fRef', el).innerHTML = ref ? `${esc(ref.name)}${xlsxFiles.length > 1 ? `<div class="warn-note">${xlsxFiles.length} Excel files in this folder — using ${existing && (ref.id === existing.reference_file_id || ref.name === existing.reference_name) ? 'the one imported before' : 'the first one'}</div>` : ''}` : 'None found';
      $('#fRef', el).title = xlsxFiles.map((f) => f.name).join('\n');
      $('#fMonth', el).value = existing?.month || suggestMonth(r.title);
      const ex = $('#fExisting', el);
      ex.hidden = !existing;
      $('#optRereadBox', el).hidden = !existing?.vin_reread_count;
      $('#optReread', el).checked = false;
      $('#optRereadN', el).textContent = existing?.vin_reread_count ? `(${fmtN(existing.vin_reread_count)} files)` : '';
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
        reread: $('#optReread', el).checked,
        ocr: $('#optOcr', el).checked,
        limit: Number($('#optLimit', el).value) || 0,
      }, ui, ctrl.signal);
      toast('Import finished');
      const acts = $('#doneActions', el);
      acts.innerHTML = `
        <button class="btn primary" data-summary="${batch.id}">Import summary</button>
        <button class="btn" data-go="check-excel" data-batch="${batch.id}">Excel Check</button>
        <button class="btn" data-go="issues" data-batch="${batch.id}">Issues</button>
        <button class="btn" data-go="records" data-batch="${batch.id}">PDF Data</button>
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
      loadBatches().then(() => { const z = $('#monthsZone'); if (z) renderMonths(parseHash().params, z); }).catch(() => {});
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
    ['complete', 'Complete', f.complete, 'ok'], ['l2', '· paper differs', f.l2, 'ok'], ['admin', '· by admin', f.admin, 'info'],
    ['open', 'Needs attention', f.excel_rows - f.complete, 'bad'], ['l3', 'Photo not confirmed', f.l3, 'bad'], ['nopdf', 'No PDF', f.nopdf, 'bad'], ['novin', '⚠ No valid VIN', f.novin, 'bad'],
    ['pdfonly', 'PDF not in Excel', f.pdfonly, 'info'], ['wrongmonth', '⚠ Date not in folder month', f.wrongmonth, 'bad']], null, f.excel_rows);
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
        <tr class="group"><th colspan="3">Excel (baseline)</th><th colspan="4">VIN evidence — PDF in the month folder (high priority)</th><th colspan="3">Name · date (low priority)</th><th></th></tr>
        <tr><th>Month</th><th>Row</th><th>VIN (key)</th>
          <th>Found PDF file</th><th>Photo VIN</th><th>Paper VIN</th><th>Result</th>
          <th>Customer</th><th>Install date</th><th title="Customer name similarity">Name</th><th></th></tr></thead>
      <tbody>${data.rows.map((x) => {
        const r = x.record;
        const pt = x.parts;
        const photo = r ? (r.vin_confirmed ? (r.file_vin || r.vin) : r.vin_picture) : '';
        if (x.invalid_vin) {
          const sg = x.suggestion;
          return `<tr class="row-alert clickable" data-fix="${data.rows.indexOf(x)}" title="Click to review and approve a VIN for this Excel row">
          <td><span class="month-chip">${esc(fmtMonth(x.month))}</span></td>
          <td class="num faint">${esc(x.row_no)}</td>
          <td class="mono bad-mark">${x.vin ? esc(x.vin) : '<i>(empty)</i>'}</td>
          <td colspan="3"><span class="bad-mark"><b>⚠ No valid VIN in Excel</b></span> <span class="faint" style="font-size:11.5px">· click to approve</span><div class="faint" style="font-size:11.5px">${esc(x.hint)}</div>${sg ? `<a href="${pdfUrl(sg.pdf_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:12px">Suggested PDF ${ICON.ext}</a>` : ''}</td>
          <td>${matchPct(0, 'novin')}</td>
          <td>${esc(x.customer_name)}</td>
          <td class="num">${dateCell(x.install_date, '', x.month, x.excel_month_ok)}</td>
          <td></td>
          <td style="white-space:nowrap">${x.excel_file_id ? `<a href="${excelUrl(x.excel_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Excel ${ICON.ext}</a>` : ''}</td>
        </tr>`;
        }
        return `<tr class="${r ? 'clickable' : ''}" data-vin="${esc(r?.vin || '')}">
          <td><span class="month-chip">${esc(fmtMonth(x.month))}</span></td>
          <td class="num faint">${esc(x.row_no)}</td>
          <td class="mono">${esc(x.vin)}${x.admin_fix ? `<div class="faint" style="font-size:11px">Excel: ${esc(x.excel_vin_raw || '(empty)')}</div>` : ''}</td>
          ${r ? `<td style="max-width:260px"><a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="${esc(r.pdf_name)}">${esc(r.pdf_name.length > 38 ? `${r.pdf_name.slice(0, 38)}…` : r.pdf_name)} ${ICON.ext}</a></td>
            <td class="mono ${pt.vin_photo ? '' : 'bad-mark'}">${pt.vin_photo ? '✔' : esc(photo || 'not read')}${r.vin_confirmed ? ` ${ADMIN_TAG}` : ''}</td>
            <td class="mono ${pt.vin_paper ? '' : 'warn-mark'}">${pt.vin_paper ? '✔' : esc(r.paper_vin || 'not readable')}${r.paper_confirmed ? ` ${ADMIN_TAG}` : ''}</td>`
            : `<td colspan="3"><span class="bad-mark">No PDF file with this VIN in the folder</span>${x.hint ? `<div class="faint" style="font-size:11.5px">${esc(x.hint)}</div>` : ''}</td>`}
          <td>${matchPct(x.score, x.band)}${x.complete_by === 'admin' ? ` ${ADMIN_TAG}<div class="faint" style="font-size:11px;max-width:220px" title="${esc(x.admin_remark)}">${esc(x.admin_remark.length > 70 ? `${x.admin_remark.slice(0, 70)}…` : x.admin_remark)}</div>` : ''}</td>
          <td>${esc(x.customer_name)}${r && pt.name < 95 ? `<div class="faint" style="font-size:11.5px">PDF: ${esc(r.customer_name)}</div>` : ''}</td>
          <td class="num">${dateCell(x.install_date, '', x.month, x.excel_month_ok)}${r && (pt.date_days || x.pdf_month_ok === false) ? `<div class="faint" style="font-size:11.5px">PDF: ${dateCell(r.install_date, r.install_date_raw, x.month, x.pdf_month_ok)}</div>` : ''}</td>
          <td class="num ${!r ? '' : pt.name >= 95 ? 'ok-mark' : pt.name >= 80 ? 'warn-mark' : 'bad-mark'}">${r ? `${pt.name}%` : ''}</td>
          <td style="white-space:nowrap">${x.excel_file_id ? `<a href="${excelUrl(x.excel_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Excel ${ICON.ext}</a>` : ''}</td>
        </tr>`;
      }).join('')}</tbody></table>` : '<div class="empty">Nothing here.</div>';
  }
  view.innerHTML = `
    <div class="view-head"><div><h1><span class="tab-num big">1</span> Excel Check</h1>
      <p>The main check. The <b>Excel of the month folder</b> is the baseline and its <b>VIN is the key</b> — one line per Excel row, same count as the Excel. For each row the app finds the PDF in the same folder whose <b>file name</b> has this VIN, then checks its <b>photo VIN</b> (evidence) and <b>paper VIN</b>; name and date are compared with low priority.
      <b>Complete</b> = the photo confirms the VIN (a different paper VIN box is only a note) · <b>Needs attention</b> = Photo not confirmed · No PDF · No valid VIN (click the row to approve). % = file 40 + photo 30 + paper 15 + name 10 + date 5. <span class="date-wrong-inline">Red date</span> = not in the folder month.</p></div>
      <div class="row-actions">
        ${monthExcel?.reference_file_id ? `<a class="btn" href="${excelUrl(monthExcel.reference_file_id)}" target="_blank" rel="noopener">Open ${esc(fmtMonth(monthExcel.month))} Excel ${ICON.ext}</a>` : ''}
        <button class="btn" data-export="${esc(batch)}" data-kind="check2">${ICON.download} Export Excel Check</button></div></div>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Month (Excel)</label><select class="select" id="ckBatch">${monthOptions(batch)}</select></div>
        <div class="field grow"><label>Result</label>${chips}</div>
      </div>
      <div class="table-wrap">${table}</div>
      ${pager({ total: data.total, page: data.page, size: data.size })}
    </div>`;
  wireCheckPage('check-excel', { ...data, records: [] });
  $$('tbody tr[data-fix]').forEach((tr) => { tr.onclick = () => openExcelFix(data.rows[Number(tr.dataset.fix)]); });
  $$('tbody tr[data-vin]').forEach((tr) => {
    if (!tr.dataset.vin) return;
    tr.onclick = async () => {
      const { records } = await api(`/api/records?q=${encodeURIComponent(tr.dataset.vin)}&size=5`);
      const rec = records.find((x) => x.vin === tr.dataset.vin) || records[0];
      if (rec) openRecord(rec);
    };
  });
}

// ---------- Manual (Thai) ----------
function renderManual(params) {
  const { toc, body } = manualHtml();
  view.innerHTML = `
    <div class="view-head"><div><h1>📖 คู่มือการใช้งาน</h1><p>${esc(MANUAL_TITLE)} — ทุกเมนู ขั้นตอนทำงาน และรายละเอียดรายงาน Excel ทุกไฟล์</p></div>
      <div class="row-actions">
        <a class="btn" href="https://github.com/sirisakG2/wallbox-report/blob/main/MANUAL_TH.md" target="_blank" rel="noopener">GitHub ${ICON.ext}</a>
        <button class="btn" id="manPrint">พิมพ์ / PDF</button></div></div>
    <div class="manual">
      <nav class="manual-toc card">${toc}</nav>
      <article class="manual-body card card-pad">${body}</article>
    </div>`;
  $('#manPrint').onclick = () => window.print();
  $$('[data-manual-link]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); document.getElementById(`m-${a.dataset.manualLink}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  });
  const sec = params.get('s');
  if (sec) setTimeout(() => document.getElementById(`m-${sec}`)?.scrollIntoView({ block: 'start' }), 50);
}

// ---------- Months & Import (one page) ----------
async function renderMonthsImport(params) {
  view.innerHTML = '<div id="impZone"></div><div id="monthsZone" class="section-gap"></div>';
  renderImport(params, $('#impZone'));
  await renderMonths(params, $('#monthsZone'));
}

// ---------- Records ----------
async function renderRecords(params) {
  const page = Number(params.get('page')) || 1;
  const q = new URLSearchParams({ page, size: 50 });
  for (const k of ['batch', 'q', 'match', 'from', 'to', 'conf', 'fstatus', 'vinlevel', 'excel', 'xlband', 'datemonth']) if (params.get(k)) q.set(k, params.get(k));
  const data = await api(`/api/records?${q}`);
  state.lastRecords = data.records;
  state.reviewMode = params.get('conf') === 'review';
  const pages = Math.max(1, Math.ceil(data.total / data.size));

  view.innerHTML = `
    <div class="view-head"><div><h1>PDF Data</h1><p>Supporting data: what the app decoded from each PDF (page 1) — VIN from the file name, the VIN photo and the paper VIN box, date, customer and more. <b>VIN check</b>: ${vinLevelPill(1)} file name = photo = paper · ${vinLevelPill(2)} photo confirms, paper box differs · ${vinLevelPill(3)} photo does not confirm → open the PDF. Click a row to check and confirm.</p></div>
      <div class="row-actions">
        <button class="btn" data-export="${esc(params.get('batch') || '')}" data-kind="check1">${ICON.download} Export PDF Data</button>
        <button class="btn" data-export="${esc(params.get('batch') || '')}">${ICON.download} Full report</button></div></div>
    <div class="chips-row">${[['', 'All', data.facets?.vin ? Object.values(data.facets.vin).reduce((a, n) => a + n, 0) : data.total, 'neutral'], ['1', LEVEL[1][1], data.facets?.vin?.[1], 'ok'], ['2', LEVEL[2][1], data.facets?.vin?.[2], 'warn'], ['3', LEVEL[3][1], data.facets?.vin?.[3], 'bad']]
      .map(([v, l, n, tone]) => `<button class="chip chip-${tone} ${(params.get('vinlevel') || '') === v ? 'active' : ''}" data-vinchip="${v}">${esc(l)} <b>${fmtN(n || 0)}</b></button>`).join('')}</div>
    <div class="card">
      <form class="toolbar" id="filters">
        <div class="field"><label>Month</label><select class="select" name="batch">${monthOptions(params.get('batch'))}</select></div>
        <div class="field grow"><label>Search</label><input class="input" name="q" placeholder="VIN, name, job number, serial, phone…" value="${esc(params.get('q') || '')}"></div>
        <div class="field"><label>Confidence</label><select class="select" name="conf">
          ${[['', 'All'], ['review', 'Needs review (<95%)'], ['full', '100% only']].map(([v, l]) => `<option value="${v}" ${(params.get('conf') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>Install date</label><select class="select" name="datemonth">
          ${[['', 'All'], ['wrong', '⚠ Not in folder month'], ['missing', 'No date']].map(([v, l]) => `<option value="${v}" ${(params.get('datemonth') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>PDF file</label><select class="select" name="fstatus">
          ${[['', 'All'], ['updated', 'Updated'], ['deleted', 'Deleted']].map(([v, l]) => `<option value="${v}" ${(params.get('fstatus') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>Excel Check</label><select class="select" name="xlband">
          ${[['', 'All'], ['complete', 'Complete'], ['l2', 'Complete · paper differs'], ['l3', 'Photo not confirmed'], ['noexcel', 'Not in Excel']].map(([v, l]) => `<option value="${v}" ${(params.get('xlband') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>VIN check</label><select class="select" name="vinlevel">
          ${[['', 'All'], ['1', LEVEL[1][1]], ['2', LEVEL[2][1]], ['3', LEVEL[3][1]]].map(([v, l]) => `<option value="${v}" ${(params.get('vinlevel') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>Installed from</label><input class="input" type="date" name="from" value="${esc(params.get('from') || '')}"></div>
        <div class="field"><label>to</label><input class="input" type="date" name="to" value="${esc(params.get('to') || '')}"></div>
        <button class="btn primary" type="submit">Apply</button>
        <button class="btn" type="button" id="clearF">Clear</button>
      </form>
      <div class="table-wrap">
        ${data.records.length ? `<table>
          <thead><tr><th>Month</th><th title="VIN from the file name (reference)">VIN (file name)</th><th>VIN check</th><th>Excel Check</th><th>Photo VIN</th><th>Paper VIN</th><th>Installed</th><th title="How sure the installation date is right">Date %</th><th>Job number</th><th>Customer</th><th>Serial</th><th></th></tr></thead>
          <tbody>${data.records.map((r, i) => `
            <tr class="clickable" data-i="${i}">
              <td><span class="month-chip">${esc(fmtMonth(r.month))}</span></td>
              <td class="mono">${esc(r.file_vin || r.vin)}</td>
              <td title="${esc(r.vin_conf_reasons.join(' · '))}">${vinLevelPill(r.vin_level)}</td>
              <td>${matchPct(r.xl_score, r.xl_band)}</td>
              ${photoCell(r)}
              ${paperCell(r)}
              <td class="num">${dateCell(r.install_date, r.install_date_raw, r.month, r.date_month_ok)}</td>
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
  f.datemonth.onchange = () => go('records', current());
  $('#clearF').onclick = () => go('records');
  $$('[data-vinchip]').forEach((c) => { c.onclick = () => go('records', { ...current(), vinlevel: c.dataset.vinchip, page: '' }); });
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
            <tr><td>Photo</td><td class="mono">${esc(r.vin_picture) || '<span class="faint">not read</span>'}${r.vin_confirmed && r.file_vin ? ` ${ADMIN_TAG}` : ''}</td><td>${photoOk(r) ? '<span class="ok-mark">✔</span>' : '<span class="bad-mark">✘</span>'}</td></tr>
            <tr><td>Paper box</td><td class="mono">${esc(r.paper_vin) || '<span class="faint">not read</span>'}${r.paper_confirmed && r.file_vin ? ` ${ADMIN_TAG}` : ''}</td><td>${paperOk(r) ? '<span class="ok-mark">✔</span>' : '<span class="warn-mark">✘</span>'}</td></tr>
          </table>
          ${reasons(r.vin_conf_reasons)}
          <div class="row-actions">
            ${!r.file_vin || photoOk(r) || paperOk(r) ? '' : `<button class="btn sm primary" data-confirm-both="${esc(r.vin)}" title="I checked the PDF: the photo and the paper VIN box both show the file name VIN">✔ Photo &amp; paper show this VIN</button>`}
            ${r.vin_confirmed || !r.file_vin || photoOk(r) ? '' : `<button class="btn sm" data-confirm-vin="${esc(r.vin)}" title="I checked the photo in the PDF: it shows the file name VIN">✔ Photo shows this VIN</button>`}
            ${r.paper_confirmed || !r.file_vin || paperOk(r) ? '' : `<button class="btn sm" data-confirm-paper="${esc(r.vin)}" title="I checked the paper VIN box in the PDF: it shows the file name VIN">✔ Paper box shows this VIN</button>`}
            <button class="btn sm" data-correct-vin="${esc(r.vin)}">Correct VIN</button>
          </div>
        </div>
        <div class="review-box">
          <div class="review-head"><span>Excel Check</span>${matchPct(r.xl_score, r.xl_band)}</div>
          ${r.ref_admin ? `<div class="admin-note">${ADMIN_TAG} Excel row ${esc(r.ref_row)} had ${r.ref_excel_vin_raw ? `“${esc(r.ref_excel_vin_raw)}”` : 'an empty VIN cell'} — this VIN was approved by admin${r.ref_admin_at ? ` on ${esc(String(r.ref_admin_at).slice(0, 16))} UTC` : ''}.<div><b>Remark:</b> ${esc(r.ref_admin_remark)}</div>
            <button class="btn sm" data-unfix="${esc(r.batch_id)}|${esc(r.ref_sheet_name || '')}|${esc(r.ref_row)}">Remove approval</button></div>` : ''}
          ${r.xl_parts ? `<table class="vin-sources">
            <tr><td>Excel row</td><td colspan="2">${r.ref_sheet_name ? `“${esc(r.ref_sheet_name)}” ` : ''}row ${esc(r.ref_row || '?')}</td></tr>
            <tr><td>VIN (Excel)</td><td class="mono" colspan="2">${esc(r.vin)}</td></tr>
            <tr><td>· file name</td><td class="mono">${esc(r.file_vin) || '–'}</td><td>${tick(r.xl_parts.vin_file, 40)}</td></tr>
            <tr><td>· photo</td><td class="mono">${esc(r.vin_picture) || 'not read'}${r.vin_confirmed && r.file_vin ? ` ${ADMIN_TAG}` : ''}</td><td>${tick(r.xl_parts.vin_photo, 30)}</td></tr>
            <tr><td>· paper box</td><td class="mono">${esc(r.paper_vin) || '–'}${r.paper_confirmed && r.file_vin ? ` ${ADMIN_TAG}` : ''}</td><td>${tick(r.xl_parts.vin_paper, 15)}</td></tr>
            <tr><td>Name <span class="faint">(low)</span></td><td>${esc(r.ref_name) || '–'}${r.xl_parts.name < 95 ? `<div class="faint">PDF: ${esc(r.customer_name)}</div>` : ''}</td><td>${r.xl_parts.name}%</td></tr>
            <tr><td>Case no. <span class="faint">(info)</span></td><td class="mono">${esc(r.ref_case) || '–'}${!r.xl_parts.case ? `<div class="faint">PDF: ${esc(r.job_number) || '–'}</div>` : ''}</td><td>${r.xl_parts.case ? '✔' : '–'}</td></tr>
            <tr><td>Date <span class="faint">(low)</span></td><td>${esc(fmtDate(r.ref_date)) || '–'}${r.xl_parts.date_days ? `<div class="faint">PDF: ${esc(fmtDate(r.install_date)) || '–'}</div>` : ''}</td><td>${dateMark(r.xl_parts.date_days)}</td></tr>
          </table>` : `<div class="faint" style="font-size:12.5px">VIN ${esc(r.vin)} is not in the submission Excel.</div>`}
          <div class="row-actions">
            ${excelUrl(r.ref_file_id || r.month_ref_file_id) ? `<a class="btn sm" href="${excelUrl(r.ref_file_id || r.month_ref_file_id)}" target="_blank" rel="noopener">Open Excel ${ICON.ext}</a>` : ''}
            ${r.name_confirmed ? '' : `<button class="btn sm" data-confirm-name="${esc(r.vin)}">✔ Name is correct</button>`}
            <button class="btn sm" data-edit-name="${esc(r.vin)}">Edit name</button>
          </div>
        </div>
        <div class="review-box">
          <div class="review-head"><span>Installation date</span>${confPill(r.date_conf, true)}</div>
          <div class="review-value">${dateCell(r.install_date, 'unreadable', r.month, r.date_month_ok)} <span class="faint">PDF: ${esc(r.install_date_raw) || '–'}</span></div>
          ${r.date_month_ok === false ? `<div class="date-banner">⚠ Installation month ${esc(fmtMonth(r.install_date.slice(0, 7), true))} is not the folder month ${esc(fmtMonth(r.month, true))}. Check the date in the PDF / Excel, or whether the PDF is in the right month's folder.</div>` : ''}
          ${!r.install_date ? '<div class="date-banner">⚠ No installation date could be read — enter it with Edit date.</div>' : ''}
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
const FIELD_LABEL = { vin: 'VIN', vin_picture: 'Photo VIN', paper_vin: 'Paper VIN box', excel_vin: 'Excel VIN (admin approval)', install_date: 'Installation date', customer_name: 'Customer name', file: 'PDF file' };
const ACTION_LABEL = { approve: 'Approved', unapprove: 'Approval removed', confirm: 'Confirmed', correct: 'Corrected', updated: 'Updated in Drive', deleted: 'Deleted from Drive', restored: 'Back in Drive' };
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
  const xc = state.batches.find((x) => x.id === batch.id)?.excel_check || { rows: 0, complete: 0, admin: 0, l3: 0, nopdf: 0, novin: 0 };
  const rows = [
    ['Excel rows (baseline)', xc.rows, 'neutral', 'Every record in the month Excel', ['check-excel', { batch: b }]],
    ['Records saved', c.saved, 'neutral', 'One record per PDF, keyed by VIN', ['records', { batch: b }]],
    ['Excel rows — Complete', xc.complete, 'ok', `Photo confirms the Excel VIN · by admin ${fmtN(xc.admin)}`, ['check-excel', { batch: b, band: 'complete' }]],
    ['Excel rows — Photo not confirmed', xc.l3, 'bad', 'PDF found; its VIN photo is unread or shows another VIN', ['check-excel', { batch: b, band: 'l3' }]],
    ['Excel rows — No PDF', xc.nopdf, 'bad', 'No PDF in the folder has this VIN in its file name', ['check-excel', { batch: b, band: 'nopdf' }]],
    ['Excel rows — No valid VIN', xc.novin, 'bad', 'VIN cell empty or not a VIN — approve a VIN or fix the Excel', ['check-excel', { batch: b, band: 'novin' }]],
    [`PDF VIN — ${LEVEL[1][1]}`, c.vin_l1, 'ok', 'File name = VIN photo = paper VIN box', ['records', { batch: b, vinlevel: '1' }]],
    [`PDF VIN — ${LEVEL[2][1]}`, c.vin_l2, 'warn', 'Photo confirms the file name; the paper VIN box differs', ['records', { batch: b, vinlevel: '2' }]],
    [`PDF VIN — ${LEVEL[3][1]}`, c.vin_l3, 'bad', 'Photo does not confirm the file name (differs or not readable) — check the PDF', ['records', { batch: b, vinlevel: '3' }]],
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
      <div class="kv" style="border:0"><dt>Install date</dt><dd>
        <a href="#/records?batch=${b}&datemonth=wrong" data-close-summary><span class="pill ${c.date_wrong_month ? 'bad' : 'ok'} plain">Not in ${esc(fmtMonth(batch.month))}: ${fmtN(c.date_wrong_month)}</span></a>
        <a href="#/records?batch=${b}&datemonth=missing" data-close-summary><span class="pill ${c.date_missing ? 'bad' : 'ok'} plain">No date: ${fmtN(c.date_missing)}</span></a></dd></div>
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
        <button class="btn" data-sum-go="check-excel">Excel Check</button>
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
  const isExcelType = EXCEL_PROBLEM_TYPES.includes(type);
  const isDateType = DATE_PROBLEM_TYPES.includes(type);
  const q = new URLSearchParams();
  if (batch) q.set('batch', batch);
  if (type && !isExcelType) q.set('type', type); else q.set('scope', 'other');
  if (text) q.set('q', text);
  if (!showResolved) q.set('resolved', '0');
  const bq = batch ? `batch=${batch}&` : '';
  const [{ issues: pdfAll }, { issues: openAll }, { problems: excelBase }, { records: wrongRecs }, { records: noDateRecs }, { rows: xlWrong, facets: xf }] = await Promise.all([
    api(`/api/issues?${q}`),
    api(`/api/issues?${bq}scope=other&resolved=0`),
    api(`/api/excel-problems${batch ? `?batch=${batch}` : ''}`),
    api(`/api/records?${bq}datemonth=wrong&size=all`),
    api(`/api/records?${bq}datemonth=missing&size=all`),
    api(`/api/baseline?${bq}band=wrongmonth&size=all`),
  ]);
  // Installation-date problems (live): PDF date not in folder month / no date; Excel date not in folder month.
  const dateRows = [
    ...wrongRecs.map((r) => ({ type: 'date_wrong_month', rec: r, what: `Installed ${fmtDate(r.install_date)} (${fmtMonth(r.install_date.slice(0, 7), true)}) — folder month is ${fmtMonth(r.month, true)}` })),
    ...noDateRecs.map((r) => ({ type: 'date_missing', rec: r, what: `No date could be read (PDF text: "${r.install_date_raw || '–'}")` })),
  ];
  const excelAll = [...excelBase, ...xlWrong.filter((x) => x.excel_month_ok === false).map((x) => ({
    type: 'excel_date_wrong_month', month: x.month, batch_id: x.batch_id, sheet_name: x.sheet_name, row_no: x.row_no, excel_file_id: x.excel_file_id,
    excel_vin: x.vin, customer_name: x.customer_name, suggestion: x.record ? { ...x.record, how: `PDF date ${fmtDate(x.record.install_date) || '–'}` } : null,
    detail: `Excel row ${x.row_no}: date ${fmtDate(x.install_date)} is not in ${fmtMonth(x.month, true)}`, excel_date: x.install_date,
  }))];
  const pdfIssues = isExcelType || isDateType ? [] : pdfAll;
  const dateList = type && !isDateType ? [] : dateRows.filter((d) => !type || d.type === type);
  const excelList = type && !isExcelType ? [] : excelAll.filter((x) => !type || x.type === type);
  const info = (t) => PROBLEM_INFO[t] || DATE_PROBLEM_INFO[t] || EXCEL_PROBLEM_INFO[t] || { name: (ISSUE_LABEL[t] || [t])[0], th: '', tone: 'neutral', meaning: '', action: '' };
  const count = (t) => (EXCEL_PROBLEM_TYPES.includes(t) ? excelAll.filter((x) => x.type === t).length
    : DATE_PROBLEM_TYPES.includes(t) ? dateRows.filter((d) => d.type === t).length : openAll.filter((i) => i.type === t).length);
  const card = (t) => `
    <button class="card problem-card ${type === t ? 'active' : ''} tone-${info(t).tone}" data-ptype="${t}">
      <div class="pc-head"><b>${esc(info(t).name)}</b><span class="pc-count">${fmtN(count(t))}</span></div>
      <div class="pc-th">${esc(info(t).th)}</div>
      <div class="pc-text">${esc(info(t).meaning)}</div>
      <div class="pc-todo"><span>What to do</span>${esc(info(t).action)}</div>
    </button>`;
  const pdfTotal = openAll.length + dateRows.length;
  const excelTotal = excelAll.length;

  view.innerHTML = `
    <div class="view-head"><div><h1><span class="tab-num big">2</span> Issues</h1><p>Everything that stops an Excel row from being Complete, and other problems to fix or approve — from the Excel Check, the Excel file itself (A) and the PDF files (B). Each card explains the problem and what to do — click a card to see those rows.</p></div>
      <button class="btn primary" id="probExport">${ICON.download} Export detailed Excel</button></div>
    <div class="toolbar card" style="border-radius:12px">
      <div class="field"><label>Month</label><select class="select" id="iBatch">${monthOptions(batch)}</select></div>
      ${type ? `<button class="chip active" id="iClearType">${esc(info(type).name)} ✕</button>` : ''}
      ${text ? `<button class="chip active" id="iClearQ" title="Remove text filter">“${esc(text)}” ✕</button>` : ''}
      <label class="check" style="height:40px"><input type="checkbox" id="iResolved" ${showResolved ? 'checked' : ''}> Show resolved</label>
    </div>

    <div class="src-head src-excel"><span class="tab-num">1</span> From Excel Check <small>— Excel rows that are not Complete yet (work on them in Excel Check)</small></div>
    <div class="xl-strip">${[['l3', 'Photo not confirmed', 'PDF found; open it and confirm the photo VIN'], ['nopdf', 'No PDF', 'No PDF in the folder with this VIN in its file name'], ['novin', '⚠ No valid VIN', 'Approve a VIN for the Excel row'], ['pdfonly', 'PDF not in Excel', 'PDF in the folder that no Excel row points to']]
      .map(([k, l, d]) => `<a class="card kpi kpi-link level-card ${xf[k] ? (k === 'pdfonly' ? 'warn' : 'bad') : 'ok'}" href="#/check-excel?${batch ? `batch=${batch}&` : ''}band=${k}"><div class="label">${l}</div><div class="value">${fmtN(xf[k] || 0)}</div><div class="sub">${d}</div></a>`).join('')}</div>

    <div class="src-head src-excel"><span class="tab-num">A</span> Excel side <small>— found in the submission Excel · ${fmtN(excelTotal)} to fix in the Excel or approve</small></div>
    <div class="problem-cards">${EXCEL_PROBLEM_TYPES.map(card).join('')}</div>
    ${type && !isExcelType ? '' : `<div class="card section-gap">
      <div class="table-wrap">
        ${excelList.length ? `<table>
          <thead><tr><th>Problem</th><th>Month</th><th>Excel row</th><th>VIN in Excel</th><th>Customer (Excel)</th><th>Suggested PDF</th><th>What to do</th><th></th></tr></thead>
          <tbody>${excelList.map((x) => `
            <tr>
              <td><span class="src-tag excel">Excel</span> <span class="pill ${info(x.type).tone}">${esc(info(x.type).name)}</span></td>
              <td><span class="month-chip">${esc(fmtMonth(x.month))}</span></td>
              <td class="num">${esc(x.sheet_name)} · ${esc(x.row_no)}</td>
              <td class="mono bad-cell">${esc(x.excel_vin)}</td>
              <td>${esc(x.customer_name)}</td>
              <td>${x.suggestion ? `<div class="stack"><span class="mono">${esc(x.suggestion.vin)}</span><small>${esc(x.suggestion.how)} · ${esc(fmtMonth(x.suggestion.month))}</small></div>` : '<span class="faint">no match found</span>'}</td>
              <td style="max-width:320px" class="muted">${esc(info(x.type).action)}</td>
              <td style="white-space:nowrap">${x.type === 'excel_no_vin' || x.type === 'excel_bad_vin' ? `<a class="btn sm primary" href="#/check-excel?batch=${x.batch_id}&band=novin" title="Open Excel Check and click the row to approve a VIN">Approve…</a> ` : ''}${x.excel_file_id ? `<a href="${excelUrl(x.excel_file_id)}" target="_blank" rel="noopener">Excel ${ICON.ext}</a>` : ''}${x.suggestion?.pdf_file_id ? ` · <a href="${pdfUrl(x.suggestion.pdf_file_id)}" target="_blank" rel="noopener">PDF ${ICON.ext}</a>` : ''}</td>
            </tr>`).join('')}</tbody></table>` : '<div class="empty">No problems in the Excel here — nice.</div>'}
      </div>
      <div class="pager"><span>${fmtN(excelList.length)} Excel problem${excelList.length === 1 ? '' : 's'} · fix them in the Excel file, then import the month again</span></div>
    </div>`}

    <div class="src-head src-pdf section-gap"><span class="tab-num">B</span> PDF side <small>— found while decoding the PDF files · ${fmtN(pdfTotal)} open</small></div>
    <div class="problem-cards">${[...DATE_PROBLEM_TYPES, ...PROBLEM_TYPES].map(card).join('')}</div>
    ${isExcelType ? '' : `<div class="card section-gap">
      <div class="table-wrap">
        ${pdfIssues.length + dateList.length ? `<table>
          <thead><tr><th>Problem</th><th>Month</th><th>VIN</th><th>What happened</th><th>What to do</th><th>PDF</th><th style="text-align:right">Action</th></tr></thead>
          <tbody>${dateList.map((d) => `
            <tr>
              <td><span class="src-tag pdf">PDF</span> <span class="pill bad">${esc(info(d.type).name)}</span></td>
              <td><span class="month-chip">${esc(fmtMonth(d.rec.month))}</span></td>
              <td class="mono">${esc(d.rec.vin)}</td>
              <td style="max-width:380px"><span class="date-wrong-inline">${esc(d.what)}</span></td>
              <td style="max-width:320px" class="muted">${esc(info(d.type).action)}</td>
              <td><a href="${pdfUrl(d.rec.pdf_file_id)}" target="_blank" rel="noopener">Open ${ICON.ext}</a></td>
              <td style="text-align:right;white-space:nowrap">
                <button class="btn sm" data-edit-date="${esc(d.rec.vin)}" data-current="${esc(d.rec.install_date || '')}">Edit date</button>
                ${d.rec.install_date ? `<button class="btn sm" data-confirm-date="${esc(d.rec.vin)}">Confirm date</button>` : ''}
              </td>
            </tr>`).join('')}${pdfIssues.map((i) => `
            <tr style="${i.resolved ? 'opacity:.5' : ''}">
              <td><span class="src-tag pdf">PDF</span> <span class="pill ${info(i.type).tone}">${esc(info(i.type).name)}</span></td>
              <td><span class="month-chip">${esc(fmtMonth(i.month))}</span></td>
              <td class="mono">${esc(i.vin)}</td>
              <td style="max-width:380px">${esc(whatHappened(i))}</td>
              <td style="max-width:320px" class="muted">${esc(info(i.type).action)}</td>
              <td>${i.pdf_file_id ? `<a href="${pdfUrl(i.pdf_file_id)}" target="_blank" rel="noopener" title="${esc(i.pdf_name)}">Open ${ICON.ext}</a>` : ''}</td>
              <td style="text-align:right;white-space:nowrap">
                ${i.type === 'duplicate_vin' && !i.resolved ? `<button class="btn sm" data-replace="${i.id}" title="Use this PDF's data for the VIN instead of the stored one">Use this PDF</button>` : ''}
                <button class="btn sm" data-resolve="${i.id}" data-val="${i.resolved ? 0 : 1}">${i.resolved ? 'Reopen' : 'Resolve'}</button>
              </td>
            </tr>`).join('')}</tbody></table>` : '<div class="empty">No problems from the PDFs here — nice.</div>'}
      </div>
      <div class="pager"><span>${fmtN(pdfIssues.length + dateList.length)} problem${pdfIssues.length + dateList.length === 1 ? '' : 's'} from the PDFs</span></div>
    </div>`}`;

  const nav = (extra = {}) => go('issues', { batch: $('#iBatch').value, type, q: text, resolved: $('#iResolved').checked ? 'all' : '', ...extra });
  $('#iBatch').onchange = () => nav();
  $('#iResolved').onchange = () => nav();
  if (type) $('#iClearType').onclick = () => nav({ type: '' });
  if (text) $('#iClearQ').onclick = () => nav({ q: '' });
  $$('[data-ptype]').forEach((c) => { c.onclick = () => nav({ type: type === c.dataset.ptype ? '' : c.dataset.ptype }); });
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
  $('#probExport').onclick = async () => {
    if (!window.ExcelJS) { toast('Excel library is still loading, try again', 'err'); return; }
    const b = state.batches.find((x) => String(x.id) === String(batch));
    toast('Building Excel…');
    try {
      await downloadProblemsWorkbook(window.ExcelJS, { batchId: b ? b.id : null, label: b ? fmtMonth(b.month, true) : 'All months', fileTag: b ? b.month : 'all-months' });
    } catch (e) { toast(`Export failed: ${e.message}`, 'err'); }
  };
}

// ---------- Months ----------
async function renderMonths(params, box = view) {
  const b = state.batches;
  box.innerHTML = `
    <div class="section-title"><h2>Imported months</h2><span class="faint">Every imported Drive folder — a new URL adds a new month; all data is kept.</span></div>
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
// Check 2 — Excel row without a valid VIN: summary, suggested PDF, approve a VIN with a remark.
function openExcelFix(x) {
  const sg = x.suggestion;
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  const d = document.createElement('aside');
  d.className = 'drawer';
  const kv = (rows) => `<dl style="margin:0">${rows.map(([k, v]) => `<div class="kv"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  d.innerHTML = `
    <div class="drawer-head"><div>
        <div class="month-line"><span class="month-badge">${esc(fmtMonth(x.month, true).toUpperCase())}</span><span class="pill bad">⚠ No valid VIN in Excel</span></div>
        <h2>${esc(x.customer_name || `Excel row ${x.row_no}`)}</h2>
        <div class="faint" style="font-size:12.5px;margin-top:3px">Excel “${esc(x.sheet_name)}” row ${esc(x.row_no)}</div></div>
      <button class="icon-btn" aria-label="Close">✕</button></div>
    <div class="drawer-body">
      <div class="review">
        <div class="review-top"><span class="label-sm">Summary</span>
          ${x.excel_file_id ? `<a class="btn sm" href="${excelUrl(x.excel_file_id)}" target="_blank" rel="noopener">Open Excel ${ICON.ext}</a>` : ''}</div>
        <div class="review-grid">
          <div class="review-box">
            <div class="review-head"><span>Excel row (baseline)</span></div>
            ${kv([
              ['VIN cell', `<span class="mono bad-mark">${x.vin ? esc(x.vin) : '<i>(empty)</i>'}</span>`],
              ['Customer', esc(x.customer_name) || '–'],
              ['Case number', `<span class="mono">${esc(x.case_number) || '–'}</span>`],
              ['Install date', dateCell(x.install_date, '', x.month, x.excel_month_ok)],
              ['Problem', esc(x.hint)],
            ])}
          </div>
          <div class="review-box">
            <div class="review-head"><span>Suggested PDF</span>${sg ? '<span class="pill info plain">same customer name</span>' : ''}</div>
            ${sg ? kv([
              ['PDF file', `<a href="${pdfUrl(sg.pdf_file_id)}" target="_blank" rel="noopener">${esc(sg.pdf_name)} ${ICON.ext}</a>`],
              ['VIN (file name)', `<span class="mono">${esc(sg.file_vin || sg.vin)}</span>`],
              ['Photo VIN', `<span class="mono">${esc(sg.vin_picture) || 'not read'}</span> ${sg.vin_picture === (sg.file_vin || sg.vin) || sg.vin_confirmed ? '<span class="ok-mark">✔</span>' : '<span class="bad-mark">✘</span>'}`],
              ['Paper VIN', `<span class="mono">${esc(sg.paper_vin) || 'not read'}</span> ${sg.paper_vin === (sg.file_vin || sg.vin) || sg.paper_confirmed ? '<span class="ok-mark">✔</span>' : '<span class="warn-mark">✘</span>'}`],
              ['Customer (PDF)', esc(sg.customer_name)],
              ['Install date (PDF)', esc(fmtDate(sg.install_date)) || '–'],
              ['Job number', `<span class="mono">${esc(sg.job_number) || '–'}</span>`],
            ]) : '<div class="faint" style="font-size:12.5px">No PDF in this folder has the same customer name. Find the PDF in the folder and type its VIN below.</div>'}
          </div>
        </div>
        <form id="fixForm" class="fix-form">
          <div class="label-sm">Approve — this Excel row uses the VIN below and becomes <b>Complete (by admin)</b></div>
          <div class="field"><label>VIN to use (must be the file name VIN of a PDF in this month folder)</label>
            <input class="input mono" name="vin" value="${esc(sg ? sg.file_vin || sg.vin : '')}" maxlength="20" autocomplete="off" spellcheck="false" required></div>
          <div class="field"><label>Remark (required — why this VIN is correct)</label>
            <textarea class="input" name="remark" rows="3" maxlength="500" required placeholder="e.g. Installed before car delivery; VIN checked in the PDF photo and with the customer">${x.vin && !/\d/.test(x.vin) ? esc(`Excel VIN cell says "${x.vin}"; `) : ''}</textarea></div>
          <div class="row-actions"><button class="btn primary" type="submit">✔ Approve (Complete)</button></div>
        </form>
      </div>
    </div>`;
  const close = () => { back.remove(); d.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.onclick = close;
  $('.icon-btn', d).onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.append(back, d);
  $('#fixForm', d).onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api('/api/excel-fixes', { method: 'POST', body: { batch_id: x.batch_id, sheet_name: x.sheet_name, row_no: x.row_no, vin: f.get('vin'), remark: f.get('remark') } });
      await afterReview(`Excel row ${x.row_no} approved — Complete (by admin)`);
    } catch (err) { toast(err.message, 'err'); }
  };
}

async function removeExcelFix(batchId, sheetName, rowNo) {
  if (!confirm(`Remove the admin approval of Excel row ${rowNo}? The row goes back to "No valid VIN in Excel".`)) return;
  try {
    await api('/api/excel-fixes', { method: 'DELETE', body: { batch_id: batchId, sheet_name: sheetName, row_no: rowNo } });
    await afterReview('Approval removed');
  } catch (err) { toast(err.message, 'err'); }
}

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
  if (cv) { e.preventDefault(); reviewPatch(cv.dataset.confirmVin, { confirm_vin: true }, 'Photo VIN confirmed'); return; }
  const uf = e.target.closest('[data-unfix]');
  if (uf) { e.preventDefault(); const [bid, sheet, row] = uf.dataset.unfix.split('|'); removeExcelFix(Number(bid), sheet, Number(row)); return; }
  const cp = e.target.closest('[data-confirm-paper]');
  if (cp) { e.preventDefault(); reviewPatch(cp.dataset.confirmPaper, { confirm_paper: true }, 'Paper VIN confirmed'); return; }
  const cb = e.target.closest('[data-confirm-both]');
  if (cb) { e.preventDefault(); reviewPatch(cb.dataset.confirmBoth, { confirm_vin: true, confirm_paper: true }, 'Photo and paper VIN confirmed'); return; }
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
