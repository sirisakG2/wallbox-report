// Reads the monthly submission Excel (reference) with ExcelJS.
// Install sheet: header row contains "Vinno"; the right-hand block repeats the left one, so only the
// first occurrence of each header is used. Charger-only sheet: title contains "รับเฉพาะเครื่องชาร์จ".
import { normalizeVin, VIN_RE, cleanThai, parseAnyDate } from './parse.js';

const pad = (n) => String(n).padStart(2, '0');

function cellText(v) {
  if (v == null) return '';
  if (v instanceof Date) return `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return cellText(v.result);
    if (v.formula) return '';
  }
  return String(v);
}

function toIsoDate(v) {
  if (typeof v === 'number' && v > 30000 && v < 300000) v = new Date(Math.round((v - 25569) * 86400000)); // Excel serial
  // cellText gives "YYYY-MM-DD" for dates; a date typed with a Thai year (26/5/2569) is stored by
  // Excel as the year 2569, which parseAnyDate converts to 2026.
  return parseAnyDate(cellText(v));
}

const HEADERS = {
  vin: (h) => /vin/i.test(h),
  case_number: (h) => /case\s*number/i.test(h),
  customer_name: (h) => h.includes('ชื่อ'),
  install_date: (h) => h.includes('วันที่ติดตั้ง'),
  charger_model: (h) => h.includes('เครื่องชาร์จรุ่น'),
  car_model: (h) => h.includes('รุ่นรถ'),
  serial: (h) => /serial/i.test(h),
  team: (h) => h.includes('ทีมช่าง'),
  po_ref: (h) => h.includes('อ้างอิง PO') || /\bPO\b/.test(h),
  parcel: (h) => h.includes('เลขพัสดุ'),
};

function readSheet(ws, sheetType) {
  let headerRow = 0;
  const cols = {};
  for (let r = 1; r <= Math.min(ws.rowCount, 20) && !headerRow; r++) {
    const row = ws.getRow(r);
    row.eachCell((cell, c) => { if (/^vin/i.test(cellText(cell.value).trim())) headerRow = r; });
  }
  if (!headerRow) return [];
  ws.getRow(headerRow).eachCell((cell, c) => {
    const h = cellText(cell.value).trim();
    for (const [key, test] of Object.entries(HEADERS)) {
      if (!(key in cols) && test(h)) { cols[key] = c; break; }
    }
  });

  const rows = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k) => (cols[k] ? row.getCell(cols[k]).value : null);
    const vin = normalizeVin(cellText(get('vin')));
    if (!VIN_RE.test(vin)) continue;
    rows.push({
      sheet: sheetType,
      vin,
      case_number: cellText(get('case_number')).trim(),
      customer_name: cleanThai(cellText(get('customer_name')).trim()),
      install_date: toIsoDate(get('install_date')),
      charger_model: cellText(get('charger_model')).trim(),
      car_model: cellText(get('car_model')).trim(),
      serial: cellText(get('serial')).replace(/^\s*SN\s*:?\s*/i, '').trim(),
      team: cleanThai(cellText(get('team')).trim()),
      po_ref: cellText(get('po_ref')).trim(),
    });
  }
  return rows;
}

export async function parseReference(ExcelJS, arrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  const rows = [];
  const sheets = [];
  wb.eachSheet((ws) => {
    const title = [ws.name, cellText(ws.getRow(1).getCell(1).value), cellText(ws.getRow(2).getCell(1).value)].join(' ');
    const type = title.includes('รับเฉพาะเครื่องชาร์จ') || title.includes('ไม่ประสงค์ติดตั้ง') ? 'charger_only' : 'install';
    const got = readSheet(ws, type);
    if (got.length) sheets.push({ name: ws.name, type, rows: got.length });
    rows.push(...got);
  });
  return { rows, sheets };
}
