// Page-1 parser for the "EV home charging" installation report PDFs.
// Pure functions + a MuPDF-based extractor; used by the PDF web worker (and node tests).

// Month names → number. Keys are compared with dots and spaces removed ("พ.ค." → "พค").
const MONTHS = {
  มค: 1, กพ: 2, มีค: 3, เมย: 4, พค: 5, มิย: 6, กค: 7, สค: 8, กย: 9, ตค: 10, พย: 11, ธค: 12,
  มกราคม: 1, กุมภาพันธ์: 2, มีนาคม: 3, เมษายน: 4, พฤษภาคม: 5, มิถุนายน: 6,
  กรกฎาคม: 7, สิงหาคม: 8, กันยายน: 9, ตุลาคม: 10, พฤศจิกายน: 11, ธันวาคม: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n) => String(n).padStart(2, '0');

// Thai (Buddhist Era) or Western year → Western year.
//   2569 → 2026 · 2026 → 2026 · "69" → 2026 (BE short) · "26" → 2026 (CE short)
export function toCEYear(y) {
  y = Number(y);
  if (y >= 2400) return y - 543;
  if (y >= 1900) return y;
  if (y >= 60 && y < 100) return y + 2500 - 543;
  if (y >= 0 && y < 60) return 2000 + y;
  return NaN;
}

function isoDate(y, m, d) {
  y = toCEYear(y); m = Number(m); d = Number(d);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return '';
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : '';
}

// Any date the reports or the Excel use → "YYYY-MM-DD" ('' if unreadable):
//   "26 พ.ค. 2569", "30 พฤษภาคม 2569", "15 มิ.ย. 2026", "8/6/2569", "26/05/2026", "31-05-69",
//   "26.5.69", "2026-05-26", Thai digits "๒๖/๕/๒๕๖๙", optional trailing time.
export function parseAnyDate(input) {
  const s = String(input || '')
    .replace(/[๐-๙]/g, (c) => String(c.charCodeAt(0) - 0x0e50))
    .replace(/\s+/g, ' ').trim()
    .replace(/\s+\d{1,2}[:.]\d{2}(:\d{2})?\s*(น\.?)?$/, ''); // drop a time part
  let m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) return isoDate(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})$/);
  if (m) return isoDate(m[3], m[2], m[1]); // day/month/year (Thai order)
  m = s.match(/^(\d{1,2})\s*([^\d]+?)\s*(\d{2,4})$/);
  if (m) {
    const key = m[2].replace(/[.\s]/g, '').toLowerCase();
    const month = MONTHS[key] || MONTHS[key.slice(0, 3)];
    return month ? isoDate(m[3], month, m[1]) : '';
  }
  return '';
}

// Kept for existing callers.
export const parseThaiDate = parseAnyDate;

// Header print stamp "3/7/69 09:33" (d/m/BE-yy) → "2026-07-03 09:33"
export function parsePrintStamp(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})$/);
  if (!m) return '';
  return `${toCEYear(m[3])}-${pad(m[2])}-${pad(m[1])} ${pad(m[4])}:${m[5]}`;
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

// Landmarks of the form, so parsing does not depend on page size: some reports are A4, some A3,
// and some are an A4 form placed in the corner of an A3 page.
//   top    = the "A: รายละเอียดลูกค้า (Customer Information)" heading
//   bottom = the "รูปยืนยันงานติดตั้ง" caption above the photos (or the first photo)
export function formAnchors(lines, images) {
  const header = lines.find((l) => /Customer Information|รายละเอียดลูกค้า/i.test(l.text));
  const caption = lines.find((l) => l.text.includes('รูปยืนยัน'));
  const top = header ? header.y + header.h / 2 : 120;
  const photos = images.filter((i) => i.w > 40 && i.h > 40 && i.y > top + 60 && i.w * i.h < 0.5 * 595 * 842);
  const firstPhoto = photos.length ? Math.min(...photos.map((i) => i.y)) : 380;
  const bottom = caption && caption.y > top ? caption.y : firstPhoto - 10;
  return { top, bottom, photos, hasHeader: !!header };
}

