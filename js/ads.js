// ============================================================
//  ads.js — ระบบจัดการพื้นที่โฆษณาหน้า Landing Page (AdSense & Sponsor/Affiliate)
//  รองรับการซ่อนโฆษณาอัตโนมัติสำหรับสมาชิก Unlimited Pass 👑
// ============================================================

export const AD_CONFIG = {
  // ใส่ Google AdSense Publisher ID เช่น 'ca-pub-1234567890123456' เมื่ออนุมัติแล้ว
  adsenseClient: '',

  // กำหนดค่าแต่ละตำแหน่งโฆษณาบนหน้า Landing Page:
  // mode: 'placeholder' (ตัวอย่างให้เห็นตำแหน่ง), 'adsense' (Google AdSense), 'sponsor' (แบนเนอร์/Affiliate เอง), 'off' (ปิด)
  slots: {
    'hub-top': {
      mode: 'off',
      label: 'Ad · พื้นที่โฆษณาส่วนบน (728×90 Leaderboard)',
      adsenseSlot: '',
      sponsor: {
        badge: 'Sponsored',
        title: 'พื้นที่โฆษณา / ผู้สนับสนุน (Leaderboard 728×90)',
        desc: 'รองรับ Google AdSense หรือแบนเนอร์ประชาสัมพันธ์สินค้า/บริการของคุณ',
        ctaText: 'ดูแพ็กเกจไร้โฆษณา',
        href: '#coin',
        imageUrl: '',
      },
    },
    'hub-mid': {
      mode: 'off',
      label: 'Ad · พื้นที่โฆษณาแนะนำเครื่องมือ (Native / Partner Banner)',
      adsenseSlot: '',
      sponsor: {
        badge: 'Partner',
        title: 'พื้นที่โฆษณา Affiliate / พาร์ตเนอร์',
        desc: 'เหมาะสำหรับแนะนำโปรแกรมตัดต่อ, Cloud เก็บเอกสาร หรือโฆษณาแบบ Native เข้ากับดีไซน์เว็บ',
        ctaText: 'ปิดโฆษณาด้วย VIP',
        href: '#coin',
        imageUrl: '',
      },
    },
    'hub-bottom': {
      mode: 'off',
      label: 'Ad · พื้นที่โฆษณาส่วนล่าง (Responsive Banner)',
      adsenseSlot: '',
      sponsor: {
        badge: 'Ad',
        title: 'พื้นที่โฆษณาท้ายหน้าแรก (Responsive Display)',
        desc: 'วางโค้ด Google AdSense Auto / Display Unit เพื่อสร้างรายได้อัตโนมัติทุกการเข้าชม',
        ctaText: 'จัดการเหรียญ',
        href: '#coin',
        imageUrl: '',
      },
    },
  },
};

let adsenseScriptInjected = false;

function ensureAdsenseScript(clientId) {
  if (adsenseScriptInjected || !clientId) return;
  adsenseScriptInjected = true;
  const s = document.createElement('script');
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
  document.head.appendChild(s);
}

/**
 * เรนเดอร์พื้นที่โฆษณาทั้งหมดบนหน้า Landing Page
 * @param {boolean} isAdFree - true เมื่อผู้ใช้มี Unlimited Pass (ซ่อนโฆษณาทั้งหมด)
 * @param {Function} onOpenCoin - callback เมื่อคลิกปุ่ม "ปิดโฆษณา"
 */
export function renderLandingAds(isAdFree, onOpenCoin) {
  const containers = document.querySelectorAll('[data-adslot]');
  containers.forEach((el) => {
    const slotKey = el.dataset.adslot;
    const cfg = AD_CONFIG.slots[slotKey];

    if (isAdFree || !cfg || cfg.mode === 'off') {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }

    el.hidden = false;

    // 1) โหมด Google AdSense จริง
    if (cfg.mode === 'adsense' && AD_CONFIG.adsenseClient && cfg.adsenseSlot) {
      ensureAdsenseScript(AD_CONFIG.adsenseClient);
      el.innerHTML = `
        <div class="ad-box ad-box--live">
          <div class="ad-box__tag">Advertisement</div>
          <ins class="adsbygoogle"
               style="display:block"
               data-ad-client="${AD_CONFIG.adsenseClient}"
               data-ad-slot="${cfg.adsenseSlot}"
               data-ad-format="auto"
               data-full-width-responsive="true"></ins>
        </div>
      `;
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ignore */ }
      return;
    }

    // 2) โหมดแบนเนอร์ Sponsor / Affiliate หรือ Placeholder
    const sp = cfg.sponsor || {};
    const isPlaceholder = cfg.mode === 'placeholder';
    el.innerHTML = `
      <div class="ad-box ${isPlaceholder ? 'ad-box--placeholder' : 'ad-box--sponsor'}">
        <div class="ad-box__left">
          <span class="ad-box__badge">${sp.badge || 'Ad'}</span>
          ${sp.imageUrl ? `<img class="ad-box__img" src="${sp.imageUrl}" alt="" />` : ''}
          <div class="ad-box__text">
            <div class="ad-box__title">${sp.title || cfg.label}</div>
            <div class="ad-box__desc">${sp.desc || ''}</div>
          </div>
        </div>
        <div class="ad-box__right">
          ${sp.href === '#coin'
            ? `<button type="button" class="btn btn--sm btn--ghost ad-vip-btn">👑 ${sp.ctaText || 'ปิดโฆษณา'}</button>`
            : `<a class="btn btn--sm btn--outline" href="${sp.href || '#'}" target="_blank" rel="noopener sponsored">${sp.ctaText || 'ดูเพิ่มเติม →'}</a>`
          }
        </div>
      </div>
    `;

    el.querySelector('.ad-vip-btn')?.addEventListener('click', () => {
      onOpenCoin?.('เปิดใช้งานแพ็กเกจ Unlimited Pass (149฿ / 30 วัน) เพื่อใช้ HugConvert แบบไร้โฆษณาทั้งหมดครับ');
    });
  });
}
