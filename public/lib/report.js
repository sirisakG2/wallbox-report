// Builds the export workbook (Records, Compare vs Reference, Issues, Summary) with ExcelJS.
import { api } from './api.js';
import { PROBLEM_INFO, PROBLEM_TYPES, whatHappened } from './problems.js';

const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141416' } };
const RED_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE2E1' } };
const GREEN_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F6EA' } };
const AMBER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4D6' } };
const FONT = { name: 'Tahoma', size: 10 };

const toDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : iso || '';
};
const flagText = (v) => (v === 1 ? '✔' : v === 0 ? '✘' : '');
const driveLink = (id) => (id ? { text: 'Open PDF', hyperlink: `https://drive.google.com/file/d/${id}/view` } : '');
const urlLink = (u) => (u ? { text: u.replace(/^https?:\/\//, ''), hyperlink: u } : '');

function addSheet(wb, name, columns, rows, style) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 14, style: { font: FONT, ...(c.style || {}) } }));
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.fill = HEAD_FILL;
    cell.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle' };
  });
  for (const r of rows) {
    const row = ws.addRow(r);
    style?.(row, r);
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

// kind: 'check1' (Check 1 sheet) · 'check2' (Check 2 sheet) · 'all' (PDF, Check 1, Check 2, Other problems)
export async function buildWorkbook(ExcelJS, { batchId = null, label, kind = 'all' }) {
  const q = batchId ? `batch=${batchId}&` : '';
  const want = { pdf: kind === 'all', check1: kind === 'all' || kind === 'check1', check2: kind === 'all' || kind === 'check2', problems: kind === 'all' };
  const [{ records }, { issues }, { batches }] = await Promise.all([
    api(`/api/records?${q}size=all`),
    want.problems ? api(`/api/issues?${q}scope=other`) : { issues: [] },
    api('/api/batches'),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Xpeng Thailand — Wall Box Installation Records';
  wb.created = new Date();
  const dateCol = { numFmt: 'dd/mm/yyyy' };

  if (want.pdf) addSheet(wb, 'PDF', [
    { header: 'VIN (file name, key)', key: 'vin', width: 21 },
    { header: '① Check PDF', key: 'vin_level_label', width: 16 },
    { header: '② Check Excel %', key: 'xl_pct', width: 11 },
    { header: 'Photo VIN', key: 'vin_picture', width: 21 },
    { header: 'Paper VIN', key: 'paper_vin', width: 21 },
    { header: 'Excel row', key: 'ref_row_text', width: 16 },
    { header: 'Excel name (col D)', key: 'ref_name', width: 30 },
    { header: 'Installation date', key: 'install_date', width: 14, style: dateCol },
    { header: 'Date %', key: 'date_conf_pct', width: 8 },
    { header: 'Needs review', key: 'needs_review', width: 11 },
    { header: 'VIN photo match', key: 'match', width: 10 },
    { header: 'Read by', key: 'vin_read_by', width: 9 },
    { header: 'Month', key: 'month', width: 9 },
    { header: 'Job number', key: 'job_number', width: 15 },
    { header: 'Charger / PO code', key: 'charger_code', width: 22 },
    { header: 'Customer name', key: 'customer_name', width: 32 },
    { header: 'Phone', key: 'phone', width: 14 },
    { header: 'Region', key: 'region', width: 12 },
    { header: 'Site type', key: 'site_type', width: 12 },
    { header: 'Charger serial', key: 'serial', width: 13 },
    { header: 'Report printed at', key: 'report_printed_at', width: 17 },
    { header: 'Job URL', key: 'job_url', width: 30 },
    { header: 'PDF file', key: 'pdf_name', width: 40 },
    { header: 'PDF link', key: 'pdf_link', width: 10 },
    { header: 'PDF file status', key: 'file_status_text', width: 20 },
    { header: 'VIN — why', key: 'vin_why', width: 55 },
    { header: 'Date — why', key: 'date_why', width: 55 },
    { header: 'Notes', key: 'notes', width: 40 },
  ], records.map((r) => ({
    vin_level_label: `${r.vin_level} · ${r.vin_level_label}`,
    xl_pct: r.xl_band === 'noexcel' ? 'Not in Excel' : r.xl_score / 100,
    ref_row_text: r.ref_row ? `${r.ref_sheet_name || ''} · ${r.ref_row}` : '',
    date_conf_pct: r.date_conf / 100,
    needs_review: r.vin_level === 3 || r.xl_band === 'low' || r.xl_band === 'noexcel' || r.date_conf < 95 ? 'Yes' : '',
    vin_why: r.vin_conf_reasons.join('; '),
    file_status_text: r.file_status ? `${r.file_status === 'updated' ? 'Updated' : 'Deleted'} ${String(r.file_status_at).slice(0, 10)}` : '',
    date_why: r.date_conf_reasons.join('; '),
    ...r,
    match: flagText(r.vin_photo_match),
    install_date: toDate(r.install_date),
    job_url: urlLink(r.job_url),
    pdf_link: driveLink(r.pdf_file_id),
  })), (row, r) => {
    const xl = row.getCell('xl_pct');
    xl.numFmt = '0%';
    xl.fill = r.xl_band === 'full' || r.xl_band === 'high' ? GREEN_FILL : r.xl_band === 'medium' ? AMBER_FILL : RED_FILL;
    const dc = row.getCell('date_conf_pct');
    dc.numFmt = '0%';
    dc.fill = r.date_conf >= 95 ? GREEN_FILL : r.date_conf >= 80 ? AMBER_FILL : RED_FILL;
    row.getCell('vin_level_label').fill = r.vin_level === 1 ? GREEN_FILL : r.vin_level === 2 ? AMBER_FILL : RED_FILL;
    if (r.vin_picture && r.vin_picture !== r.file_vin) row.getCell('vin_picture').fill = RED_FILL;
    if (r.paper_vin !== r.file_vin) row.getCell('paper_vin').fill = AMBER_FILL;
    if (r.vin_level === 3 || r.xl_band === 'low' || r.xl_band === 'noexcel' || r.date_conf < 95) row.getCell('needs_review').fill = AMBER_FILL;
    if (r.file_status === 'deleted') row.getCell('file_status_text').fill = RED_FILL;
    if (r.file_status === 'updated') row.getCell('file_status_text').fill = AMBER_FILL;
    const c = row.getCell('match');
    if (r.vin_photo_match === 0) c.fill = RED_FILL;
    else if (r.vin_photo_match === 1) c.fill = GREEN_FILL;
    else c.fill = AMBER_FILL;
  });

  const cmpCols = [
    ['date_match', 'rec_date', 'ref_date'],
    ['job_match', 'rec_job', 'ref_case'],
    ['serial_match', 'rec_serial', 'ref_serial'],
    ['name_match', 'rec_name', 'ref_name'],
  ];
  if (want.check1) {
    const LEVEL = { 1: '① Match 3/3', 2: '② File = Photo', 3: '③ Not matched' };
    addSheet(wb, 'Check 1 · PDF', [
      { header: 'Month', key: 'month', width: 9 },
      { header: 'VIN in file name (reference)', key: 'file_vin', width: 22 },
      { header: 'VIN in photo', key: 'vin_picture', width: 22 },
      { header: 'VIN in paper box', key: 'paper_vin', width: 22 },
      { header: 'Result', key: 'level', width: 16 },
      { header: 'Photo read by', key: 'read_by', width: 12 },
      { header: 'Why', key: 'why', width: 60 },
      { header: 'Customer (PDF)', key: 'customer_name', width: 30 },
      { header: 'Job number', key: 'job_number', width: 15 },
      { header: 'PDF file', key: 'pdf_name', width: 40 },
      { header: 'PDF link', key: 'pdf_link', width: 10 },
    ], records.map((r) => ({
      month: r.month, file_vin: r.file_vin || '', vin_picture: r.vin_picture || (r.charger_photo ? 'charger photo' : 'not read'),
      paper_vin: r.paper_vin || '', level: LEVEL[r.vin_level], read_by: r.vin_read_by === 'free' ? 'Free reader' : r.vin_read_by === 'ai' ? 'AI' : '',
      why: r.vin_conf_reasons.join('; '), customer_name: r.customer_name, job_number: r.job_number, pdf_name: r.pdf_name, pdf_link: driveLink(r.pdf_file_id),
    })), (row, r) => {
      row.getCell('level').fill = r.vin_level === 1 ? GREEN_FILL : r.vin_level === 2 ? AMBER_FILL : RED_FILL;
      if (r.vin_picture && r.vin_picture !== r.file_vin) row.getCell('vin_picture').fill = RED_FILL;
      if (r.paper_vin !== r.file_vin) row.getCell('paper_vin').fill = AMBER_FILL;
    });
  }

  const base = want.check2 ? await api(`/api/baseline?${batchId ? `batch=${batchId}&` : ''}size=all`) : null;
  if (want.check2) {
  const mark = (ok) => (ok ? '✔' : '✘');
  addSheet(wb, 'Check 2 · Excel baseline', [
    { header: 'Month', key: 'month', width: 9 },
    { header: 'Excel sheet', key: 'sheet_name', width: 16 },
    { header: 'Excel row', key: 'row_no', width: 9 },
    { header: 'VIN (Excel)', key: 'vin', width: 21 },
    { header: 'Customer (Excel)', key: 'customer_name', width: 30 },
    { header: 'Case no. (Excel)', key: 'case_number', width: 15 },
    { header: 'Install date (Excel)', key: 'install_date', width: 14, style: dateCol },
    { header: 'PDF found', key: 'found', width: 9 },
    { header: 'VIN file (15)', key: 'vin_file', width: 10 },
    { header: 'VIN photo (15)', key: 'vin_photo', width: 10 },
    { header: 'VIN paper (10)', key: 'vin_paper', width: 10 },
    { header: 'Name % (25)', key: 'name', width: 10 },
    { header: 'Case (15)', key: 'case', width: 9 },
    { header: 'Date (20)', key: 'date', width: 10 },
    { header: '% match', key: 'score', width: 9 },
    { header: 'Customer (PDF)', key: 'pdf_name', width: 30 },
    { header: 'Job no. (PDF)', key: 'pdf_job', width: 15 },
    { header: 'Install date (PDF)', key: 'pdf_date', width: 14, style: dateCol },
    { header: 'PDF link', key: 'pdf_link', width: 10 },
  ], base.rows.map((x) => ({
    month: x.month, sheet_name: x.sheet_name, row_no: x.row_no, vin: x.vin, customer_name: x.customer_name,
    case_number: x.case_number, install_date: toDate(x.install_date),
    found: x.record ? 'Yes' : 'No PDF',
    vin_file: x.parts ? mark(x.parts.vin_file) : '', vin_photo: x.parts ? mark(x.parts.vin_photo) : '', vin_paper: x.parts ? mark(x.parts.vin_paper) : '',
    name: x.parts ? x.parts.name / 100 : '', case: x.parts ? mark(x.parts.case) : '',
    date: x.parts ? (x.parts.date_days === 0 ? '✔' : x.parts.date_days === null ? '' : `${x.parts.date_days} days`) : '',
    score: x.score / 100,
    pdf_name: x.record?.customer_name || '', pdf_job: x.record?.job_number || '', pdf_date: toDate(x.record?.install_date),
    pdf_link: driveLink(x.record?.pdf_file_id),
  })), (row, x) => {
    const sc = row.getCell('score');
    sc.numFmt = '0%';
    sc.fill = x.band === 'full' || x.band === 'high' ? GREEN_FILL : x.band === 'medium' ? AMBER_FILL : RED_FILL;
    row.getCell('name').numFmt = '0%';
    if (!x.record) row.getCell('found').fill = RED_FILL;
    for (const k of ['vin_file', 'vin_photo', 'vin_paper', 'case']) if (x.parts && !x.parts[k]) row.getCell(k).fill = RED_FILL;
    if (x.parts && x.parts.date_days !== 0) row.getCell('date').fill = AMBER_FILL;
  });

  }

  if (want.problems) addSheet(wb, 'Other problems', [
    { header: 'Type', key: 'type', width: 16 },
    { header: 'VIN', key: 'vin', width: 21 },
    { header: 'Month', key: 'month', width: 9 },
    { header: 'Detail', key: 'detail', width: 70 },
    { header: 'PDF file', key: 'pdf_name', width: 40 },
    { header: 'PDF link', key: 'pdf_link', width: 10 },
    { header: 'Resolved', key: 'resolved', width: 9 },
  ], issues.map((i) => {
    let detail = i.detail;
    try { const d = JSON.parse(i.detail); if (d?.message) detail = d.message; } catch { /* plain text */ }
    return { ...i, detail, resolved: i.resolved ? 'Yes' : '', pdf_link: driveLink(i.pdf_file_id) };
  }));

  const scope = batchId ? batches.filter((b) => b.id === batchId) : batches;
  const sum = wb.addWorksheet('Summary');
  sum.columns = [{ width: 34 }, { width: 18 }];
  const title = sum.addRow(['Xpeng Thailand — Wall Box Installation Records']);
  title.font = { ...FONT, size: 14, bold: true };
  sum.addRow([`Export: ${label}`]).font = FONT;
  sum.addRow([`Generated: ${new Date().toLocaleString('en-GB')}`]).font = FONT;
  sum.addRow([]);
  const lines = [
    ['Export', { check1: '① Check PDF — file name ↔ inside PDF', check2: '② Check Excel — Excel rows as baseline', all: 'All sheets' }[kind]],
    ['Months included', scope.map((b) => b.month).join(', ')],
    ['PDFs in folder(s)', scope.reduce((a, b) => a + b.pdf_count, 0)],
    ['PDF records (unique VIN)', records.length],
  ];
  if (want.check1) lines.push(
    ['① Match 3/3 (file = photo = paper)', records.filter((r) => r.vin_level === 1).length],
    ['② File = Photo (paper box differs)', records.filter((r) => r.vin_level === 2).length],
    ['③ Not matched (photo ≠ file name)', records.filter((r) => r.vin_level === 3).length],
  );
  if (want.check2) lines.push(
    ['Check 2 · Excel rows', base.rows.length],
    ['Check 2 · 100% match', base.facets.full],
    ['Check 2 · 90–99%', base.facets.high],
    ['Check 2 · 70–89%', base.facets.medium],
    ['Check 2 · below 70%', base.facets.low],
    ['Check 2 · Excel row with no PDF', base.facets.nopdf],
    ['Check 2 · PDF not in Excel', base.facets.pdfonly],
  );
  if (want.problems) lines.push(['Other problems (open)', issues.filter((i) => !i.resolved).length]);
  for (const l of lines) {
    const row = sum.addRow(l);
    row.font = FONT;
    row.getCell(1).font = { ...FONT, bold: true };
  }
  return wb;
}

export async function downloadWorkbook(ExcelJS, opts) {
  const wb = await buildWorkbook(ExcelJS, opts);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wallbox_${opts.kind || 'all'}_${opts.fileTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Detailed "Other problems" workbook (with explanations in English and Thai) ----------

const WRAP = { wrapText: true, vertical: 'top' };

export async function buildProblemsWorkbook(ExcelJS, { batchId = null, label }) {
  const q = batchId ? `batch=${batchId}&` : '';
  const [{ issues }, { records }, { batches }] = await Promise.all([
    api(`/api/issues?${q}scope=other&resolved=all`),
    api(`/api/records?size=all`),
    api('/api/batches'),
  ]);
  const byFile = new Map(records.map((r) => [r.pdf_file_id, r]));
  const byVin = new Map(records.map((r) => [r.vin, r]));
  const recOf = (i) => byFile.get(i.pdf_file_id) || byVin.get(i.vin) || null;
  const batchOf = new Map(batches.map((b) => [b.id, b]));
  const excelLink = (id) => (id ? { text: 'Open Excel', hyperlink: `https://drive.google.com/file/d/${id}/view` } : '');
  const found = (at) => (at ? String(at).slice(0, 16).replace('T', ' ') : '');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Xpeng Thailand — Wall Box Installation Records';
  wb.created = new Date();

  // --- Read me
  const rm = wb.addWorksheet('Read me', { views: [{ showGridLines: false }] });
  rm.columns = [{ width: 26 }, { width: 22 }, { width: 55 }, { width: 55 }, { width: 45 }, { width: 55 }, { width: 55 }, { width: 8 }, { width: 10 }];
  const t = rm.addRow(['Other problems — explanation and details']);
  t.font = { ...FONT, size: 16, bold: true };
  rm.addRow([`Export: ${label} · generated ${new Date().toLocaleString('en-GB')}`]).font = { ...FONT, color: { argb: 'FF666666' } };
  rm.addRow([]);
  for (const line of [
    'These are problems that ① Check PDF (file name VIN vs inside the PDF) and ② Check Excel (Excel rows vs PDF) do not show.',
    'ปัญหาในไฟล์นี้คือปัญหาที่ Check 1 และ Check 2 ไม่ได้แสดง ต้องให้ผู้ดูแลตรวจเอง',
    'How to use: 1) read the explanation of each problem below · 2) go to the sheet of that problem (tabs at the bottom) · 3) open the PDF link, check, and fix or mark it resolved in the app (menu "Other problems").',
    'วิธีใช้: 1) อ่านคำอธิบายแต่ละปัญหาด้านล่าง 2) ไปที่ชีตของปัญหานั้น (แท็บด้านล่าง) 3) คลิกลิงก์ PDF ตรวจสอบ แล้วแก้ไขหรือกด Resolve ในแอป (เมนู Other problems)',
  ]) { const r = rm.addRow([line]); r.font = FONT; rm.mergeCells(r.number, 1, r.number, 9); r.alignment = WRAP; r.height = 30; }
  rm.addRow([]);
  const head = rm.addRow(['Problem', 'ปัญหา', 'What it means', 'ความหมาย', 'Why it matters', 'What to do', 'สิ่งที่ต้องทำ', 'Open', 'Resolved']);
  head.eachCell((c) => { c.fill = HEAD_FILL; c.font = { ...FONT, bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = WRAP; });
  for (const type of PROBLEM_TYPES) {
    const p = PROBLEM_INFO[type];
    const list = issues.filter((i) => i.type === type);
    const r = rm.addRow([p.name, p.th, p.meaning, p.meaning_th, `${p.why}\n${p.why_th}`, p.action, p.action_th,
      list.filter((i) => !i.resolved).length, list.filter((i) => i.resolved).length]);
    r.font = FONT;
    r.alignment = WRAP;
    r.height = 105;
    r.getCell(1).font = { ...FONT, bold: true };
    r.getCell(8).fill = list.some((i) => !i.resolved) ? AMBER_FILL : GREEN_FILL;
  }

  // --- All problems
  const common = (i) => {
    const r = recOf(i);
    const b = batchOf.get(i.batch_id);
    return {
      problem: PROBLEM_INFO[i.type]?.name || i.type,
      status: i.resolved ? 'Resolved' : 'Open',
      month: i.month || b?.month || '',
      vin: i.vin,
      customer: r?.customer_name || '',
      job: r?.job_number || '',
      pdf_name: i.pdf_name,
      pdf_link: driveLink(i.pdf_file_id),
      excel_row: r?.ref_row ? `${r.ref_sheet_name || ''} · row ${r.ref_row}` : '',
      excel_link: excelLink(r?.ref_file_id || b?.reference_file_id),
      what: whatHappened(i),
      todo: PROBLEM_INFO[i.type]?.action || '',
      found: found(i.created_at),
    };
  };
  const commonCols = [
    { header: 'Problem', key: 'problem', width: 22 },
    { header: 'Status', key: 'status', width: 10 },
    { header: 'Month', key: 'month', width: 9 },
    { header: 'VIN', key: 'vin', width: 21 },
    { header: 'Customer (PDF)', key: 'customer', width: 28 },
    { header: 'Job number (PDF)', key: 'job', width: 15 },
  ];
  const tailCols = [
    { header: 'What happened', key: 'what', width: 60, style: { alignment: WRAP } },
    { header: 'What to do', key: 'todo', width: 60, style: { alignment: WRAP } },
    { header: 'PDF file', key: 'pdf_name', width: 38 },
    { header: 'PDF link', key: 'pdf_link', width: 10 },
    { header: 'Excel row', key: 'excel_row', width: 18 },
    { header: 'Excel link', key: 'excel_link', width: 11 },
    { header: 'Found (UTC)', key: 'found', width: 16 },
  ];
  const statusFill = (row, i) => { row.getCell('status').fill = i.resolved ? GREEN_FILL : AMBER_FILL; };
  const sorted = [...issues].sort((a, b) => a.resolved - b.resolved || PROBLEM_TYPES.indexOf(a.type) - PROBLEM_TYPES.indexOf(b.type));
  addSheet(wb, 'All problems', [...commonCols, ...tailCols], sorted.map(common), (row, x, i = sorted[row.number - 2]) => statusFill(row, i));

  // --- One sheet per problem type, with the columns that matter for it
  const extra = {
    edited_pdf: {
      cols: [{ header: 'Job at top of page', key: 'header_job', width: 16 }, { header: 'Job in table', key: 'table_job', width: 16 },
        { header: 'Report printed', key: 'printed', width: 16 }, { header: 'Install date (PDF)', key: 'date', width: 14 }],
      row: (i, r) => {
        const m = /header shows job (\S+) but the table says (\S+)/.exec(i.detail || '');
        return { header_job: m?.[1] || '(labels are pictures)', table_job: m?.[2] || r?.job_number || '', printed: r?.report_printed_at || '', date: r?.install_date || '' };
      },
    },
    duplicate_vin: {
      cols: [{ header: 'Kept record: PDF', key: 'kept_pdf', width: 38 }, { header: 'Kept: month', key: 'kept_month', width: 10 }, { header: 'Kept: link', key: 'kept_link', width: 10 },
        { header: 'Kept: customer', key: 'kept_customer', width: 26 }, { header: 'This PDF: customer', key: 'this_customer', width: 26 },
        { header: 'This PDF: install date', key: 'this_date', width: 14 }, { header: 'This PDF: job', key: 'this_job', width: 15 }],
      row: (i) => {
        let d = {};
        try { d = JSON.parse(i.detail); } catch { /* old format */ }
        const kept = byVin.get(i.vin);
        return { kept_pdf: d.existing?.pdf_name || kept?.pdf_name || '', kept_month: d.existing?.month || kept?.month || '',
          kept_link: driveLink(d.existing?.pdf_file_id || kept?.pdf_file_id), kept_customer: kept?.customer_name || '',
          this_customer: d.record?.customer_name || '', this_date: d.record?.install_date || '', this_job: d.record?.job_number || '' };
      },
    },
    scanned_page: {
      cols: [{ header: 'Install date (AI read)', key: 'date', width: 14 }, { header: 'VIN photo (AI read)', key: 'photo', width: 21 },
        { header: 'Notes', key: 'notes', width: 50, style: { alignment: WRAP } }],
      row: (i, r) => ({ date: r?.install_date || '', photo: r?.vin_picture || '', notes: r?.notes || '' }),
    },
    vin_photo_wrong: {
      cols: [{ header: 'Text seen in the photo', key: 'seen', width: 50, style: { alignment: WRAP } }],
      row: (i, r) => ({ seen: r?.ocr_raw || '' }),
    },
    error: { cols: [], row: () => ({}) },
    file_updated: {
      cols: [{ header: 'Updated in Drive', key: 'when', width: 16 }],
      row: (i, r) => ({ when: r?.file_status_at || '' }),
    },
  };
  for (const type of PROBLEM_TYPES) {
    const list = sorted.filter((i) => i.type === type);
    if (!list.length) continue;
    const x = extra[type];
    const ws = addSheet(wb, PROBLEM_INFO[type].sheet, [...commonCols, ...x.cols, ...tailCols],
      list.map((i) => ({ ...common(i), ...x.row(i, recOf(i)) })), (row) => statusFill(row, list[row.number - 2]));
    // Explanation above the table.
    ws.spliceRows(1, 0, [`${PROBLEM_INFO[type].name} — ${PROBLEM_INFO[type].th}`], [PROBLEM_INFO[type].meaning], [`What to do: ${PROBLEM_INFO[type].action}`], []);
    for (const n of [1, 2, 3]) { ws.mergeCells(n, 1, n, 8); ws.getRow(n).alignment = WRAP; ws.getRow(n).font = { ...FONT, bold: n === 1, size: n === 1 ? 13 : 10 }; }
    ws.getRow(2).height = 30;
    ws.getRow(3).height = 30;
    ws.views = [{ state: 'frozen', ySplit: 5 }];
    ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: ws.columnCount } };
  }
  return wb;
}

export async function downloadProblemsWorkbook(ExcelJS, opts) {
  const wb = await buildProblemsWorkbook(ExcelJS, opts);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `wallbox_problems_${opts.fileTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
