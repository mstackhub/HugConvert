# คู่มือนำ HeyConvert ขึ้น Vercel + เชื่อมต่อ Supabase (พร้อมรับคนใช้วันละ 1,000+ คน)

โปรเจกต์เตรียมไฟล์ตั้งค่า **Vercel (`vercel.json`)** และสคริปต์ฐานข้อมูล **Supabase (`supabase_schema.sql`)** ไว้ให้พร้อมแล้วครับ ทำตาม 3 ขั้นตอนนี้ก็ออนไลน์ใช้งานจริงได้เลย:

---

## ขั้นตอนที่ 1: นำเว็บขึ้น Vercel (ฟรี Bandwidth ไม่จำกัด)
1. เข้าเว็บ [vercel.com](https://vercel.com) และล็อกอินด้วยบัญชี GitHub ของคุณ
2. กด **Add New... → Project** แล้วเลือก Repository **`mstackhub/HeyConvert`**
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

## (เสริม) เชื่อมต่อรับเงินอัตโนมัติ PromptPay QR
1. สมัคร **Stripe Thailand** (รองรับ PromptPay QR + บัตรเครดิต ไม่มีค่ารายเดือน)
2. สร้าง **Payment Links** สำหรับแพ็กเกจ `29฿`, `79฿`, `199฿`, `149฿` แล้วนำลิงก์มาวางในช่อง `paymentUrl` ในไฟล์ `js/heycoin.js`
3. สร้าง Vercel Serverless Function (`/api/stripe-webhook.js`) เพื่อรับแจ้งเตือนเมื่อลูกค้าสแกนจ่ายสำเร็จ แล้วเรียก Supabase Service Key บวกเหรียญเข้า `public.wallets` อัตโนมัติภายใน 2 วินาทีครับ
