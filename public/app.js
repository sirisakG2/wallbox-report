// Admin console: Dashboard · Import month · Records · Compare · Issues · Months · Export
import { api } from './lib/api.js';
import { runImport, suggestMonth } from './lib/importer.js';
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
  edited_pdf: ['PDF may be edited', 'bad'], suspicious_date: ['Suspicious date', 'warn'],
};
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

const VIEWS = { dashboard: renderDashboard, import: renderImport, records: renderRecords, compare: renderCompare, issues: renderIssues, months: renderMonths, export: renderExport };

async function route() {
  const { name, params } = parseHash();
  const fn = VIEWS[name] || renderDashboard;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === (VIEWS[name] ? name : 'dashboard')));
  // A running import keeps going when switching tabs; renderImport re-attaches its view.
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
  const read = s.ocr_match + s.ocr_mismatch;
  const maxBar = Math.max(1, ...s.byInstallMonth.map((x) => x.n));
  view.innerHTML = `
    <div class="view-head">
      <div><h1>Dashboard</h1><p>All imported months at a glance.</p></div>
      <button class="btn primary lg" data-go="import">${ICON.play} Import a month</button>
    </div>
    <div class="grid cols-5">
      <div class="card kpi accent"><div class="label">Records</div><div class="value">${fmtN(s.records)}</div><div class="sub">unique VINs · ${fmtN(s.months)} month${s.months === 1 ? '' : 's'}</div></div>
      <div class="card kpi"><div class="label">VIN photo match</div><div class="value">${read ? pct(s.ocr_match, read) : 0}%</div><div class="sub">${fmtN(s.ocr_match)} match · ${fmtN(s.ocr_mismatch)} mismatch</div></div>
      <a class="card kpi kpi-link" href="#/records?conf=review"><div class="label">To review</div><div class="value" style="color:${s.to_review ? 'var(--warn)' : 'inherit'}">${fmtN(s.to_review)}</div><div class="sub">VIN or date below 95% · ${fmtN(s.full_conf)} at 100%</div></a>
      <div class="card kpi"><div class="label">In reference Excel</div><div class="value">${pct(s.matched, s.reference_rows)}%</div><div class="sub">${fmtN(s.matched)} of ${fmtN(s.reference_rows)} rows have a PDF</div></div>
      <div class="card kpi"><div class="label">Open issues</div><div class="value" style="color:${s.open_issues ? 'var(--warn)' : 'inherit'}">${fmtN(s.open_issues)}</div><div class="sub">need a look</div></div>
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
        <div class="stat"><b style="color:${b.open_issue_count ? 'var(--warn)' : 'inherit'}">${fmtN(b.open_issue_count)}</b><span>Issues</span></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-3);margin-bottom:6px"><span>Processed ${fmtN(b.processed_count)} / ${fmtN(b.pdf_count)}</span><span>Reference match ${b.reference_count ? pct(b.matched_count, b.reference_count) : 0}%</span></div>
        <div class="meter"><i style="width:${done}%"></i></div>
      </div>
      <div class="row-actions">
        <button class="btn sm primary" data-summary="${b.id}">Summary</button>
        <button class="btn sm" data-go="records" data-batch="${b.id}">Records</button>
        <button class="btn sm" data-go="compare" data-batch="${b.id}">Compare</button>
        <button class="btn sm" data-go="issues" data-batch="${b.id}">Issues</button>
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
        folder, month,
        reprocess: $('#optReprocess', el).checked,
        retry: $('#optRetry', el).checked,
        ocr: $('#optOcr', el).checked,
        limit: Number($('#optLimit', el).value) || 0,
      }, ui, ctrl.signal);
      toast('Import finished');
      const acts = $('#doneActions', el);
      acts.innerHTML = `
        <button class="btn primary" data-summary="${batch.id}">Import summary</button>
        <button class="btn" data-go="records" data-batch="${batch.id}">View records</button>
        <button class="btn" data-go="compare" data-batch="${batch.id}">Compare with reference</button>
        <button class="btn" data-go="issues" data-batch="${batch.id}">Issues</button>
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

