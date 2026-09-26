// Free, on-device VIN check using the browser's TextDetector (Shape Detection API).
// In Chrome on macOS this runs Apple's text recognition — no Cloudflare AI neurons are used.
// Needs chrome://flags/#enable-experimental-web-platform-features; without it everything goes to AI.
import { normalizeVin } from './parse.js';

let detector = null;
let status = null; // { available, reason }

export async function freeOcrStatus() {
  if (status) return status;
  if (!('TextDetector' in self)) {
    status = { available: false, reason: 'TextDetector not available in this browser' };
    return status;
  }
  try {
    detector = new self.TextDetector();
    // Smoke test: some builds expose the API but have no backend.
    const c = new OffscreenCanvas(240, 60);
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, 240, 60);
    g.fillStyle = '#000'; g.font = 'bold 36px Arial'; g.fillText('TEST 123', 10, 44);
    await detector.detect(c);
    status = { available: true, reason: '' };
  } catch (e) {
    detector = null;
    status = { available: false, reason: `TextDetector failed: ${e.message}` };
  }
  return status;
}

const CHARGER_RE = /MANUFACTURER|CHINT|CONVERGY|RATED|EQUIPMENT/;

function rotated(bitmap, deg) {
  const swap = deg === 90 || deg === 270;
  const c = new OffscreenCanvas(swap ? bitmap.height : bitmap.width, swap ? bitmap.width : bitmap.height);
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2);
  g.rotate((deg * Math.PI) / 180);
  g.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  return c;
}

// Returns { result: 'match' | 'charger' | 'unknown', text }.
// 'match' only when the exact 17-character PDF VIN is found in the photo — anything else is left to AI.
export async function freeReadVin(jpegBytes, expectedVin) {
  if (!(await freeOcrStatus()).available) return { result: 'unknown', text: '' };
  const vin = normalizeVin(expectedVin);
  const bitmap = await createImageBitmap(new Blob([jpegBytes], { type: 'image/jpeg' }));
  let all = '';
  try {
    for (const deg of [0, 270, 90, 180]) {
      const found = await detector.detect(deg ? rotated(bitmap, deg) : bitmap);
      const text = found.map((t) => t.rawValue).join(' ');
      all += ` ${text}`;
      const flat = normalizeVin(text);
      if (vin.length === 17 && flat.includes(vin)) return { result: 'match', text: text.trim() };
      if (deg === 0 && CHARGER_RE.test(text.toUpperCase()) && !/L1NN/.test(flat)) {
        return { result: 'charger', text: text.trim() };
      }
    }
  } finally {
    bitmap.close();
  }
  return { result: 'unknown', text: all.trim() };
}
