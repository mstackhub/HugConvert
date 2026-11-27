// ============================================================
//  subpage-nav.js — แถบเมนู + ยอดเหรียญ + โปรไฟล์ผู้ใช้ชุดเดียวกับหน้าแรกสำหรับหน้าย่อย
// ============================================================
import { initAuth, getCurrentUser, onAuthStateChange, logoutUser } from './auth.js';
import { loadWallet, hasUnlimitedPass, syncWalletFromCloud } from './heycoin.js';

const $ = (s) => document.querySelector(s);

function renderSubHeaderState() {
  const user = getCurrentUser();
  const w = loadWallet();
  const isPass = hasUnlimitedPass(w);

  const balEl = $('#coinBalanceText');
  const actionEl = $('#coinPillAction');
  if (balEl) {
    balEl.innerHTML = isPass ? `∞ <small style="font-weight:600;opacity:.85;">(${w.balance})</small>` : String(w.balance);
  }
  if (actionEl) {
    actionEl.textContent = isPass ? '👑 VIP Pass' : (w.isGuest ? 'รับฟรี 15 เหรียญ' : '+ เติมเหรียญ');
    actionEl.classList.toggle('is-pass', isPass);
  }

  const guestBtn = $('#authGuestBtn');
  const userWrap = $('#userMenuWrap');
  if (!user) {
    if (guestBtn) guestBtn.hidden = false;
    if (userWrap) userWrap.hidden = true;
  } else {
    if (guestBtn) guestBtn.hidden = true;
    if (userWrap) userWrap.hidden = false;
    const displayName = user.name || user.email.split('@')[0];
    const initial = (displayName || 'U').trim().charAt(0).toUpperCase();
    if ($('#userAvatar')) $('#userAvatar').textContent = initial;
    if ($('#userNameText')) $('#userNameText').textContent = displayName;
    if ($('#ddUserName')) $('#ddUserName').textContent = user.name || 'สมาชิก HugConvert';
    if ($('#ddUserEmail')) $('#ddUserEmail').textContent = user.email;
    if ($('#ddWalletId')) $('#ddWalletId').textContent = w.walletId || '';
  }
}

function initThemeToggle() {
  const btn = $('#themeToggleBtn');
  const sync = () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (btn) {
      btn.textContent = isDark ? '☀️' : '🌙';
      btn.setAttribute('aria-pressed', String(isDark));
    }
  };
  sync();
  btn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hc.theme.v1', next);
    document.documentElement.setAttribute('data-theme', next);
    sync();
  });
}

(async function bootSubpageNav() {
  initThemeToggle();
  renderSubHeaderState();

  $('#coinWalletBtn')?.addEventListener('click', () => {
    location.href = '/?tool=topup';
  });
  $('#authGuestBtn')?.addEventListener('click', () => {
    location.href = '/?tool=topup';
  });
  $('#userMenuBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dd = $('#profileDropdown');
    if (!dd) return;
    dd.hidden = !dd.hidden;
    $('#userMenuBtn')?.setAttribute('aria-expanded', String(!dd.hidden));
  });
  document.addEventListener('click', (e) => {
    const wrap = $('#userMenuWrap');
    const dd = $('#profileDropdown');
    if (dd && !dd.hidden && wrap && !wrap.contains(e.target)) {
      dd.hidden = true;
      $('#userMenuBtn')?.setAttribute('aria-expanded', 'false');
    }
  });
  $('#ddOpenCoinBtn')?.addEventListener('click', () => { location.href = '/?tool=topup'; });
  $('#ddOpenHistoryBtn')?.addEventListener('click', () => { location.href = '/?tool=history'; });
  $('#ddLogoutBtn')?.addEventListener('click', async () => {
    await logoutUser();
    renderSubHeaderState();
  });

  onAuthStateChange(async () => {
    renderSubHeaderState();
    await syncWalletFromCloud();
    renderSubHeaderState();
  });

  await initAuth();
  await syncWalletFromCloud();
  renderSubHeaderState();
})();
