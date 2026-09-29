# คู่มือการใช้งาน — Wall Box Installation Records (Xpeng Thailand)

> ไฟล์นี้สร้างจาก `public/lib/manual-th.js` (เนื้อหาเดียวกับเมนู "คู่มือ" ในแอป) ด้วยคำสั่ง `node scripts/build-manual.mjs`

## สารบัญ

- [1. ภาพรวมระบบ](#1-ภาพรวมระบบ)
- [2. ขั้นตอนทำงานประจำเดือน (สรุป)](#2-ขั้นตอนทำงานประจำเดือน-สรุป)
- [3. การเข้าสู่ระบบและหน้าจอทั่วไป](#3-การเข้าสู่ระบบและหน้าจอทั่วไป)
- [4. Dashboard](#4-dashboard)
- [5. ① Excel Check — งานหลัก: แถว Excel ↔ PDF ในโฟลเดอร์](#5-①-excel-check--งานหลัก-แถว-excel--pdf-ในโฟลเดอร์)
- [6. ② Issues — ปัญหาที่ต้องแก้หรืออนุมัติ](#6-②-issues--ปัญหาที่ต้องแก้หรืออนุมัติ)
- [7. PDF Data — ข้อมูลที่ถอดจาก PDF (ข้อมูลสนับสนุน)](#7-pdf-data--ข้อมูลที่ถอดจาก-pdf-ข้อมูลสนับสนุน)
- [8. Months & Import — นำเข้าเดือนและจัดการเดือน](#8-months--import--นำเข้าเดือนและจัดการเดือน)
- [9. รายงาน Excel (รายละเอียดทุกไฟล์และทุกคอลัมน์)](#9-รายงาน-excel-รายละเอียดทุกไฟล์และทุกคอลัมน์)
- [10. คำศัพท์](#10-คำศัพท์)
- [11. คำถามที่พบบ่อยและการแก้ปัญหา](#11-คำถามที่พบบ่อยและการแก้ปัญหา)

## 1. ภาพรวมระบบ

ระบบนี้ใช้ตรวจสอบงานติดตั้งเครื่องชาร์จรถยนต์ไฟฟ้า (Wall Box) ประจำเดือน **หลักการ: ไฟล์ Excel สรุปงานติดตั้งของแต่ละเดือนคือข้อมูลฐาน (baseline)** แล้วใช้ไฟล์ **PDF** ในโฟลเดอร์ Google Drive ของเดือนนั้น (1 ไฟล์ = 1 งานติดตั้ง) เป็น**หลักฐาน**ว่าตรงกับ Excel หรือไม่ ถ้าไม่ตรง มีปัญหาอะไร

| ลำดับงาน | เมนู | ทำอะไร |
|---|---|---|
| 1. นำเข้า | **Months & Import** | อ่านโฟลเดอร์ของเดือน: ไฟล์ Excel + ไฟล์ PDF ทั้งหมด |
| งานย่อย | **PDF Data** | ถอดข้อมูลจาก PDF แต่ละไฟล์ (หน้า 1): VIN ในชื่อไฟล์, VIN ในรูปถ่าย, VIN ในช่องกระดาษ, วันที่, ชื่อลูกค้า ฯลฯ |
| 2. ตรวจ ★ (งานหลัก) | **① Excel Check** | ทุกแถวใน Excel → หา PDF ในโฟลเดอร์ → หลักฐาน (รูป VIN) ตรงกับ Excel หรือไม่ |
| 3. แก้ไข | **② Issues** | ทุกอย่างที่ทำให้แถว Excel ยังไม่ Complete และปัญหาอื่น → แก้ไขหรืออนุมัติ |
| 4. รายงาน | ปุ่ม Export | ส่งออก Excel: Summary · Excel Check · Issues · PDF Data |

หลักสำคัญ: **VIN ใน Excel (คอลัมน์ H) คือคีย์หลัก** ระบบหา PDF ที่**ชื่อไฟล์**มี VIN นี้ในโฟลเดอร์เดียวกัน แล้วใช้**รูปถ่าย VIN** เป็นหลักฐาน ส่วน**ช่อง VIN บนกระดาษ**มีความสำคัญรอง (มักพิมพ์ผิด) · ชื่อลูกค้าและวันที่ตรวจด้วยแต่ความสำคัญต่ำ

### สถานะของแถว Excel

| สถานะ | ความหมาย |
|---|---|
| **Complete** (เขียว) | พบ PDF และรูปถ่ายยืนยัน VIN · มี 2 แบบ: ครบทั้งรูปและกระดาษ หรือ **Complete · paper differs** (ช่องกระดาษต่าง เป็นเพียงหมายเหตุ) · แยกว่าทำโดย **App (auto)** หรือ **Admin** |
| **Photo not confirmed** (แดง) | พบ PDF แต่รูป VIN อ่านไม่ได้หรือเป็น VIN อื่น → เปิด PDF แล้วยืนยัน |
| **No PDF** (แดง) | ไม่มี PDF ในโฟลเดอร์ที่ชื่อไฟล์มี VIN นี้ |
| **⚠ No valid VIN** (แดงทั้งแถว) | ช่อง VIN ใน Excel ว่าง/เป็นข้อความ/ผิดรูปแบบ → อนุมัติ VIN หรือแก้ Excel |

ข้อมูลทุกเดือนถูกเก็บในฐานข้อมูล นำเข้าเดือนใหม่ได้เรื่อย ๆ และส่งออกเป็น Excel ได้ทุกเมื่อ

### เมนู

| เมนู | ใช้ทำอะไร |
|---|---|
| Dashboard | ภาพรวม: ผล Excel Check ของทุกเดือน (Complete / Needs attention), Issues, วันที่ผิดเดือน และข้อมูล PDF |
| **① Excel Check** ★ | งานหลัก — 1 บรรทัดต่อ 1 แถวใน Excel (จำนวนเท่ากับ Excel) พร้อมสถานะและการอนุมัติ |
| **② Issues** | รายการปัญหาที่ต้องแก้/อนุมัติ: จาก Excel Check, ฝั่ง Excel (A) และฝั่ง PDF (B) |
| PDF Data (ขวา) | ข้อมูลที่ถอดจาก PDF ทุกไฟล์ + ผลตรวจ VIN ของ PDF (ข้อมูลสนับสนุน) |
| Months & Import (ขวา) | นำเข้าเดือนใหม่ และจัดการเดือนที่นำเข้าแล้ว |
| คู่มือ | หน้านี้ |

## 2. ขั้นตอนทำงานประจำเดือน (สรุป)

1. **Months & Import**: วาง URL โฟลเดอร์ Google Drive ของเดือน กด **Check folder** แล้วกด **Start import** (ถ้าติดโควต้า AI ให้ทำต่อหลัง 07:00 น.) — เสร็จแล้วระบบเปิด **Import summary**
2. **① Excel Check** เลือกเดือน ดูตัวเลข **Complete** และ **Needs attention**
3. ชิป **Photo not confirmed** → คลิกแถว เปิด PDF ตรวจรูป แล้วกด **✔ Photo & paper show this VIN** / **✔ Photo shows this VIN** หรือ **Correct VIN**
4. ชิป **⚠ No valid VIN** → คลิกแถว ตรวจ PDF ที่ระบบแนะนำ แล้ว **Approve** พร้อม Remark
5. ชิป **No PDF** / **PDF not in Excel** → ดูหมายเหตุ (ชื่อไฟล์พิมพ์ผิด / อยู่เดือนอื่น) แล้วแจ้งผู้รับเหมาหรือแก้ Excel
6. **② Issues** ตรวจปัญหาฝั่ง Excel (A) และฝั่ง PDF (B): PDF ที่อาจถูกแก้ไข, VIN ซ้ำ, หน้าสแกน, วันที่ผิดเดือน ฯลฯ
7. ส่งออก Excel: **Full report** (Dashboard / Months ⬇ / PDF Data) หรือ **Export Excel Check** / **Export PDF Data** / **Export detailed Excel** (Issues)

> 💡 ถ้าเพิ่ม/แก้ไฟล์ PDF หรือ Excel ใน Drive ภายหลัง ให้ **Re-check** เดือนนั้น ระบบอ่านเฉพาะไฟล์ใหม่/ที่เปลี่ยน อ่าน Excel ใหม่ และไม่ลบงานตรวจ/การอนุมัติของผู้ดูแล

## 3. การเข้าสู่ระบบและหน้าจอทั่วไป

- เปิด **https://wallbox.anotai.net** ใส่รหัสผ่านผู้ดูแล จะอยู่ในระบบได้ 7 วัน กด **Sign out** มุมขวาบนเพื่อออก
- ใส่รหัสผ่านผิด 8 ครั้งใน 15 นาที ระบบจะล็อกเครือข่ายนั้น 15 นาที
- แถบเมนู: ซ้าย = ลำดับงานหลัก (Dashboard · ① Excel Check · ② Issues) · ขวา = ข้อมูลสนับสนุน (PDF Data · Months & Import · คู่มือ)
- ปุ่ม ☀/🌙 มุมขวาบน สลับธีมมืด/สว่าง
- ด้านล่างสุดแสดงเวอร์ชันแอปและเลข GitHub (เช่น `main@4d98e3b`) ใช้ตรวจว่าเว็บเป็นเวอร์ชันล่าสุด
- ถ้ามีแถบ "A new version of the app is available" ให้กด **Refresh**
- ถ้าหน้าจอค้างหรือแสดง "Something went wrong" ให้กด **Ctrl+Shift+R** (โหลดใหม่ทั้งหมด)

## 4. Dashboard

หน้าภาพรวมของทุกเดือนที่นำเข้า เรียงตามความสำคัญ

| ส่วน | ความหมาย |
|---|---|
| **① Excel Check** (กล่องบน) | **Excel rows** (จำนวนแถว Excel ทั้งหมด) · **Complete** (% และแยก by the app / admin / paper differs) · **Needs attention** · แถบความคืบหน้า |
| 3 กล่องสาเหตุ | **Photo not confirmed** · **No PDF** · **⚠ No valid VIN** — คลิกเพื่อเปิดรายการใน Excel Check · ลิงก์ "PDFs are not in any Excel" |
| **⚠ Installation date** (กล่องแดง) | จำนวน PDF ที่วันที่ติดตั้งไม่อยู่ในเดือนของโฟลเดอร์ และที่อ่านวันที่ไม่ได้ (ดูหัวข้อ 4.1) |
| **② Issues** | จำนวนปัญหาที่ยังเปิดอยู่ (เท่ากับตัวเลขบนเมนู) |
| PDF Data | ผลตรวจ VIN ของ PDF: All 3 match / Paper differs / Photo not confirmed (ข้อมูลสนับสนุน) คลิกเพื่อเปิด PDF Data |
| Imported months | การ์ดแต่ละเดือน: **Excel rows · Complete · Needs attention · Issues · Date ≠ month**, % Complete และปุ่ม Summary / Excel Check / Issues / PDF Data / Excel |
| Installations by install date | กราฟจำนวนงานตามเดือนที่ติดตั้ง |

### 4.1 กฎวันที่ติดตั้ง — ต้องอยู่ในเดือนของโฟลเดอร์

วันที่ติดตั้งเป็นข้อมูลสำคัญสำหรับการเบิกจ่าย ทุกงานในโฟลเดอร์ของเดือนใดต้องมีวันที่ติดตั้ง**อยู่ในเดือนนั้น** เช่น โฟลเดอร์ 2026-06 ต้องเป็นวันที่ 1–30 มิ.ย. 2026 ระบบตรวจทั้งวันที่ใน **PDF** และใน **Excel**

| ปัญหา | ฝั่ง | แสดงที่ | ต้องทำอะไร |
|---|---|---|---|
| **Date not in folder month** | PDF | Dashboard, PDF Data (ตัวกรอง Install date / คอลัมน์ Installed สีแดง), Issues (B), หน้าต่างรายละเอียด (แถบแดง) | เปิด PDF ตรวจวันที่ ถ้าอ่านผิดกด **Edit date** ถ้าวันที่ถูกจริง ติดต่อผู้รับเหมา หรือกด **Confirm date** เพื่อยอมรับ |
| **No installation date** | PDF | เหมือนข้างบน | เปิด PDF แล้วกด **Edit date** ใส่วันที่ที่ถูกต้อง |
| **Excel date not in folder month** | Excel | Excel Check (ชิป ⚠ และวันที่สีแดง), Issues (A) | แก้วันที่ในไฟล์ Excel หรือย้ายแถวไปเดือนที่ถูกต้อง |

> ℹ️ วันที่ที่ผู้ดูแลกด **Confirm date** หรือ **Edit date** แล้ว จะไม่ถูกแจ้งซ้ำ และบันทึกใน History · วันที่นอกเดือนลดความมั่นใจของวันที่ลง 25% และทำให้รายการอยู่ใน **Needs review**

## 5. ① Excel Check — งานหลัก: แถว Excel ↔ PDF ในโฟลเดอร์

ไฟล์ **Excel สรุปงานติดตั้งในโฟลเดอร์ของเดือน** (ชีตติดตั้ง) เป็นข้อมูลฐาน 1 แถว = 1 VIN (**VIN คอลัมน์ H เป็นคีย์หลัก**) ระบบเก็บ**ทุกแถวที่มีเลขในคอลัมน์ ลำดับ** จึงมีจำนวนแถว**เท่ากับ Excel** เสมอ (แถวหมายเหตุ/แพคเกจใต้ตารางไม่นับ) แล้วตรวจแต่ละแถวตามลำดับความสำคัญ:

1. **หา PDF ในโฟลเดอร์เดียวกัน** ที่**ชื่อไฟล์**มี VIN เดียวกัน → **Found PDF file** (ชื่อไฟล์ + ลิงก์) ถ้าไม่พบ = **No PDF**
2. ใน PDF ที่พบ ตรวจ **VIN ในรูปถ่าย** (หลักฐาน) และ **VIN ในช่องกระดาษ** (รอง)
3. **ชื่อลูกค้า** (คอลัมน์ D) และ **วันที่ติดตั้ง** — เทียบด้วยแต่ความสำคัญต่ำ · Case number แสดงเพื่อข้อมูล ไม่คิดคะแนน

### สถานะ (Result)

| สถานะ | ความหมาย | ต้องทำอะไร |
|---|---|---|
| **Complete** (เขียว) | พบ PDF · รูป ✔ · ช่องกระดาษ ✔ | ไม่ต้องทำอะไร |
| **Complete · paper differs** (เขียว) | พบ PDF · รูป ✔ · ช่องกระดาษต่าง/อ่านไม่ได้ — นับเป็น Complete (ช่องกระดาษเป็นเพียงหมายเหตุ) | แจ้งช่างแก้แบบฟอร์มถ้าจำเป็น หรือกด **Paper box shows this VIN** |
| **Photo not confirmed** (แดง) | พบ PDF แต่รูปอ่านไม่ได้หรือเป็น VIN อื่น | คลิกแถว → Open PDF ดูรูป → **✔ Photo & paper show this VIN** / **✔ Photo shows this VIN** หรือ **Correct VIN** |
| **No PDF** (แดง) | ไม่มี PDF ที่ชื่อไฟล์มี VIN นี้ในโฟลเดอร์ | ดูหมายเหตุใต้ข้อความ: พบ VIN นี้ใน**รูป/ช่องกระดาษ**ของ PDF อื่น (ชื่อไฟล์พิมพ์ผิด) หรือ PDF อยู่ใน**โฟลเดอร์เดือนอื่น** · ถ้าไม่มีเลย ขอ PDF จากผู้รับเหมา |
| **⚠ No valid VIN** (แดงทั้งแถว) | ช่อง VIN ใน Excel ว่าง, เป็นข้อความ (เช่น "ติดตั้งก่อนรับรถ") หรือ VIN ผิดรูปแบบ | **คลิกแถว** → อนุมัติ VIN (ดูหัวข้อ 5.1) หรือแก้ Excel แล้ว Re-check |
| PDF not in Excel (ชิป) | PDF ในโฟลเดอร์ที่ไม่มีแถวใน Excel | ตรวจว่าลืมใส่ใน Excel หรือ VIN ใน Excel พิมพ์ผิด |

### % match (รวม 100)

| รายการ | คะแนน |
|---|---|
| VIN ในชื่อไฟล์ (พบ PDF) | 40 |
| VIN ในรูปถ่าย | 30 |
| VIN ในช่องกระดาษ | 15 |
| ชื่อลูกค้า (ตามความเหมือน %; ชื่อที่ผู้ดูแลยืนยันแล้วได้เต็ม) | 10 |
| วันที่ติดตั้ง: ตรงกัน 5 · ต่างไม่เกิน 3 วัน 2.5 | 5 |

การเทียบชื่อ: ไม่สนใจคำนำหน้า (คุณ/นาย/นาง/นางสาว/น.ส.), เว้นวรรค, เครื่องหมาย, วรรณยุกต์ที่หายไป, "บ." = "บริษัท" และเทียบชื่อบุคคล/บริษัททีละส่วน

### 5.1 อนุมัติ VIN ให้แถว Excel ที่ไม่มี VIN (Admin approve)

1. Excel Check → ชิป **⚠ No valid VIN** → คลิกแถว
2. หน้าต่างสรุปแสดงข้อมูลแถว Excel (ช่อง VIN, ลูกค้า, Case no., วันที่, ปัญหา) และ **Suggested PDF** (ชื่อลูกค้าเหมือนกัน) พร้อม VIN ชื่อไฟล์ / รูป / กระดาษ — คลิกเปิด PDF ตรวจได้
3. ช่อง **VIN to use** ใส่ VIN ที่แนะนำให้แล้ว (แก้ได้) ต้องเป็น VIN ในชื่อไฟล์ของ PDF ในโฟลเดอร์เดือนเดียวกัน และไม่ซ้ำกับแถวอื่นใน Excel
4. เขียน **Remark** (บังคับ 3–500 ตัวอักษร) แล้วกด **✔ Approve (Complete)**
5. แถวเปลี่ยนเป็น **Complete (by admin)** 100% ทันทีทุกเมนูและทุกไฟล์ Excel · บันทึกใน **History** ของ PDF นั้น
6. การอนุมัติเก็บแยกไว้ จึง**คงอยู่หลัง Re-check** (ตราบใดที่แถวนั้นยังไม่มี VIN และชื่อลูกค้าเดิม) · ยกเลิกด้วยปุ่ม **Remove approval** ในหน้าต่างรายละเอียดของ PDF (ส่วน Excel Check)

### 5.2 Completed by — ใครทำให้ Complete

| ค่า | ความหมาย |
|---|---|
| **App (auto)** | ระบบตรวจเองว่ารูปถ่าย (และกระดาษ) ตรงกับ VIN ใน Excel |
| **Admin** | Complete เพราะผู้ดูแล: อนุมัติ VIN ให้แถว Excel ที่ไม่มี VIN หรือยืนยัน VIN รูป/กระดาษ — ดูเหตุผลที่ **Admin remark** · บนหน้าจอมีป้าย **admin** และชิป **· by admin** |

### หน้าจอ

- ชิป: All (= จำนวนแถวใน Excel) · **Complete** · · paper differs · · by admin · **Needs attention** · Photo not confirmed · No PDF · ⚠ No valid VIN · PDF not in Excel · ⚠ Date not in folder month
- คอลัมน์: Month · Row · **VIN (key)** · **Found PDF file** (คลิกเปิด PDF) · **Photo VIN** (✔ หรือค่าที่อ่านได้ สีแดง) · **Paper VIN** (✔ หรือค่าที่อ่านได้ สีส้ม) · **Result** (+ ป้าย admin และ remark) · Customer · Install date · Name % · ลิงก์ Excel
- ถ้าชื่อหรือวันที่ต่าง จะแสดงค่าจาก PDF ใต้ค่าจาก Excel · วันที่สีแดง = ไม่อยู่ในเดือนของโฟลเดอร์
- คลิกแถว: เปิดหน้าต่างรายละเอียดของ PDF (หัวข้อ 7.1) หรือหน้าต่างอนุมัติ (แถว No valid VIN)
- ปุ่ม **Open <เดือน> Excel** เปิดไฟล์ Excel ใน Drive (เมื่อเลือกเดือน) · ปุ่ม **Export Excel Check** (หัวข้อ 9.2)

## 6. ② Issues — ปัญหาที่ต้องแก้หรืออนุมัติ

รวมทุกอย่างที่ทำให้แถว Excel ยังไม่ Complete และปัญหาอื่น แบ่งเป็น 3 ส่วน แต่ละการ์ดมีคำอธิบายและสิ่งที่ต้องทำ คลิกการ์ดเพื่อกรองรายการ ตัวเลขบนเมนู = ปัญหาที่ยังเปิดอยู่

### 1. From Excel Check

กล่องสรุป 4 กล่อง: **Photo not confirmed · No PDF · ⚠ No valid VIN · PDF not in Excel** — คลิกเพื่อไปทำงานต่อใน Excel Check

### A. ฝั่ง Excel (แก้ในไฟล์ Excel แล้ว Re-check หรืออนุมัติใน Excel Check)

| ปัญหา | ความหมาย | สิ่งที่ต้องทำ |
|---|---|---|
| ไม่มี VIN ใน Excel | ช่อง VIN (คอลัมน์ H) ว่างหรือเป็นข้อความ เช่น "ติดตั้งก่อนรับรถ" | ปุ่ม **Approve…** → Excel Check คลิกแถว อนุมัติ VIN ของ PDF ที่แนะนำพร้อม Remark · หรือใส่ VIN ในคอลัมน์ H แล้ว Re-check |
| VIN ใน Excel พิมพ์ผิด | VIN ไม่ถูกต้อง (จำนวนตัวอักษรผิด/พิมพ์ผิด) | เทียบกับ VIN ใน PDF ที่แนะนำ แล้วแก้คอลัมน์ H หรืออนุมัติ |
| PDF อยู่ใน Excel ของเดือนอื่น | PDF อยู่ในโฟลเดอร์เดือนนี้ แต่ VIN อยู่ใน Excel เดือนอื่น | ตรวจว่างานเป็นของเดือนไหน ย้าย PDF หรือแก้ Excel |
| วันที่ใน Excel ไม่อยู่ในเดือน | วันที่ติดตั้งใน Excel ไม่อยู่ในเดือนของโฟลเดอร์ | แก้วันที่ใน Excel หรือย้ายแถว |

### B. ฝั่ง PDF (แก้/Resolve ในแอป)

| ปัญหา | ความหมาย | สิ่งที่ต้องทำ |
|---|---|---|
| วันที่ไม่อยู่ในเดือน / ไม่มีวันที่ | วันที่ติดตั้งใน PDF อยู่เดือนอื่น หรืออ่านไม่ได้ | ปุ่ม **Edit date** / **Confirm date** ในตาราง |
| PDF อาจถูกแก้ไข | เลขงานหัวกระดาษไม่ตรงกับในตาราง หรือหัวตารางเป็นรูปภาพแล้วพิมพ์ทับ (นำรายงานเก่ามาแก้) | ตรวจเลขงานและรูปถ่ายว่าเป็นของลูกค้ารายนี้ ถ้าไม่แน่ใจขอรายงานต้นฉบับจากช่าง |
| VIN ซ้ำ | PDF 2 ไฟล์ใช้ VIN เดียวกัน ระบบเก็บไฟล์แรก | เปิดทั้งสองไฟล์: งานเดียวกัน → Resolve · ไฟล์ที่สองถูก → **Use this PDF** · VIN พิมพ์ผิด → แก้ VIN |
| หน้าสแกน | หน้าแรกเป็นรูปภาพ ข้อมูลทั้งหมดอ่านด้วย AI | ตรวจชื่อ วันที่ VIN เลขงาน แก้ถ้าผิด |
| รูปเครื่องชาร์จอยู่ในช่องรูป VIN | ช่องรูป VIN เป็นรูปฉลากเครื่องชาร์จ | หารูป VIN ในหน้าอื่น แล้วกด Photo shows this VIN หรือขอรูปจากช่าง |
| ยังอ่านไม่สำเร็จ | ติดโควต้า AI สแกนอ่านไม่ออก หรือดาวน์โหลดไม่สำเร็จ | Re-check เดือนเดิม (ติ๊ก Retry unread / failed) หลัง 07:00 น. |
| PDF ถูกอัปเดตใน Drive | ไฟล์ถูกแก้/อัปโหลดใหม่ ระบบอ่านใหม่แล้ว | ตรวจ VIN ชื่อ วันที่ อีกครั้ง แล้ว Resolve |

- ตาราง A: Problem · Month · Excel row · VIN in Excel · Customer · **Suggested PDF** · What to do · ปุ่ม **Approve…** · ลิงก์ Excel/PDF
- ตาราง B: Problem · Month · VIN · What happened · What to do · PDF · ปุ่ม **Resolve / Reopen** (และ **Use this PDF** สำหรับ VIN ซ้ำ) — ติ๊ก **Show resolved** เพื่อดูที่แก้แล้ว
- ปุ่ม **Export detailed Excel** (หัวข้อ 9.4)

## 7. PDF Data — ข้อมูลที่ถอดจาก PDF (ข้อมูลสนับสนุน)

งานย่อยของระบบ: รายการ PDF ทุกไฟล์พร้อมข้อมูลที่ถอดได้จากหน้า 1 และ**ผลตรวจ VIN ของ PDF** — VIN ใน**ชื่อไฟล์** ↔ VIN ใน**รูปถ่าย** ↔ VIN ใน**ช่องกระดาษ** ใช้ค้นหา ตรวจทาน และยืนยัน/แก้ไข

| แหล่ง VIN | ความสำคัญ | ตัวอย่าง |
|---|---|---|
| ชื่อไฟล์ PDF | ใช้จับคู่กับ Excel (เป็น VIN หลักของรายการ PDF) | `L1NNSGHAXTB222327 มยุรี มีทรัพย์.pdf` |
| รูปถ่าย VIN (หน้า 1) | หลักฐาน — ต้องยืนยันชื่อไฟล์ | อ่านด้วยตัวอ่านฟรีในเครื่อง ถ้าไม่ชัดจึงใช้ AI |
| ช่อง "หมายเลขตัวถัง (VinNo.)" บนกระดาษ | รอง | มักพิมพ์ผิดแบบ OCR เช่น `AK` แทน `AX` |

### ผลตรวจ VIN ของ PDF (VIN check)

| ผล | ความหมาย | ต้องทำอะไร |
|---|---|---|
| **All 3 match** (เขียว) | ชื่อไฟล์ = รูปถ่าย = ช่องกระดาษ | ไม่ต้องทำอะไร |
| **Paper differs** (ส้ม) | รูปยืนยันชื่อไฟล์ แต่ช่องกระดาษต่าง (พิมพ์ผิด/อ่านไม่ได้) | โดยทั่วไป VIN ถูกต้อง แจ้งช่างแก้แบบฟอร์มถ้าจำเป็น |
| **Photo not confirmed** (แดง) | รูปไม่ยืนยันชื่อไฟล์: อ่านได้ค่าอื่น, อ่านไม่ออก หรือเป็นรูปเครื่องชาร์จ | เปิด PDF ตรวจรูป แล้วยืนยันหรือ **Correct VIN** |

### หน้าจอ

- ชิป **All / All 3 match / Paper differs / Photo not confirmed** กรองตามผลตรวจ VIN
- **Search**: ค้นหา VIN ชื่อ เลขงาน Serial เบอร์โทร
- ตัวกรอง: Month, **Confidence** (All / **Needs review** / 100% only), Install date, PDF file (Updated/Deleted), **Excel Check**, **VIN check**, ช่วงวันที่ติดตั้ง
- คอลัมน์: Month · VIN (file name) · VIN check · Excel Check · Photo VIN · Paper VIN · Installed · Date % · Job number · Customer · Serial · PDF
- **Needs review** = คิวงาน: Photo not confirmed, Excel Check ยังไม่ Complete / ไม่อยู่ใน Excel, หรือวันที่ต่ำกว่า 95%
- ปุ่ม **Export PDF Data** (หัวข้อ 9.3) และ **Full report** (หัวข้อ 9.1)

> ℹ️ ตัวอ่านรูปฟรี (PaddleOCR) ทำงานในเครื่องของผู้ใช้ ยืนยันได้ประมาณ 80% ของรูป ส่วนที่เหลือใช้ AI ของ Cloudflare ซึ่งมีโควต้าฟรีวันละ 10,000 neurons

### 7.1 หน้าต่างรายละเอียด (คลิกแถวใดก็ได้ ใน PDF Data หรือ Excel Check)

| ส่วน | รายละเอียด / ปุ่ม |
|---|---|
| หัว | ป้าย**เดือน** (เน้นสี), ชื่อลูกค้า, VIN; ถ้า VIN อยู่ใน Excel เดือนอื่นจะมีป้ายเตือน |
| Open PDF | เปิดไฟล์ PDF ใน Drive เพื่อตรวจ |
| VIN check | VIN ชื่อไฟล์ / รูป / ช่องกระดาษ พร้อม ✔✘ และเหตุผล · ปุ่ม: **✔ Photo & paper show this VIN** · **✔ Photo shows this VIN** · **✔ Paper box shows this VIN** (แสดงเฉพาะปุ่มที่ต้องใช้) · **Correct VIN** (แก้ VIN — ห้ามซ้ำกับรายการอื่น) |
| ป้าย **admin** | ค่าที่ผู้ดูแลยืนยันแล้ว ระบบถือว่าตรงกับ VIN ในชื่อไฟล์ และอัปเดตผลทุกที่ทันที (เช่น Photo not confirmed → Complete) ทุกเมนูและทุกไฟล์ Excel · ค่าที่อ่านได้เดิมยังแสดงอยู่ และบันทึกใน **History** |
| Excel Check | แถว Excel (ชีตและเลขแถว), VIN (ชื่อไฟล์/รูป/กระดาษ), ชื่อ %, Case no., วันที่ พร้อม ✔✘ · ถ้าอนุมัติ VIN แล้ว: remark และปุ่ม **Remove approval** · ปุ่ม **Open Excel** · **Name is correct** · **Edit name** |
| Installation date | วันที่และข้อความจาก PDF, % และเหตุผล · ปุ่ม **Confirm date** · **Edit date** |
| History | ประวัติการยืนยัน/แก้ไข/อนุมัติทั้งหมด (ค่าเดิม → ค่าใหม่, เวลา, IP) และเหตุการณ์ไฟล์ (อัปเดต/ลบใน Drive) |
| รายละเอียดอื่น | เลขงาน, รหัสลูกค้า/PO, เบอร์, ภูมิภาค, ลักษณะสถานที่, Serial, วันพิมพ์รายงาน, Job URL, หมายเหตุ |

> 💡 ในโหมด Needs review เมื่อยืนยัน/แก้ไขเสร็จ ระบบจะเปิดรายการถัดไปให้อัตโนมัติ

> ℹ️ ค่าที่ผู้ดูแลยืนยัน แก้ไข หรืออนุมัติ จะไม่ถูกเขียนทับเมื่อ Re-check และบันทึกไว้ใน History เสมอ

## 8. Months & Import — นำเข้าเดือนและจัดการเดือน

### นำเข้าเดือนใหม่

1. ตั้งค่าโฟลเดอร์ Google Drive ให้แชร์แบบ **Anyone with the link** (ทุกคนที่มีลิงก์ดูได้)
2. วาง URL โฟลเดอร์ในช่อง **Google Drive folder URL** กด **Check folder**
3. ระบบแสดง: ชื่อโฟลเดอร์, จำนวน PDF, ไฟล์ Excel อ้างอิง, เดือน (แก้ได้) และสถานะตัวอ่าน VIN ฟรี
4. ตั้งค่าตัวเลือก แล้วกด **Start import** ห้ามปิดหน้าเว็บระหว่างนำเข้า (สลับเมนูได้)

| ตัวเลือก | ความหมาย |
|---|---|
| Read VIN photo with AI | อ่านรูป VIN (ตัวอ่านฟรีก่อน แล้วใช้ AI เฉพาะรูปที่ไม่ชัด) — ควรเปิดไว้ |
| Retry unread / failed files | อ่านไฟล์ที่ค้าง (เช่น ติดโควต้า AI) ซ้ำ — ควรเปิดไว้ |
| Re-read VIN photos that are not matched (N files) | แสดงเมื่อเดือนนั้นมี PDF ที่รูปยังไม่ยืนยัน (Photo not confirmed) และผู้ดูแลยังไม่ยืนยัน: อ่านรูป VIN ใหม่เฉพาะไฟล์เหล่านี้ ด้วยตัวอ่านฟรีก่อน ใช้ AI เฉพาะที่ยังยืนยันไม่ได้ ไม่รวมหน้าสแกน ใช้เวลาไม่กี่นาที เก็บงานตรวจของผู้ดูแลไว้ |
| Re-process all files | อ่านทุกไฟล์ใหม่ทั้งหมด (ใช้เมื่อจำเป็นเท่านั้น งานตรวจของผู้ดูแลยังอยู่) |
| Test run — only first N files | ทดลองกับ N ไฟล์แรก (0 = ทั้งหมด) |

### นำเข้าโฟลเดอร์เดิมซ้ำ (Re-check)

เมื่อ Check folder ที่เคยนำเข้าแล้ว ระบบแสดง "Since the last import":

| สถานะ | ความหมาย | สิ่งที่ระบบทำ |
|---|---|---|
| new | PDF ใหม่ | นำเข้า |
| updated | PDF ชื่อเดิมแต่วันที่แก้ไขใหม่กว่า หรืออัปโหลดใหม่ | อ่านใหม่ เก็บงานตรวจของผู้ดูแลไว้ ทำเครื่องหมาย "Updated" |
| deleted | PDF ที่ไม่อยู่ในโฟลเดอร์แล้ว | เก็บข้อมูลไว้ ทำเครื่องหมาย "Deleted" |
| unchanged | ไม่เปลี่ยน | ข้าม |

ทุกครั้งที่นำเข้าซ้ำ ระบบอ่าน Excel ของเดือนใหม่ (ใช้ไฟล์เดิมที่เคยนำเข้า ถ้ามีหลายไฟล์) แล้วคำนวณ Excel Check, วันที่ และ Issues ใหม่ ข้อมูลที่ผู้ดูแลยืนยัน/แก้ไข/อนุมัติ และ History ยังอยู่ครบ

### ควรติ๊กช่องไหน (นำเข้าซ้ำ)

| ต้องการ | Read VIN photo with AI | Retry unread / failed | Re-read not matched | Re-process all |
|---|---|---|---|---|
| เพิ่ม PDF ใหม่ / ไฟล์ที่อัปเดต / อ่าน Excel ใหม่ | ✅ | ✅ | ⬜ | ⬜ |
| อ่านไฟล์ที่ค้างเพราะโควต้า AI หมด | ✅ | ✅ | ⬜ | ⬜ |
| อ่านรูป VIN ที่ยังไม่ยืนยันใหม่ด้วยตัวอ่านฟรี (เช่น มิ.ย. 2026 ที่อ่านด้วย AI ครั้งแรก) | ✅ | ✅ | ✅ | ⬜ |
| อ่านทุกไฟล์ใหม่ (เช่น วันที่อ่านไม่ได้จำนวนมากจากการนำเข้าเก่า — พ.ค. 2026) | ✅ | — | — | ✅ |

> 💡 เริ่มนำเข้าหลัง 07:00 น. (เวลาที่โควต้า AI ฟรีรีเซ็ต) และช่อง Test run ให้เป็น 0

> ℹ️ ถ้าโฟลเดอร์มี Excel มากกว่า 1 ไฟล์ ระบบใช้ไฟล์เดิมที่เคยนำเข้าเดือนนั้น และแสดงข้อความแจ้ง

### ระหว่างนำเข้า

- แถบความคืบหน้า และตัวนับ: Processed, Saved, Duplicates, Issues, Errors, MB downloaded พร้อมเวลาที่เหลือ
- บันทึก (log) แสดงผลแต่ละไฟล์
- ถ้าโควต้า AI ฟรีหมด ระบบอ่านต่อเฉพาะส่วนที่ไม่ต้องใช้ AI และเก็บไฟล์ที่เหลือไว้ให้รอบถัดไป (หลัง 07:00 น.)
- เสร็จแล้วเปิด **Import summary** อัตโนมัติ และมีปุ่ม Excel Check / Issues / PDF Data

### Import summary (สรุปผลของเดือน)

- PDFs in folder, Processed, Scanned pages, Last run
- **Excel rows** · Complete · Photo not confirmed · No PDF · No valid VIN (คลิกเพื่อเปิด Excel Check)
- PDF VIN: All 3 match / Paper differs / Photo not confirmed · VIN photo not read — AI quota · Files failed · Duplicate VIN
- PDF files (Updated/Deleted), VIN photos read by (Free/AI)

### Imported months (ตารางด้านล่าง)

| คอลัมน์ / ปุ่ม | ความหมาย |
|---|---|
| Month | แก้เดือนได้โดยตรง |
| Folder | ลิงก์โฟลเดอร์ Drive |
| PDFs / Processed / Records / VIN ✘ / Problems | จำนวนต่าง ๆ ของเดือน |
| Excel | จำนวนแถว Excel ที่มี PDF / ทั้งหมด และลิงก์เปิด Excel |
| Summary | เปิดสรุปผลของเดือน |
| Resume / Re-check | เปิดหน้า Import พร้อม URL โฟลเดอร์ของเดือนนั้น และกด Check folder ให้อัตโนมัติ (ยังไม่เปลี่ยนข้อมูล) — แสดงไฟล์ new / updated / deleted แล้วเลือกตัวเลือกและกด **Start import** · Resume = ยังนำเข้าไม่เสร็จ, Re-check = เสร็จแล้ว |
| ⬇ | ส่งออก Full report ของเดือน |
| Delete | ลบเดือนและข้อมูลทั้งหมดของเดือน (ต้องพิมพ์ DELETE ยืนยัน — ย้อนกลับไม่ได้) |

## 9. รายงาน Excel (รายละเอียดทุกไฟล์และทุกคอลัมน์)

| ปุ่ม (อยู่ที่หน้า) | ชื่อไฟล์ | ชีตในไฟล์ (ตามลำดับ) |
|---|---|---|
| **Full report** (PDF Data) / ⬇ (Dashboard, Months) | `wallbox_report_<เดือน>_<วันที่>.xlsx` | **Summary · Excel Check · Issues · PDF Data** |
| Export Excel Check (Excel Check) | `wallbox_excel-check_…` | Summary · Excel Check |
| Export PDF Data (PDF Data) | `wallbox_pdf-data_…` | Summary · PDF Data |
| Export detailed Excel (Issues) | `wallbox_issues_…` | Read me · All problems · ชีตตามประเภทปัญหา · ⚠ Install date · Excel side problems |

ถ้าเลือกเดือนก่อนกดส่งออก จะได้เฉพาะเดือนนั้น ถ้าไม่เลือก (All months) จะได้ทุกเดือน ทุกชีตมีแถวหัวตารางตรึงไว้และตัวกรอง (Filter)

### ความหมายของสี

| สี | ความหมาย |
|---|---|
| เขียว | Complete / ตรง / ผ่าน |
| ส้ม | ควรตรวจ (ช่องกระดาษต่าง, ชื่อ/วันที่ต่าง, Needs review, Updated, ปัญหาฝั่ง Excel) |
| แดง | ต้องแก้ (Photo not confirmed, No PDF, No valid VIN ทั้งแถว, วันที่ผิดเดือน, Deleted) |
| ฟ้า | ผู้ดูแลยืนยัน/อนุมัติแล้ว (admin) · ปัญหาฝั่ง PDF ในชีต Issues |

### 9.1 ชีต Summary (ชีตแรก)

ส่วนแรก **EXCEL CHECK**: Excel rows · ✔ Complete (by the app / by admin / paper differs) · ✘ Needs attention (Photo not confirmed / No PDF / No valid VIN) · PDF not in Excel — ตามด้วยจำนวน PDF, วันที่ผิดเดือน/ไม่มีวันที่, ผลตรวจ VIN ของ PDF และจำนวน Issues ที่เปิดอยู่ (ฝั่ง Excel / ฝั่ง PDF)

### 9.2 ชีต Excel Check (1 แถว = 1 แถวใน Excel — จำนวนเท่ากับ Excel)

| คอลัมน์ | ความหมาย |
|---|---|
| Month · Excel sheet · Excel row | ตำแหน่งแถวใน Excel |
| VIN (Excel, key) | VIN จาก Excel คอลัมน์ H — คีย์หลัก (แถวที่อนุมัติแล้วแสดง VIN ที่อนุมัติ) |
| Result | Complete / Complete · paper differs (เขียว) · Photo not confirmed / No PDF (แดง) · **⚠ No valid VIN** (แดงทั้งแถว) · ถ้าทำโดยผู้ดูแล: "… (by admin)" |
| Found PDF file · PDF link | ชื่อไฟล์ PDF ในโฟลเดอร์เดียวกันที่ชื่อไฟล์มี VIN นี้ / ลิงก์ (แดงถ้าไม่พบ) · แถว No valid VIN: "Suggested: …" |
| VIN in photo · Photo = Excel VIN | VIN ที่อ่านจากรูป (สีฟ้า "→ ✔ admin confirmed" = ผู้ดูแลยืนยันแล้ว) / ✔✘ (แดงถ้าไม่ตรง) |
| VIN in paper box · Paper = Excel VIN | VIN ในช่องกระดาษ / ✔✘ (ส้มถ้าไม่ตรง) |
| Confirmed by admin | ช่องที่ผู้ดูแลยืนยันแล้ว: Excel VIN (row N), Photo VIN, Paper VIN, Install date, Customer name (สีฟ้า) |
| % match | ไฟล์ 40 + รูป 30 + กระดาษ 15 + ชื่อ 10 + วันที่ 5 |
| Completed by · Admin remark | แถว Complete: **App (auto)** หรือ **Admin** (สีฟ้า) พร้อมเหตุผล เช่น "Excel VIN cell "ติดตั้งก่อนรับรถ" → L1NN… approved by admin: <remark>" |
| Customer (Excel) · Customer (PDF) · Name % | ชื่อลูกค้าและความเหมือน (ความสำคัญต่ำ; ส้มถ้าต่ำกว่า 80%) |
| Install date (Excel) · Install date (PDF) · Date diff | วันที่ติดตั้งและจำนวนวันที่ต่างกัน (ความสำคัญต่ำ) |
| Excel date in folder month / PDF date in folder month | ✔ หรือ ✘ (แดง) วันที่อยู่ในเดือนของโฟลเดอร์หรือไม่ |
| Case no. (Excel) · Job no. (PDF) | เพื่อข้อมูล ไม่คิดคะแนน |
| Note | เมื่อไม่พบ PDF: บอกว่าพบ VIN นี้ในรูป/กระดาษของ PDF อื่น (ชื่อไฟล์ผิด) หรือ PDF อยู่ในเดือนอื่น · แถวไม่มี VIN: สาเหตุ และ PDF ที่ชื่อลูกค้าเหมือนกัน |

### 9.3 ชีต PDF Data (1 แถว = 1 ไฟล์ PDF)

| คอลัมน์ | ความหมาย |
|---|---|
| VIN (file name, key) | VIN จากชื่อไฟล์ PDF |
| VIN check (PDF) | 1 · All 3 match / 2 · Paper differs / 3 · Photo not confirmed |
| Excel Check / Excel Check % | สถานะของแถว Excel ที่จับคู่ (หรือ Not in Excel) และ % match |
| Photo VIN / Paper VIN | VIN ที่อ่านจากรูป / จากช่องกระดาษ (แดง/ส้มถ้าไม่ตรง) · ถ้าผู้ดูแลยืนยัน: "ค่าที่อ่านได้ → ✔ admin confirmed <VIN>" (สีฟ้า) |
| Confirmed by admin · Completed by · Admin remark | สิ่งที่ผู้ดูแลยืนยัน · App (auto) / Admin · เหตุผลการอนุมัติ VIN ของแถว Excel |
| Excel row / Excel name (col D) | ชีตและแถวใน Excel / ชื่อลูกค้าใน Excel |
| Installation date / Date in folder month / Date % | วันที่ติดตั้งจาก PDF / ✔ ✘ NO DATE / ความมั่นใจของวันที่ |
| Needs review | Yes = ควรตรวจ |
| VIN photo match / Read by | ✔✘ รูปตรงกับ VIN / อ่านด้วย free (ฟรี) หรือ ai |
| Month · Job number · Charger / PO code · Customer name · Phone · Region · Site type · Charger serial · Report printed at · Job URL | ข้อมูลจากแบบฟอร์มหน้า 1 |
| PDF file / PDF link / PDF file status | ชื่อไฟล์ / ลิงก์ / Updated หรือ Deleted พร้อมวันที่ |
| VIN — why / Date — why / Notes | เหตุผลของผลตรวจ VIN และวันที่ / หมายเหตุ รวมถึงการแก้ไขของผู้ดูแล |

### 9.4 ชีต Issues (ใน Full report) และไฟล์ Export detailed Excel

ชีต **Issues** ใน Full report: Side (Excel / PDF) · Type · VIN · Month · Detail · PDF file/link · Excel row · Resolved — รายการย่อ

| ชีตในไฟล์ detailed | เนื้อหา |
|---|---|
| Read me | วิธีใช้ไฟล์ (ไทย/อังกฤษ) และตารางอธิบายทุกปัญหา: ความหมาย, ผลกระทบ, สิ่งที่ต้องทำ, จำนวน Open/Resolved, Source (Excel side / PDF side) |
| All problems | ทุกปัญหา 1 แถวต่อปัญหา: Source · Problem · Status · Month · VIN · Customer · Job number · What happened · What to do · PDF file/link · Excel row/link · Found (UTC) |
| ⚠ Install date | ปัญหาวันที่ทั้งหมด (ฝั่ง PDF และฝั่ง Excel) พร้อมเดือนโฟลเดอร์, เดือนของวันที่ (แดง), วันที่ PDF/Excel, สิ่งที่ต้องทำ และลิงก์ |
| Edited PDF · Duplicate VIN · Scanned page · Charger photo · Not read yet · Updated in Drive | ชีตตามประเภทปัญหาฝั่ง PDF พร้อมคอลัมน์เฉพาะของแต่ละประเภท |
| Excel side problems | Problem · Month · Excel sheet/row · VIN cell in Excel · Customer · Case number · Suggested PDF VIN · How it was matched · Suggested PDF customer/link · What to do · Excel link |

## 10. คำศัพท์

| คำ | ความหมาย |
|---|---|
| VIN | หมายเลขตัวถังรถ 17 หลัก (ไม่มีตัว I, O, Q) ของ XPENG ขึ้นต้นด้วย L1NN |
| Baseline / Excel row | แถวในไฟล์ Excel สรุปงานติดตั้งของเดือน = ข้อมูลฐานที่ต้องตรวจ |
| Complete | แถว Excel ที่พบ PDF และรูปถ่ายยืนยัน VIN (โดย App หรือ Admin) |
| Needs attention | แถว Excel ที่ยังไม่ Complete: Photo not confirmed, No PDF, No valid VIN |
| Record / PDF | 1 รายการ PDF = 1 ไฟล์ PDF = 1 VIN |
| Batch / Month | 1 โฟลเดอร์ Drive = 1 เดือน |
| Free reader | ตัวอ่านรูปฟรี (PaddleOCR) ที่ทำงานในเครื่องผู้ใช้ |
| AI | Cloudflare Workers AI ใช้อ่านรูปที่ไม่ชัดและหน้าสแกน |
| admin | ค่าที่ผู้ดูแลยืนยัน/อนุมัติ (มีเหตุผลใน Admin remark และ History) |
| Needs review | รายการ PDF ที่ควรให้ผู้ดูแลตรวจ |
| Resolve | ทำเครื่องหมายว่าตรวจ/แก้ปัญหาแล้ว |
| temporary ID | รหัสชั่วคราวแทน VIN เช่น L1NNRM2…, L1NNRAT…, L1NNPKS… (ยังไม่มี VIN จริง) |

## 11. คำถามที่พบบ่อยและการแก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| หน้าจอแสดง "Something went wrong" หรือค้าง | กด Ctrl+Shift+R ถ้ายังเป็น อาจเกินโควต้าฟรีของ Cloudflare รอหลัง 07:00 น. หรือแจ้งผู้ดูแลระบบ |
| Import หยุด "allowance is used up" | โควต้า AI ฟรีวันละ 10,000 neurons หมด Re-check หลัง 07:00 น. (ไฟล์ที่ทำแล้วไม่ถูกอ่านซ้ำ) |
| Free VIN reader OFF | ไฟล์ตัวอ่านยังโหลดไม่เสร็จ/อินเทอร์เน็ตช้า รอสักครู่แล้ว Check folder ใหม่ ถ้ายัง OFF ระบบจะใช้ AI แทน |
| Check folder แจ้ง "not shared publicly" | ตั้งค่าแชร์โฟลเดอร์เป็น Anyone with the link |
| จำนวนแถวใน Excel Check ไม่เท่ากับ Excel | Re-check เดือนนั้นเพื่ออ่าน Excel ใหม่ (ระบบนับแถวที่มีเลขในคอลัมน์ ลำดับ) |
| VIN ในรายการผิด | เปิดรายการ → Correct VIN (ระบบกันไม่ให้ซ้ำกับรายการอื่น) |
| อนุมัติ VIN ผิดแถว | เปิดรายการ PDF → ส่วน Excel Check → Remove approval แล้วอนุมัติใหม่ |
| ต้องการยกเลิกการแก้ไข | แก้ค่ากลับได้ด้วยปุ่มเดิม ประวัติทั้งหมดอยู่ใน History |
| เพิ่ม PDF ภายหลัง | Re-check โฟลเดอร์เดิม ระบบนำเข้าเฉพาะไฟล์ใหม่/เปลี่ยน |

### ข้อจำกัดของแผนฟรี Cloudflare (รีเซ็ต 00:00 UTC = 07:00 น. ไทย)

- ฐานข้อมูล D1: อ่านได้ 5 ล้านแถวต่อวัน
- Workers: เวลาประมวลผลสั้นต่อคำขอ
- Workers AI: 10,000 neurons ต่อวัน
- แผน Workers Paid ($5/เดือน) ขยายขีดจำกัดทั้งหมด

