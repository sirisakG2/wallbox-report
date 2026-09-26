// Workers AI vision OCR.
//  POST /api/ocr?mode=vin[&expected=<VIN>]  body = JPEG of the VIN photo → { raw, vin }
//     `expected` (VIN from the PDF text) is only used to pick among candidates, never shown to the model.
//  POST /api/ocr?mode=page                  body = JPEG of a scanned page 1 → { raw, fields }
import { bad, json, normalizeVin, pickVin } from '../../lib/server.js';

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
const MAX_BYTES = 2_500_000;

const VIN_PROMPT =
  'This photo shows a car windscreen VIN plate or sticker (the photo may be rotated or mirrored by reflection). ' +
  'Read the 17-character vehicle identification number exactly as printed. VINs use digits and capital letters ' +
  'except I, O and Q. Ignore dates, addresses and job numbers such as XPENG2604217. ' +
  'Reply with the VIN only. If no VIN is visible reply NONE.';

const PAGE_PROMPT =
  'This is page 1 of a Thai EV home-charger installation report. Read the table "A:รายละเอียดลูกค้า" and the photos. ' +
  'Return JSON only with these keys: job_number (หมายเลขงาน/Job number, like XPENG2601276), ' +
  'charger_code (รหัสลูกค้า), install_date_raw (วันที่ติดตั้ง exactly as printed, e.g. "24 มิ.ย. 2569"), ' +
  'customer_name (ชื่อลูกค้า, Thai text exactly), phone (เบอร์โทร), region (ภูมิภาค), site_type (ลักษณะสถานที่ติดตั้ง), ' +
  'vin (หมายเลขตัวถัง in the table), serial (หมายเลขเครื่องชาร์จ), job_url (URL printed at the bottom, or ""), ' +
  'vin_picture (the 17-character VIN you can read inside the photo captioned "รูปหมายเลขตัวถัง (VinNo.)", or "" if unreadable). ' +
  'Use "" for anything you cannot read.';

const PAGE_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(['job_number', 'charger_code', 'install_date_raw', 'customer_name', 'phone', 'region',
    'site_type', 'vin', 'serial', 'job_url', 'vin_picture'].map((k) => [k, { type: 'string' }])),
  required: ['job_number', 'install_date_raw', 'customer_name', 'vin', 'serial', 'vin_picture'],
};

function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function ask(env, prompt, bytes, extra = {}) {
  return env.AI.run(MODEL, {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${toBase64(bytes)}` } },
      ],
    }],
    temperature: 0,
    ...extra,
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.AI) return bad('Workers AI binding "AI" is not configured', 500);
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode') || 'vin';
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length) return bad('Empty image');
  if (bytes.length > MAX_BYTES) return bad('Image too large', 413);

  try {
    if (mode === 'page') {
      const out = await ask(env, PAGE_PROMPT, bytes, {
        max_tokens: 600,
        response_format: { type: 'json_schema', json_schema: PAGE_SCHEMA },
      });
      let fields = out?.response;
      if (typeof fields === 'string') {
        const m = fields.match(/\{[\s\S]*\}/);
        fields = m ? JSON.parse(m[0]) : {};
      }
      fields = fields && typeof fields === 'object' ? fields : {};
      for (const k of Object.keys(fields)) fields[k] = String(fields[k] ?? '').trim();
      fields.vin = normalizeVin(fields.vin);
      fields.vin_picture = pickVin(fields.vin_picture || '', fields.vin);
      return json({ raw: JSON.stringify(out?.response ?? ''), fields });
    }

    const out = await ask(env, VIN_PROMPT, bytes, { max_tokens: 40 });
    const raw = String(out?.response ?? '').trim();
    return json({ raw, vin: pickVin(raw, url.searchParams.get('expected') || '') });
  } catch (e) {
    return bad(`OCR failed: ${e.message}`, 502);
  }
}
