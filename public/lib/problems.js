// Plain-language explanation of each "Other problems" type (English + Thai), shared by the page and
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

export const PROBLEM_TYPES = Object.keys(PROBLEM_INFO);

// Plain-language "what happened" for one problem row.
export function whatHappened(i) {
  let d = i.detail || '';
  try { const j = JSON.parse(d); if (j?.message) d = j.message; } catch { /* plain text */ }
  if (i.type === 'error' && /4006|allocation/i.test(d)) return 'Daily free AI limit was reached before this file was read.';
  return d;
}
