// Module worker: parses page 1 of a PDF with MuPDF (WASM) off the main thread.
// MuPDF is used instead of pdf.js because these reports use Thai fonts whose ToUnicode maps drop
// tone marks; MuPDF recovers them from glyph names.
import * as mupdf from 'https://cdn.jsdelivr.net/npm/mupdf@1.28.1/dist/mupdf.js';
import { extractPage1 } from './parse.js';

self.onmessage = ({ data }) => {
  const { id, buffer } = data;
  try {
    const bytes = new Uint8Array(buffer);
    const head = new TextDecoder().decode(bytes.subarray(0, 1024));
    if (!head.includes('%PDF')) throw new Error('File is not a PDF');
    const r = extractPage1(mupdf, bytes);
    const transfer = [r.vinJpeg?.buffer, r.pageJpeg?.buffer].filter(Boolean);
    self.postMessage({ id, ok: true, ...r }, transfer);
  } catch (e) {
    self.postMessage({ id, ok: false, error: String(e?.message || e) });
  }
};
self.postMessage({ ready: true });
