// คู่มือการใช้งาน (ภาษาไทย) — แหล่งข้อมูลเดียวสำหรับเมนู "คู่มือ" ในแอป และไฟล์ MANUAL_TH.md บน GitHub
// (สร้างด้วย `node scripts/build-manual.mjs`). เนื้อหาเป็นบล็อก: h, p, ul, ol, table, note, tip.
// ข้อความรองรับ **ตัวหนา** และ `โค้ด`.

export const MANUAL_TITLE = 'คู่มือการใช้งาน — Wall Box Installation Records (Xpeng Thailand)';

export const MANUAL = [
  {
    id: 'overview', title: '1. ภาพรวมระบบ',
    blocks: [
      ['p', 'ระบบนี้ใช้ตรวจสอบรายงานการติดตั้งเครื่องชาร์จรถยนต์ไฟฟ้า (Wall Box) ประจำเดือน โดยอ่านไฟล์ **PDF** ทุกไฟล์ในโฟลเดอร์ Google Drive ของเดือนนั้น (1 ไฟล์ = 1 งานติดตั้ง) แล้วเทียบกับไฟล์ **Excel สรุปงานติดตั้ง** ที่อยู่ในโฟลเดอร์เดียวกัน'],
      ['p', 'ระบบตรวจ 2 แบบ:'],
      ['table', ['การตรวจ', 'เทียบอะไรกับอะไร', 'คำถามที่ตอบ'], [
        ['**① Check PDF**', 'VIN ใน**ชื่อไฟล์ PDF** ↔ VIN ใน**รูปถ่าย** และ VIN ใน**ช่องกระดาษ** (ในไฟล์ PDF)', 'ไฟล์ PDF นี้เป็นของรถคันนี้จริงหรือไม่'],
        ['**② Check Excel**', 'แถวใน **Excel** (เป็นฐาน) ↔ ข้อมูลที่อ่านได้จาก PDF', 'ข้อมูลที่ส่งเบิกใน Excel ตรงกับรายงาน PDF หรือไม่ (VIN, ชื่อลูกค้า, เลขเคส, วันที่)'],
      ]],
      ['p', 'หลักสำคัญ: **VIN ในชื่อไฟล์ PDF คือค่าอ้างอิงหลัก** (ช่างเป็นคนพิมพ์) รูปถ่าย VIN ต้องยืนยันค่านี้ ส่วน VIN ในช่องกระดาษมีความสำคัญรองลงมา'],
      ['p', 'ข้อมูลทุกเดือนถูกเก็บไว้ในฐานข้อมูล นำเข้าเดือนใหม่ได้เรื่อย ๆ และส่งออกเป็น Excel ได้ทุกเมื่อ'],
      ['h', 'เมนูทั้งหมด'],
      ['table', ['เมนู', 'ใช้ทำอะไร'], [
        ['Dashboard', 'ภาพรวมผลตรวจทุกเดือน (KPI ① และ ②)'],
        ['① Check PDF', 'ผลตรวจ VIN: ชื่อไฟล์ ↔ รูปถ่าย ↔ ช่องกระดาษ'],
        ['② Check Excel', 'ผลตรวจแถว Excel เทียบกับ PDF พร้อม % match'],
        ['Other problems', 'ปัญหาอื่นที่ตาราง ① และ ② ไม่แสดง แยกตามที่มา'],
        ['Months & Import', 'นำเข้าเดือนใหม่ และจัดการเดือนที่นำเข้าแล้ว'],
        ['All PDFs', 'รายการ PDF ทั้งหมด ค้นหา ตรวจทาน ยืนยัน/แก้ไข'],
        ['คู่มือ', 'หน้านี้'],
      ]],
    ],
  },
  {
    id: 'monthly', title: '2. ขั้นตอนทำงานประจำเดือน (สรุป)',
    blocks: [
      ['ol', [
        'เข้าเมนู **Months & Import** วาง URL โฟลเดอร์ Google Drive ของเดือน กด **Check folder** แล้วกด **Start import** (ถ้าติดโควต้า AI ให้ทำต่อหลัง 07:00 น.)',
        'เมื่อนำเข้าเสร็จ ระบบเปิด **Import summary** ให้ดูผลรวม',
        'ไปที่ **① Check PDF** เลือกเดือน กดดู **③ Not matched** เปิดแต่ละรายการตรวจรูปใน PDF แล้วกด **Photo shows this VIN** หรือ **Correct VIN**',
        'ไปที่ **② Check Excel** ดูแถวที่ % match ต่ำ และ **Excel row · no PDF** / **PDF · not in Excel** ตรวจกับ Excel และ PDF',
        'ไปที่ **Other problems** ตรวจ PDF ที่อาจถูกแก้ไข, VIN ซ้ำ, หน้าสแกน และปัญหาใน Excel',
        'ใช้ **All PDFs → Confidence: Needs review** เป็นคิวงาน ตรวจจนหมด',
        'ส่งออก Excel: **Export Check 1**, **Export Check 2**, **Export detailed Excel** หรือ **Export all sheets**',
      ]],
      ['tip', 'ถ้าเพิ่ม/แก้ไฟล์ PDF หรือ Excel ใน Drive ภายหลัง ให้ Import โฟลเดอร์เดิมซ้ำ ระบบจะอ่านเฉพาะไฟล์ใหม่/ไฟล์ที่เปลี่ยน และไม่ลบงานตรวจที่ผู้ดูแลทำไว้'],
    ],
  },
  {
    id: 'login', title: '3. การเข้าสู่ระบบและหน้าจอทั่วไป',
    blocks: [
      ['ul', [
        'เปิด **https://wallbox.anotai.net** ใส่รหัสผ่านผู้ดูแล จะอยู่ในระบบได้ 7 วัน กด **Sign out** มุมขวาบนเพื่อออก',
        'ใส่รหัสผ่านผิด 8 ครั้งใน 15 นาที ระบบจะล็อกเครือข่ายนั้น 15 นาที',
        'ปุ่ม ☀/🌙 มุมขวาบน สลับธีมมืด/สว่าง',
        'ด้านล่างสุดแสดงเวอร์ชันแอปและเลข GitHub (เช่น `main@4d98e3b`) ใช้ตรวจว่าเว็บเป็นเวอร์ชันล่าสุด',
        'ถ้ามีแถบ "A new version of the app is available" ให้กด **Refresh**',
        'ถ้าหน้าจอค้างหรือแสดง "Something went wrong" ให้กด **Ctrl+Shift+R** (โหลดใหม่ทั้งหมด)',
      ]],
    ],
  },
  {
    id: 'dashboard', title: '4. Dashboard',
    blocks: [
      ['p', 'หน้าภาพรวมของทุกเดือนที่นำเข้า'],
      ['table', ['ส่วน', 'ความหมาย'], [
        ['**① Check PDF** (3 กล่อง)', 'จำนวนและ % ของ PDF แต่ละระดับ ①②③ คลิกกล่องเพื่อเปิดรายการใน ① Check PDF'],
        ['**② Check Excel** (5 กล่อง)', 'จำนวนแถว Excel แยกตาม % match (100%, 90–99%, 70–89%, ต่ำกว่า 70%, ไม่มี PDF) และลิงก์ "PDFs not in any Excel"'],
        ['Records', 'จำนวน PDF (VIN ไม่ซ้ำ) และจำนวนเดือน'],
        ['To review', 'จำนวนรายการที่ต้องตรวจ (③, % match ต่ำกว่า 70% / ไม่อยู่ใน Excel, หรือวันที่ต่ำกว่า 95%) คลิกเพื่อเปิดคิวงาน'],
        ['In reference Excel', 'สัดส่วนแถว Excel ที่มี PDF'],
        ['Other problems', 'จำนวนปัญหาอื่นที่ยังเปิดอยู่'],
        ['Imported months', 'การ์ดแต่ละเดือน: จำนวน Records, PDFs, VIN ✘, Problems, ความคืบหน้า และปุ่ม Summary / All PDFs / Check PDF / Check Excel / Other problems / Excel'],
        ['Installations by install date', 'กราฟจำนวนงานตามเดือนที่ติดตั้ง'],
        ['**⚠ Installation date** (กล่องแดง)', 'จำนวน PDF ที่วันที่ติดตั้ง**ไม่อยู่ในเดือนของโฟลเดอร์** และที่**อ่านวันที่ไม่ได้** แยกตามเดือน คลิกเพื่อเปิดรายการ (ดูหัวข้อ 4.1) · การ์ดเดือนแสดง "Date ≠ month"'],
      ]],
      ['h', '4.1 กฎวันที่ติดตั้ง — ต้องอยู่ในเดือนของโฟลเดอร์'],
      ['p', 'วันที่ติดตั้งเป็นข้อมูลสำคัญสำหรับการเบิกจ่าย ทุกงานในโฟลเดอร์ของเดือนใดต้องมีวันที่ติดตั้ง**อยู่ในเดือนนั้น** เช่น โฟลเดอร์ 2026-06 ต้องเป็นวันที่ 1–30 มิ.ย. 2026 เท่านั้น ระบบตรวจทั้งวันที่ใน **PDF** และวันที่ใน **Excel**'],
      ['table', ['ปัญหา', 'แหล่ง', 'แสดงที่', 'ต้องทำอะไร'], [
        ['**Date not in folder month**', '① PDF', 'Dashboard, ① Check PDF (คอลัมน์ Installed สีแดง), All PDFs (ตัวกรอง Install date), Other problems ①, หน้าต่างรายละเอียด (แถบแดง)', 'เปิด PDF ตรวจวันที่ ถ้าอ่านผิดกด **Edit date** ถ้าวันที่ถูกจริง (งานเดือนอื่นอยู่ผิดโฟลเดอร์ / ส่งเบิกล่าช้า) ติดต่อผู้รับเหมา หรือกด **Confirm date** เพื่อยอมรับ'],
        ['**No installation date**', '① PDF', 'เหมือนข้างบน', 'เปิด PDF แล้วกด **Edit date** ใส่วันที่ที่ถูกต้อง'],
        ['**Excel date not in folder month**', '② Excel', '② Check Excel (ชิป ⚠ และวันที่สีแดง), Other problems ②', 'แก้วันที่ในไฟล์ Excel ส่งเบิก หรือย้ายแถวไปเดือนที่ถูกต้อง'],
      ]],
      ['note', 'วันที่ที่ผู้ดูแลกด **Confirm date** หรือ **Edit date** แล้ว จะไม่ถูกแจ้งซ้ำ (ถือว่าตรวจแล้ว) และบันทึกใน History ของรายการ · วันที่นอกเดือนจะลดความมั่นใจของวันที่ลง 25% และทำให้รายการอยู่ใน **Needs review**'],
    ],
  },
  {
    id: 'check1', title: '5. ① Check PDF — ชื่อไฟล์ ↔ ข้อมูลใน PDF',
    blocks: [
      ['p', 'ตรวจว่า VIN ใน**ชื่อไฟล์ PDF** ตรงกับ VIN ที่อยู่**ในไฟล์ PDF** หรือไม่ จาก 3 แหล่ง:'],
      ['table', ['แหล่ง VIN', 'ความสำคัญ', 'ตัวอย่าง'], [
        ['ชื่อไฟล์ PDF', 'สูง — ค่าอ้างอิง (เป็น VIN หลักของรายการ)', '`L1NNSGHAXTB222327 มยุรี มีทรัพย์.pdf`'],
        ['รูปถ่าย VIN (หน้า 1)', 'ต้องยืนยันชื่อไฟล์', 'ระบบอ่านรูปด้วยตัวอ่านฟรีในเครื่อง ถ้าไม่ชัดจึงใช้ AI'],
        ['ช่อง "หมายเลขตัวถัง (VinNo.)" บนกระดาษ', 'รอง', 'มักพิมพ์ผิดแบบ OCR เช่น `AK` แทน `AX`'],
      ]],
      ['h', 'ผลการตรวจ 3 ระดับ'],
      ['table', ['ระดับ', 'ความหมาย', 'ต้องทำอะไร'], [
        ['**① Match 3/3** (เขียว)', 'ชื่อไฟล์ = รูปถ่าย = ช่องกระดาษ', 'ไม่ต้องทำอะไร'],
        ['**② File = Photo** (ส้ม)', 'รูปยืนยันชื่อไฟล์ แต่ช่องกระดาษต่าง (พิมพ์ผิด/อ่านไม่ได้)', 'โดยทั่วไปถือว่า VIN ถูกต้อง แจ้งช่างแก้แบบฟอร์มถ้าจำเป็น'],
        ['**③ Not matched** (แดง)', 'รูปไม่ยืนยันชื่อไฟล์: อ่านได้ค่าอื่น, อ่านไม่ออก หรือเป็นรูปเครื่องชาร์จ', 'เปิด PDF ตรวจรูป แล้วกด **Photo shows this VIN** หรือ **Correct VIN**'],
      ]],
      ['h', 'หน้าจอ'],
      ['ul', [
        '**Month** เลือกเดือน, ชิป **All / ① / ② / ③** กรองผล (ตัวเลขคือจำนวน)',
        'คอลัมน์: Month · VIN in file name · VIN photo (แดงถ้าไม่ตรง) · Paper VIN box (ส้มถ้าไม่ตรง) · Result · Read by (Free/AI) · Customer · **Installed** (แดงถ้าไม่อยู่ในเดือนของโฟลเดอร์หรือไม่มีวันที่) · ลิงก์ PDF',
        'คลิกแถวเพื่อเปิดหน้าต่างรายละเอียด (ดูหัวข้อ 9)',
        'ปุ่ม **Export Check 1** ส่งออกเฉพาะผลตรวจนี้ (ดูหัวข้อ 10.2)',
      ]],
      ['note', 'ตัวอ่านรูปฟรี (PaddleOCR) ทำงานในเครื่องของผู้ใช้ ยืนยันได้ประมาณ 80% ของรูป ส่วนที่เหลือใช้ AI ของ Cloudflare ซึ่งมีโควต้าฟรีวันละ 10,000 neurons'],
    ],
  },
  {
    id: 'check2', title: '6. ② Check Excel — แถว Excel เป็นฐาน เทียบกับ PDF',
    blocks: [
      ['p', 'ทุกแถวใน Excel สรุปงานติดตั้ง (ชีตติดตั้ง) เป็น "ข้อมูลฐาน": **เลขแถว, VIN (คอลัมน์ H), ชื่อลูกค้า (คอลัมน์ D), เลขเคส (Case number), วันที่ติดตั้ง** ระบบหา PDF ที่มี VIN เดียวกัน (ชื่อไฟล์ → รูป → ช่องกระดาษ) แล้วเทียบทีละช่อง'],
      ['h', 'วิธีคิด % match (รวม 100)'],
      ['table', ['ช่องใน Excel', 'เทียบกับข้อมูลใน PDF', 'คะแนน'], [
        ['VIN', 'VIN ใน**ชื่อไฟล์**', '15'],
        ['VIN', 'VIN ใน**รูปถ่าย**', '15'],
        ['VIN', 'VIN ใน**ช่องกระดาษ**', '10'],
        ['ชื่อลูกค้า', 'ชื่อลูกค้าใน PDF (คิดตามความเหมือน %; ชื่อที่ผู้ดูแลยืนยันแล้วได้เต็ม)', '25'],
        ['Case number', 'เลขงาน (Job number) ใน PDF', '15'],
        ['วันที่ติดตั้ง', 'วันที่ใน PDF: ตรงกัน 20 · ต่างไม่เกิน 3 วัน 10 · มากกว่านั้น 0', '20'],
      ]],
      ['p', 'การเทียบชื่อ: ไม่สนใจคำนำหน้า (คุณ/นาย/นาง/นางสาว/น.ส.), เว้นวรรค, เครื่องหมาย, วรรณยุกต์ที่หายไป, "บ." = "บริษัท" และเทียบชื่อบุคคล/บริษัททีละส่วน'],
      ['h', 'กลุ่มผลลัพธ์'],
      ['table', ['กลุ่ม', 'ความหมาย'], [
        ['100%', 'ทุกช่องตรง'],
        ['90–99%', 'เกือบตรงทั้งหมด'],
        ['70–89%', 'บางช่องต่าง — ควรตรวจ (ส่วนใหญ่เป็นวันที่ใน PDF ต่างจาก Excel)'],
        ['ต่ำกว่า 70%', 'หลายช่องต่าง — ต้องตรวจ'],
        ['Excel row · no PDF', 'แถวใน Excel ที่ไม่มี PDF ของ VIN นั้นในโฟลเดอร์'],
        ['PDF · not in Excel', 'PDF ที่ไม่มีแถวใน Excel'],
      ]],
      ['h', 'หน้าจอ'],
      ['ul', [
        'ซ้าย: ข้อมูล Excel (เดือน, แถว, VIN, ลูกค้า, Case no., วันที่) — ขวา: ผลที่พบใน PDF (✔/✘ ต่อช่อง, % ชื่อ, วันที่ต่างกันกี่วัน) และ **Match %**',
        'ถ้าช่องไม่ตรง จะแสดงค่าจาก PDF ใต้ค่าจาก Excel',
        'ปุ่ม **Open <เดือน> Excel** เปิดไฟล์ Excel ใน Drive (เมื่อเลือกเดือน)',
        'ปุ่ม **Export Check 2** (ดูหัวข้อ 10.3)',
      ]],
    ],
  },
  {
    id: 'problems', title: '7. Other problems — ปัญหาอื่น แยกตามที่มา',
    blocks: [
      ['p', 'ปัญหาที่ตาราง ① และ ② ไม่ได้แสดง แบ่งเป็น 2 ส่วน แต่ละการ์ดมีคำอธิบายและสิ่งที่ต้องทำ คลิกการ์ดเพื่อกรองรายการ'],
      ['h', '① จาก Check PDF (แก้/Resolve ในแอป)'],
      ['table', ['ปัญหา', 'ความหมาย', 'สิ่งที่ต้องทำ'], [
        ['PDF อาจถูกแก้ไข', 'เลขงานหัวกระดาษไม่ตรงกับในตาราง หรือหัวตารางเป็นรูปภาพแล้วพิมพ์ทับ (นำรายงานเก่ามาแก้)', 'ตรวจเลขงานและรูปถ่ายว่าเป็นของลูกค้ารายนี้ ถ้าไม่แน่ใจขอรายงานต้นฉบับจากช่าง'],
        ['VIN ซ้ำ', 'PDF 2 ไฟล์ใช้ VIN เดียวกัน ระบบเก็บไฟล์แรก', 'เปิดทั้งสองไฟล์: งานเดียวกัน → Resolve · ไฟล์ที่สองถูก → **Use this PDF** · VIN พิมพ์ผิด → แก้ VIN'],
        ['หน้าสแกน', 'หน้าแรกเป็นรูปภาพ ข้อมูลทั้งหมดอ่านด้วย AI', 'ตรวจชื่อ วันที่ VIN เลขงาน แก้ถ้าผิด'],
        ['รูปเครื่องชาร์จอยู่ในช่องรูป VIN', 'ช่องรูป VIN เป็นรูปฉลากเครื่องชาร์จ', 'หารูป VIN ในหน้าอื่น แล้วกด Photo shows this VIN หรือขอรูปจากช่าง'],
        ['ยังอ่านไม่สำเร็จ', 'ติดโควต้า AI สแกนอ่านไม่ออก หรือดาวน์โหลดไม่สำเร็จ', 'Import เดือนเดิมซ้ำ (ติ๊ก Retry unread / failed) หลัง 07:00 น.'],
        ['PDF ถูกอัปเดตใน Drive', 'ไฟล์ถูกแก้/อัปโหลดใหม่ ระบบอ่านใหม่แล้ว', 'ตรวจ VIN ชื่อ วันที่ อีกครั้ง แล้ว Resolve'],
      ]],
      ['h', '② จาก Check Excel (แก้ในไฟล์ Excel แล้ว Import ใหม่)'],
      ['table', ['ปัญหา', 'ความหมาย', 'สิ่งที่ต้องทำ'], [
        ['ไม่มี VIN ใน Excel', 'ช่อง VIN (คอลัมน์ H) เป็นข้อความ เช่น "ติดตั้งก่อนรับรถ"', 'ดู PDF ที่ระบบแนะนำ (ชื่อลูกค้าเดียวกัน) เพื่อหา VIN จริง ใส่ในคอลัมน์ H'],
        ['VIN ใน Excel พิมพ์ผิด', 'VIN ไม่ถูกต้อง (จำนวนตัวอักษรผิด/พิมพ์ผิด)', 'เทียบกับ VIN ใน PDF ที่ระบบแนะนำ แล้วแก้คอลัมน์ H'],
        ['PDF อยู่ใน Excel ของเดือนอื่น', 'PDF อยู่ในโฟลเดอร์เดือนนี้ แต่ VIN อยู่ใน Excel เดือนอื่น', 'ตรวจว่างานเป็นของเดือนไหน ย้าย PDF หรือแก้ Excel'],
      ]],
      ['ul', [
        'ตาราง ①: Problem · Month · VIN · What happened · What to do · PDF · ปุ่ม **Resolve / Reopen** (และ **Use this PDF** สำหรับ VIN ซ้ำ) — ติ๊ก **Show resolved** เพื่อดูที่แก้แล้ว',
        'ตาราง ②: Problem · Month · Excel row · VIN in Excel · Customer · **Suggested PDF** · What to do · ลิงก์ Excel/PDF',
        'ปุ่ม **Export detailed Excel** (ดูหัวข้อ 10.4)',
      ]],
    ],
  },
  {
    id: 'import', title: '8. Months & Import — นำเข้าเดือนและจัดการเดือน',
    blocks: [
      ['h', 'นำเข้าเดือนใหม่'],
      ['ol', [
        'ตั้งค่าโฟลเดอร์ Google Drive ให้แชร์แบบ **Anyone with the link** (ทุกคนที่มีลิงก์ดูได้)',
        'วาง URL โฟลเดอร์ในช่อง **Google Drive folder URL** กด **Check folder**',
        'ระบบแสดง: ชื่อโฟลเดอร์, จำนวน PDF, ไฟล์ Excel อ้างอิง, เดือน (แก้ได้) และสถานะตัวอ่าน VIN ฟรี',
        'ตั้งค่าตัวเลือก แล้วกด **Start import** ห้ามปิดหน้าเว็บระหว่างนำเข้า (สลับเมนูได้)',
      ]],
      ['table', ['ตัวเลือก', 'ความหมาย'], [
        ['Read VIN photo with AI', 'อ่านรูป VIN (ตัวอ่านฟรีก่อน แล้วใช้ AI เฉพาะรูปที่ไม่ชัด) — ควรเปิดไว้'],
        ['Retry unread / failed files', 'อ่านไฟล์ที่ค้าง (เช่น ติดโควต้า AI) ซ้ำ — ควรเปิดไว้'],
        ['Re-read VIN photos that are not matched (N files)', 'แสดงเมื่อเดือนนั้นมีไฟล์ระดับ ③ ที่ผู้ดูแลยังไม่ยืนยัน: อ่านรูป VIN ใหม่เฉพาะไฟล์เหล่านี้ ด้วยตัวอ่านฟรี (PaddleOCR) ก่อน ใช้ AI เฉพาะที่ยังยืนยันไม่ได้ ไม่รวมหน้าสแกน ใช้เวลาไม่กี่นาที เก็บงานตรวจของผู้ดูแลไว้ — เหมาะกับเดือนที่เคยอ่านด้วย AI อย่างเดียว (มิ.ย. 2026) เพราะ AI อาจอ่านผิด 1 ตัว เช่น X เป็น K'],
        ['Re-process all files', 'อ่านทุกไฟล์ใหม่ทั้งหมด (ใช้เมื่อจำเป็นเท่านั้น งานตรวจของผู้ดูแลยังอยู่)'],
        ['Test run — only first N files', 'ทดลองกับ N ไฟล์แรก (0 = ทั้งหมด)'],
      ]],
      ['h', 'นำเข้าโฟลเดอร์เดิมซ้ำ'],
      ['p', 'เมื่อ Check folder ที่เคยนำเข้าแล้ว ระบบแสดง "Since the last import":'],
      ['table', ['สถานะ', 'ความหมาย', 'สิ่งที่ระบบทำ'], [
        ['new', 'PDF ใหม่', 'นำเข้า'],
        ['updated', 'PDF ชื่อเดิมแต่วันที่แก้ไขใหม่กว่า หรืออัปโหลดใหม่', 'อ่านใหม่ เก็บงานตรวจของผู้ดูแลไว้ ทำเครื่องหมาย "Updated"'],
        ['deleted', 'PDF ที่ไม่อยู่ในโฟลเดอร์แล้ว', 'เก็บข้อมูลไว้ ทำเครื่องหมาย "Deleted"'],
        ['unchanged', 'ไม่เปลี่ยน', 'ข้าม'],
      ]],
      ['note', 'ถ้าโฟลเดอร์มี Excel มากกว่า 1 ไฟล์ ระบบใช้ไฟล์เดิมที่เคยนำเข้าเดือนนั้น และแสดงข้อความแจ้ง'],
      ['h', 'ระหว่างนำเข้า'],
      ['ul', [
        'แถบความคืบหน้า และตัวนับ: Processed, Saved, Duplicates, Issues, Errors, MB downloaded พร้อมเวลาที่เหลือ',
        'บันทึก (log) แสดงผลแต่ละไฟล์',
        'ถ้าโควต้า AI ฟรีหมด ระบบอ่านต่อเฉพาะส่วนที่ไม่ต้องใช้ AI และเก็บไฟล์ที่เหลือไว้ให้รอบถัดไป (หลัง 07:00 น.)',
        'เสร็จแล้วเปิด **Import summary** อัตโนมัติ',
      ]],
      ['h', 'Import summary (สรุปผลของเดือน)'],
      ['ul', [
        'PDFs in folder, Processed, Scanned pages, Last run',
        'Records saved · VIN ①②③ · VIN photo not read — AI quota · Files failed · Duplicate VIN (คลิกแต่ละแถวเพื่อดูรายการ)',
        'Excel check, PDF files (Updated/Deleted), VIN photos read by (Free/AI)',
      ]],
      ['h', 'Imported months (ตารางด้านล่าง)'],
      ['table', ['คอลัมน์ / ปุ่ม', 'ความหมาย'], [
        ['Month', 'แก้เดือนได้โดยตรง'],
        ['Folder', 'ลิงก์โฟลเดอร์ Drive'],
        ['PDFs / Processed / Records / VIN ✘ / Problems', 'จำนวนต่าง ๆ ของเดือน'],
        ['Excel', 'จำนวนแถว Excel ที่มี PDF / ทั้งหมด และลิงก์เปิด Excel'],
        ['Summary', 'เปิดสรุปผลของเดือน'],
        ['Resume / Re-check', 'นำเข้าโฟลเดอร์เดิมซ้ำ'],
        ['⬇', 'ส่งออก Excel ของเดือน (ทุกชีต)'],
        ['Delete', 'ลบเดือนและข้อมูลทั้งหมดของเดือน (ต้องพิมพ์ DELETE ยืนยัน — ย้อนกลับไม่ได้)'],
      ]],
    ],
  },
  {
    id: 'allpdfs', title: '9. All PDFs และหน้าต่างรายละเอียด (ตรวจ/ยืนยัน/แก้ไข)',
    blocks: [
      ['p', 'รายการ PDF ทั้งหมดพร้อมผลตรวจทั้งสองแบบ ใช้ค้นหาและใช้เป็นคิวงานตรวจ'],
      ['ul', [
        '**Search**: ค้นหา VIN ชื่อ เลขงาน Serial เบอร์โทร',
        'ตัวกรอง: Month, **Confidence** (All / **Needs review** / 100% only), **② Check Excel**, **① Check PDF**, **PDF file** (Updated/Deleted), ช่วงวันที่ติดตั้ง',
        'คอลัมน์: Month · VIN (file name) · ① Check PDF · ② Check Excel · Photo VIN · Paper VIN · Installed · Date % · Job number · Customer · Serial · PDF',
        '**Needs review** เรียงรายการที่ควรตรวจก่อน: ① ระดับ ③, ② ต่ำกว่า 70% หรือไม่อยู่ใน Excel, หรือวันที่ต่ำกว่า 95%',
        'ปุ่ม **Export all sheets** (ดูหัวข้อ 10.1)',
      ]],
      ['h', 'หน้าต่างรายละเอียด (คลิกแถวใดก็ได้)'],
      ['table', ['ส่วน', 'รายละเอียด / ปุ่ม'], [
        ['หัว', 'ป้าย**เดือน** (เน้นสี), ชื่อลูกค้า, VIN; ถ้า VIN อยู่ใน Excel เดือนอื่นจะมีป้ายเตือน'],
        ['Open PDF', 'เปิดไฟล์ PDF ใน Drive เพื่อตรวจ'],
        ['VIN check (①)', 'VIN ชื่อไฟล์ / รูป / ช่องกระดาษ พร้อม ✔✘ และเหตุผล · ปุ่ม **Photo shows this VIN** (ยืนยัน) · **Correct VIN** (แก้ VIN — ห้ามซ้ำกับรายการอื่น)'],
        ['② Check Excel', 'แถว Excel (ชีตและเลขแถว), VIN (ชื่อไฟล์/รูป/กระดาษ), ชื่อ %, Case no., วันที่ พร้อม ✔✘ · ปุ่ม **Open Excel** · **Name is correct** · **Edit name** (มีปุ่มใช้ชื่อจาก Excel หรือจากชื่อไฟล์)'],
        ['Installation date', 'วันที่และข้อความจาก PDF, % และเหตุผล · ปุ่ม **Confirm date** · **Edit date**'],
        ['History', 'ประวัติการยืนยัน/แก้ไขทั้งหมด (ค่าเดิม → ค่าใหม่, เวลา, IP) และเหตุการณ์ไฟล์ (อัปเดต/ลบใน Drive)'],
        ['รายละเอียดอื่น', 'เลขงาน, รหัสลูกค้า/PO, เบอร์, ภูมิภาค, ลักษณะสถานที่, Serial, วันพิมพ์รายงาน, Job URL, หมายเหตุ'],
      ]],
      ['tip', 'ในโหมด Needs review เมื่อยืนยัน/แก้ไขเสร็จ ระบบจะเปิดรายการถัดไปให้อัตโนมัติ'],
      ['note', 'ค่าที่ผู้ดูแลยืนยันหรือแก้ไข จะไม่ถูกเขียนทับเมื่อ Import ซ้ำ และบันทึกไว้ใน History เสมอ'],
    ],
  },
  {
    id: 'reports', title: '10. รายงาน Excel (รายละเอียดทุกไฟล์และทุกคอลัมน์)',
    blocks: [
      ['table', ['ปุ่ม (อยู่ที่หน้า)', 'ชื่อไฟล์', 'ชีตในไฟล์'], [
        ['Export all sheets (All PDFs) / ⬇ (Months, Dashboard)', '`wallbox_all_<เดือน>_<วันที่>.xlsx`', 'PDF · Check 1 · PDF · Check 2 · Excel baseline · Other problems · Summary'],
        ['Export Check 1 (① Check PDF)', '`wallbox_check1_…`', 'Check 1 · PDF · Summary'],
        ['Export Check 2 (② Check Excel)', '`wallbox_check2_…`', 'Check 2 · Excel baseline · Summary'],
        ['Export detailed Excel (Other problems)', '`wallbox_problems_…`', 'Read me · All problems · ชีตตามประเภทปัญหา · ② Excel problems'],
      ]],
      ['p', 'ถ้าเลือกเดือนก่อนกดส่งออก จะได้เฉพาะเดือนนั้น ถ้าไม่เลือก (All months) จะได้ทุกเดือน ทุกชีตมีแถวหัวตารางตรึงไว้และตัวกรอง (Filter)'],
      ['h', 'ความหมายของสี'],
      ['table', ['สี', 'ความหมาย'], [
        ['เขียว', 'ตรง / ผ่าน (① ระดับ 1, % สูง, Resolved)'],
        ['ส้ม', 'ควรตรวจ (② ระดับ 2, % กลาง, Needs review, Updated, Open)'],
        ['แดง', 'ไม่ตรง / ต้องแก้ (③, % ต่ำ, ไม่มี PDF, Deleted, ช่องที่ไม่ตรง)'],
        ['ฟ้า/น้ำเงิน', 'ปัญหาจาก Excel (แหล่งที่มา ②)'],
      ]],
      ['h', '10.1 ชีต PDF (1 แถว = 1 ไฟล์ PDF)'],
      ['table', ['คอลัมน์', 'ความหมาย'], [
        ['VIN (file name, key)', 'VIN จากชื่อไฟล์ ใช้เป็นคีย์หลัก'],
        ['① Check PDF', 'ผลตรวจ ①: 1 · Match 3/3 / 2 · File = Photo / 3 · Not matched'],
        ['② Check Excel %', '% match กับแถว Excel (หรือ Not in Excel)'],
        ['Photo VIN / Paper VIN', 'VIN ที่อ่านจากรูป / จากช่องกระดาษ (แดง/ส้มถ้าไม่ตรง)'],
        ['Excel row / Excel name (col D)', 'ชีตและแถวใน Excel / ชื่อลูกค้าใน Excel'],
        ['Installation date / Date %', 'วันที่ติดตั้งจาก PDF / ความมั่นใจของวันที่'],
        ['Date in folder month', '✔ = อยู่ในเดือนของโฟลเดอร์ · ✘ 2026-05 ≠ 2026-06 = อยู่เดือนอื่น · NO DATE = อ่านไม่ได้ (แดง พร้อมวันที่แดง)'],
        ['Needs review', 'Yes = ควรตรวจ'],
        ['VIN photo match / Read by', '✔✘ รูปตรงกับ VIN / อ่านด้วย free (ฟรี) หรือ ai'],
        ['Month · Job number · Charger / PO code · Customer name · Phone · Region · Site type · Charger serial · Report printed at · Job URL', 'ข้อมูลจากแบบฟอร์มหน้า 1'],
        ['PDF file / PDF link / PDF file status', 'ชื่อไฟล์ / ลิงก์ / Updated หรือ Deleted พร้อมวันที่'],
        ['VIN — why / Date — why', 'เหตุผลของผลตรวจ VIN และวันที่'],
        ['Notes', 'หมายเหตุ รวมถึงการแก้ไขของผู้ดูแล'],
      ]],
      ['h', '10.2 ชีต Check 1 · PDF'],
      ['table', ['คอลัมน์', 'ความหมาย'], [
        ['Month', 'เดือน'],
        ['VIN in file name (reference)', 'VIN ในชื่อไฟล์ (ค่าอ้างอิง)'],
        ['VIN in photo', 'VIN ที่อ่านจากรูป (หรือ charger photo / not read) — แดงถ้าไม่ตรง'],
        ['VIN in paper box', 'VIN ในช่องกระดาษ — ส้มถ้าไม่ตรง'],
        ['Result', '① Match 3/3 / ② File = Photo / ③ Not matched (สีเขียว/ส้ม/แดง)'],
        ['Photo read by', 'Free reader หรือ AI'],
        ['Why', 'เหตุผลของผล'],
        ['Installation date / Date in folder month', 'วันที่ติดตั้งจาก PDF / ✔ ✘ NO DATE (แดงถ้าไม่อยู่ในเดือนของโฟลเดอร์)'],
        ['Customer (PDF) · Job number · PDF file · PDF link', 'ข้อมูลอ้างอิงและลิงก์'],
      ]],
      ['h', '10.3 ชีต Check 2 · Excel baseline (1 แถว = 1 แถวใน Excel)'],
      ['table', ['คอลัมน์', 'ความหมาย'], [
        ['Month · Excel sheet · Excel row', 'ตำแหน่งแถวใน Excel'],
        ['VIN (Excel) · Customer (Excel) · Case no. (Excel) · Install date (Excel)', 'ข้อมูลฐานจาก Excel'],
        ['PDF found', 'Yes / No PDF'],
        ['VIN file (15) · VIN photo (15) · VIN paper (10)', '✔/✘ VIN ในชื่อไฟล์ / รูป / ช่องกระดาษ ตรงกับ Excel (ตัวเลขในวงเล็บคือคะแนน)'],
        ['Name % (25)', 'ความเหมือนของชื่อลูกค้า'],
        ['Case (15)', '✔/✘ Case number ตรงกับเลขงานใน PDF'],
        ['Date (20)', '✔ = ตรง, "N days" = ต่างกัน N วัน'],
        ['% match', 'คะแนนรวม (เขียว ≥90, ส้ม 70–89, แดง <70)'],
        ['Customer (PDF) · Job no. (PDF) · Install date (PDF) · PDF link', 'ค่าจาก PDF เพื่อเทียบ'],
        ['Excel date in folder month / PDF date in folder month', '✔ หรือ ✘ (แดง) วันที่ใน Excel / PDF อยู่ในเดือนของโฟลเดอร์หรือไม่'],
      ]],
      ['h', '10.4 ไฟล์ Other problems (Export detailed Excel)'],
      ['table', ['ชีต', 'เนื้อหา'], [
        ['Read me', 'วิธีใช้ไฟล์ (ไทย/อังกฤษ) และตารางอธิบายทุกปัญหา: ความหมาย, ผลกระทบ, สิ่งที่ต้องทำ, จำนวน Open/Resolved, Source (①/②)'],
 ['⚠ Install date', 'ปัญหาวันที่ทั้งหมด: ① PDF (ไม่อยู่ในเดือน / ไม่มีวันที่) และ ② Excel (วันที่ใน Excel ไม่อยู่ในเดือน) พร้อมเดือนโฟลเดอร์, เดือนของวันที่ (แดง), วันที่ PDF, ข้อความวันที่ใน PDF, วันที่ Excel, สิ่งที่ต้องทำ และลิงก์'],
        ['All problems', 'ทุกปัญหา 1 แถวต่อปัญหา: Source · Problem · Status · Month · VIN · Customer · Job number · What happened · What to do · PDF file/link · Excel row/link · Found (UTC)'],
        ['Edited PDF', '+ Job at top of page · Job in table · Report printed · Install date'],
        ['Duplicate VIN', '+ ไฟล์ที่เก็บไว้ (ชื่อ, เดือน, ลิงก์, ลูกค้า) และไฟล์นี้ (ลูกค้า, วันที่, เลขงาน)'],
        ['Scanned page', '+ Install date (AI read) · VIN photo (AI read) · Notes'],
        ['Charger photo', '+ Text seen in the photo'],
        ['Not read yet / Updated in Drive', '+ เหตุผล / วันที่อัปเดต'],
        ['② Excel problems', 'Problem · Month · Excel sheet/row · VIN cell in Excel · Customer · Case number · Suggested PDF VIN · How it was matched · Suggested PDF customer/link · What to do · Excel link'],
      ]],
      ['h', '10.5 ชีต Summary'],
      ['p', 'สรุปตัวเลขของไฟล์ที่ส่งออก: เดือนที่รวม, จำนวน PDF, จำนวนแต่ละระดับของ ①, จำนวนแต่ละกลุ่มของ ②, จำนวนปัญหาที่เปิดอยู่'],
      ['h', '10.6 ชีต Other problems (ในไฟล์ all)'],
      ['p', 'Type · VIN · Month · Detail · PDF file · PDF link · Resolved — รายการปัญหาอื่นแบบย่อ (ใช้ไฟล์ detailed สำหรับคำอธิบายเต็ม)'],
    ],
  },
  {
    id: 'terms', title: '11. คำศัพท์',
    blocks: [
      ['table', ['คำ', 'ความหมาย'], [
        ['VIN', 'หมายเลขตัวถังรถ 17 หลัก (ไม่มีตัว I, O, Q) ของ XPENG ขึ้นต้นด้วย L1NN'],
        ['Record', '1 รายการ = 1 ไฟล์ PDF = 1 VIN'],
        ['Batch / Month', '1 โฟลเดอร์ Drive = 1 เดือน'],
        ['Reference Excel', 'ไฟล์ Excel สรุปงานติดตั้งในโฟลเดอร์ ใช้เป็นฐานของ ②'],
        ['Free reader', 'ตัวอ่านรูปฟรี (PaddleOCR) ที่ทำงานในเครื่องผู้ใช้'],
        ['AI', 'Cloudflare Workers AI ใช้อ่านรูปที่ไม่ชัดและหน้าสแกน'],
        ['Needs review', 'รายการที่ควรให้ผู้ดูแลตรวจ'],
        ['Resolve', 'ทำเครื่องหมายว่าตรวจ/แก้ปัญหาแล้ว'],
        ['temporary ID', 'รหัสชั่วคราวแทน VIN เช่น L1NNRM2…, L1NNRAT…, L1NNPKS… (ยังไม่มี VIN จริง)'],
      ]],
    ],
  },
  {
    id: 'faq', title: '12. คำถามที่พบบ่อยและการแก้ปัญหา',
    blocks: [
      ['table', ['อาการ', 'สาเหตุ / วิธีแก้'], [
        ['หน้าจอแสดง "Something went wrong" หรือค้าง', 'กด Ctrl+Shift+R ถ้ายังเป็น อาจเกินโควต้าฟรีของ Cloudflare รอหลัง 07:00 น. หรือแจ้งผู้ดูแลระบบ'],
        ['Import หยุด "allowance is used up"', 'โควต้า AI ฟรีวันละ 10,000 neurons หมด Import ซ้ำหลัง 07:00 น. (ไฟล์ที่ทำแล้วไม่ถูกอ่านซ้ำ)'],
        ['Free VIN reader OFF', 'ไฟล์ตัวอ่านยังโหลดไม่เสร็จ/อินเทอร์เน็ตช้า รอสักครู่แล้ว Check folder ใหม่ ถ้ายัง OFF ระบบจะใช้ AI แทน'],
        ['Check folder แจ้ง "not shared publicly"', 'ตั้งค่าแชร์โฟลเดอร์เป็น Anyone with the link'],
        ['VIN ในรายการผิด', 'เปิดรายการ → Correct VIN (ระบบกันไม่ให้ซ้ำกับรายการอื่น)'],
        ['ต้องการยกเลิกการแก้ไข', 'แก้ค่ากลับได้ด้วยปุ่มเดิม ประวัติทั้งหมดอยู่ใน History'],
        ['เพิ่ม PDF ภายหลัง', 'Import โฟลเดอร์เดิมซ้ำ ระบบนำเข้าเฉพาะไฟล์ใหม่/เปลี่ยน'],
      ]],
      ['h', 'ข้อจำกัดของแผนฟรี Cloudflare (รีเซ็ต 00:00 UTC = 07:00 น. ไทย)'],
      ['ul', [
        'ฐานข้อมูล D1: อ่านได้ 5 ล้านแถวต่อวัน',
        'Workers: เวลาประมวลผลสั้นต่อคำขอ',
        'Workers AI: 10,000 neurons ต่อวัน',
        'แผน Workers Paid ($5/เดือน) ขยายขีดจำกัดทั้งหมด',
      ]],
    ],
  },
];

