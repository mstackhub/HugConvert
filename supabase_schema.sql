-- ============================================================
--  HeyConvert — Supabase PostgreSQL Schema สำหรับระบบสมาชิก & กระเป๋า HeyCoin
--  วิธีใช้: คัดลอกโค้ดนี้ไปรันในเมนู SQL Editor บนเว็บ Supabase.com ได้ทันที
-- ============================================================

-- 1. ตารางเก็บกระเป๋าเหรียญ HeyCoin ผูกกับ auth.users
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_code text unique not null,
  balance integer not null default 15 check (balance >= 0),
  last_check_in date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. ตารางประวัติการรับ/ใช้เหรียญ (Ledger)
create table if not exists public.coin_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  label text not null,
  payment_ref text,
  created_at timestamptz not null default now()
);

-- 3. เปิดใช้งาน Row Level Security (ป้องกันผู้ใช้แก้ยอดเหรียญเองจากเบราว์เซอร์)
alter table public.wallets enable row level security;
alter table public.coin_transactions enable row level security;

create policy "Users can view own wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "Users can view own transactions"
  on public.coin_transactions for select
  using (auth.uid() = user_id);

-- 4. Trigger สร้างกระเป๋า + แจกฟรี 15 HeyCoins อัตโนมัติทันทีที่สมัครสมาชิกใหม่
create or replace function public.handle_new_user_wallet()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
begin
  v_code := 'HC-' || upper(substr(md5(new.id::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4));
  insert into public.wallets (user_id, wallet_code, balance)
  values (new.id, v_code, 15);

  insert into public.coin_transactions (user_id, delta, label)
  values (new.id, 15, '🎁 โบนัสต้อนรับสมาชิกใหม่');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_wallet();
