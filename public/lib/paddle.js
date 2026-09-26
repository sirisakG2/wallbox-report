// Minimal PaddleOCR (PP-OCRv4) text reader on onnxruntime — no OpenCV, runs on any computer.
// Environment-agnostic: images are plain { data: RGBA Uint8ClampedArray, width, height } and the
// onnxruntime module (onnxruntime-web in the browser, onnxruntime-node in tests) is passed in.

// Settings follow @gutenye/ocr (the reference JS port), which tested far better on VIN photos than
// the Python defaults: full-resolution detection, very low threshold, plain x/255 input, and each
// text line cut out as a rotated rectangle and straightened before recognition.
const DET_LIMIT = 1600;      // max side for detection
const DET_THRESH = 0.03;     // pixel probability threshold
const MIN_SIDE = 3;
const UNCLIP = 1.5;          // box expansion ratio
const REC_H = 48;
const REC_MAX_W = 1600;

// Bilinear resize of an RGBA image.
export function resizeRGBA(img, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const sx = img.width / w;
  const sy = img.height / h;
  for (let y = 0; y < h; y++) {
    const fy = Math.min((y + 0.5) * sy - 0.5, img.height - 1);
    const y0 = Math.max(0, Math.floor(fy));
    const y1 = Math.min(img.height - 1, y0 + 1);
    const dy = Math.max(0, fy - y0);
    for (let x = 0; x < w; x++) {
      const fx = Math.min((x + 0.5) * sx - 0.5, img.width - 1);
      const x0 = Math.max(0, Math.floor(fx));
      const x1 = Math.min(img.width - 1, x0 + 1);
      const dx = Math.max(0, fx - x0);
      for (let c = 0; c < 3; c++) {
        const a = img.data[(y0 * img.width + x0) * 4 + c];
        const b = img.data[(y0 * img.width + x1) * 4 + c];
        const d = img.data[(y1 * img.width + x0) * 4 + c];
        const e = img.data[(y1 * img.width + x1) * 4 + c];
        out[(y * w + x) * 4 + c] = (a * (1 - dx) + b * dx) * (1 - dy) + (d * (1 - dx) + e * dx) * dy;
      }
      out[(y * w + x) * 4 + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

export function rotateRGBA(img, deg) {
  if (!deg) return img;
  const { width: W, height: H, data } = img;
  const swap = deg === 90 || deg === 270;
  const w = swap ? H : W;
  const h = swap ? W : H;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let nx, ny;
      if (deg === 90) { nx = H - 1 - y; ny = x; }          // clockwise
      else if (deg === 180) { nx = W - 1 - x; ny = H - 1 - y; }
      else { nx = y; ny = W - 1 - x; }                      // 270 clockwise
      const s = (y * W + x) * 4;
      const d = (ny * w + nx) * 4;
      out[d] = data[s]; out[d + 1] = data[s + 1]; out[d + 2] = data[s + 2]; out[d + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

// Convex hull (monotone chain) of integer points [[x,y],...].
function convexHull(pts) {
  if (pts.length < 3) return pts.slice();
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  const hull = lower.concat(upper);
  return hull.length ? hull : [pts[0]];
}

// Minimum-area rectangle of a hull (rotating calipers): { cx, cy, w, h, ux, uy } where (ux,uy) is the
// unit vector along w; the perpendicular (-uy, ux) is along h.
function minAreaRect(hull) {
  if (hull.length === 1) return { cx: hull[0][0] + 0.5, cy: hull[0][1] + 0.5, w: 1, h: 1, ux: 1, uy: 0 };
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    const q = hull[(i + 1) % hull.length];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
    const ux = (q[0] - p[0]) / len;
    const uy = (q[1] - p[1]) / len;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * ux + y * uy;
      const v = -x * uy + y * ux;
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (v < minV) minV = v; if (v > maxV) maxV = v;
    }
    const w = maxU - minU + 1;
    const h = maxV - minV + 1;
    if (!best || w * h < best.w * best.h) {
      const cu = (minU + maxU) / 2 + 0.5;
      const cv = (minV + maxV) / 2 + 0.5;
      best = { cx: cu * ux - cv * uy, cy: cu * uy + cv * ux, w, h, ux, uy };
    }
  }
  // Make w the long side so text lines are cut horizontally.
  if (best.h > best.w) best = { ...best, w: best.h, h: best.w, ux: -best.uy, uy: best.ux };
  if (best.ux < 0) best = { ...best, ux: -best.ux, uy: -best.uy };
  return best;
}

// Straightened crop of a rotated rectangle (bilinear sampling).
function cropRotated(img, r, outW, outH) {
  const out = new Uint8ClampedArray(outW * outH * 4);
  const sx = r.w / outW;
  const sy = r.h / outH;
  const vx = -r.uy;
  const vy = r.ux;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const du = (x + 0.5) * sx - r.w / 2;
      const dv = (y + 0.5) * sy - r.h / 2;
      const fx = Math.min(Math.max(r.cx + du * r.ux + dv * vx - 0.5, 0), img.width - 1);
      const fy = Math.min(Math.max(r.cy + du * r.uy + dv * vy - 0.5, 0), img.height - 1);
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const x1 = Math.min(x0 + 1, img.width - 1), y1 = Math.min(y0 + 1, img.height - 1);
      const ax = fx - x0, ay = fy - y0;
      for (let c = 0; c < 3; c++) {
        const v = (img.data[(y0 * img.width + x0) * 4 + c] * (1 - ax) + img.data[(y0 * img.width + x1) * 4 + c] * ax) * (1 - ay)
          + (img.data[(y1 * img.width + x0) * 4 + c] * (1 - ax) + img.data[(y1 * img.width + x1) * 4 + c] * ax) * ay;
        out[(y * outW + x) * 4 + c] = v;
      }
      out[(y * outW + x) * 4 + 3] = 255;
    }
  }
  return { data: out, width: outW, height: outH };
}

// Model input: planes in B, G, R order with plain x/255 scaling.
function toInput(img) {
  const n = img.width * img.height;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    input[i] = img.data[i * 4 + 2] / 255;
    input[n + i] = img.data[i * 4 + 1] / 255;
    input[2 * n + i] = img.data[i * 4] / 255;
  }
  return input;
}

export class PaddleOcr {
  constructor(ort, det, rec, dict) {
    this.ort = ort;
    this.det = det;
    this.rec = rec;
    this.dict = dict;
  }

  // det/rec/dict: model URLs or paths; loadBytes(url) → Uint8Array; loadText(url) → string
  static async create(ort, { det, rec, dict }, { loadBytes, loadText, providers = ['wasm'] }) {
    const opts = { executionProviders: providers, graphOptimizationLevel: 'all' };
    const [d, r, keys] = await Promise.all([
      loadBytes(det).then((b) => ort.InferenceSession.create(b, opts)),
      loadBytes(rec).then((b) => ort.InferenceSession.create(b, opts)),
      loadText(dict),
    ]);
    return new PaddleOcr(ort, d, r, keys.split(/\r?\n/));
  }

  async detectBoxes(img) {
    const scale = Math.min(1, DET_LIMIT / Math.max(img.width, img.height));
    const w = Math.max(32, Math.ceil((img.width * scale) / 32) * 32);
    const h = Math.max(32, Math.ceil((img.height * scale) / 32) * 32);
    const small = resizeRGBA(img, w, h);
    const out = await this.det.run({ [this.det.inputNames[0]]: new this.ort.Tensor('float32', toInput(small), [1, 3, h, w]) });
    const prob = out[this.det.outputNames[0]].data;

    // Connected components of the text map → rotated rectangles.
    const on = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) on[i] = prob[i] > DET_THRESH ? 1 : 0;
    const seen = new Uint8Array(w * h);
    const rects = [];
    const stack = [];
    const rx = img.width / w;
    const ry = img.height / h;
    for (let i = 0; i < w * h; i++) {
      if (!on[i] || seen[i]) continue;
      const edge = [];
      stack.push(i);
      seen[i] = 1;
      while (stack.length) {
        const p = stack.pop();
        const x = p % w;
        const y = (p - x) / w;
        // Only boundary pixels matter for the hull.
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !on[p - 1] || !on[p + 1] || !on[p - w] || !on[p + w]) edge.push([x, y]);
        if (x > 0 && on[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1); }
        if (x < w - 1 && on[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1); }
        if (y > 0 && on[p - w] && !seen[p - w]) { seen[p - w] = 1; stack.push(p - w); }
        if (y < h - 1 && on[p + w] && !seen[p + w]) { seen[p + w] = 1; stack.push(p + w); }
      }
      const r = minAreaRect(convexHull(edge));
      if (Math.min(r.w, r.h) < MIN_SIDE) continue;
      const d = (r.w * r.h * UNCLIP) / (2 * (r.w + r.h)); // PaddleOCR unclip distance
      const W = (r.w + 2 * d) * Math.hypot(r.ux * rx, r.uy * ry);
      const H = (r.h + 2 * d) * Math.hypot(-r.uy * rx, r.ux * ry);
      if (Math.min(W, H) < MIN_SIDE + 2) continue;
      const ux = r.ux * rx, uy = r.uy * ry;
      const ul = Math.hypot(ux, uy);
      rects.push({ cx: r.cx * rx, cy: r.cy * ry, w: W, h: H, ux: ux / ul, uy: uy / ul });
    }
    return rects.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  }

  async recognize(img, r) {
    if (r.w < 4 || r.h < 4) return '';
    const w = Math.min(REC_MAX_W, Math.max(REC_H, Math.ceil((REC_H * r.w) / r.h)));
    const line = cropRotated(img, r, w, REC_H);
    const out = await this.rec.run({ [this.rec.inputNames[0]]: new this.ort.Tensor('float32', toInput(line), [1, 3, REC_H, w]) });
    const t = out[this.rec.outputNames[0]];
    const [, T, C] = t.dims;
    let text = '';
    let prev = -1;
    for (let s = 0; s < T; s++) {
      let best = -Infinity;
      let bi = 0;
      for (let c = 0; c < C; c++) { const v = t.data[s * C + c]; if (v > best) { best = v; bi = c; } }
      if (bi !== prev && bi !== 0) text += bi - 1 < this.dict.length ? this.dict[bi - 1] : ' ';
      prev = bi;
    }
    return text;
  }

  // Reads all text in an image (one orientation).
  async read(img) {
    const boxes = await this.detectBoxes(img);
    const texts = [];
    for (const b of boxes) texts.push(await this.recognize(img, b));
    return texts.join(' ');
  }
}
