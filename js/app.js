/* ============================================================
   TYAF TEAM — основной скрипт сайта
   ============================================================ */
(function () {
  'use strict';

  var D = window.TYAF, I18N = window.I18N;
  D.PROJECTS = D.PROJECTS.filter(function (p) { return !p.hidden; });   // hidden: true — проект пока не опубликован
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var html = document.documentElement;
  var body = document.body;

  /* ---------- Безопасное хранилище (в приватных вкладках localStorage может падать) ---------- */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ============================================================
     1. ЯЗЫК
     ============================================================ */
  var lang = store.get('tyaf-lang');
  if (lang !== 'ru' && lang !== 'en') {
    var nav = (navigator.language || (navigator.languages && navigator.languages[0]) || 'ru').toLowerCase();
    lang = nav.indexOf('ru') === 0 ? 'ru' : 'en';
  }

  function t(key, vars) {
    var s = (I18N[lang] && I18N[lang][key]);
    if (s === undefined) s = I18N.ru[key];
    if (s === undefined) return key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] !== undefined ? vars[k] : m; });
    return s;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(n) { return (n === null || n === undefined) ? '—' : Number(n).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US'); }
  function plural(n, base) {
    var cat = new Intl.PluralRules(lang === 'ru' ? 'ru' : 'en').select(n);
    return t('count.' + base + '.' + cat, { n: n });
  }
  function fmtDate(iso) {
    try { return new Date(iso + 'T12:00:00').toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch (e) { return iso; }
  }
  function fmtSize(bytes) {
    if (!bytes) return '';
    var mb = bytes / 1048576;
    var v = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
    return v + (lang === 'ru' ? ' МБ' : ' MB');
  }

  function applyI18n(root) {
    root = root || document;
    $$('[data-i18n]', root).forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-html]', root).forEach(function (el) { el.innerHTML = t(el.getAttribute('data-i18n-html'), { year: D.SITE.foundedYear }); });
    $$('[data-i18n-attr]', root).forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var p = pair.split(':'); if (p.length === 2) el.setAttribute(p[0].trim(), t(p[1].trim()));
      });
    });
  }

  /* ============================================================
     2. ТЕМА
     ============================================================ */
  var themeBtn = $('#theme-toggle'), logoImg = $('#logo-img');
  function setTheme(th, manual) {
    html.className = th;
    themeBtn.textContent = th === 'dark' ? '☾' : '☀︎';
    logoImg.src = th === 'dark' ? 'img/logo.webp' : 'img/logo-light.webp';
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = th === 'dark' ? '#04020a' : '#f5f0ff';
    store.set('tyaf-theme', th);
    if (manual) store.set('tyaf-theme-manual', '1');
  }
  setTheme(html.classList.contains('light') ? 'light' : 'dark', false);
  themeBtn.addEventListener('click', function () { setTheme(html.classList.contains('dark') ? 'light' : 'dark', true); });
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onMq = function (e) { if (!store.get('tyaf-theme-manual')) setTheme(e.matches ? 'dark' : 'light', false); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }

  /* ============================================================
     3. API (счётчики, лайки, поддержка)
     ============================================================ */
  var API = {
    base: (window.TYAF_API_BASE || '').replace(/\/$/, ''),
    online: false,
    stats: {},
    totals: { views: 0, likes: 0, downloads: 0 },
    vid: (function () {
      var v = store.get('tyaf-vid');
      if (!v) {
        v = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
        store.set('tyaf-vid', v);
      }
      return v;
    })(),
    req: function (path, opts) {
      if (!window.TYAF_SERVER) return Promise.reject(new Error('static'));   // сервера нет — запросов не делаем
      opts = opts || {};
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 8000) : null;
      var headers = { 'X-Vid': API.vid };
      if (opts.body) headers['Content-Type'] = 'application/json';
      return fetch(API.base + path, {
        method: opts.method || 'GET', headers: headers, keepalive: !!opts.keepalive,
        body: opts.body ? JSON.stringify(opts.body) : undefined, signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        if (timer) clearTimeout(timer);
        var ct = r.headers.get('content-type') || '';
        if (ct.indexOf('application/json') === -1) { var e = new Error('not-json'); e.status = r.status; throw e; }
        return r.json().then(function (j) { if (!r.ok) { var er = new Error(j.error || 'http'); er.status = r.status; er.data = j; throw er; } return j; });
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
    },
    refresh: function () {
      return API.req('/api/stats').then(function (j) {
        API.online = true; API.stats = j.projects || {}; API.totals = j.totals || API.totals;
      }).catch(function () { API.online = false; }).then(function () { paintStats(); });
    },
    view: function (id) {
      if (!API.online) return Promise.resolve();
      return API.req('/api/view/' + encodeURIComponent(id), { method: 'POST' }).then(function (j) { mergeStat(id, j); }).catch(function () {});
    },
    like: function (id) { return API.req('/api/like/' + encodeURIComponent(id), { method: 'POST' }); },
    track: function (id, kind) {
      if (!API.online) return;
      API.req('/api/track/' + encodeURIComponent(id) + '/' + kind, { method: 'POST', keepalive: true }).then(function (j) { mergeStat(id, j); }).catch(function () {});
    }
  };
  function mergeStat(id, j) {
    if (!j || typeof j !== 'object') return;
    API.stats[id] = Object.assign(API.stats[id] || {}, j);
    var tot = { views: 0, likes: 0, downloads: 0 };
    Object.keys(API.stats).forEach(function (k) { tot.views += API.stats[k].views || 0; tot.likes += API.stats[k].likes || 0; tot.downloads += API.stats[k].downloads || 0; });
    API.totals = tot;
    paintStats();
  }
  function stat(id) { return API.stats[id] || null; }

  /* Обновление всех цифр на странице без перерисовки */
  function paintStats() {
    $$('[data-stat]').forEach(function (el) {
      var id = el.getAttribute('data-id'), k = el.getAttribute('data-stat');
      var s = stat(id);
      el.textContent = (API.online && s) ? num(s[k]) : '—';
    });
    $$('.like-btn[data-id]').forEach(function (b) {
      var s = stat(b.getAttribute('data-id'));
      var liked = !!(API.online && s && s.liked);
      b.classList.toggle('liked', liked);
      b.setAttribute('aria-pressed', liked ? 'true' : 'false');
      b.setAttribute('aria-label', liked ? t('like.remove') : t('like.add'));
      b.querySelector('.heart').textContent = liked ? '♥' : '♡';
    });
    $$('[data-total]').forEach(function (el) { el.textContent = API.online ? num(API.totals[el.getAttribute('data-total')]) : '—'; });
  }

  function statsInline(p) {
    return '<span class="stat" title="' + esc(t('stats.views')) + '">◉ <span data-stat="views" data-id="' + p.id + '">—</span></span>' +
      '<button type="button" class="like-btn" data-id="' + p.id + '" aria-pressed="false" aria-label="' + esc(t('like.add')) + '"><span class="heart">♡</span> <span data-stat="likes" data-id="' + p.id + '">—</span></button>' +
      '<span class="stat" title="' + esc(t('stats.downloads')) + '">⇩ <span data-stat="downloads" data-id="' + p.id + '">—</span></span>';
  }

  /* Лайк: оптимистично, с откатом при ошибке */
  function toggleLike(id, btn) {
    if (!API.online) { toast(t('like.fail'), true); return; }
    var s = API.stats[id] = API.stats[id] || { views: 0, likes: 0, downloads: 0, liked: false };
    var prev = { likes: s.likes, liked: s.liked };
    s.liked = !s.liked; s.likes = Math.max(0, (s.likes || 0) + (s.liked ? 1 : -1));
    paintStats();
    if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
    API.like(id).then(function (j) { mergeStat(id, j); }).catch(function () {
      s.likes = prev.likes; s.liked = prev.liked; paintStats(); toast(t('like.fail'), true);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.like-btn[data-id]');
    if (b) { e.preventDefault(); e.stopPropagation(); toggleLike(b.getAttribute('data-id'), b); }
  }, true);

  /* ============================================================
     4. TOAST
     ============================================================ */
  function toast(msg, isErr) {
    var el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : ''); el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 320); }, 3200);
  }

  /* ============================================================
     5. РЕНДЕР: категории, проекты, новости, заказы, статистика
     ============================================================ */
  var CATS = [
    { type: 'map', page: 'maps', key: 'maps', icon: '◈' },
    { type: 'mod', page: 'mods', key: 'mods', icon: '✺' },
    { type: 'texturepack', page: 'texturepacks', key: 'texturepacks', icon: '❖' }
  ];
  var PAGE_OF_TYPE = { map: 'maps', mod: 'mods', texturepack: 'texturepacks', other: 'other' };
  var PRICES = {
    rub: { texturepack: 100, mod: 500, map: 1000, full: 3000 },
    stars: { texturepack: 100, mod: 350, map: 750, full: 2500 }
  };
  function byType(type) { return D.PROJECTS.filter(function (p) { return p.type === type; }); }
  function byId(id) { for (var i = 0; i < D.PROJECTS.length; i++) if (D.PROJECTS[i].id === id) return D.PROJECTS[i]; return null; }
  function ptitle(p) { return t('p.' + p.id + '.title'); }

  function renderCategories() {
    $('#categoryGrid').innerHTML = CATS.map(function (c) {
      var list = byType(c.type);
      var img = list.length
        ? '<div class="card-img"><img src="' + list[0].cover + '" alt="" loading="lazy" decoding="async" /></div>'
        : '<div class="card-img cosmic"><span>' + c.icon + '</span><div class="soon">' + esc(t('cat.soon')) + '</div></div>';
      return '<a class="project-card" href="#/' + c.page + '">' + img +
        '<div class="card-body"><h3>' + esc(t('cat.' + c.key + '.title')) + '</h3><p>' + esc(t('cat.' + c.key + '.desc')) +
        '</p><span class="project-tag">' + esc(plural(list.length, c.type)) + '</span></div></a>';
    }).join('');
  }

  function renderProjectLists() {
    $$('[data-list]').forEach(function (box) {
      var type = box.getAttribute('data-list'), list = byType(type);
      if (!list.length) {
        var cat = CATS.filter(function (c) { return c.type === type; })[0];
        var key = cat ? cat.key : 'other';
        box.innerHTML = '<div class="empty-page"><div class="empty-icon">' + (cat ? cat.icon : '◈') + '</div><h3>' + esc(t('empty.title')) + '</h3><p>' +
          esc(t('empty.' + key)) + '</p><a class="btn btn-outline" href="' + D.SITE.telegram + '" target="_blank" rel="noopener">' + esc(t('empty.follow')) + '</a></div>';
        return;
      }
      box.innerHTML = list.map(function (p) {
        return '<article class="map-card" tabindex="0" role="link" data-open="' + p.id + '" aria-label="' + esc(ptitle(p)) + '">' +
          '<div class="card-img"><img src="' + p.cover + '" alt="' + esc(ptitle(p)) + '" loading="lazy" decoding="async" /></div>' +
          '<div class="card-body"><h3>' + esc(ptitle(p)) + '</h3><p class="clamp">' + esc(t('p.' + p.id + '.desc')) + '</p>' +
          '<div class="map-stats"><div class="stats-left">' + statsInline(p) + '</div>' +
          '<div class="stats-right">' + esc(t('by')) + ': <b>' + esc(p.author) + '</b></div></div></div></article>';
      }).join('');
    });
  }

  function newsCard(n, featured, clickable) {
    var dateLine = fmtDate(n.date) + ' • ' + t('type.news');
    return '<article class="news-card' + (featured ? ' featured' : '') + (clickable ? ' clickable' : '') + '"' + (clickable ? ' data-go="news" tabindex="0" role="link"' : '') + '>' +
      (featured ? '<span class="badge-new">' + esc(t('badge.new')) + '</span>' : '') +
      '<div class="news-date">' + esc(dateLine) + '</div>' +
      '<h4>' + n.icon + ' ' + esc(t('n.' + n.id + '.title')) + '</h4>' +
      '<p>' + esc(t('n.' + n.id + '.desc')) + '</p>' +
      (n.image ? '<div class="news-img"><img src="' + n.image + '" alt="" loading="lazy" decoding="async" /></div>' : '') +
      '<div class="news-author">' + esc(t('by')) + ': <b>' + esc(n.author) + '</b></div></article>';
  }
  function renderNews() {
    var list = D.NEWS.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    $('#homeNews').innerHTML = list.slice(0, 3).map(function (n, i) { return newsCard(n, i === 0, true); }).join('');
    $('#newsFeed').innerHTML = list.map(function (n, i) { return newsCard(n, i === 0, false); }).join('');
  }

  /* ---------- Бегущая строка и лента фактов (клик → окно с интересным фактом) ---------- */
  var tickerData = [];
  function buildTickerData() {
    tickerData = [];
    D.NEWS.forEach(function (n) {
      var fact = t('n.' + n.id + '.fact');
      tickerData.push({ icon: n.icon, title: t('n.' + n.id + '.title'), text: fact !== 'n.' + n.id + '.fact' ? fact : t('n.' + n.id + '.desc'), tag: t('type.news') });
    });
    D.PROJECTS.forEach(function (p) {
      var c = CATS.filter(function (x) { return x.type === p.type; })[0];
      var fact = t('p.' + p.id + '.fact');
      tickerData.push({ icon: c ? c.icon : '◈', title: ptitle(p), text: fact !== 'p.' + p.id + '.fact' ? fact : t('p.' + p.id + '.desc'), tag: t('type.' + p.type) });
    });
    [['✦', 'founded'], ['♫', 'music'], ['◈', 'bedrock'], ['✪', 'order']].forEach(function (x) {
      tickerData.push({ icon: x[0], title: t('tick.' + x[1] + '.title', { year: D.SITE.foundedYear }), text: t('tick.' + x[1] + '.text', { year: D.SITE.foundedYear }), tag: t('modal.facts') });
    });
  }
  function renderTickers() {
    buildTickerData();
    var idx = tickerData.map(function (_, i) { return i; });
    var rep = function (min) { var r = idx.slice(); while (r.length < min) r = r.concat(idx); return r; };
    var hItems = rep(12).map(function (i) { return '<button type="button" class="marquee-item" data-fact="' + i + '">' + tickerData[i].icon + ' <b>' + esc(tickerData[i].title) + '</b></button>'; }).join('');
    var hHTML = '<div class="mq-half">' + hItems + '</div><div class="mq-half" aria-hidden="true">' + hItems.replace(/data-fact=/g, 'tabindex="-1" data-fact=') + '</div>';
    $$('[data-ticker="h"] .marquee-content').forEach(function (el) { el.innerHTML = hHTML; });
    var vItems = rep(8).map(function (i) {
      var it = tickerData[i];
      return '<button type="button" class="vitem" data-fact="' + i + '"><span class="vi">' + it.icon + '</span><span><b>' + esc(it.title) + '</b><small>' + esc(it.tag) + '</small></span></button>';
    }).join('');
    $$('[data-ticker="v"]').forEach(function (el) { el.innerHTML = '<div>' + vItems + '</div><div aria-hidden="true">' + vItems.replace(/data-fact=/g, 'tabindex="-1" data-fact=') + '</div>'; });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fact]');
    if (!b) return;
    var it = tickerData[+b.getAttribute('data-fact')]; if (it) openFact(it.icon, it.title, it.text);
  });

  function ordersHTML() {
    var P = function (cur, k) {
      var n = PRICES[cur][k].toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
      return t('price.' + cur, { n: n });
    };
    var rows = function (cur, cls) {
      return ['texturepack', 'mod', 'map', 'full'].map(function (k) {
        return '<div class="price-item"><span class="price-name">' + esc(t('price.' + k)) + '</span><span class="price-val ' + cls + '">' + esc(P(cur, k)) + '</span></div>';
      }).join('');
    };
    return '<div class="orders-section">' +
      '<div class="section-label">' + esc(t('sec.orders')) + '</div>' +
      '<h2 class="section-title">' + esc(t('sec.ordersTitle')) + '</h2>' +
      '<p class="orders-sub">' + esc(t('orders.sub')) + '</p>' +
      '<div class="orders-grid">' +
      '<div class="order-card"><span class="order-icon">₽</span><div class="order-title">' + esc(t('orders.rub.title')) + '</div><p class="order-desc">' + esc(t('orders.rub.desc')) + '</p><div class="price-list">' + rows('rub', '') + '</div>' +
      '<a href="' + D.SITE.telegramDirect + '" target="_blank" rel="noopener" class="order-btn primary">' + esc(t('orders.write')) + '</a></div>' +
      '<div class="order-card"><span class="order-icon">✦</span><div class="order-title">' + esc(t('orders.stars.title')) + '</div><p class="order-desc">' + esc(t('orders.stars.desc')) + '</p><div class="price-list">' + rows('stars', 'gold') + '</div>' +
      '<a href="' + D.SITE.telegramDirect + '" target="_blank" rel="noopener" class="order-btn gold">' + esc(t('orders.write')) + '</a></div>' +
      '</div><p class="orders-note">' + esc(t('orders.note')) + '</p></div>';
  }
  function renderOrders() { $$('[data-orders]').forEach(function (el) { el.innerHTML = ordersHTML(); }); }

  function renderAbout() {
    var count = D.PROJECTS.length;
    $('#homeStats').innerHTML =
      '<div><div class="stat-num">' + count + '</div><div class="stat-label">' + esc(t('stat.projects')) + '</div></div>' +
      '<div><div class="stat-num">' + num(D.SITE.subscribers) + '</div><div class="stat-label">' + esc(t('stat.subscribers')) + '</div></div>' +
      (window.TYAF_SERVER ? '<div><div class="stat-num" data-total="downloads">—</div><div class="stat-label">' + esc(t('stat.downloads')) + '</div></div>' : '') +
      '<div><div class="stat-num">∞</div><div class="stat-label">' + esc(t('stat.ideas')) + '</div></div>';
    $('#aboutFull').innerHTML = t('about.full', { year: D.SITE.foundedYear });
    $('#aboutStats').innerHTML =
      '<div><div class="stat-number">' + count + '</div><div class="stat-label">' + esc(t('stat.projects')) + '</div></div>' +
      '<div><div class="stat-number">' + num(D.SITE.subscribers) + '</div><div class="stat-label">' + esc(t('stat.subscribers')) + '</div></div>' +
      (window.TYAF_SERVER ? '<div><div class="stat-number" data-total="downloads">—</div><div class="stat-label">' + esc(t('stat.downloads')) + '</div></div>' : '') +
      (window.TYAF_SERVER ? '<div><div class="stat-number" data-total="likes">—</div><div class="stat-label">' + esc(t('stat.likes')) + '</div></div>' : '') +
      (window.TYAF_SERVER ? '<div><div class="stat-number" data-total="views">—</div><div class="stat-label">' + esc(t('stat.views')) + '</div></div>' : '');
    $('#creditsText').textContent = t('about.creditsText', { team: D.SITE.team, author: D.SITE.author });
    $('#footerMade').textContent = t('footer.made', { team: D.SITE.team, year: new Date(D.SITE.launchDate).getFullYear() });
  }

  function renderAll() {
    renderCategories(); renderProjectLists(); renderNews(); renderTickers(); renderOrders(); renderAbout();
    applyI18n();
    document.title = t('meta.title');
    var md = $('meta[name="description"]'); if (md) md.content = t('meta.desc');
    html.lang = lang;
    $('#lang-toggle').textContent = lang.toUpperCase();
    paintStats();
  }

  /* ============================================================
     6. РОУТЕР (#/maps, #/maps/map1 …)
     ============================================================ */
  var PAGES = ['home', 'maps', 'mods', 'texturepacks', 'other', 'news', 'orders', 'support', 'about'];
  var currentPage = 'home';

  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '').split('/');
    var page = PAGES.indexOf(h[0]) !== -1 ? h[0] : 'home';
    return { page: page, id: h[1] || null };
  }

  function showPage(page) {
    var changed = page !== currentPage;
    currentPage = page;
    $$('.page').forEach(function (p) { p.classList.toggle('active', p.getAttribute('data-page') === page); });
    $$('.nav-link[data-route], .sub-link[data-route]').forEach(function (a) {
      var on = a.getAttribute('data-route') === page;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var inSub = ['maps', 'mods', 'texturepacks', 'other'].indexOf(page) !== -1;
    var sub = $('#sub-projects'), tog = $('#projectsToggle');
    if (inSub) { sub.classList.add('open'); tog.setAttribute('aria-expanded', 'true'); }
    tog.classList.toggle('active', inSub);
    closeSidebar();
    if (changed) { window.scrollTo(0, 0); }
  }

  function route() {
    var r = parseHash();
    var project = r.id ? byId(r.id) : null;
    if (project && r.page !== PAGE_OF_TYPE[project.type]) r.page = PAGE_OF_TYPE[project.type];
    showPage(r.page);
    if (project) openProject(project); else closeProjectUI();
    if (r.page === 'maps' || r.page === 'home') API.refresh();
  }
  window.addEventListener('hashchange', route);

  /* ============================================================
     7. САЙДБАР / БУРГЕР
     ============================================================ */
  var burger = $('#burgerBtn'), sidebar = $('#sidebar'), overlay = $('#sidebarOverlay');
  function openSidebar() {
    sidebar.classList.add('open'); overlay.classList.add('open'); burger.classList.add('open');
    burger.setAttribute('aria-expanded', 'true'); body.style.overflow = 'hidden'; body.classList.add('sidebar-open');
  }
  function closeSidebar() {
    sidebar.classList.remove('open'); overlay.classList.remove('open'); burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false'); body.classList.remove('sidebar-open');
    if (!body.classList.contains('modal-open')) body.style.overflow = '';
  }
  burger.addEventListener('click', function () { sidebar.classList.contains('open') ? closeSidebar() : openSidebar(); });
  overlay.addEventListener('click', closeSidebar);
  $('#projectsToggle').addEventListener('click', function () {
    var open = $('#sub-projects').classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) closeSidebar(); });

  /* ============================================================
     8. МОДАЛЬНОЕ ОКНО ПРОЕКТА
     ============================================================ */
  var pm = $('#projectModal'), fm = $('#factModal');
  var cur = null, slide = 0, lastFocus = null, tab = 'gallery', duckResume = false;

  function lockBody(on) {
    body.classList.toggle('modal-open', on);
    body.style.overflow = on ? 'hidden' : (sidebar.classList.contains('open') ? 'hidden' : '');
  }

  function openProject(p) {
    if (cur && cur.id === p.id && !pm.hidden) { return; }
    cur = p; slide = 0; tab = 'gallery';
    lastFocus = document.activeElement;

    $('#pmTitle').textContent = ptitle(p);
    $('#pmAuthor').textContent = p.author;
    $('#pmDesc').textContent = t('p.' + p.id + '.desc');
    var fact = t('p.' + p.id + '.fact');
    $('#pmFact').textContent = fact === 'p.' + p.id + '.fact' ? '' : '✧ ' + fact;
    $('#pmStats').innerHTML = statsInline(p);

    // Галерея
    var imgs = (p.gallery && p.gallery.length) ? p.gallery : [p.cover];
    $('#pmTrack').innerHTML = imgs.map(function (src, i) {
      return '<div class="slide"><img src="' + src + '" alt="' + esc(ptitle(p)) + ' — ' + (i + 1) + '" draggable="false" ' + (i ? 'loading="lazy"' : '') + ' decoding="async" /></div>';
    }).join('');
    $('#pmDots').innerHTML = imgs.map(function (_, i) { return '<button type="button" data-dot="' + i + '" aria-label="' + (i + 1) + '"></button>'; }).join('');
    $('#pmPrev').hidden = $('#pmNext').hidden = $('#pmDots').hidden = imgs.length < 2;
    goSlide(0);

    // Видео
    var hasVideo = !!(p.video && (p.video.src || p.video.youtube));
    $('#pmTabs').hidden = !hasVideo;
    setTab('gallery');

    // Скачивание: 2 способа
    var tg = $('#pmTg'), file = $('#pmFile');
    tg.href = p.tg || D.SITE.telegram;
    file.href = API.online ? (API.base + '/dl/' + encodeURIComponent(p.id) + '?v=' + encodeURIComponent(API.vid)) : p.file;
    file.setAttribute('download', p.file.split('/').pop());
    $('#pmSize').textContent = p.size ? '(' + fmtSize(p.size) + ')' : '';
    $('#pmShare').hidden = false;

    paintStats();
    pm.hidden = false; lockBody(true);
    pm.scrollTop = 0;
    $('.modal-close', pm).focus({ preventScroll: true });
    API.view(p.id);
  }

  function closeProjectUI() {
    if (pm.hidden) return;
    pm.hidden = true; cur = null; $('#pmVideo').innerHTML = ''; duck(false);
    lockBody(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }
  function closeProject() {
    if (pm.hidden) return;
    var r = parseHash();
    if (r.id) { location.hash = '#/' + r.page; } else { closeProjectUI(); }
  }

  function goSlide(i) {
    var n = $$('#pmTrack .slide').length; if (!n) return;
    slide = (i + n) % n;
    $('#pmTrack').style.transform = 'translateX(' + (-100 * slide) + '%)';
    $$('#pmDots button').forEach(function (d, k) { d.classList.toggle('active', k === slide); });
  }
  $('#pmPrev').addEventListener('click', function () { goSlide(slide - 1); });
  $('#pmNext').addEventListener('click', function () { goSlide(slide + 1); });
  $('#pmDots').addEventListener('click', function (e) { var b = e.target.closest('[data-dot]'); if (b) goSlide(+b.getAttribute('data-dot')); });
  (function swipe() {
    var g = $('.gallery', pm), x0 = null, y0 = null;
    g.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    g.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) goSlide(slide + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });
  })();

  /* Вкладки «Скриншоты / Видео» */
  function setTab(name) {
    tab = name;
    $$('#pmTabs button').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    $('#pmGallery').hidden = name !== 'gallery';
    var pane = $('#pmVideo'); pane.hidden = name !== 'video';
    pane.innerHTML = ''; duck(false);
    if (name === 'video' && cur) buildVideo(pane, cur.video);
  }
  $('#pmTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (b) setTab(b.getAttribute('data-tab')); });

  function videoSoon(pane) {
    pane.innerHTML = '<div class="video-soon"><span>▶︎</span><div>' + esc(t('modal.videoSoon')) + '</div></div>';
  }
  function buildVideo(pane, v) {
    if (v.youtube) {
      pane.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.youtube) + '?rel=0" title="' + esc(ptitle(cur)) + '" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>';
      duck(true);
      return;
    }
    var vid = document.createElement('video');
    vid.controls = true; vid.playsInline = true; vid.preload = 'metadata';
    if (v.poster) vid.poster = v.poster;
    vid.setAttribute('playsinline', '');
    vid.src = v.src;
    vid.addEventListener('error', function () { videoSoon(pane); });
    vid.addEventListener('play', function () { duck(true); });
    vid.addEventListener('pause', function () { duck(false); });
    vid.addEventListener('ended', function () { duck(false); });
    pane.appendChild(vid);
  }

  /* Приглушаем фоновую музыку, пока играет видео */
  function duck(on) {
    if (on) { if (!audio.paused) { audio.pause(); duckResume = true; } }
    else if (duckResume) { duckResume = false; var pr = audio.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }

  /* Скачивание */
  $('#pmTg').addEventListener('click', function () { if (cur) API.track(cur.id, 'tg'); });
  $('#pmFile').addEventListener('click', function () {
    if (!cur) return;
    toast(t('modal.dlStarted'));
    if (!API.online) return;                      // с сервера /dl/ считает сам
    setTimeout(function () { API.refresh(); }, 2500);
  });
  /* Поделиться */
  $('#pmShare').addEventListener('click', function () {
    if (!cur) return;
    var url = location.origin + location.pathname + '#/' + PAGE_OF_TYPE[cur.type] + '/' + cur.id;
    if (navigator.share) { navigator.share({ title: ptitle(cur), text: t('p.' + cur.id + '.desc'), url: url }).catch(function () {}); return; }
    var done = function () { toast(t('modal.copied')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt('URL', url); });
    else window.prompt('URL', url);
  });

  /* Окно факта */
  function openFact(icon, title, text) {
    $('#factIcon').textContent = icon; $('#factTitle').textContent = title; $('#factText').textContent = text;
    lastFocus = document.activeElement; fm.hidden = false; lockBody(true); $('.modal-close', fm).focus({ preventScroll: true });
  }
  function closeFact() { if (fm.hidden) return; fm.hidden = true; lockBody(!pm.hidden); }

  /* Закрытие окон */
  [pm, fm].forEach(function (m) {
    m.addEventListener('mousedown', function (e) { if (e.target === m) (m === pm ? closeProject() : closeFact()); });
    $('[data-close]', m).addEventListener('click', function () { m === pm ? closeProject() : closeFact(); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!fm.hidden) closeFact(); else if (!pm.hidden) closeProject(); else closeSidebar(); return; }
    if (!pm.hidden && fm.hidden) {
      if (e.key === 'ArrowLeft' && tab === 'gallery') goSlide(slide - 1);
      if (e.key === 'ArrowRight' && tab === 'gallery') goSlide(slide + 1);
    }
    if (e.key === 'Tab') {                                  // ловушка фокуса внутри окна
      var m = !fm.hidden ? fm : (!pm.hidden ? pm : null); if (!m) return;
      var f = $$('a[href],button:not([disabled]),summary,input,select,textarea,[tabindex]:not([tabindex="-1"])', m).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* Клики по карточкам (делегирование) */
  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-open]');
    if (card) { var p = byId(card.getAttribute('data-open')); if (p) location.hash = '#/' + PAGE_OF_TYPE[p.type] + '/' + p.id; return; }
    var go = e.target.closest('[data-go]');
    if (go) { location.hash = '#/' + go.getAttribute('data-go'); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-open],[data-go]')) { e.preventDefault(); e.target.click(); }
  });

  /* ============================================================
     9. ПОДДЕРЖКА
     ============================================================ */
  (function support() {
    var form = $('#supportForm'), status = $('#sf-status'), btn = $('#sf-send'), msg = $('#sf-message');
    var shownAt = Date.now();
    msg.addEventListener('input', function () { $('#sf-count').textContent = msg.value.length; });
    function setStatus(text, cls) { status.textContent = text; status.className = 'form-status ' + (cls || ''); }
    function mark(el, bad) { el.closest('.field').classList.toggle('invalid', !!bad); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.name.value.trim(), contact = form.contact.value.trim(), message = msg.value.trim();
      [form.name, form.contact, msg].forEach(function (el) { mark(el, false); });
      if (!name || !contact || !message) {
        mark(form.name, !name); mark(form.contact, !contact); mark(msg, !message);
        return setStatus(t('support.errRequired'), 'err');
      }
      if (!/^(@?[A-Za-z0-9_]{4,32}|[^\s@]+@[^\s@]+\.[^\s@]{2,}|https?:\/\/\S+)$/.test(contact)) { mark(form.contact, true); return setStatus(t('support.errContact'), 'err'); }
      if (message.length < 10) { mark(msg, true); return setStatus(t('support.errShort'), 'err'); }

      btn.disabled = true; setStatus(t('support.sending'));
      API.req('/api/support', { method: 'POST', body: {
        name: name, contact: contact, topic: form.topic.value, message: message, website: form.website.value,
        elapsed: Date.now() - shownAt, lang: lang, page: location.hash
      } }).then(function () {
        setStatus(t('support.ok'), 'ok'); form.reset(); $('#sf-count').textContent = '0'; shownAt = Date.now();
      }).catch(function (err) {
        setStatus(err && err.status === 429 ? t('support.errRate') : (err && err.status === 400 && err.data && err.data.message ? err.data.message : t('support.errServer')), 'err');
      }).then(function () { btn.disabled = false; });
    });
  })();

  /* ============================================================
     10. МУЗЫКА
     ============================================================ */
  var audio = $('#bg-audio'), playIcon = $('#play-icon'), mTitle = $('#music-title'), mDot = $('#playing-indicator');
  var tracks = [
    { title: 'The Treacherous Song of the North', src: 'music/track1.mp3' },
    { title: 'Whispers in the Cold', src: 'music/track2.mp3' },
    { title: 'The Call of the Abyss', src: 'music/track3.mp3' }
  ];
  var ti = 0, srcLoaded = false;
  function showTrack() { mTitle.textContent = tracks[ti].title; mTitle.title = tracks[ti].title; }
  function loadTrack(play) {
    audio.src = tracks[ti].src; srcLoaded = true; showTrack();
    if (play) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); }
  }
  function step(d) { var was = !audio.paused; ti = (ti + d + tracks.length) % tracks.length; if (was) loadTrack(true); else { srcLoaded = false; showTrack(); } }
  $('#play-toggle').addEventListener('click', function () {
    duckResume = false;
    if (!srcLoaded) { loadTrack(true); return; }
    if (audio.paused) { var p = audio.play(); if (p && p.catch) p.catch(function () {}); } else audio.pause();
  });
  $('#prev-track').addEventListener('click', function () { step(-1); });
  $('#next-track').addEventListener('click', function () { step(1); });
  audio.addEventListener('play', function () { playIcon.textContent = '❙❙'; mDot.hidden = false; });
  audio.addEventListener('pause', function () { playIcon.textContent = '▶'; mDot.hidden = true; });
  audio.addEventListener('ended', function () { ti = (ti + 1) % tracks.length; loadTrack(true); });
  audio.addEventListener('error', function () { if (srcLoaded) { toast(t('music.loadErr'), true); playIcon.textContent = '▶'; mDot.hidden = true; } });
  showTrack();

  /* ============================================================
     11. ЯЗЫК — переключатель
     ============================================================ */
  $('#lang-toggle').addEventListener('click', function () {
    lang = lang === 'ru' ? 'en' : 'ru'; store.set('tyaf-lang', lang);
    renderAll();
    if (cur && !pm.hidden) { var p = cur; cur = null; pm.hidden = true; var prevFocus = lastFocus; openProject(p); lastFocus = prevFocus; }
  });

  /* ============================================================
     12. КУРСОР, «НАВЕРХ»
     ============================================================ */
  if (window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    body.classList.add('has-cursor');
    var star = $('#cursor-star'), trail = $('#cursor-trail'), cx = 0, cy = 0, raf = 0;
    document.addEventListener('mousemove', function (e) {
      cx = e.clientX; cy = e.clientY;
      if (!raf) raf = requestAnimationFrame(function () {
        star.style.left = cx + 'px'; star.style.top = cy + 'px';
        trail.style.left = cx + 'px'; trail.style.top = cy + 'px'; raf = 0;
      });
    }, { passive: true });
    document.addEventListener('mouseleave', function () { star.style.opacity = 0; trail.style.opacity = 0; });
    document.addEventListener('mouseenter', function () { star.style.opacity = ''; trail.style.opacity = ''; });
  }
  var toTop = $('#toTop');
  window.addEventListener('scroll', function () { toTop.hidden = window.scrollY < 700; }, { passive: true });
  toTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ============================================================
     13. КОСМИЧЕСКИЙ ФОН (облегчённый)
     ============================================================ */
  (function galaxy() {
    var canvas = $('#galaxy-canvas'), ctx = canvas.getContext('2d');
    var W = 0, H = 0, time = 0;
    var small = Math.min(window.innerWidth, window.innerHeight) < 700;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var N_STARS = small ? 300 : 700, N_GAL = small ? 900 : 2400;
    var stars = [], gal = [];
    var nebulae = [
      { x: .2, y: .3, hue: 280, sat: 60, light: 40, size: .25 }, { x: .7, y: .25, hue: 220, sat: 70, light: 50, size: .2 },
      { x: .4, y: .6, hue: 300, sat: 50, light: 35, size: .22 }, { x: .8, y: .7, hue: 260, sat: 60, light: 45, size: .18 },
      { x: .1, y: .7, hue: 200, sat: 50, light: 40, size: .15 }
    ];
    var TAU = Math.PI * 2, i;
    for (i = 0; i < N_STARS; i++) { var h = 240 + Math.random() * 60; stars.push({ x: Math.random(), y: Math.random(), r: .3 + Math.random() * 2.2, t: Math.random() * TAU, sp: .001 + Math.random() * .012, b: .2 + Math.random() * .8, c: 'hsl(' + h + ',70%,85%)', g: 'hsl(' + h + ',80%,80%)' }); }
    for (i = 0; i < N_GAL; i++) { var gh = 260 + Math.random() * 40; gal.push({ a: Math.random() * TAU + Math.floor(Math.random() * 3) * 2.094, d: Math.random() * .7, r: .5 + Math.random() * 2, b: .3 + Math.random() * .6, c: 'hsl(' + gh + ',80%,75%)' }); }

    function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { resize(); if (reduce) frame(); }, 150); });
    resize();

    function frame() {
      time += .003;
      var dark = html.classList.contains('dark');
      ctx.globalAlpha = 1;
      if (dark) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = '#f5f0ff'; ctx.fillRect(0, 0, W, H); }
      var cx = W * .5, cy = H * .45, n, g, x, y, s;

      for (var k = 0; k < nebulae.length; k++) {
        n = nebulae[k];
        x = n.x * W + Math.sin(time * .01 + n.hue) * 20; y = n.y * H + Math.cos(time * .015 + n.light) * 20;
        var size = n.size * Math.max(W, H * .8) * .3;
        g = ctx.createRadialGradient(x, y, 0, x, y, size);
        if (dark) { g.addColorStop(0, 'hsla(' + n.hue + ',' + n.sat + '%,' + n.light + '%,.16)'); g.addColorStop(.5, 'hsla(' + n.hue + ',' + (n.sat - 10) + '%,' + (n.light - 10) + '%,.07)'); }
        else { g.addColorStop(0, 'rgba(210,205,235,.28)'); g.addColorStop(.5, 'rgba(200,195,225,.12)'); }
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, size, 0, TAU); ctx.fill();
      }

      var rad = Math.max(W, H * 1.2) * .42;
      for (i = 0; i < gal.length; i++) {
        s = gal[i];
        var a = s.a + time * .02 * (1 - s.d * .5), dist = s.d * rad;
        x = cx + Math.cos(a) * dist + Math.sin(time * .3 + s.d * 5) * 3;
        y = cy + Math.sin(a) * dist * .4 + Math.cos(time * .2 + s.d * 3) * 2;
        var sz = s.r * (.8 + .4 * Math.sin(time * .5 + s.d * 10)), al = s.b * (.4 + .6 * (1 - s.d * 1.2));
        ctx.beginPath(); ctx.arc(x, y, dark ? sz : sz * .8, 0, TAU);
        if (dark) { ctx.globalAlpha = Math.max(0, al * .85); ctx.fillStyle = s.c; } else { ctx.globalAlpha = Math.min(1, (al * .5 + .1) * .45); ctx.fillStyle = '#1a0a2e'; }
        ctx.fill();
      }
      for (i = 0; i < stars.length; i++) {
        s = stars[i]; s.t += s.sp;
        var tw = s.b * (.5 + .5 * Math.sin(s.t)); x = s.x * W; y = s.y * H;
        ctx.beginPath(); ctx.arc(x, y, dark ? s.r : s.r * .9, 0, TAU);
        if (dark) { ctx.globalAlpha = Math.max(0, tw * .7); ctx.fillStyle = s.c; } else { ctx.globalAlpha = Math.min(1, (tw * .5 + .05) * .5); ctx.fillStyle = '#1a0a2e'; }
        ctx.fill();
        if (dark && s.b > .6) { ctx.beginPath(); ctx.arc(x, y, s.r * 5, 0, TAU); ctx.globalAlpha = Math.max(0, tw * .05); ctx.fillStyle = s.g; ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      if (!dark) {
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .7);
      { g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(200,200,215,.15)'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
    }

    if (reduce) { frame(); return; }
    var last = 0, minDt = small ? 1000 / 30 : 1000 / 45, running = true;
    function loop(ts) {
      if (running && ts - last >= minDt) { last = ts; frame(); }
      requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', function () { running = !document.hidden; });
    requestAnimationFrame(loop);
  })();

  /* ============================================================
     14. СТАРТ
     ============================================================ */
  renderAll();
  route();
  API.refresh();
  setInterval(function () { if (!document.hidden && API.online) API.refresh(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) API.refresh(); });
})();
