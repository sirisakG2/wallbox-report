// Lists files of a public Google Drive folder (no API key) via the embedded folder view.
import { bad, folderIdFromUrl, json, labelToDate } from '../../../lib/server.js';

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export async function onRequestGet({ request }) {
  const folderId = folderIdFromUrl(new URL(request.url).searchParams.get('folder'));
  if (!folderId) return bad('Invalid Google Drive folder URL');

  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}`, {
    headers: { 'user-agent': 'Mozilla/5.0', 'accept-language': 'en' },
  });
  if (!res.ok) return bad(`Google Drive returned ${res.status}. Is the folder shared as "Anyone with the link"?`, 502);
  const html = await res.text();

  const title = decodeEntities((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '').trim();
  const files = [];
  const re = /<div class="flip-entry" id="entry-([A-Za-z0-9_-]+)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>[\s\S]*?<div class="flip-entry-last-modified"><div>([^<]*)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    const [, id, href, rawName, label] = m;
    if (href.includes('/folders/')) continue; // sub-folders are not processed
    const name = decodeEntities(rawName).trim();
    const lower = name.toLowerCase();
    const type = lower.endsWith('.pdf') ? 'pdf' : /\.xlsx?$/.test(lower) ? 'xlsx' : 'other';
    files.push({ id, name, type, modifiedDay: labelToDate(decodeEntities(label)) });
  }
  if (!files.length && !title) return bad('Folder not found or not shared publicly', 404);
  return json({ folderId, title, files });
}
