// Plain-language explanation of each "Issues" type (English + Thai), shared by the page and
// the detailed Excel export.
export const PROBLEM_INFO = {
  edited_pdf: {
    name: 'PDF may be edited', th: 'PDF อาจถูกแก้ไข', tone: 'bad', sheet: 'Edited PDF',
    meaning: 'The job number printed at the top of the page is different from the job number in the table, or the table labels are pictures with the values typed over them. This happens when an old report is copied and new customer data is typed in.',
    meaning_th: 'เลขงานที่พิมพ์อยู่หัวกระดาษไม่ตรงกับเลขงานในตาราง หรือหัวข้อในตารางเป็นรูปภาพแล้วพิมพ์ข้อมูลทับ มักเกิดจากการนำรายงานเก่ามาแก้ไขใส่ข้อมูลลูกค้ารายใหม่',
    why: 'The report may not belong to this installation — the photos may come from another job.',
    why_th: 'รายงานอาจไม่ใช่ของงานติดตั้งนี้ รูปถ่ายอาจมาจากงานอื่น',
    action: 'Open the PDF. Compare the job number at the top with the one in the table, and check that the VIN, charger and car photos belong to this customer. If in doubt, ask the installer for the original report. Mark resolved when checked.',
    action_th: 'เปิด PDF เทียบเลขงานหัวกระดาษกับในตาราง ตรวจรูป VIN เครื่องชาร์จ และรถ ว่าเป็นของลูกค้ารายนี้ ถ้าไม่แน่ใจให้ขอรายงานต้นฉบับจากช่าง ตรวจแล้วกด Resolve',
  },
  duplicate_vin: {
    name: 'Duplicate VIN', th: 'VIN ซ้ำ', tone: 'warn', sheet: 'Duplicate VIN',
    meaning: 'Two PDF files use the same VIN. The first file is kept as the record; the second one is listed here.',
    meaning_th: 'มีไฟล์ PDF 2 ไฟล์ใช้ VIN เดียวกัน ระบบเก็บไฟล์แรกเป็นข้อมูลหลัก ไฟล์ที่สองแสดงในรายการนี้',
    why: 'The same car may be reported (and billed) twice, or one file name has a wrong VIN.',
    why_th: 'อาจเป็นการรายงาน (และเบิกเงิน) ซ้ำ หรือชื่อไฟล์ใดไฟล์หนึ่งพิมพ์ VIN ผิด',
    action: 'Open both PDFs. Same installation → keep one and mark resolved. The second file is the right one → "Use this PDF". One VIN is a typo → correct the VIN.',
    action_th: 'เปิดทั้งสองไฟล์ ถ้าเป็นงานเดียวกันให้เก็บไว้ไฟล์เดียวแล้ว Resolve ถ้าไฟล์ที่สองถูกต้องกด "Use this PDF" ถ้า VIN พิมพ์ผิดให้แก้ VIN',
  },
  scanned_page: {
    name: 'Scanned page', th: 'หน้าสแกน', tone: 'info', sheet: 'Scanned page',
    meaning: 'Page 1 of the PDF is a picture (a scan or photo of paper) with no text, so every field was read by AI.',
    meaning_th: 'หน้าแรกของ PDF เป็นรูปภาพ (สแกนหรือถ่ายรูปกระดาษ) ไม่มีข้อความ ระบบจึงใช้ AI อ่านข้อมูลทั้งหมด',
    why: 'AI can misread Thai names, dates and numbers.',
    why_th: 'AI อาจอ่านชื่อภาษาไทย วันที่ หรือตัวเลขผิด',
    action: 'Open the PDF and check the customer name, installation date, VIN and job number against the record. Correct anything wrong, then mark resolved.',
    action_th: 'เปิด PDF ตรวจชื่อลูกค้า วันที่ติดตั้ง VIN และเลขงาน เทียบกับข้อมูลในระบบ แก้ไขถ้าผิด แล้วกด Resolve',
  },
  vin_photo_wrong: {
    name: 'Charger photo in VIN slot', th: 'รูปเครื่องชาร์จอยู่ในช่องรูป VIN', tone: 'warn', sheet: 'Charger photo',
    meaning: 'The photo in the "VIN number" position shows the charger label (serial number), not the car VIN.',
    meaning_th: 'รูปในช่อง "รูปหมายเลขตัวถัง (VIN)" เป็นรูปฉลากเครื่องชาร์จ ไม่ใช่รูป VIN ของรถ',
    why: 'The VIN cannot be confirmed from the photo (Check 1).',
    why_th: 'ไม่สามารถยืนยัน VIN จากรูปถ่ายได้ (Check 1)',
    action: 'Look for a VIN photo on the other pages of the PDF. If the VIN is visible and correct → open the record and click "Photo shows this VIN". If there is none, ask the installer for a VIN photo.',
    action_th: 'หารูป VIN ในหน้าอื่นของ PDF ถ้าเห็น VIN ถูกต้องให้เปิดรายการแล้วกด "Photo shows this VIN" ถ้าไม่มีให้ขอรูป VIN จากช่าง',
  },
  error: {
    name: 'Not read yet', th: 'ยังอ่านไม่สำเร็จ', tone: 'bad', sheet: 'Not read yet',
    meaning: 'The file could not be read completely — the daily free AI limit was reached, the scan was unreadable, or the download failed. It is waiting for the next import run.',
    meaning_th: 'ระบบอ่านไฟล์ได้ไม่ครบ เช่น ใช้ AI ฟรีครบโควต้าต่อวัน สแกนอ่านไม่ออก หรือดาวน์โหลดไม่สำเร็จ ไฟล์รออ่านในรอบถัดไป',
    why: 'This PDF is missing from the checks until it is read.',
    why_th: 'PDF นี้ยังไม่ถูกนำไปตรวจจนกว่าจะอ่านสำเร็จ',
    action: 'Run "Import month" again with the same folder URL ("Retry unread / failed" ticked). If the AI limit was reached, do it after 07:00 (Thailand).',
    action_th: 'เข้าเมนู Import month ใส่ URL โฟลเดอร์เดิม ติ๊ก "Retry unread / failed" แล้วกด Start ถ้าติดโควต้า AI ให้ทำหลัง 07:00 น.',
  },
  file_updated: {
    name: 'PDF updated in Drive', th: 'PDF ถูกอัปเดตใน Drive', tone: 'info', sheet: 'Updated in Drive',
    meaning: 'The PDF was changed or re-uploaded in Google Drive after the last import, so it was read again.',
    meaning_th: 'ไฟล์ PDF ถูกแก้ไขหรืออัปโหลดใหม่ใน Google Drive หลังการนำเข้าครั้งก่อน ระบบจึงอ่านใหม่',
    why: 'The data may have changed since it was last checked.',
    why_th: 'ข้อมูลอาจเปลี่ยนไปจากที่เคยตรวจแล้ว',
    action: 'Open the record and check the VIN, customer name and date again. Mark resolved when done.',
    action_th: 'เปิดรายการตรวจ VIN ชื่อลูกค้า และวันที่อีกครั้ง แล้วกด Resolve',
  },
};

