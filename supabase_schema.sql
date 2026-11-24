-- ============================================================
--  HugConvert — Supabase PostgreSQL Schema (Production Ready)
--  รองรับ: 1,000+ ผู้ใช้/วัน, ป้องกันแก้ยอดเหรียญจากเบราว์เซอร์ (RLS + Atomic RPC)
--  วิธีใช้: คัดลอกทั้งหมดไปวางและกด Run ใน SQL Editor ของ Supabase.com
-- ============================================================

-- 1. ตารางเก็บกระเป๋าเหรียญ HugCoin & Unlimited Pass ผูกกับ auth.users
create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_code text unique not null,
  balance numeric(10,1) not null default 15 check (balance >= 0),
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
  delta numeric(10,1) not null,
  label text not null,
  payment_ref text,
  created_at timestamptz not null default now()
);

-- รองรับกรณีสร้างตารางไว้แล้ว ให้แปลงคอลัมน์เป็น numeric(10,1) เพื่อรองรับ 0.5 HugCoin
alter table public.wallets alter column balance type numeric(10,1) using balance::numeric(10,1);
alter table public.coin_transactions alter column delta type numeric(10,1) using delta::numeric(10,1);

create index if not exists idx_coin_tx_user_created
  on public.coin_transactions (user_id, created_at desc);

create unique index if not exists idx_coin_tx_payment_ref
  on public.coin_transactions (payment_ref)
  where payment_ref is not null;

-- 3. เปิด Row Level Security (ผู้ใช้อ่านได้เฉพาะของตัวเอง แก้ตัวเลขตรงๆ ไม่ได้)
alter table public.wallets enable row level security;
alter table public.coin_transactions enable row level security;

create policy "Users can view own wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "Users can view own transactions"
  on public.coin_transactions for select
  using (auth.uid() = user_id);

-- 4. Trigger สร้างกระเป๋า + แจกฟรี +15 HugCoins อัตโนมัติทันทีที่สมัครสมาชิกใหม่
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

-- 5. RPC: เช็คอินรับโบนัสรายวัน (+0.5 HugCoin, เพดานโบนัสฟรี 20 HugCoins) แบบ Atomic กันกดเบิ้ล
create or replace function public.claim_daily_bonus()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Bangkok')::date;
  v_daily constant numeric(10,1) := 0.5;
  v_cap constant numeric(10,1) := 20.0;
  v_cur_bal numeric(10,1);
  v_added numeric(10,1);
  v_new_bal numeric(10,1);
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'msg', 'กรุณาเข้าสู่ระบบก่อน');
  end if;

  select balance into v_cur_bal from public.wallets where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'msg', 'ไม่พบกระเป๋าเหรียญ');
  end if;

  if v_cur_bal >= v_cap then
    return jsonb_build_object('ok', false, 'msg', 'ยอดเหรียญถึงเพดานโบนัสฟรี (20 HugCoins) แล้ว ใช้เหรียญก่อนแล้วค่อยรับเพิ่มนะครับ');
  end if;

  v_added := least(v_daily, v_cap - v_cur_bal);

  update public.wallets
  set balance = balance + v_added,
      last_check_in = v_today,
      updated_at = now()
  where user_id = v_uid
    and (last_check_in is null or last_check_in < v_today)
  returning balance into v_new_bal;

  if not found then
    return jsonb_build_object('ok', false, 'msg', 'วันนี้คุณรับโบนัสรายวันไปแล้ว');
  end if;

  insert into public.coin_transactions (user_id, delta, label)
  values (v_uid, v_added, '☀️ เช็คอินรายวัน (' || v_today::text || ')');

  return jsonb_build_object('ok', true, 'balance', v_new_bal, 'added', v_added);
end;
$$;

-- 6. RPC: หักเหรียญ HugCoin แบบ Atomic (หักเฉพาะเมื่อมียอดพอหรือมี Unlimited Pass)
drop function if exists public.spend_heycoins(integer, text);
create or replace function public.spend_heycoins(p_amount numeric, p_reason text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pass timestamptz;
  v_new_bal numeric(10,1);
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
    return jsonb_build_object('ok', false, 'msg', 'เหรียญ HugCoin ไม่เพียงพอ');
  end if;

  insert into public.coin_transactions (user_id, delta, label)
  values (v_uid, -p_amount, coalesce(p_reason, '⚡ ใช้งานฟีเจอร์ HugConvert'));

  return jsonb_build_object('ok', true, 'balance', v_new_bal);
end;
$$;

-- 7. RPC: เติมเหรียญ / เปิด Unlimited Pass จาก Opn Payments Webhook (Idempotent 100%)
create or replace function public.credit_opn_purchase(
  p_user_id uuid,
  p_coins integer,
  p_pass_days integer,
  p_label text,
  p_payment_ref text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_bal integer;
begin
  -- ป้องกันการเติมซ้ำหาก Webhook และ Polling เรียกพร้อมกัน
  if exists (select 1 from public.coin_transactions where payment_ref = p_payment_ref) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  if p_pass_days > 0 then
    update public.wallets
    set unlimited_until = greatest(now(), coalesce(unlimited_until, now())) + (p_pass_days || ' days')::interval,
        updated_at = now()
    where user_id = p_user_id
    returning balance into v_new_bal;
  else
    update public.wallets
    set balance = balance + p_coins,
        updated_at = now()
    where user_id = p_user_id
    returning balance into v_new_bal;
  end if;

  insert into public.coin_transactions (user_id, delta, label, payment_ref)
  values (p_user_id, coalesce(p_coins, 0), p_label, p_payment_ref);

  return jsonb_build_object('ok', true, 'balance', v_new_bal);
end;
$$;
