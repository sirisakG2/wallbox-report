// Streams one publicly shared Google Drive file (PDF / xlsx) to the browser (avoids CORS).
// Uses the direct download host with confirm=t, which skips the "can't scan for viruses" page
// Drive shows for larger files.
import { DRIVE_ID_RE, bad } from '../../../lib/server.js';

export async function onRequestGet({ request }) {
  const id = new URL(request.url).searchParams.get('id') || '';
  if (!DRIVE_ID_RE.test(id)) return bad('Invalid file id');

  const res = await fetch(`https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`, {
    headers: { 'user-agent': 'Mozilla/5.0' },
  });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || type.includes('text/html')) {
    return bad(`File is not publicly downloadable (${res.status})`, 502);
  }
  const headers = { 'content-type': type || 'application/octet-stream', 'cache-control': 'no-store' };
  const len = res.headers.get('content-length');
  if (len) headers['x-file-size'] = len; // content-length itself may be dropped when re-encoded
  return new Response(res.body, { headers });
}
