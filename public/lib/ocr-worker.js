// Module worker: free VIN photo check with PaddleOCR (PP-OCRv4) on onnxruntime-web.
// Runs on any computer (Windows, Mac) in any modern browser — no settings, no Cloudflare AI.
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/esm/ort.min.js';
import { PaddleOcr, rotateRGBA } from './paddle.js';
import { normalizeVin } from './parse.js';

const ORT_DIST = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.3/dist/';
const MODELS = 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1.4.2/assets/';
const CHARGER_RE = /MANUFACTURER|CHINT|CONVERGY|RATED|EQUIPMENT/i;

ort.env.wasm.wasmPaths = ORT_DIST;
ort.env.wasm.numThreads = 1; // multi-threading needs cross-origin isolation; one thread per worker is enough

let ocr = null;

async function load() {
  const get = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Cannot load ${url.split('/').pop()} (${res.status})`);
    return res;
  };
  ocr = await PaddleOcr.create(ort, {
    det: `${MODELS}ch_PP-OCRv4_det_infer.onnx`,
    rec: `${MODELS}ch_PP-OCRv4_rec_infer.onnx`,
    dict: `${MODELS}ppocr_keys_v1.txt`,
  }, {
    loadBytes: async (u) => new Uint8Array(await (await get(u)).arrayBuffer()),
    loadText: async (u) => (await get(u)).text(),
  });
}

async function toRGBA(jpegBytes) {
  const bmp = await createImageBitmap(new Blob([jpegBytes], { type: 'image/jpeg' }));
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const g = c.getContext('2d');
  g.drawImage(bmp, 0, 0);
  bmp.close();
  const d = g.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: d.width, height: d.height };
}

// 'match' only when the exact 17-character PDF VIN appears in the photo.
async function readVin(jpeg, expected) {
  const vin = normalizeVin(expected);
  const img = await toRGBA(jpeg);
  let all = '';
  for (const deg of [0, 270, 90, 180]) {
    const text = await ocr.read(rotateRGBA(img, deg));
    all += ` ${text}`;
    const flat = normalizeVin(text);
    if (vin.length === 17 && flat.includes(vin)) return { result: 'match', text: text.trim() };
    if (deg === 0 && CHARGER_RE.test(text) && !flat.includes('L1NN')) return { result: 'charger', text: text.trim() };
  }
  return { result: 'unknown', text: all.trim() };
}

const ready = load().then(() => ({ ok: true }), (e) => ({ ok: false, error: String(e?.message || e) }));

self.onmessage = async ({ data }) => {
  const status = await ready;
  if (data.type === 'status') { self.postMessage({ id: data.id, ...status }); return; }
  if (!status.ok) { self.postMessage({ id: data.id, ok: false, error: status.error }); return; }
  try {
    self.postMessage({ id: data.id, ok: true, ...(await readVin(data.jpeg, data.expected)) });
  } catch (e) {
    self.postMessage({ id: data.id, ok: false, error: String(e?.message || e) });
  }
};
