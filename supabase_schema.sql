-- ============================================================
--  HeyConvert — Supabase PostgreSQL Schema (Production Ready)
--  รองรับ: 1,000+ ผู้ใช้/วัน, ป้องกันแก้ยอดเหรียญจากเบราว์เซอร์ (RLS + Atomic RPC)
--  วิธีใช้: คัดลอกทั้งหมดไปวางและกด Run ใน SQL Editor ของ Supabase.com
-- ============================================================

-- 1. ตารางเก็บกระเป๋าเหรียญ HeyCoin & Unlimited Pass ผูกกับ auth.users
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_code text unique not null,
  balance integer not null default 15 check (balance >= 0),
  unlimited_until timestamptz,
  last_check_in date,
  used_coupons text[] not null default '{}',
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

create index if not exists idx_coin_tx_user_created
  on public.coin_transactions (user_id, created_at desc);

-- 3. เปิด Row Level Security (ผู้ใช้อ่านได้เฉพาะของตัวเอง แก้ตัวเลขตรงๆ ไม่ได้)
alter table public.wallets enable row level security;
alter table public.coin_transactions enable row level security;

create policy "Users can view own wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "Users can view own transactions"
  on public.coin_transactions for select
  using (auth.uid() = user_id);

-- 4. Trigger สร้างกระเป๋า + แจกฟรี +15 HeyCoins อัตโนมัติทันทีที่สมัครสมาชิกใหม่
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
  values (new.id, v_code, 15)
  on conflict (user_id) do nothing;

  insert into public.coin_transactions (user_id, delta, label)
  values (new.id, 15, '🎁 โบนัสต้อนรับสมาชิกใหม่');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_wallet();

-- 5. RPC: เช็คอินรับโบนัสรายวัน (+3 HeyCoins) แบบ Atomic กันกดเบิ้ล
create or replace function public.claim_daily_bonus()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_new_bal integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'กรุณาเข้าสู่ระบบก่อน');
  end if;

  update public.wallets
  set balance = balance + 3,
      last_check_in = v_today,
      updated_at = now()
  where user_id = v_uid
    and (last_check_in is null or last_check_in < v_today)
  returning balance into v_new_bal;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'วันนี้คุณรับโบนัสรายวันไปแล้ว');
  end if;

  insert into public.coin_transactions (user_id, delta, label)
  values (v_uid, 3, '☀️ เช็คอินรายวัน (' || v_today::text || ')');

  return jsonb_build_object('ok', true, 'balance', v_new_bal, 'added', 3);
end;
$$;

-- 6. RPC: หักเหรียญ HeyCoin แบบ Atomic (หักเฉพาะเมื่อมียอดพอหรือมี Unlimited Pass)
create or replace function public.spend_heycoins(p_amount integer, p_reason text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pass timestamptz;
  v_new_bal integer;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'กรุณาเข้าสู่ระบบก่อน');
  end if;
  if p_amount <= 0 then
    return jsonb_build_object('ok', true);
  end if;

  select unlimited_until into v_pass from public.wallets where user_id = v_uid;
  if v_pass is not null and v_pass > now() then
    return jsonb_build_object('ok', true, 'is_pass', true);
  end if;

  update public.wallets
  set balance = balance - p_amount,
      updated_at = now()
  where user_id = v_uid
    and balance >= p_amount
  returning balance into v_new_bal;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'เหรียญ HeyCoin ไม่เพียงพอ');
  end if;

  insert into public.coin_transactions (user_id, delta, label)
  values (v_uid, -p_amount, coalesce(p_reason, '⚡ ใช้งานฟีเจอร์ HeyConvert'));

  return jsonb_build_object('ok', true, 'balance', v_new_bal);
end;
$$;