// ---------- Records ----------
async function renderRecords(params) {
  const page = Number(params.get('page')) || 1;
  const q = new URLSearchParams({ page, size: 50 });
  for (const k of ['batch', 'q', 'match', 'from', 'to', 'conf']) if (params.get(k)) q.set(k, params.get(k));
  const data = await api(`/api/records?${q}`);
  state.lastRecords = data.records;
  state.reviewMode = params.get('conf') === 'review';
  const pages = Math.max(1, Math.ceil(data.total / data.size));

  view.innerHTML = `
    <div class="view-head"><div><h1>Records</h1><p>One row per installation PDF — VIN is the primary key. VIN % / Date % show how sure the reading is; below 95% needs a look.</p></div>
      <button class="btn" data-export="${esc(params.get('batch') || '')}">${ICON.download} Export Excel</button></div>
    <div class="card">
      <form class="toolbar" id="filters">
        <div class="field"><label>Month</label><select class="select" name="batch">${monthOptions(params.get('batch'))}</select></div>
        <div class="field grow"><label>Search</label><input class="input" name="q" placeholder="VIN, name, job number, serial, phone…" value="${esc(params.get('q') || '')}"></div>
        <div class="field"><label>Confidence</label><select class="select" name="conf">
          ${[['', 'All'], ['review', 'Needs review (<95%)'], ['full', '100% only']].map(([v, l]) => `<option value="${v}" ${(params.get('conf') || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>VIN photo</label><select class="select" name="match">
          ${[['', 'All'], ['1', 'Match'], ['0', 'Mismatch'], ['null', 'Not read']].map(([v, l]) => `<option value="${v}" ${params.get('match') === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select></div>
        <div class="field"><label>Installed from</label><input class="input" type="date" name="from" value="${esc(params.get('from') || '')}"></div>
        <div class="field"><label>to</label><input class="input" type="date" name="to" value="${esc(params.get('to') || '')}"></div>
        <button class="btn primary" type="submit">Apply</button>
        <button class="btn" type="button" id="clearF">Clear</button>
      </form>
      <div class="table-wrap">
        ${data.records.length ? `<table>
          <thead><tr><th>VIN</th><th title="How sure the VIN is right">VIN %</th><th>Installed</th><th title="How sure the installation date is right">Date %</th><th>VIN picture</th><th>VIN photo</th><th>Job number</th><th>Customer</th><th>Phone</th><th>Serial</th><th>Month</th><th></th></tr></thead>
          <tbody>${data.records.map((r, i) => `
            <tr class="clickable" data-i="${i}">
              <td class="mono">${esc(r.vin)}</td>
              <td title="${esc(r.vin_conf_reasons.join(' · '))}">${confPill(r.vin_conf)}</td>
              <td class="num">${esc(fmtDate(r.install_date)) || `<span class="pill bad">${esc(r.install_date_raw || 'missing')}</span>`}</td>
              <td title="${esc(r.date_conf_reasons.join(' · '))}">${confPill(r.date_conf)}</td>
              <td class="mono ${r.vin_photo_match === 0 ? 'bad-cell' : ''}">${esc(r.vin_picture) || '<span class="faint">–</span>'}</td>
              <td>${matchPill(r.vin_photo_match)}</td>
              <td class="mono">${esc(r.job_number)}</td>
              <td>${esc(r.customer_name)}</td>
              <td class="num">${esc(r.phone)}</td>
              <td class="mono">${esc(r.serial)}</td>
              <td class="faint">${esc(fmtMonth(r.month))}</td>
              <td><a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">PDF ${ICON.ext}</a></td>
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
  f.match.onchange = () => go('records', current());
  f.conf.onchange = () => go('records', current());
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
          <div class="review-head"><span>VIN</span>${confPill(r.vin_conf, true)}</div>
          <div class="mono review-value">${esc(r.vin)}</div>
          ${reasons(r.vin_conf_reasons)}
          <div class="row-actions">
            ${r.vin_confirmed ? '' : `<button class="btn sm" data-confirm-vin="${esc(r.vin)}">✔ Confirm VIN</button>`}
            <button class="btn sm" data-correct-vin="${esc(r.vin)}">Correct VIN</button>
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
    ['PDF', `<a href="${pdfUrl(r.pdf_file_id)}" target="_blank" rel="noopener">${esc(r.pdf_name)} ${ICON.ext}</a>`],
    ['Raw reading', `<span class="mono faint">${esc(r.ocr_raw) || '–'}</span>`],
    ['Notes', esc(r.notes) || '–'],
    ['Last updated', esc(r.updated_at)],
  ];
  const back = document.createElement('div');
  back.className = 'drawer-backdrop';
  const d = document.createElement('aside');
  d.className = 'drawer';
  d.innerHTML = `
    <div class="drawer-head"><div><div class="label-sm">Installation record</div><h2>${esc(r.customer_name || r.vin)}</h2></div>
      <button class="icon-btn" aria-label="Close">✕</button></div>
    <div class="drawer-body">${review}<dl style="margin:0">${rows.map(([k, v]) => `<div class="kv"><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl></div>`;
  const close = () => { back.remove(); d.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  back.onclick = close;
  $('.icon-btn', d).onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.append(back, d);
}

// ---------- Import summary (per month) ----------
async function openSummary(batchId) {
  const { batch, counts: c, quotaReached } = await api(`/api/batches/${batchId}/summary`);
  const b = String(batch.id);
  const rows = [
    ['Records saved', c.saved, 'neutral', 'One record per PDF, keyed by VIN', ['records', { batch: b }]],
    ['VIN photo ✔ matches PDF', c.vin_match, 'ok', 'AI reading of the VIN photo = VIN in the PDF', ['records', { batch: b, match: '1' }]],
    ['VIN photo ✘ differs', c.vin_mismatch, 'bad', 'Check the photo — often an AI misread, sometimes a real error', ['records', { batch: b, match: '0' }]],
    ['VIN photo not read — AI quota used up', c.unread_quota, 'warn', 'Daily free Workers AI allowance ran out', ['issues', { batch: b, type: 'ocr_failed', q: 'allocation' }]],
    ['VIN photo not read — other reasons', c.unread_other, 'warn', 'AI saw no VIN, no photo on page 1, scanned page, or AI reading switched off', ['records', { batch: b, match: 'null' }]],
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
      <div class="kv" style="border:0"><dt>VIN photos read by</dt><dd><span class="pill ok plain">Free ${fmtN(c.read_free)}</span> <span class="pill info plain">AI ${fmtN(c.read_ai)}</span></dd></div>
      <div class="row-actions" style="margin-top:8px">
        <button class="btn" data-sum-go="compare">Compare with reference</button>
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
  $('[data-sum-go]', d).onclick = () => { close(); go('compare', { batch: b }); };
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
              <td>${flagCell(x.name_match)}</td>${cell(x.name_match, x.record?.customer_name, x.reference?.customer_name)}
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
  if (type) q.set('type', type);
  if (text) q.set('q', text);
  if (!showResolved) q.set('resolved', '0');
  const { issues } = await api(`/api/issues?${q}`);
  const detailText = (i) => { try { const d = JSON.parse(i.detail); return d?.message || i.detail; } catch { return i.detail; } };

  view.innerHTML = `
    <div class="view-head"><div><h1>Issues</h1><p>Problems found while importing — check them against the PDF and mark resolved.</p></div></div>
    <div class="card">
      <div class="toolbar">
        <div class="field"><label>Month</label><select class="select" id="iBatch">${monthOptions(batch)}</select></div>
        <div class="field"><label>Type</label><select class="select" id="iType"><option value="">All types</option>
          ${Object.entries(ISSUE_LABEL).map(([k, [l]]) => `<option value="${k}" ${type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
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
            </tr>`).join('')}</tbody></table>` : '<div class="empty">No issues — nice.</div>'}
      </div>
      <div class="pager"><span>${fmtN(issues.length)} issue${issues.length === 1 ? '' : 's'}</span></div>
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
          <thead><tr><th>Month</th><th>Folder</th><th>PDFs</th><th>Processed</th><th>Records</th><th>VIN ✘</th><th>Issues</th><th>Reference</th><th>Status</th><th>Imported</th><th style="text-align:right">Actions</th></tr></thead>
          <tbody>${b.map((x) => `
            <tr>
              <td><input type="month" class="input" value="${esc(x.month)}" data-month="${x.id}" style="height:32px;width:150px"></td>
              <td style="max-width:300px"><a href="${esc(x.folder_url)}" target="_blank" rel="noopener">${esc(x.folder_name || x.folder_id)} ${ICON.ext}</a></td>
              <td class="num">${fmtN(x.pdf_count)}</td>
              <td class="num">${fmtN(x.processed_count)}</td>
              <td class="num">${fmtN(x.record_count)}</td>
              <td class="num" style="color:${x.ocr_mismatch_count ? 'var(--bad)' : 'inherit'}">${fmtN(x.ocr_mismatch_count)}</td>
              <td class="num">${fmtN(x.open_issue_count)}</td>
              <td><div class="stack"><span class="num">${fmtN(x.matched_count)} / ${fmtN(x.reference_count)}</span><small title="${esc(x.reference_name)}">${esc((x.reference_name || 'no Excel').slice(0, 30))}</small></div></td>
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
    <div class="view-head"><div><h1>Export</h1><p>Download an Excel workbook built from the stored data.</p></div></div>
    <div class="grid cols-2">
      <div class="card card-pad">
        <div class="field" style="max-width:360px"><label>Months</label><select class="select" id="eBatch">${monthOptions(params.get('batch'))}</select></div>
        <div style="margin-top:22px"><button class="btn primary lg" id="eGo">${ICON.download} Download Excel</button></div>
      </div>
      <div class="card card-pad">
        <h2 style="margin:0 0 12px;font-size:15px">Workbook contents</h2>
        <dl style="margin:0">
          <div class="kv"><dt>Records</dt><dd>One row per PDF: VIN, VIN picture, VIN photo match, installation date, job, customer, serial, links</dd></div>
          <div class="kv"><dt>Compare vs Reference</dt><dd>PDF vs submission Excel — date, job/case number, serial, name; mismatches in red</dd></div>
          <div class="kv"><dt>Issues</dt><dd>Duplicates, VIN photo mismatches, scanned pages, errors</dd></div>
          <div class="kv" style="border:0"><dt>Summary</dt><dd>Counts per export</dd></div>
        </dl>
      </div>
    </div>`;
  $('#eGo').onclick = () => exportExcel($('#eBatch').value);
}

async function exportExcel(batchId) {
  if (!window.ExcelJS) { toast('Excel library is still loading, try again', 'err'); return; }
  const b = state.batches.find((x) => String(x.id) === String(batchId));
  toast('Building Excel…');
  try {
    await downloadWorkbook(window.ExcelJS, {
      batchId: b ? b.id : null,
      label: b ? fmtMonth(b.month, true) : 'All months',
      fileTag: b ? b.month : 'all-months',
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
  if (x) { e.preventDefault(); exportExcel(x.dataset.export); }
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
