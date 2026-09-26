// Page-1 parser for the "EV home charging" installation report PDFs.
// Pure functions + a MuPDF-based extractor; used by the PDF web worker (and node tests).

const THAI_MONTHS = {
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6,
  'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6,
  'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
};

const pad = (n) => String(n).padStart(2, '0');

// "26 พ.ค. 2569" → "2026-05-26" (Buddhist Era year − 543). Returns '' if unparseable.
export function parseThaiDate(s) {
  const m = String(s || '').replace(/\s+/g, ' ').trim().match(/^(\d{1,2})\s*([^\d\s]+)\s*(\d{2,4})$/);
  if (!m) return '';
  const month = THAI_MONTHS[m[2].replace(/\s/g, '')];
  if (!month) return '';
  let year = Number(m[3]);
  if (year < 100) year += 2500;
  if (year > 2400) year -= 543;
  const day = Number(m[1]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return '';
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Header print stamp "3/7/69 09:33" (d/m/BE-yy) → "2026-07-03 09:33"
export function parsePrintStamp(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  let y = Number(m[3]);
  if (y < 100) y += 2500;
  if (y > 2400) y -= 543;
  return `${y}-${pad(m[2])}-${pad(m[1])} ${pad(m[4])}:${m[5]}`;
}

// NFC + "ํา" (nikhahit + sara aa, produced by some PDF fonts) → "ำ"; strip zero-width chars.
export function cleanThai(s) {
  return String(s || '').normalize('NFC').replace(/\u0E4D\u0E32/g, '\u0E33').replace(/[\u200B-\u200D\uFEFF\u0000]/g, '');
}

// Customer name from file name "<VIN>[_ ]<name>(1).pdf"
export function nameFromFileName(name) {
  return cleanThai(String(name || '').replace(/\.pdf$/i, '').replace(/^[A-Za-z0-9]{17}/, '')
    .replace(/\(\d+\)$/, '').replace(/^[\s_\-.]+/, '').trim());
}

export function normalizeVin(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/I/g, '1').replace(/[OQ]/g, '0');
}
export const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export function vinFromFileName(name) {
  const m = String(name || '').toUpperCase().match(/[A-HJ-NPR-Z0-9]{17}/);
  return m ? m[0] : '';
}

// Label (left column) → field. Order matters: first match wins.
const LABELS = [
  ['job_number', (t) => /job\s*number/i.test(t) || t.includes('หมายเลขงาน')],
  ['charger_code', (t) => t.includes('รหัสลูกค้า')],
  ['install_date_raw', (t) => t.includes('วันที่ติดตั้ง') || t.includes('วันส่งมอบ')],
  ['customer_name', (t) => t.includes('ชื่อลูกค้า') || t.includes('ผู้ติดต่อ')],
  ['phone', (t) => t.includes('เบอร์โทร')],
  ['region', (t) => t.includes('ภูมิภาค')],
  ['site_type', (t) => t.includes('ลักษณะสถานที่')],
  ['vin', (t) => /vin\s*no/i.test(t) || t.includes('หมายเลขตัวถัง')],
  ['serial', (t) => /serial\s*no/i.test(t) || t.includes('หมายเลขเครื่องชาร์จ')],
];

// Some reports draw each text run several times (fake bold) and also emit sub-fragments
// ("หมายเลขงาน", "/Job number", "หมายเลขงาน/Job number"). Keep only the most complete line.
export function dedupeLines(lines) {
  const keep = [];
  const sorted = [...lines].sort((a, b) => b.text.length - a.text.length);
  for (const l of sorted) {
    const covered = keep.some((m) => Math.abs(m.y - l.y) < 4 && l.x >= m.x - 3 && l.x + l.w <= m.x + m.w + 3
      && m.text.replace(/\s/g, '').includes(l.text.replace(/\s/g, '')));
    if (!covered) keep.push(l);
  }
  return keep.sort((a, b) => a.y - b.y || a.x - b.x);
}

// lines: [{x, y, w, h, text}] in page coords (y down), images: [{x, y, w, h, index}]
export function parseLines(lines, images) {
  const out = {};
  const photoTop = Math.min(...images.filter((i) => i.y > 300).map((i) => i.y), 380);
  const tableLines = lines.filter((l) => l.y > 120 && l.y < photoTop - 10);
  const labels = [];
  for (const l of tableLines) {
    const hit = LABELS.find(([, test]) => test(l.text));
    if (hit && !labels.some((x) => x.field === hit[0])) labels.push({ field: hit[0], ...l });
  }
  const isLabel = (l) => labels.some((x) => x === l || (x.x === l.x && x.y === l.y && x.text === l.text));
  for (const lab of labels) {
    const nextLabelX = Math.min(...labels.filter((o) => Math.abs(o.y - lab.y) < 8 && o.x > lab.x).map((o) => o.x), Infinity);
    const vals = tableLines
      .filter((l) => !isLabel(l) && Math.abs(l.y - lab.y) < 8 && l.x > lab.x + 20 && l.x < nextLabelX)
      .sort((a, b) => a.x - b.x);
    let v = vals.map((l) => l.text).join(' ').trim();
    // Some layouts put label and value on one line: "(Serial No.) 261400290"
    if (!v) {
      const m = lab.text.match(/\)\s*(\S.*)$/);
      if (m) v = m[1].trim();
    }
    out[lab.field] = v.replace(/\s+/g, ' ');
  }

  for (const l of lines) {
    if (l.y < 40 && !out.report_printed_at) {
      const p = parsePrintStamp(l.text);
      if (p) out.report_printed_at = p;
    }
    const u = l.text.match(/https?:\/\/ev\.rpdservice\.com\/\S+/);
    if (u) out.job_url = u[0];
  }
  out.install_date = parseThaiDate(out.install_date_raw);
  out.vin = normalizeVin(out.vin);
  out.serial = String(out.serial || '').replace(/\s+/g, '');
  return out;
}

