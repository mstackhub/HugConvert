# คู่มือนำ HugConvert ขึ้น Vercel + เชื่อมต่อ Supabase (พร้อมรับคนใช้วันละ 1,000+ คน)

โปรเจกต์เตรียมไฟล์ตั้งค่า **Vercel (`vercel.json`)** และสคริปต์ฐานข้อมูล **Supabase (`supabase_schema.sql`)** ไว้ให้พร้อมแล้วครับ ทำตาม 3 ขั้นตอนนี้ก็ออนไลน์ใช้งานจริงได้เลย:

---

## ขั้นตอนที่ 1: นำเว็บขึ้น Vercel (ฟรี Bandwidth ไม่จำกัด)
1. เข้าเว็บ [vercel.com](https://vercel.com) และล็อกอินด้วยบัญชี GitHub ของคุณ
2. กด **Add New... → Project** แล้วเลือก Repository **`mstackhub/HugConvert`**
3. ไม่ต้องตั้งค่า Build Command (เพราะเป็น Static Web ล้วน) กด **Deploy** ได้เลย
4. รอ ~20 วินาที เว็บจะออนไลน์ทันทีที่ `https://hey-convert.vercel.app` (และสามารถผูก Custom Domain ของคุณเองได้ฟรีในเมนู **Settings → Domains**)
   > ทุกครั้งที่แก้ไขโค้ดแล้ว `git push` ขึ้น GitHub, Vercel จะอัปเดตหน้าเว็บให้อัตโนมัติ

---

## ขั้นตอนที่ 2: สร้างฐานข้อมูล & ระบบสมาชิกบน Supabase (ฟรี 50,000 Users/เดือน)
1. เข้าเว็บ [supabase.com](https://supabase.com) → กด **New Project** (แนะนำเลือก Region เป็น **Singapore** เพื่อให้คนไทยโหลดเร็วที่สุด)
2. ไปที่เมนูด้านซ้าย **SQL Editor** → กด **New query**
3. เปิดไฟล์ `supabase_schema.sql` ในโปรเจกต์นี้ คัดลอกโค้ดทั้งหมดไปวางแล้วกด **Run**
   - ระบบจะสร้างตาราง `wallets`, `coin_transactions`, ระบบความปลอดภัย `RLS`, ฟังก์ชัน `claim_daily_bonus()`, `spend_heycoins()`, และ Trigger แจก **+15 HeyCoins** ให้สมาชิกใหม่โดยอัตโนมัติ
4. (ถ้าต้องการปุ่ม Google Login) ไปที่ **Authentication → Providers → Google** แล้วเปิดใช้งานพร้อมใส่ Client ID / Secret จาก Google Cloud Console
5. ไปที่ **Project Settings → API** แล้วคัดลอกค่า 2 ตัวนี้:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key**

---

## ขั้นตอนที่ 3: นำ Key มาใส่ในโค้ด
เปิดไฟล์ `js/auth.js` บรรทัดที่ 8–11 แล้ววางค่าที่คัดลอกมา:
```js
export const SUPABASE_CONFIG = {
  url: 'https://xxxx.supabase.co',
  anonKey: 'eyJhbGciOi...',
};
```
จากนั้น `git commit` และ `git push` ขึ้น GitHub — Vercel จะอัปเดตระบบ Login จริงให้ภายใน 15 วินาทีครับ!

---

## (เสริม) เชื่อมต่อรับเงินอัตโนมัติ PromptPay QR ผ่าน Opn Payments (Omise)
โปรเจกต์เตรียม Serverless Functions (`/api/opn-create-qr.js`, `/api/opn-webhook.js`, `/api/opn-check-status.js`) ไว้ให้เรียบร้อยแล้ว เพียงทำ 3 ขั้นตอน:
1. สมัครบัญชี **Opn Payments (omise.co)** (เปิดใช้งาน PromptPay ค่าธรรมเนียม 1.65%, 0฿ รายเดือน)
2. นำ Key ไปใส่ใน **Vercel → Project Settings → Environment Variables**:
   - `OMISE_SECRET_KEY` = Secret Key จากหน้า Dashboard ของ Opn (`skey_test_...` หรือ `skey_...`)
   - `SUPABASE_URL` = Project URL จาก Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` = Service Role Key จาก Supabase (สำหรับให้ Backend บวกเหรียญเข้ากระเป๋าอย่างปลอดภัย)
3. ในหน้า Dashboard ของ Opn → **Webhooks** → เพิ่ม URL: `https://<ชื่อเว็บของคุณ>.vercel.app/api/opn-webhook` (เลือก Event: `charge.complete`) — เสร็จสมบูรณ์ครับ!