// lines: [{x, y, w, h, text}] in page coords (y down), images: [{x, y, w, h, index}]
export function parseLines(lines, images) {
  const out = {};
  const { top, bottom, hasHeader } = formAnchors(lines, images);
  const tableLines = lines.filter((l) => l.y > top && l.y < bottom);
  const labels = [];
  for (const l of tableLines) {
    const hit = LABELS.find(([, test]) => test(l.text));
    if (hit && !labels.some((x) => x.field === hit[0])) labels.push({ field: hit[0], ...l });
  }
  const isLabel = (l) => labels.some((x) => x === l || (x.x === l.x && x.y === l.y && x.text === l.text));
  for (const lab of labels) {
    const nextLabelX = Math.min(...labels.filter((o) => Math.abs(o.y - lab.y) < 8 && o.x > lab.x).map((o) => o.x), Infinity);
    const vals = tableLines
      // A label may wrap onto two lines ("…(Serial" / "No.)"), pushing its value half a line down.
      .filter((l) => !isLabel(l) && Math.abs(l.y - lab.y) < Math.min(14, Math.max(8, lab.h * 0.75)) && l.x > lab.x + 20 && l.x < nextLabelX)
      .sort((a, b) => a.x - b.x);
    let v = vals.map((l) => l.text).join(' ').trim();
    // Some layouts put label and value on one line: "(Serial No.) 261400290"
    if (!v) {
      const m = lab.text.match(/\)\s*(\S.*)$/);
      if (m) v = m[1].trim();
    }
    out[lab.field] = v.replace(/\s+/g, ' ');
  }

  // Fallback by position: some PDFs have the table labels as graphics (values typed over the form),
  // so the values are found by their row. Rows are in A4 points after normalisation.
  const ROWS = { job_number: 162, install_date_raw: 185, customer_name: 209, phone: 232, region: 255, site_type: 278, vin: 302, serial: 325 };
  const VALID = {
    job_number: (t) => /XPENG\s*\d{5,}/i.test(t),
    install_date_raw: (t) => !!parseAnyDate(t),
    phone: (t) => /\d{3}.*\d{3}/.test(t),
    vin: (t) => VIN_RE.test(normalizeVin(t)),
    serial: (t) => /\d{6,}/.test(t),
  };
  let byPosition = 0;
  const shift = hasHeader ? top - 145 : 0; // heading centre is at y≈145 on the reference form
  for (const [field, row] of Object.entries(ROWS)) {
    if (out[field]) continue;
    const rowY = row + shift;
    const hit = tableLines
      .filter((l) => !isLabel(l) && l.x >= 195 && l.x < 340 && Math.abs(l.y - rowY) < 9)
      .sort((a, b) => Math.abs(a.y - rowY) - Math.abs(b.y - rowY))[0];
    if (hit && (!VALID[field] || VALID[field](hit.text))) { out[field] = hit.text.replace(/\s+/g, ' ').trim(); byPosition++; }
  }
  if (!out.charger_code) {
    const hit = tableLines.find((l) => !isLabel(l) && l.x >= 400 && Math.abs(l.y - ROWS.job_number) < 9);
    if (hit) { out.charger_code = hit.text.trim(); byPosition++; }
  }
  out.layout = labels.length >= 5 ? 'standard' : byPosition ? 'no-labels' : 'unknown';

  for (const l of lines) {
    if (l.y < 40) {
      const j = l.text.match(/XPENG\s*\d{5,}/i);
      if (j && !out.header_job) out.header_job = j[0].replace(/\s/g, '').toUpperCase();
    }
    if (l.y < 40 && !out.report_printed_at) {
      const p = parsePrintStamp(l.text);
      if (p) out.report_printed_at = p;
    }
    const u = l.text.match(/https?:\/\/ev\.rpdservice\.com\/\S+/);
    if (u) out.job_url = u[0];
  }
  out.install_date = parseAnyDate(out.install_date_raw);
  out.vin = normalizeVin(out.vin);
  out.serial = String(out.serial || '').replace(/\s+/g, '');
  return out;
}