// Picks the VIN photo: the image right above the caption "รูปหมายเลขตัวถัง (VinNo.)",
// else the top-left photo of the 2×2 grid.
export function pickVinImage(lines, images) {
  const photos = images.filter((i) => i.y > 300 && i.w > 60 && i.h > 60);
  if (!photos.length) return null;
  const cap = lines.find((l) => l.y > 300 && (l.text.includes('ตัวถัง') || /vin\s*no/i.test(l.text)));
  if (cap) {
    const cx = cap.x + cap.w / 2;
    const above = photos
      .filter((p) => p.y + p.h <= cap.y + 6 && cap.y - (p.y + p.h) < 40 && cx >= p.x - 40 && cx <= p.x + p.w + 40)
      .sort((a, b) => Math.abs(a.x + a.w / 2 - cx) - Math.abs(b.x + b.w / 2 - cx));
    if (above.length) return above[0];
  }
  return [...photos].sort((a, b) => a.y - b.y || a.x - b.x)[0];
}

// Full extraction with a MuPDF module. Returns { fields, vinJpeg (Uint8Array|null), pageCount }.
export function extractPage1(mupdf, bytes, maxSide = 1400) {
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
  try {
    const page = doc.loadPage(0);
    const st = page.toStructuredText('preserve-images');
    const lines = [];
    const images = [];
    const imageObjs = [];
    st.walk({
      onImageBlock(bbox, transform, image) {
        const [x0, y0, x1, y1] = bbox;
        images.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, index: imageObjs.length });
        imageObjs.push(image);
      },
      beginLine(bbox) {
        lines.push({ x: bbox[0], y: bbox[1], w: bbox[2] - bbox[0], h: bbox[3] - bbox[1], text: '' });
      },
      onChar(c) {
        lines[lines.length - 1].text += c;
      },
    });
    // Normalise coordinates to an A4 width of 595pt (some reports are printed on A3).
    const [bx0, , bx1] = page.getBounds();
    const k = 595 / ((bx1 - bx0) || 595);
    for (const o of [...lines, ...images]) { o.x *= k; o.y *= k; o.w *= k; o.h *= k; }
    for (const l of lines) l.text = cleanThai(l.text).replace(/\s+/g, ' ').trim();
    const cleanLines = dedupeLines(lines.filter((l) => l.text));

    // Page 1 flattened into one picture (scan/screenshot) → no text layer; caller must OCR the page.
    if (cleanLines.length < 5) {
      const pagePix = page.toPixmap(mupdf.Matrix.scale(2 * k, 2 * k), mupdf.ColorSpace.DeviceRGB, false, true);
      return { fields: {}, vinJpeg: null, pageJpeg: pagePix.asJPEG(80, false), scanned: true, pageCount: doc.countPages() };
    }
    const fields = parseLines(cleanLines, images);

    let vinJpeg = null;
    const vinImg = pickVinImage(cleanLines, images);
    if (vinImg) {
      let pix = imageObjs[vinImg.index].toPixmap();
      if (pix.getAlpha()) pix = pix.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, false);
      const side = Math.max(pix.getWidth(), pix.getHeight());
      if (side > maxSide) {
        pix = pix.warp([[0, 0], [pix.getWidth(), 0], [pix.getWidth(), pix.getHeight()], [0, pix.getHeight()]],
          Math.round(pix.getWidth() * maxSide / side), Math.round(pix.getHeight() * maxSide / side));
      }
      vinJpeg = pix.asJPEG(85, false);
    }
    return { fields, vinJpeg, pageJpeg: null, scanned: false, pageCount: doc.countPages() };
  } finally {
    doc.destroy?.();
  }
}
