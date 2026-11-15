const copy = {
  fa: {
    eyebrow: 'SARINA · مدیریت مرکزی',
    title: 'مرکز فرماندهی هوشمند',
    intro: 'نمای واقعی از وضعیت دسترسی، زیرساخت و مسیر توسعه؛ فقط داده‌هایی نمایش داده می‌شوند که از منبع معتبر دریافت شده باشند.',
    refresh: 'به‌روزرسانی بررسی‌ها',
    accessTitle: 'کنترل دسترسی مدیر',
    session: 'نشست امن',
    role: 'مجوز مدیر سیستم',
    profile: 'پروفایل مدیریتی',
    connected: 'تأیید شد',
    checking: 'در حال بررسی…',
    unavailable: 'قابل تأیید نیست',
    denied: 'دسترسی مجاز نیست',
    healthTitle: 'وضعیت احراز هویت',
    healthText: 'این نتیجه فقط وضعیت نشست، پروفایل و نقش مدیر را نشان می‌دهد؛ نه سلامت کل زیرساخت.',
    verified: 'بررسی موفق',
    modulesTitle: 'نقشه عملیاتی SARINA',
    modulesIntro: 'وضعیت اتصال هر بخش بر اساس داده و رابط واقعی ثبت می‌شود.',
    modules: [
      ['کاربران و نقش‌ها', 'مدیریت کاربران، نقش‌ها و سطح دسترسی', 'در انتظار رابط امن مدیریت'],
      ['مزارع و پرونده‌ها', 'تعداد مزارع، داده‌های ثبت‌شده و کیفیت پرونده', 'در انتظار رابط امن مدیریت'],
      ['کارشناسان و درخواست‌ها', 'بررسی صلاحیت، مدارک و پرونده‌های ارجاعی', 'در انتظار رابط امن مدیریت'],
      ['بازارگاه', 'فروشندگان، محصولات، سفارش‌ها و درخواست قیمت', 'در انتظار رابط امن مدیریت'],
      ['هسته هوش مرکزی', 'درخواست‌ها، مدل‌های فعال، خطاها و نتایج SCI/SIACP', 'در انتظار رابط پایش امن'],
      ['سلامت زیرساخت', 'خطاهای نرم‌افزار، دیتابیس، فضای ابری و انتشار', 'در انتظار اتصال پایشگرها']
    ],
    roadmapTitle: 'پیشرفت هوشمندسازی پنل',
    phase1: 'مرحله ۱ · شناسایی امن مدیر و ورود به پنل',
    phase1State: 'تأییدشده در این نشست',
    phase2: 'مرحله ۲ · ساخت رابط امن داده‌های مدیریتی',
    phase2State: 'گام بعدی',
    phase3: 'مرحله ۳ · ثبت رویدادها و پایش سلامت سرویس‌ها',
    phase3State: 'پس از مرحله ۲',
    evidenceTitle: 'مرز دقت و شواهد',
    evidence: 'تا زمانی که رابط مدیریتیِ سمت سرور ساخته و آزمایش نشده، آمار کل کاربران، مزارع، سفارش‌ها، گزارش‌های امنیتی و سلامت سرویس‌ها نمایش داده نمی‌شود. دسترسی مرورگر به داده‌های شخصی کاربران یا دور زدن RLS مجاز نیست.',
    activityTitle: 'رویدادهای مدیریتی',
    noActivity: 'هنوز منبع رویداد مدیریتی به این پنل متصل نشده است.',
    loading: 'در حال بررسی دسترسی…',
    retry: 'تلاش دوباره',
    signedOut: 'نشست فعال پیدا نشد. دوباره وارد حساب شوید.',
    profileMissing: 'پروفایل مدیریتی در دسترس نیست.',
    roleMissing: 'این حساب نقش مدیر سیستم ندارد.',
    checkFailed: 'بررسی دسترسی انجام نشد. جزئیات در کنسول فنی ثبت شده است.',
    updated: 'آخرین بررسی',
    account: 'حساب مدیر',
    signOutHint: 'برای خروج از حساب، از دکمه خروج بالای صفحه استفاده کنید.'
  },
  en: {
    eyebrow: 'SARINA · CENTRAL ADMINISTRATION',
    title: 'Intelligent command center',
    intro: 'A truthful view of access, infrastructure and delivery. Only information backed by a verified source is shown.',
    refresh: 'Refresh checks',
    accessTitle: 'Administrator access',
    session: 'Secure session',
    role: 'System administrator role',
    profile: 'Admin profile',
    connected: 'Verified',
    checking: 'Checking…',
    unavailable: 'Unverified',
    denied: 'Access denied',
    healthTitle: 'Authentication status',
    healthText: 'This result covers session, profile and administrator role only—not the health of the entire platform.',
    verified: 'Checks passed',
    modulesTitle: 'SARINA operational map',
    modulesIntro: 'Each module is marked connected only when its real data source is available.',
    modules: [
      ['Users and roles', 'User accounts, roles and access levels', 'Secure admin API pending'],
      ['Farms and records', 'Farm totals, submitted data and record quality', 'Secure admin API pending'],
      ['Experts and requests', 'Credential review, documents and assigned cases', 'Secure admin API pending'],
      ['Marketplace', 'Sellers, products, orders and quote requests', 'Secure admin API pending'],
      ['Central intelligence', 'Requests, enabled models, errors and SCI/SIACP results', 'Secure monitoring API pending'],
      ['Infrastructure health', 'Application errors, database, cloud and deployments', 'Health probes pending']
    ],
    roadmapTitle: 'Admin intelligence roadmap',
    phase1: 'Phase 1 · Secure admin identification and entry',
    phase1State: 'Verified in this session',
    phase2: 'Phase 2 · Secure administrative data interface',
    phase2State: 'Next step',
    phase3: 'Phase 3 · Audit events and service health monitoring',
    phase3State: 'After phase 2',
    evidenceTitle: 'Evidence and accuracy boundary',
    evidence: 'Until server-side admin interfaces are implemented and tested, platform-wide counts, orders, security events and service health are not displayed. The browser must not bypass RLS or expose other users’ private records.',
    activityTitle: 'Administrative events',
    noActivity: 'No administrative event source is connected yet.',
    loading: 'Checking access…',
    retry: 'Try again',
    signedOut: 'No active session was found. Sign in again.',
    profileMissing: 'The administrator profile is unavailable.',
    roleMissing: 'This account does not have the system administrator role.',
    checkFailed: 'Access verification failed. Technical details are in the console.',
    updated: 'Last checked',
    account: 'Administrator account',
    signOutHint: 'Use the sign-out control in the page header to end this session.'
  }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeLabel = (lang, date) => new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : 'en-GB', {dateStyle:'medium',timeStyle:'short'}).format(date);