// ---------- renderers ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inlineHtml = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
const inlineMd = (s) => String(s).replace(/\|/g, '\\|');

export function manualHtml() {
  const toc = MANUAL.map((s) => `<a href="#m-${s.id}" data-manual-link="${s.id}">${esc(s.title)}</a>`).join('');
  const body = MANUAL.map((s) => `<section class="manual-sec" id="m-${s.id}"><h2>${esc(s.title)}</h2>${s.blocks.map((b) => {
    const [t, a, c] = b;
    if (t === 'h') return `<h3>${inlineHtml(a)}</h3>`;
    if (t === 'p') return `<p>${inlineHtml(a)}</p>`;
    if (t === 'ul') return `<ul>${a.map((x) => `<li>${inlineHtml(x)}</li>`).join('')}</ul>`;
    if (t === 'ol') return `<ol>${a.map((x) => `<li>${inlineHtml(x)}</li>`).join('')}</ol>`;
    if (t === 'note') return `<div class="manual-note">ℹ️ ${inlineHtml(a)}</div>`;
    if (t === 'tip') return `<div class="manual-tip">💡 ${inlineHtml(a)}</div>`;
    if (t === 'table') return `<table class="manual-table"><thead><tr>${a.map((h) => `<th>${inlineHtml(h)}</th>`).join('')}</tr></thead><tbody>${c.map((r) => `<tr>${r.map((x) => `<td>${inlineHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    return '';
  }).join('')}</section>`).join('');
  return { toc, body };
}

export function manualMarkdown() {
  const out = [`# ${MANUAL_TITLE}`, '', '> ไฟล์นี้สร้างจาก `public/lib/manual-th.js` (เนื้อหาเดียวกับเมนู "คู่มือ" ในแอป) ด้วยคำสั่ง `node scripts/build-manual.mjs`', '', '## สารบัญ', ''];
  // Same rule as GitHub's heading anchors (github-slugger): keep letters, marks, numbers, "_" "-" and spaces; space → "-".
  const slug = (t) => t.toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '').replace(/ /g, '-');
  for (const s of MANUAL) out.push(`- [${s.title}](#${slug(s.title)})`);
  out.push('');
  for (const s of MANUAL) {
    out.push(`## ${s.title}`, '');
    for (const [t, a, c] of s.blocks) {
      if (t === 'h') out.push(`### ${a}`, '');
      else if (t === 'p') out.push(a, '');
      else if (t === 'ul') out.push(...a.map((x) => `- ${x}`), '');
      else if (t === 'ol') out.push(...a.map((x, i) => `${i + 1}. ${x}`), '');
      else if (t === 'note') out.push(`> ℹ️ ${a}`, '');
      else if (t === 'tip') out.push(`> 💡 ${a}`, '');
      else if (t === 'table') {
        out.push(`| ${a.map(inlineMd).join(' | ')} |`, `|${a.map(() => '---').join('|')}|`, ...c.map((r) => `| ${r.map(inlineMd).join(' | ')} |`), '');
      }
    }
  }
  return out.join('\n');
}
