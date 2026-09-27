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

export async function buildWorkbook(ExcelJS, { batchId = null, label }) {
  const q = batchId ? `batch=${batchId}&` : '';
  const [{ records }, compare, { issues }, { batches }] = await Promise.all([
    api(`/api/records?${q}size=all`),
    api(`/api/compare?${batchId ? `batch=${batchId}` : ''}`),
    api(`/api/issues?${q}`),
    api('/api/batches'),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Xpeng Thailand — Wall Box Installation Records';
  wb.created = new Date();
  const dateCol = { numFmt: 'dd/mm/yyyy' };

  addSheet(wb, 'Records', [
    { header: 'VIN (file name, key)', key: 'vin', width: 21 },
    { header: 'VIN check', key: 'vin_level_label', width: 15 },
    { header: 'Photo VIN', key: 'vin_picture', width: 21 },
    { header: 'Paper VIN', key: 'paper_vin', width: 21 },
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
    date_conf_pct: r.date_conf / 100,
    needs_review: r.vin_level === 3 || r.date_conf < 95 ? 'Yes' : '',
    vin_why: r.vin_conf_reasons.join('; '),
    file_status_text: r.file_status ? `${r.file_status === 'updated' ? 'Updated' : 'Deleted'} ${String(r.file_status_at).slice(0, 10)}` : '',
    date_why: r.date_conf_reasons.join('; '),
    ...r,
    match: flagText(r.vin_photo_match),
    install_date: toDate(r.install_date),
    job_url: urlLink(r.job_url),
    pdf_link: driveLink(r.pdf_file_id),
  })), (row, r) => {
    const dc = row.getCell('date_conf_pct');
    dc.numFmt = '0%';
    dc.fill = r.date_conf >= 95 ? GREEN_FILL : r.date_conf >= 80 ? AMBER_FILL : RED_FILL;
    row.getCell('vin_level_label').fill = r.vin_level === 1 ? GREEN_FILL : r.vin_level === 2 ? AMBER_FILL : RED_FILL;
    if (r.vin_picture && r.vin_picture !== r.file_vin) row.getCell('vin_picture').fill = RED_FILL;
    if (r.paper_vin !== r.file_vin) row.getCell('paper_vin').fill = AMBER_FILL;
    if (r.vin_level === 3 || r.date_conf < 95) row.getCell('needs_review').fill = AMBER_FILL;
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
  addSheet(wb, 'Compare vs Reference', [
    { header: 'VIN', key: 'vin', width: 21 },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Month', key: 'month', width: 9 },
    { header: 'Date ✔', key: 'date_match', width: 8 },
    { header: 'Install date (PDF)', key: 'rec_date', width: 14, style: dateCol },
    { header: 'Install date (Excel)', key: 'ref_date', width: 14, style: dateCol },
    { header: 'Job ✔', key: 'job_match', width: 8 },
    { header: 'Job number (PDF)', key: 'rec_job', width: 15 },
    { header: 'Case number (Excel)', key: 'ref_case', width: 15 },
    { header: 'Serial ✔', key: 'serial_match', width: 8 },
    { header: 'Serial (PDF)', key: 'rec_serial', width: 13 },
    { header: 'Serial (Excel)', key: 'ref_serial', width: 13 },
    { header: 'Name ✔', key: 'name_match', width: 8 },
    { header: 'Name (PDF)', key: 'rec_name', width: 30 },
    { header: 'Name (Excel)', key: 'ref_name', width: 30 },
    { header: 'Charger model (Excel)', key: 'ref_model', width: 20 },
    { header: 'Car model (Excel)', key: 'ref_car', width: 16 },
    { header: 'Team (Excel)', key: 'ref_team', width: 28 },
    { header: 'PDF link', key: 'pdf_link', width: 10 },
  ], compare.rows.map((x) => ({
    vin: x.vin,
    status: x.status,
    month: x.month,
    date_match: flagText(x.date_match), rec_date: toDate(x.record?.install_date), ref_date: toDate(x.reference?.install_date),
    job_match: flagText(x.job_match), rec_job: x.record?.job_number || '', ref_case: x.reference?.case_number || '',
    serial_match: flagText(x.serial_match), rec_serial: x.record?.serial || '', ref_serial: x.reference?.serial || '',
    name_match: flagText(x.name_match), rec_name: x.record?.customer_name || '', ref_name: x.reference?.customer_name || '',
    ref_model: x.reference?.charger_model || '', ref_car: x.reference?.car_model || '', ref_team: x.reference?.team || '',
    pdf_link: driveLink(x.record?.pdf_file_id),
  })), (row, x) => {
    if (x.status !== 'Both') row.getCell('status').fill = AMBER_FILL;
    for (const [flag, a, b] of cmpCols) {
      if (x[flag] === 0) for (const k of [flag, a, b]) row.getCell(k).fill = RED_FILL;
      else if (x[flag] === 1) row.getCell(flag).fill = GREEN_FILL;
    }
  });

  addSheet(wb, 'Issues', [
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
    ['Months included', scope.map((b) => b.month).join(', ')],
    ['PDFs in folder(s)', scope.reduce((a, b) => a + b.pdf_count, 0)],
    ['Records (unique VIN)', records.length],
    ['VIN ① Match 3/3 (file = photo = paper)', records.filter((r) => r.vin_level === 1).length],
    ['VIN ② File = Photo (paper differs)', records.filter((r) => r.vin_level === 2).length],
    ['VIN ③ Not matched (photo ≠ file name)', records.filter((r) => r.vin_level === 3).length],
    ['VIN photo ✔ match', records.filter((r) => r.vin_photo_match === 1).length],
    ['VIN photo ✘ mismatch', records.filter((r) => r.vin_photo_match === 0).length],
    ['VIN photo not read', records.filter((r) => r.vin_photo_match == null).length],
    ...Object.entries(compare.summary).map(([k, v]) => [`Compare: ${k.replace(/_match_fail$/, ' mismatches').replace(/_/g, ' ')}`, v]),
    ['Open issues', issues.filter((i) => !i.resolved).length],
  ];
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
  a.download = `wallbox_${opts.fileTag}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