export function renderAdminWorkspace(lang = 'fa', profile = null) {
  const t = copy[lang] || copy.en;
  const modules = t.modules.map((m, i) => `
    <article class="admin-module-card">
      <div class="admin-module-icon">${['♙','🌾','♧','🛒','✧','⌁'][i]}</div>
      <div class="admin-module-copy"><h3>${m[0]}</h3><p>${m[1]}</p><span class="admin-pending">${m[2]}</span></div>
    </article>`).join('');
  return `
    <div class="admin-shell" dir="${lang === 'fa' ? 'rtl' : 'ltr'}">
      <header class="admin-hero">
        <div><span class="admin-eyebrow">${t.eyebrow}</span><h1>${t.title}</h1><p>${t.intro}</p></div>
        <button type="button" class="admin-refresh" data-admin-refresh>↻ ${t.refresh}</button>
      </header>
      <section class="admin-panel">
        <div class="admin-section-heading"><div><span class="admin-kicker">01</span><h2>${t.accessTitle}</h2></div><span class="admin-state" data-admin-overall>${t.checking}</span></div>
        <div class="admin-check-grid">
          <article class="admin-check-card"><span>◉</span><div><small>${t.session}</small><b data-admin-session>${t.checking}</b></div></article>
          <article class="admin-check-card"><span>♙</span><div><small>${t.role}</small><b data-admin-role>${t.checking}</b></div></article>
          <article class="admin-check-card"><span>▣</span><div><small>${t.profile}</small><b data-admin-profile>${t.checking}</b></div></article>
        </div>
        <p class="admin-footnote">${t.healthText}</p>
      </section>
      <section class="admin-panel">
        <div class="admin-section-heading"><div><span class="admin-kicker">02</span><h2>${t.modulesTitle}</h2><p>${t.modulesIntro}</p></div></div>
        <div class="admin-module-grid">${modules}</div>
      </section>
      <section class="admin-panel">
        <div class="admin-section-heading"><div><span class="admin-kicker">03</span><h2>${t.roadmapTitle}</h2></div></div>
        <ol class="admin-roadmap">
          <li class="is-done"><span>${t.phase1}</span><b>${t.phase1State}</b></li>
          <li class="is-next"><span>${t.phase2}</span><b>${t.phase2State}</b></li>
          <li><span>${t.phase3}</span><b>${t.phase3State}</b></li>
        </ol>
      </section>
      <section class="admin-lower-grid">
        <article class="admin-panel admin-evidence"><h2>ⓘ ${t.evidenceTitle}</h2><p>${t.evidence}</p></article>
        <article class="admin-panel admin-events"><h2>◷ ${t.activityTitle}</h2><p data-admin-events>${t.noActivity}</p></article>
      </section>
      <div class="admin-status-line"><span data-admin-message role="status">${t.loading}</span><small><span>${t.account}:</span> <b data-admin-name>${esc(profile?.full_name || profile?.email || '—')}</b></small><small><span>${t.updated}:</span> <b data-admin-updated>—</b></small></div>
      <p class="admin-signout-hint">${t.signOutHint}</p>
    </div>`;
}