// Problems in the submission Excel itself (Issues · Excel side) — found live, fixed in the Excel file.
export const EXCEL_PROBLEM_INFO = {
  excel_no_vin: {
    name: 'VIN missing in Excel', th: 'ไม่มี VIN ใน Excel', tone: 'bad', sheet: 'Excel VIN missing',
    meaning: 'The VIN cell (column H) has text instead of a VIN — usually "ติดตั้งก่อนรับรถ" (the charger was installed before the car was delivered). This row cannot be matched to a PDF by VIN.',
    meaning_th: 'ช่อง VIN (คอลัมน์ H) เป็นข้อความแทน VIN ส่วนใหญ่เป็น "ติดตั้งก่อนรับรถ" จึงจับคู่กับ PDF ด้วย VIN ไม่ได้',
    why: 'The installation cannot be verified against the PDF, and the VIN is needed for billing and warranty.',
    why_th: 'ตรวจสอบกับ PDF ไม่ได้ และต้องใช้ VIN ในการเบิกเงินและรับประกัน',
    action: 'Open Excel Check → "No valid VIN" and click the row: check the suggested PDF (same customer name) and approve its VIN with a remark (→ Complete, by admin). Or put the real VIN into column H and Re-check the month.',
    action_th: 'เปิด Excel Check → "No valid VIN" คลิกแถว ตรวจ PDF ที่แนะนำ (ชื่อลูกค้าเดียวกัน) แล้วอนุมัติ VIN พร้อม Remark (→ Complete โดย admin) หรือใส่ VIN จริงในคอลัมน์ H แล้ว Re-check เดือนนั้น',
  },
  excel_bad_vin: {
    name: 'VIN typo in Excel', th: 'VIN ใน Excel พิมพ์ผิด', tone: 'bad', sheet: 'Excel VIN typo',
    meaning: 'The VIN in column H looks like a VIN but is not valid (wrong length or a wrong character).',
    meaning_th: 'VIN ในคอลัมน์ H คล้าย VIN แต่ไม่ถูกต้อง (จำนวนตัวอักษรผิด หรือพิมพ์ผิด)',
    why: 'This Excel row cannot be matched to its PDF.',
    why_th: 'จับคู่แถวนี้กับ PDF ไม่ได้',
    action: 'Compare with the suggested PDF VIN (closest match), correct column H and import the month again.',
    action_th: 'เทียบกับ VIN ใน PDF ที่ระบบแนะนำ แก้คอลัมน์ H ให้ถูกต้อง แล้ว Import month ใหม่',
  },
  excel_other_month: {
    name: "PDF in another month's Excel", th: 'PDF อยู่ใน Excel ของเดือนอื่น', tone: 'warn', sheet: 'Other month Excel',
    meaning: "The PDF is in this month's folder, but its VIN is listed in another month's Excel, not in this month's.",
    meaning_th: 'ไฟล์ PDF อยู่ในโฟลเดอร์เดือนนี้ แต่ VIN อยู่ใน Excel ของเดือนอื่น ไม่ใช่เดือนนี้',
    why: 'The installation may be billed in the wrong month, or twice.',
    why_th: 'อาจเบิกเงินผิดเดือน หรือเบิกซ้ำ',
    action: 'Check which month the installation belongs to. Move the PDF to the right month\'s folder or fix the Excel.',
    action_th: 'ตรวจว่างานนี้เป็นของเดือนไหน ย้าย PDF ไปโฟลเดอร์เดือนที่ถูกต้อง หรือแก้ Excel',
  },
};
EXCEL_PROBLEM_INFO.excel_date_wrong_month = {
  name: 'Excel date not in folder month', th: 'วันที่ใน Excel ไม่ตรงเดือนของโฟลเดอร์', tone: 'bad', sheet: 'Excel date wrong month',
  meaning: 'The installation date in the Excel row is in a different month than the folder (e.g. a May date in the June Excel).',
  meaning_th: 'วันที่ติดตั้งในแถว Excel อยู่คนละเดือนกับโฟลเดอร์ (เช่น วันที่เดือนพฤษภาคมใน Excel เดือนมิถุนายน)',
  why: 'The installation may be billed in the wrong month.',
  why_th: 'อาจเบิกงานผิดเดือน',
  action: 'Check the real installation date in the PDF. Fix the date in the Excel, or move the row to the right month\'s Excel.',
  action_th: 'ตรวจวันที่ติดตั้งจริงใน PDF แก้วันที่ใน Excel หรือย้ายแถวไปไว้ใน Excel ของเดือนที่ถูกต้อง',
};
export const EXCEL_PROBLEM_TYPES = Object.keys(EXCEL_PROBLEM_INFO);