// Picks the VIN photo: the image right above the caption "รูปหมายเลขตัวถัง (VinNo.)",
// else the top-left photo of the 2×2 grid.
export function pickVinImage(lines, images) {
  const { bottom, photos } = formAnchors(lines, images);
  if (!photos.length) return null;
  const cap = lines.find((l) => l.y > bottom && (l.text.includes('ตัวถัง') || /vin\s*no/i.test(l.text)));
  if (cap) {
    const cx = cap.x + cap.w / 2;
    const above = photos
      .filter((p) => p.y + p.h <= cap.y + 6 && cap.y - (p.y + p.h) < 40 && cx >= p.x - 40 && cx <= p.x + p.w + 40)
      .sort((a, b) => Math.abs(a.x + a.w / 2 - cx) - Math.abs(b.x + b.w / 2 - cx));
    if (above.length) return above[0];
  }
  return [...photos].sort((a, b) => a.y - b.y || a.x - b.x)[0];
}

// Full extraction with a MuPDF module. Returns { fields, vinJpeg, pageJpeg, scanned, pageCount }.
// Every MuPDF object is destroyed explicitly: relying on the garbage collector exhausts the WASM heap
// after a large (hundreds of MB) PDF and makes every following file fail with "malloc failed".
export function extractPage1(mupdf, bytes, maxSide = 1400) {
  const owned = [];
  const own = (o) => { if (o) owned.push(o); return o; };
  const doc = own(mupdf.Document.openDocument(bytes, 'application/pdf'));
  try {
    const pageCount = doc.countPages();
    const page = own(doc.loadPage(0));
    const st = own(page.toStructuredText('preserve-images'));
    const lines = [];
    const images = [];
    const imageObjs = [];
    st.walk({
      onImageBlock(bbox, transform, image) {
        const [x0, y0, x1, y1] = bbox;
        images.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, index: imageObjs.length });
        imageObjs.push(own(image));
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

    // Page 1 flattened into one picture (scan/screenshot) → caller must OCR the page. Also covers
    // scans with a scanner's garbage hidden text layer: a full-page image and no readable VIN/job.
    const pageArea = 595 * (595 / ((bx1 - bx0) || 595)) * ((page.getBounds()[3] - page.getBounds()[1]) || 842);
    const fullPageImage = images.some((i) => i.w * i.h > 0.8 * 595 * (pageArea / 595));
    const scannedPage = () => {
      const pagePix = own(page.toPixmap(mupdf.Matrix.scale(2 * k, 2 * k), mupdf.ColorSpace.DeviceRGB, false, true));
      return { fields: {}, vinJpeg: null, pageJpeg: pagePix.asJPEG(80, false), scanned: true, pageCount };
    };
    if (cleanLines.length < 5) return scannedPage();
    const fields = parseLines(cleanLines, images);
    // XPENG VINs are made in China, so they start with "L" (world manufacturer code L1N).
    const trustworthy = /XPENG\s*\d{5,}/i.test(fields.job_number || '') || (VIN_RE.test(fields.vin || '') && /^L/.test(fields.vin));
    if (fullPageImage && !trustworthy) return scannedPage();

    let vinJpeg = null;
    const vinImg = pickVinImage(cleanLines, images);
    if (vinImg) {
      let pix = own(imageObjs[vinImg.index].toPixmap());
      if (pix.getAlpha()) pix = own(pix.convertToColorSpace(mupdf.ColorSpace.DeviceRGB, false));
      const side = Math.max(pix.getWidth(), pix.getHeight());
      if (side > maxSide) {
        pix = own(pix.warp([[0, 0], [pix.getWidth(), 0], [pix.getWidth(), pix.getHeight()], [0, pix.getHeight()]],
          Math.round(pix.getWidth() * maxSide / side), Math.round(pix.getHeight() * maxSide / side)));
      }
      vinJpeg = pix.asJPEG(85, false); // a copy, safe after destroy
    }
    return { fields, vinJpeg, pageJpeg: null, scanned: false, pageCount };
  } finally {
    for (const o of owned.reverse()) { try { o.destroy(); } catch { /* already freed */ } }
  }
}
