// Loads every table the check pages need ONCE (records, Excel rows, issues, batch files, months),
// joins them in memory and scores each record (Check 1 level, Check 2 % match, date %).
// Cached per data version (lib/cache.js), so page views cost one row read until something changes.
// This replaces ~16 correlated sub-queries per record, which used up D1's daily row-read limit.
import { cached } from './cache.js';
import { withConfidence } from './confidence.js';

export function loadAll(db) {
  return cached(db, 'all', async () => {
    const [recs, refs, iss, files, bats] = await db.batch([
      db.prepare('SELECT * FROM records'),
      db.prepare('SELECT id, batch_id, sheet, sheet_name, row_no, vin, case_number, customer_name, install_date, charger_model, car_model, serial, team FROM reference_rows ORDER BY id'),
      db.prepare('SELECT id, batch_id, pdf_file_id, vin, type, resolved FROM issues'),
      db.prepare('SELECT batch_id, file_id, status FROM batch_files'),
      db.prepare('SELECT * FROM batches'),
    ]);
    const batches = bats.results;
    const batchById = new Map(batches.map((b) => [b.id, b]));

    // First Excel install row per VIN (any month); any-sheet presence; first row incl. charger-only.
    const installByVin = new Map();
    const anyByVin = new Map();
    for (const f of refs.results) {
      if (f.sheet === 'install' && !installByVin.has(f.vin)) installByVin.set(f.vin, f);
      if ((f.sheet === 'install' || f.sheet === 'charger_only') && !anyByVin.has(f.vin)) anyByVin.set(f.vin, f);
    }
    // Issue flags per file.
    const flags = new Map();
    for (const i of iss.results) {
      const k = `${i.batch_id}|${i.pdf_file_id}`;
      let set = flags.get(k);
      if (!set) flags.set(k, (set = new Set()));
      set.add(i.type);
      if (i.type === 'suspicious_date' && !i.resolved) set.add('suspicious_open');
    }

    const records = recs.results.map((r) => {
      const b = batchById.get(r.batch_id);
      const ref = installByVin.get(r.vin);
      const anyRef = ref || anyByVin.get(r.vin);
      const refBatch = anyRef && batchById.get(anyRef.batch_id);
      const f = flags.get(`${r.batch_id}|${r.pdf_file_id}`) || new Set();
      return withConfidence({
        ...r,
        month: b?.month || '',
        ref_date: ref?.install_date ?? null,
        ref_name: ref?.customer_name ?? null,
        ref_row: ref?.row_no ?? null,
        ref_case: ref?.case_number ?? null,
        ref_sheet_name: ref?.sheet_name ?? null,
        in_install_sheet: ref ? 1 : 0,
        in_reference: anyRef ? 1 : 0,
        ref_file_id: refBatch?.reference_file_id ?? null,
        ref_month: refBatch?.month ?? null,
        month_ref_file_id: b?.reference_file_id ?? null,
        vin_from_filename: f.has('missing_vin') ? 1 : 0,
        filename_differs: f.has('filename_vin') ? 1 : 0,
        edited_pdf: f.has('edited_pdf') ? 1 : 0,
        scanned: f.has('scanned_page') ? 1 : 0,
        suspicious_date: f.has('suspicious_open') ? 1 : 0,
        charger_photo: f.has('vin_photo_wrong') ? 1 : 0,
      });
    });
    return { records, refs: refs.results, issues: iss.results, files: files.results, batches };
  });
}
