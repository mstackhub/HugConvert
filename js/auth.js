// ============================================================
//  auth.js — ระบบสมาชิก (เข้าสู่ระบบ / สมัครสมาชิก / Google Sign-In / โปรไฟล์)
//  รองรับ 2 โหมดอัตโนมัติ:
//    1) Local Auth Mode (ทำงานได้ทันทีบนเครื่องและ GitHub Pages สำหรับทดสอบครบทุก Flow)
//    2) Supabase Cloud Mode (เพียงใส่ SUPABASE_URL และ SUPABASE_ANON_KEY ด้านล่าง)
// ============================================================

export const SUPABASE_CONFIG = {
  url: 'https://hmmievfvhbqrnifbspoh.supabase.co',
  anonKey: 'sb_publishable_1tMLl6X39zET_CSYVduThg_qM4WiHAO',  // ใส่ anon/publishable key จาก Supabase Project Settings -> API
};

const USERS_DB_KEY = 'hc.auth.users.v1';
const SESSION_KEY = 'hc.auth.session.v1';

let supabaseClient = null;
const authListeners = new Set();

export const isCloudAuthConfigured = () =>
  Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);

export async function getSupabase() {
  if (!isCloudAuthConfigured()) return null;
  if (supabaseClient) return supabaseClient;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  return supabaseClient;
}

function loadLocalUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_DB_KEY) || '[]'); }
  catch { return []; }
}

function saveLocalUsers(users) {
  localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
}

async function hashPassword(pw) {
  const enc = new TextEncoder().encode('hc_salt_v1:' + pw);
  if (window.crypto?.subtle) {
    const buf = await window.crypto.subtle.digest('SHA-256', enc);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // fallback สำหรับ non-secure context
  let h = 0;
  for (let i = 0; i < enc.length; i++) h = ((h << 5) - h + enc[i]) | 0;
  return 'h_' + Math.abs(h).toString(16);
}

function notifyAuthChange(user) {
  authListeners.forEach((fn) => {
    try { fn(user); } catch (e) { console.error(e); }
  });
}

export function onAuthStateChange(fn) {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}

/** อ่านข้อมูลผู้ใช้ที่ล็อกอินอยู่ปัจจุบัน (คืนค่า null หากเป็น Guest) */
export function getCurrentUser() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (raw && raw.id && raw.email) return raw;
  } catch { /* ignore */ }
  return null;
}

export async function getAccessToken() {
  const sb = await getSupabase();
  if (!sb) return '';
  const { data } = await sb.auth.getSession();
  return data?.session?.access_token || '';
}

function setCurrentUser(user) {
  if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else localStorage.removeItem(SESSION_KEY);
  notifyAuthChange(user);
}

/** เริ่มต้นตรวจสอบ Session (ทั้ง Cloud และ Local) */
export async function initAuth() {
  const sb = await getSupabase();
  if (sb) {
    const { data } = await sb.auth.getSession();
    if (data?.session?.user) {
      const u = mapSupabaseUser(data.session.user);
      setCurrentUser(u);
    }
    sb.auth.onAuthStateChange((_ev, session) => {
      setCurrentUser(session?.user ? mapSupabaseUser(session.user) : null);
    });
    return getCurrentUser();
  }
  return getCurrentUser();
}

function mapSupabaseUser(u) {
  const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || 'Member';
  return {
    id: u.id,
    email: u.email,
    name,
    provider: u.app_metadata?.provider || 'email',
    avatarUrl: u.user_metadata?.avatar_url || '',
    mode: 'cloud',
  };
}

/** สมัครสมาชิกใหม่ด้วยอีเมลและรหัสผ่าน */
export async function registerWithEmail({ name, email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim() || cleanEmail.split('@')[0];
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, msg: 'กรุณากรอกอีเมลให้ถูกต้อง' };
  }
  if (!password || password.length < 6) {
    return { ok: false, msg: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' };
  }

  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { full_name: cleanName } },
    });
    if (error) return { ok: false, msg: error.message };
    const u = data.user ? mapSupabaseUser(data.user) : null;
    if (data.session && u) {
      setCurrentUser(u);
      return { ok: true, user: u, isNew: true, msg: 'สมัครสมาชิกสำเร็จและบันทึกลง Supabase แล้ว! รับฟรี +15 HugCoins 🎉' };
    }
    return {
      ok: true,
      needsConfirm: true,
      user: null,
      isNew: true,
      msg: 'สมัครสมาชิกและบันทึกลง Supabase แล้ว! กรุณากดยืนยันอีเมลในกล่องจดหมายก่อนเข้าสู่ระบบ (หรือปิด Confirm email ใน Supabase)',
    };
  }

  // Local Auth Mode
  const users = loadLocalUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    return { ok: false, msg: 'อีเมลนี้ถูกใช้งานแล้ว กรุณากดเข้าสู่ระบบแทนครับ' };
  }
  const pwHash = await hashPassword(password);
  const newUser = {
    id: 'usr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    email: cleanEmail,
    name: cleanName,
    pwHash,
    provider: 'email',
    createdAt: Date.now(),
  };
  users.push(newUser);
  saveLocalUsers(users);

  const sessionUser = { id: newUser.id, email: newUser.email, name: newUser.name, provider: 'email', mode: 'local' };
  setCurrentUser(sessionUser);
  return { ok: true, user: sessionUser, isNew: true, msg: 'สมัครสมาชิกสำเร็จ! รับฟรี +15 HugCoins เข้ากระเป๋าแล้ว 🎉' };
}

/** เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน */
export async function loginWithEmail({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false, msg: 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน' };
  }

  const sb = await getSupabase();
  if (sb) {
    const { data, error } = await sb.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) {
      const m = String(error.message || '').toLowerCase();
      if (m.includes('not confirmed')) {
        return { ok: false, msg: 'กรุณากดยืนยันอีเมลในกล่องจดหมายของคุณก่อนเข้าสู่ระบบ (หรือปิด Confirm email ใน Supabase)' };
      }
      return { ok: false, msg: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง (หากยังไม่เคยสมัครบน Supabase ให้กดสมัครสมาชิกก่อนครับ)' };
    }
    const u = mapSupabaseUser(data.user);
    setCurrentUser(u);
    return { ok: true, user: u, msg: `ยินดีต้อนรับกลับมาครับ คุณ ${u.name}!` };
  }

  // Local Auth Mode
  const users = loadLocalUsers();
  const found = users.find((u) => u.email === cleanEmail);
  if (!found) {
    return { ok: false, msg: 'ไม่พบบัญชีอีเมลนี้ กรุณาสมัครสมาชิกก่อนครับ' };
  }
  const pwHash = await hashPassword(password);
  if (found.pwHash !== pwHash) {
    return { ok: false, msg: 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' };
  }
  const sessionUser = { id: found.id, email: found.email, name: found.name, provider: found.provider || 'email', mode: 'local' };
  setCurrentUser(sessionUser);
  return { ok: true, user: sessionUser, msg: `เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${found.name}!` };
}

/** เข้าสู่ระบบด้วย Google (OAuth บน Supabase หรือ Instant Google Demo บน Local) */
export async function loginWithGoogle(demoEmail = 'demo.user@gmail.com', demoName = 'Google User') {
  const sb = await getSupabase();
  if (sb) {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href },
    });
    if (error) return { ok: false, msg: error.message };
    return { ok: true, redirecting: true };
  }

  // Local Auth Mode: สร้างหรือดึงบัญชี Google จำลองให้เข้าใช้งานได้ทันทีในคลิกเดียว
  const cleanEmail = String(demoEmail || 'demo.user@gmail.com').trim().toLowerCase();
  const users = loadLocalUsers();
  let found = users.find((u) => u.email === cleanEmail);
  let isNew = false;
  if (!found) {
    isNew = true;
    found = {
      id: 'usr_gg_' + Date.now().toString(36),
      email: cleanEmail,
      name: demoName || cleanEmail.split('@')[0],
      pwHash: '',
      provider: 'google',
      createdAt: Date.now(),
    };
    users.push(found);
    saveLocalUsers(users);
  }
  const sessionUser = { id: found.id, email: found.email, name: found.name, provider: 'google', mode: 'local' };
  setCurrentUser(sessionUser);
  return {
    ok: true,
    user: sessionUser,
    isNew,
    msg: isNew
      ? `เข้าสู่ระบบด้วย Google สำเร็จ! รับโบนัสต้อนรับ +15 HugCoins 🎉`
      : `เข้าสู่ระบบด้วยบัญชี Google (${found.email}) สำเร็จ!`,
  };
}

/** ขอรีเซ็ตรหัสผ่าน */
export async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { ok: false, msg: 'กรุณากรอกอีเมลที่ลงทะเบียนไว้' };
  }
  const sb = await getSupabase();
  if (sb) {
    const { error } = await sb.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) return { ok: false, msg: error.message };
    return { ok: true, msg: `ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่ ${cleanEmail} แล้ว กรุณาตรวจสอบกล่องจดหมาย` };
  }

  const users = loadLocalUsers();
  const found = users.find((u) => u.email === cleanEmail);
  if (!found) return { ok: false, msg: 'ไม่พบอีเมลนี้ในระบบ' };
  return { ok: true, msg: `(โหมดทดสอบ) ระบบจำลองการส่งลิงก์รีเซ็ตรหัสผ่านไปที่ ${cleanEmail} เรียบร้อยแล้ว` };
}

/** ออกจากระบบ */
export async function logoutUser() {
  const sb = await getSupabase();
  if (sb) {
    try { await sb.auth.signOut(); } catch { /* ignore */ }
  }
  setCurrentUser(null);
  return { ok: true, msg: 'ออกจากระบบเรียบร้อยแล้ว' };
}
