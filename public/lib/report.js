// Builds the export workbook (Records, Compare vs Reference, Issues, Summary) with ExcelJS.
import { api } from './api.js';

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