// Installation-date rules checked live on the PDF data (Issues · PDF side).
export const DATE_PROBLEM_INFO = {
  date_wrong_month: {
    name: 'Install date not in folder month', th: 'วันที่ติดตั้งไม่ตรงเดือนของโฟลเดอร์', tone: 'bad', sheet: 'Date not in month',
    meaning: 'The installation date in the PDF is in a different month than the folder it was imported from (e.g. a May date in the June folder).',
    meaning_th: 'วันที่ติดตั้งใน PDF อยู่คนละเดือนกับโฟลเดอร์ที่นำเข้า (เช่น วันที่เดือนพฤษภาคมในโฟลเดอร์เดือนมิถุนายน)',
    why: 'The installation may be billed in the wrong month, or the date in the report is wrong.',
    why_th: 'อาจเบิกงานผิดเดือน หรือวันที่ในรายงานผิด',
    action: 'Open the PDF and check the date. Wrong date → "Edit date". Right date → the PDF belongs to another month\'s folder (move it) — or confirm it if it is billed in this month on purpose.',
    action_th: 'เปิด PDF ตรวจวันที่ ถ้าวันที่ผิดให้กด "Edit date" ถ้าวันที่ถูก แสดงว่า PDF ควรอยู่โฟลเดอร์เดือนอื่น (ย้ายไฟล์) หรือกด Confirm date ถ้าตั้งใจเบิกในเดือนนี้',
  },
  date_missing: {
    name: 'No installation date', th: 'ไม่มีวันที่ติดตั้ง', tone: 'bad', sheet: 'No date',
    meaning: 'No installation date could be read from the PDF.',
    meaning_th: 'อ่านวันที่ติดตั้งจาก PDF ไม่ได้',
    why: 'The installation cannot be placed in a billing month.',
    why_th: 'ไม่สามารถระบุเดือนที่เบิกได้',
    action: 'Open the PDF, find the installation date and enter it with "Edit date".',
    action_th: 'เปิด PDF หาวันที่ติดตั้ง แล้วใส่ด้วยปุ่ม "Edit date"',
  },
};
export const DATE_PROBLEM_TYPES = Object.keys(DATE_PROBLEM_INFO);

export const PROBLEM_TYPES = Object.keys(PROBLEM_INFO);

// Plain-language "what happened" for one problem row.
export function whatHappened(i) {
  let d = i.detail || '';
  try { const j = JSON.parse(d); if (j?.message) d = j.message; } catch { /* plain text */ }
  if (i.type === 'error' && /4006|allocation/i.test(d)) return 'Daily free AI limit was reached before this file was read.';
  return d;
}