export function bindAdminWorkspace({root, supabase, getProfile, getLanguage}) {
  if (!root || root.dataset.adminBound === '1') return;
  root.dataset.adminBound = '1';

  const refresh = async () => {
    const lang = getLanguage();
    const t = copy[lang] || copy.en;
    const set = (selector, value) => { const node = root.querySelector(selector); if (node) node.textContent = value; };
    ['[data-admin-session]','[data-admin-role]','[data-admin-profile]','[data-admin-overall]'].forEach(s => set(s, t.checking));
    set('[data-admin-message]', t.loading);
    try {
      const {data:userResult,error:userError} = await supabase.auth.getUser();
      if (userError || !userResult?.user) {
        set('[data-admin-session]', t.unavailable); set('[data-admin-role]', t.unavailable); set('[data-admin-profile]', t.unavailable);
        set('[data-admin-overall]', t.denied); set('[data-admin-message]', t.signedOut); return;
      }
      set('[data-admin-session]', t.connected);
      const [{data:roles,error:roleError},{data:account,error:profileError}] = await Promise.all([
        supabase.from('user_roles').select('roles(code)').eq('scope_type','global').is('scope_id',null),
        supabase.from('users').select('id,email,full_name,account_status').eq('auth_user_id',userResult.user.id).maybeSingle()
      ]);
      if (roleError) throw roleError;
      if (!account || profileError) {
        set('[data-admin-role]', t.unavailable); set('[data-admin-profile]', t.unavailable); set('[data-admin-overall]', t.denied);
        set('[data-admin-message]', t.profileMissing); return;
      }
      set('[data-admin-profile]', t.connected);
      const isAdmin = (roles || []).some(row => row.roles?.code === 'admin');
      if (!isAdmin) {
        set('[data-admin-role]', t.denied); set('[data-admin-overall]', t.denied); set('[data-admin-message]', t.roleMissing); return;
      }
      set('[data-admin-role]', t.connected);
      set('[data-admin-overall]', t.verified);
      set('[data-admin-name]', account.full_name || account.email || getProfile()?.full_name || '—');
      set('[data-admin-updated]', timeLabel(lang, new Date()));
      set('[data-admin-message]', t.verified);
    } catch (error) {
      console.error('SARINA admin access verification failed:', error);
      set('[data-admin-session]', t.unavailable); set('[data-admin-role]', t.unavailable); set('[data-admin-profile]', t.unavailable);
      set('[data-admin-overall]', t.denied); set('[data-admin-message]', t.checkFailed);
    }
  };

  root.addEventListener('click', event => {
    if (event.target.closest('[data-admin-refresh]')) refresh();
  });
  refresh();
}
