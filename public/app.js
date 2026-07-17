/**
 * Nifty-7 — Dream11 / My11Circle-style client
 * Green brand preserved. Contests, logos, FOMO joins, premium login.
 */
(function () {
  'use strict';

  const NIFTY50 = [
    { s: 'RELIANCE', n: 'Reliance Industries' },
    { s: 'TCS', n: 'Tata Consultancy' },
    { s: 'HDFCBANK', n: 'HDFC Bank' },
    { s: 'ICICIBANK', n: 'ICICI Bank' },
    { s: 'INFY', n: 'Infosys' },
    { s: 'SBIN', n: 'State Bank of India' },
    { s: 'BHARTIARTL', n: 'Bharti Airtel' },
    { s: 'ITC', n: 'ITC Limited' },
    { s: 'LT', n: 'Larsen & Toubro' },
    { s: 'WIPRO', n: 'Wipro' },
    { s: 'MARUTI', n: 'Maruti Suzuki' },
    { s: 'ASIANPAINT', n: 'Asian Paints' },
    { s: 'AXISBANK', n: 'Axis Bank' },
    { s: 'SUNPHARMA', n: 'Sun Pharma' },
    { s: 'TITAN', n: 'Titan Company' },
    { s: 'TATAMOTORS', n: 'Tata Motors' },
    { s: 'ADANIENT', n: 'Adani Enterprises' },
    { s: 'ADANIPORTS', n: 'Adani Ports' },
    { s: 'BAJFINANCE', n: 'Bajaj Finance' },
    { s: 'HINDUNILVR', n: 'Hindustan Unilever' },
    { s: 'TATASTEEL', n: 'Tata Steel' },
    { s: 'TECHM', n: 'Tech Mahindra' },
    { s: 'POWERGRID', n: 'Power Grid' },
    { s: 'NTPC', n: 'NTPC' },
    { s: 'ZEEL', n: 'Zee Entertainment' },
    { s: 'BAJAJ-AUTO', n: 'Bajaj Auto' },
    { s: 'APOLLOHOSP', n: 'Apollo Hospitals' },
    { s: 'BRITANNIA', n: 'Britannia' },
    { s: 'BPCL', n: 'BPCL' },
    { s: 'CIPLA', n: 'Cipla' },
    { s: 'COALINDIA', n: 'Coal India' },
    { s: 'DIVISLAB', n: 'Divi\'s Labs' },
    { s: 'DRREDDY', n: 'Dr Reddy\'s' },
    { s: 'EICHERMOT', n: 'Eicher Motors' },
    { s: 'GRASIM', n: 'Grasim' },
    { s: 'HCLTECH', n: 'HCL Tech' },
    { s: 'HDFCLIFE', n: 'HDFC Life' },
    { s: 'HEROMOTOCO', n: 'Hero MotoCorp' },
    { s: 'HINDALCO', n: 'Hindalco' },
    { s: 'INDUSINDBK', n: 'IndusInd Bank' },
    { s: 'JSWSTEEL', n: 'JSW Steel' },
    { s: 'KOTAKBANK', n: 'Kotak Mahindra' },
    { s: 'LTIM', n: 'LTIMindtree' },
    { s: 'M&M', n: 'Mahindra & Mahindra' },
    { s: 'NESTLEIND', n: 'Nestlé India' },
    { s: 'ONGC', n: 'ONGC' },
    { s: 'SBILIFE', n: 'SBI Life' },
    { s: 'TATACONSUM', n: 'Tata Consumer' },
    { s: 'ULTRACEMCO', n: 'UltraTech Cement' }
  ];

  const LOGO_COLORS = {
    RELIANCE: '1a3c6e', TCS: '0d47a1', HDFCBANK: '004c8f', ICICIBANK: 'f58220', INFY: '007cc3',
    SBIN: '22409a', BHARTIARTL: 'e60012', ITC: 'f7a800', LT: '003366', WIPRO: '341c79'
  };

  let livePriceMap = {};
  let selectedStocks = [];
  let contestsCache = [];
  let joining = false;
  let builderStep = 1; // 1 select, 2 captain
  let bullPick = '';
  let calfPick = '';
  let filterMode = 'all';
  let localJoinedBump = 0;
  let pendingTeamName = '';

  const $ = (id) => document.getElementById(id);
  const safeId = (sym) => String(sym).replace(/[^a-zA-Z0-9]/g, '_');
  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function getUser() {
    try { return JSON.parse(localStorage.getItem('nifty7_user') || 'null'); } catch (_) { return null; }
  }
  function setUser(u) { localStorage.setItem('nifty7_user', JSON.stringify(u)); }
  function getToken() { return localStorage.getItem('nifty7_token') || ''; }
  function setToken(t) { if (t) localStorage.setItem('nifty7_token', t); }
  function getBaskets() {
    try { return JSON.parse(localStorage.getItem('nifty7_saved_baskets') || '[]'); } catch (_) { return []; }
  }
  function setBaskets(list) { localStorage.setItem('nifty7_saved_baskets', JSON.stringify(list || [])); }

  function toast(msg, type) {
    const host = $('toastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' err' : type === 'warn' ? ' warn' : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
  }

  async function api(url, options) {
    const headers = { 'Content-Type': 'application/json', ...(options && options.headers) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    let data;
    try { data = await res.json(); } catch (_) { throw new Error('Invalid server response'); }
    if (!res.ok && data && data.message) {
      const err = new Error(data.message);
      err.data = data;
      throw err;
    }
    return data;
  }

  function formatINR(n) {
    const num = Number(n) || 0;
    if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
    if (num >= 100000) return '₹' + (num / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    return '₹' + Math.round(num).toLocaleString('en-IN');
  }

  function logoUrl(sym) {
    const normalized = String(sym).replace(/\s+/g, '').replace(/&/g, 'and');
    const color = LOGO_COLORS[sym] || '00b35a';
    const tickertape = `https://assets.tickertape.in/stock-logos/${encodeURIComponent(normalized)}.png`;
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(sym)}&background=${color}&color=fff&bold=true&size=64&format=png`;
    return { tickertape, fallback };
  }

  function logoImg(sym, size) {
    const { tickertape, fallback } = logoUrl(sym);
    const px = size || 18;
    return `<img src="${tickertape}" alt="" width="${px}" height="${px}" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'" style="width:${px}px;height:${px}px;border-radius:50%;object-fit:cover;background:#fff">`;
  }

  function companyName(sym) {
    const hit = NIFTY50.find((x) => x.s === sym);
    return hit ? hit.n : sym;
  }

  // ---------- NAV ----------
  window.switchNav = function (tab) {
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('on'));
    document.querySelectorAll('.nav button').forEach((el) => el.classList.remove('on'));
    const view = $(`view-${tab}`);
    const nav = $(`nav-${tab}`);
    if (view) view.classList.add('on');
    if (nav) nav.classList.add('on');
    checkSession();
    if (tab === 'home' || tab === 'contests') refreshContests();
  };

  window.switchContestTab = function (sub) {
    $('tab-btn-live').className = sub === 'live' ? 'chip on' : 'chip';
    $('tab-btn-completed').className = sub === 'completed' ? 'chip on' : 'chip';
    $('contest-section-live').style.display = sub === 'live' ? 'block' : 'none';
    $('contest-section-completed').style.display = sub === 'completed' ? 'block' : 'none';
  };

  window.closeModal = function (id) {
    const el = $(id);
    if (el) el.classList.remove('open');
  };
  function openModal(id) {
    const el = $(id);
    if (el) el.classList.add('open');
  }

  // ---------- MARKET + COUNTDOWN ----------
  function setMarketStatus(source) {
    const el = $('marketStatusBadge');
    if (!el) return;
    el.textContent = `Market source: ${source || 'unknown'}`;
    el.style.background = source === 'yahoo' ? 'rgba(15,118,110,.95)' : source === 'error' ? 'rgba(220,38,38,.95)' : 'rgba(107,33,168,.95)';
  }

  function setMarketDebug(data) {
    const debug = $('marketDebugInfo');
    if (!debug) return;
    if (!data || !data.prices) {
      debug.textContent = 'Live debug: no market feed data yet';
      return;
    }
    const sample = data.prices.RELIANCE || Object.values(data.prices)[0] || { price: '—', change: 0 };
    const change = Number.isFinite(Number(sample.change)) ? Number(sample.change).toFixed(2) : '0.00';
    debug.textContent = `Live debug: ${Object.keys(data.prices).length} symbols · RELIANCE ₹${sample.price} ${change}%`;
  }

  async function updateMarketFeed() {
    try {
      const data = await api('/api/contests/prices');
      if (data.success && data.prices) {
        livePriceMap = data.prices;
        console.log('Market feed loaded', data.source, Object.keys(data.prices).length);
        console.log('RELIANCE data', data.prices.RELIANCE);
        setMarketStatus(data.source);
        setMarketDebug(data);
        renderNewsTicker();
        updateBuilderPrices();
      } else {
        console.warn('Market feed returned no prices', data);
        setMarketStatus('fallback');
        setMarketDebug(null);
      }
    } catch (err) {
      console.error('Market feed failed', err);
      setMarketStatus('error');
      setMarketDebug(null);
    }
  }

  function renderNewsTicker() {
    const el = $('newsTickerContent');
    if (!el) return;
    const keys = Object.keys(livePriceMap);
    if (!keys.length) {
      el.innerHTML = '<span class="t-item">Syncing live Nifty 50…</span>';
      return;
    }
    let html = '';
    keys.forEach((sym) => {
      const st = livePriceMap[sym];
      const ch = Number.isFinite(Number(st.change)) ? Number(st.change) : 0;
      html += `<span class="t-item">${logoImg(sym, 16)} <b>${escapeHtml(sym)}</b> ₹${st.price} <span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</span></span>`;
    });
    el.innerHTML = html + html;
  }

  function updateLockCountdown() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const lock = new Date(ist);
    lock.setHours(8, 55, 0, 0);
    if (ist > lock) lock.setDate(lock.getDate() + 1);
    // Weekend → Monday
    while (lock.getDay() === 0 || lock.getDay() === 6) lock.setDate(lock.getDate() + 1);

    const diff = lock - ist;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    if ($('lockCountdown')) $('lockCountdown').textContent = `Lock in ${pad(h)}:${pad(m)}:${pad(s)}`;

    const open = ist.getDay() >= 1 && ist.getDay() <= 5 && ist.getHours() * 100 + ist.getMinutes() < 1530;
    if ($('matchLivePill')) {
      $('matchLivePill').textContent = open ? '● MARKET OPEN' : '● MARKET CLOSED';
      $('matchLivePill').style.color = open ? '#fda4af' : '#86efac';
    }
  }

  // ---------- CONTEST CARDS ----------
  function contestCardHTML(c, featured) {
    const joined = (c.joined || 0) + (c.id === 'mega_daily' ? localJoinedBump : 0);
    const max = c.max_spots || 100;
    const left = Math.max(0, max - joined);
    const pct = Math.min(98, Math.max(4, (joined / max) * 100));
    const pot = c.pot || joined * (c.entry_fee || 100);
    const first = Math.round(pot * 0.222);
    const winners = Math.max(1, Math.floor(joined * 0.35));
    const isH2H = c.type === '1v1';
    const badges = isH2H
      ? '<span class="badge b-guar">Winner Takes ~90%</span>'
      : '<span class="badge b-mega">Mega</span><span class="badge b-flex">Flexible</span><span class="badge b-guar">Guaranteed</span>';

    return `
      <article class="contest ${featured ? 'hot' : ''}" data-type="${isH2H ? 'h2h' : 'mega'}" data-fee="${c.entry_fee}">
        <div class="c-head"><div class="c-badges">${badges}</div>
          <span style="font-size:11px;font-weight:800;color:var(--muted)">${escapeHtml(c.name)}</span>
        </div>
        <div class="c-body">
          <div>
            <div class="prize-label">Prize Pool</div>
            <div class="prize">${formatINR(pot)}</div>
            <div class="first">1st Prize <b>${formatINR(first)}</b> · ${winners.toLocaleString('en-IN')} winners</div>
          </div>
          <button type="button" class="entry" onclick="startJoinFlow('${c.id}', ${c.entry_fee}, '${escapeHtml(c.name)}')">₹${c.entry_fee}</button>
        </div>
        <div class="c-foot">
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="spots">
            <span>${left.toLocaleString('en-IN')} spots left</span>
            <span>${joined.toLocaleString('en-IN')} teams</span>
          </div>
        </div>
        <div class="c-actions">
          <button type="button" class="line-btn" onclick="showWinningsInfo('${c.id}', ${pot})">Prize Breakup</button>
          <button type="button" class="line-btn" onclick="openStandings('${c.id}', '${escapeHtml(c.name)}')">Leaderboard</button>
        </div>
      </article>`;
  }

  function applyFilter() {
    document.querySelectorAll('#homeContestList .contest, #contestListFull .contest').forEach((el) => {
      const type = el.getAttribute('data-type');
      const fee = Number(el.getAttribute('data-fee'));
      let show = true;
      if (filterMode === 'mega') show = type === 'mega';
      if (filterMode === 'h2h') show = type === 'h2h';
      if (filterMode === 'low') show = fee <= 100;
      el.style.display = show ? 'block' : 'none';
    });
  }

  async function refreshContests() {
    try {
      const data = await api('/api/contests');
      if (!data.success) return;
      contestsCache = data.contests || [];
      const mega = contestsCache.find((c) => c.id === 'mega_daily') || contestsCache.find((c) => c.type === 'mega');
      const battles = contestsCache.filter((c) => c.type === '1v1');

      if (mega) {
        const joined = mega.joined + localJoinedBump;
        if ($('statJoined')) $('statJoined').textContent = joined.toLocaleString('en-IN');
        if ($('statPool')) $('statPool').textContent = formatINR(mega.pot || joined * mega.entry_fee);
      }

      const homeList = [mega, ...battles].filter(Boolean);
      if ($('homeContestList')) {
        $('homeContestList').innerHTML = homeList.map((c, i) => contestCardHTML(c, i === 0)).join('');
      }
      if ($('contestListFull')) {
        $('contestListFull').innerHTML = homeList.map((c, i) => contestCardHTML(c, i === 0)).join('');
      }
      applyFilter();
      renderHomeLeaderboards();
    } catch (_) {
      if ($('homeUserLeaderboards')) {
        $('homeUserLeaderboards').innerHTML = '<div class="card empty">Syncing contests…</div>';
      }
    }
  }

  function renderHomeLeaderboards() {
    const container = $('homeUserLeaderboards');
    if (!container) return;
    const mega = contestsCache.find((c) => c.id === 'mega_daily');
    if (!mega) {
      container.innerHTML = '<div class="card empty">Open Mega League to see live ranks</div>';
      return;
    }
    container.innerHTML = `
      <div class="card" style="cursor:pointer" onclick="openStandings('mega_daily','Nifty Mega League')">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-family:Outfit,sans-serif">Mega League Live Rankings</strong>
          <span class="badge b-flex">LIVE</span>
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:8px;font-weight:600">
          ${(mega.joined + localJoinedBump).toLocaleString('en-IN')} teams competing · Tap to open
        </div>
      </div>`;
  }

  window.showWinningsInfo = function (contestId, pot) {
    toast(`Pool ${formatINR(pot)} · Rank 1 ~22% · Top 35% win cash`, 'warn');
  };

  // ---------- JOIN ----------
  window.startJoinFlow = function (contestId, entryFee, contestName) {
    const user = getUser();
    if (!user) { openModal('loginModal'); toast('Login to join', 'warn'); return; }
    const baskets = getBaskets();
    if (!baskets.length) {
      toast('Create a team first', 'warn');
      switchNav('baskets');
      openCreateBasketForm();
      return;
    }
    const content = $('joinSheetContent');
    content.innerHTML = `
      <div class="handle"></div>
      <h3>Select Team</h3>
      <p class="sub">Joining <b>${escapeHtml(contestName)}</b> · Entry ₹${entryFee}</p>
      ${baskets.map((b) => `
        <button type="button" class="pick" onclick="confirmJoinStep('${contestId}',${entryFee},'${escapeHtml(contestName)}',${b.id})">
          <span>${escapeHtml(b.name)}</span><span style="color:var(--green);font-size:12px">Use ›</span>
        </button>`).join('')}
      <button type="button" class="btn btn-w" onclick="closeModal('joinSheet')">Cancel</button>`;
    openModal('joinSheet');
  };

  window.confirmJoinStep = function (contestId, fee, contestName, basketId) {
    const chosen = getBaskets().find((b) => Number(b.id) === Number(basketId));
    if (!chosen) { toast('Team not found', 'err'); return; }
    $('joinSheetContent').innerHTML = `
      <div class="handle"></div>
      <h3>Confirm Entry</h3>
      <p class="sub">Same flow as Dream11 — confirm & pay</p>
      <div class="card" style="border-color:rgba(0,179,90,.35)">
        <div style="font-weight:800;margin-bottom:4px">${escapeHtml(contestName)}</div>
        <div style="font-size:13px;color:var(--muted)">Team: <b>${escapeHtml(chosen.name)}</b></div>
        <div style="font-family:Outfit,sans-serif;font-weight:900;font-size:24px;color:var(--green2);margin-top:8px">₹${fee}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button type="button" class="btn btn-w" style="flex:1" onclick="closeModal('joinSheet')">Back</button>
        <button type="button" class="btn btn-g" style="flex:1" id="confirmJoinBtn" onclick="executeJoin('${contestId}',${basketId})">Join Now</button>
      </div>`;
  };

  window.executeJoin = async function (contestId, basketId) {
    if (joining) return;
    const user = getUser();
    const chosen = getBaskets().find((b) => Number(b.id) === Number(basketId));
    if (!user || !chosen) { toast('Session missing', 'err'); return; }
    const btn = $('confirmJoinBtn');
    joining = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Joining…'; }
    try {
      const data = await api('/api/contests/join', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, contestId, basket: chosen })
      });
      if (data.success) {
        closeModal('joinSheet');
        if (data.balance != null) { user.balance = data.balance; setUser(user); }
        toast('Joined successfully!');
        fetchUserProfileData();
        refreshContests();
        switchNav('home');
      } else toast(data.message || 'Could not join', 'err');
    } catch (err) {
      toast(err.message || 'Join failed', 'err');
    } finally {
      joining = false;
      if (btn) { btn.disabled = false; btn.textContent = 'Join Now'; }
    }
  };

  // ---------- TEAMS / BUILDER ----------
  window.openCreateBasketForm = function () {
    selectedStocks = [];
    bullPick = '';
    calfPick = '';
    builderStep = 1;
    $('createBasketBox').style.display = 'block';
    renderBuilder();
    $('createBasketBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  window.closeCreateBasketForm = function () {
    $('createBasketBox').style.display = 'none';
    selectedStocks = [];
  };

  function renderBuilder() {
    const box = $('createBasketBox');
    if (!box) return;
    if (builderStep === 1) {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-family:Outfit,sans-serif;font-size:16px">Create Team · Pick 7</h3>
          <button type="button" class="line-btn" style="flex:0;padding:6px 10px" onclick="closeCreateBasketForm()">✕</button>
        </div>
        <input class="search" id="customBasketNameInput" placeholder="Team name (optional)">
        <input class="search" id="stockSearchInput" placeholder="Search stocks…" oninput="filterStocks()" autocomplete="off">
        <div class="stock-list" id="stockGrid"></div>
        <div class="sticky-cta">
          <div><div style="font-size:11px;opacity:.7">Players</div><b><span id="selectedCount">0</span>/7</b></div>
          <button type="button" class="go" id="nextBuilderBtn" disabled onclick="goCaptainStep()">Next ›</button>
        </div>`;
      initBasketGrid();
    } else {
      box.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <h3 style="margin:0;font-family:Outfit,sans-serif;font-size:16px">Bull (2×) & Calf (1.5×)</h3>
          <button type="button" class="line-btn" style="flex:0;padding:6px 10px" onclick="builderStep=1;renderBuilder()">‹ Back</button>
        </div>
        <p style="font-size:12px;color:var(--muted);margin:8px 0 0">Like Captain & Vice-Captain on Dream11</p>
        <div class="cap-grid" id="capGrid"></div>
        <div class="sticky-cta">
          <div><div style="font-size:11px;opacity:.7">Multipliers</div><b>${bullPick || '—'} / ${calfPick || '—'}</b></div>
          <button type="button" class="go" id="saveBasketBtn" ${bullPick && calfPick && bullPick !== calfPick ? '' : 'disabled'} onclick="saveNewBasket()">Save Team</button>
        </div>`;
      renderCapGrid();
    }
  }
  // expose for inline onclick back
  window.renderBuilder = renderBuilder;

  function initBasketGrid() {
    const grid = $('stockGrid');
    if (!grid) return;
    grid.innerHTML = '';
    NIFTY50.forEach(({ s: sym, n }) => {
      const st = livePriceMap[sym] || { price: '—', change: 0 };
      const ch = Number.isFinite(Number(st.change)) ? Number(st.change) : 0;
      const on = selectedStocks.includes(sym) ? ' on' : '';
      grid.insertAdjacentHTML('beforeend', `
        <div class="stock-row${on}" id="row-${safeId(sym)}" onclick="toggleStockSelection('${sym}')">
          ${logoImg(sym, 36)}
          <div class="meta"><div class="sym">${escapeHtml(sym)}</div><div class="co">${escapeHtml(n)}</div></div>
          <div class="px"><div id="p-${safeId(sym)}">₹${st.price}</div>
            <div id="c-${safeId(sym)}" class="${ch >= 0 ? 'up' : 'down'}" style="font-size:11px">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</div>
          </div>
          <button type="button" class="add-btn" tabindex="-1">${on ? '✓' : '+'}</button>
        </div>`);
    });
    updateBuilderFooter();
  }

  function updateBuilderPrices() {
    NIFTY50.forEach(({ s: sym }) => {
      const st = livePriceMap[sym];
      if (!st) return;
      const p = $(`p-${safeId(sym)}`);
      const c = $(`c-${safeId(sym)}`);
      if (!p || !c) return;
      const ch = Number.isFinite(Number(st.change)) ? Number(st.change) : 0;
      p.textContent = `₹${st.price}`;
      c.className = ch >= 0 ? 'up' : 'down';
      c.textContent = `${ch >= 0 ? '+' : ''}${(ch).toFixed(2)}%`;
      if (st.change === undefined || st.change === null) {
        console.warn(`Stock change missing for ${sym}`, st);
      }
    });
  }

  function updateBuilderFooter() {
    if ($('selectedCount')) $('selectedCount').textContent = String(selectedStocks.length);
    const next = $('nextBuilderBtn');
    if (next) next.disabled = selectedStocks.length !== 7;
  }

  window.toggleStockSelection = function (sym) {
    const idx = selectedStocks.indexOf(sym);
    if (idx > -1) selectedStocks.splice(idx, 1);
    else {
      if (selectedStocks.length >= 7) { toast('Max 7 stocks', 'warn'); return; }
      selectedStocks.push(sym);
    }
    const row = $(`row-${safeId(sym)}`);
    if (row) {
      const on = selectedStocks.includes(sym);
      row.classList.toggle('on', on);
      const btn = row.querySelector('.add-btn');
      if (btn) btn.textContent = on ? '✓' : '+';
    }
    updateBuilderFooter();
  };

  window.filterStocks = function () {
    const q = (($('stockSearchInput') && $('stockSearchInput').value) || '').toUpperCase().trim();
    NIFTY50.forEach(({ s: sym, n }) => {
      const row = $(`row-${safeId(sym)}`);
      if (!row) return;
      row.style.display = (!q || sym.includes(q) || n.toUpperCase().includes(q)) ? 'flex' : 'none';
    });
  };

  window.goCaptainStep = function () {
    if (selectedStocks.length !== 7) return;
    const nameEl = $('customBasketNameInput');
    pendingTeamName = (nameEl && nameEl.value.trim()) || '';
    builderStep = 2;
    bullPick = '';
    calfPick = '';
    renderBuilder();
  };

  function renderCapGrid() {
    const grid = $('capGrid');
    if (!grid) return;
    grid.innerHTML = selectedStocks.map((sym) => {
      const isBull = bullPick === sym;
      const isCalf = calfPick === sym;
      const cls = isBull ? 'on-bull' : isCalf ? 'on-calf' : '';
      return `
        <div class="cap-card ${cls}">
          ${logoImg(sym, 40)}
          <div class="s">${escapeHtml(sym)}</div>
          <div class="cap-btns">
            <button type="button" class="${isBull ? 'b' : ''}" onclick="setBull('${sym}')">Bull 2×</button>
            <button type="button" class="${isCalf ? 'c' : ''}" onclick="setCalf('${sym}')">Calf 1.5×</button>
          </div>
        </div>`;
    }).join('');
  }

  window.setBull = function (sym) {
    if (calfPick === sym) calfPick = '';
    bullPick = sym;
    renderBuilder();
  };
  window.setCalf = function (sym) {
    if (bullPick === sym) bullPick = '';
    calfPick = sym;
    renderBuilder();
  };

  window.saveNewBasket = async function () {
    const user = getUser();
    if (!user) { openModal('loginModal'); return; }
    if (!bullPick || !calfPick || bullPick === calfPick) {
      toast('Pick different Bull & Calf', 'warn');
      return;
    }
    const nameInput = pendingTeamName || `Team ${getBaskets().length + 1}`;
    const payload = {
      name: nameInput,
      bull: bullPick,
      calf: calfPick,
      normal: selectedStocks.filter((s) => s !== bullPick && s !== calfPick)
    };
    const btn = $('saveBasketBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    try {
      const data = await api(`/api/user/${encodeURIComponent(user.id)}/baskets`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (data.success && data.basket) {
        const baskets = getBaskets();
        baskets.push(data.basket);
        setBaskets(baskets);
        closeCreateBasketForm();
        renderSavedBaskets();
        toast(`${data.basket.name} ready to play!`);
      } else toast(data.message || 'Save failed', 'err');
    } catch (_) {
      const local = { id: Date.now(), ...payload };
      const baskets = getBaskets();
      baskets.push(local);
      setBaskets(baskets);
      closeCreateBasketForm();
      renderSavedBaskets();
      toast(`${local.name} saved`, 'warn');
    }
  };

  function renderSavedBaskets() {
    const listEl = $('savedBasketsList');
    if (!listEl) return;
    const baskets = getBaskets();
    if (!baskets.length) {
      listEl.innerHTML = `<div class="card empty"><p style="margin:0 0 12px">No teams yet — create one like Dream11.</p>
        <button type="button" class="btn btn-g" onclick="openCreateBasketForm()">Create Team</button></div>`;
      return;
    }
    listEl.innerHTML = baskets.map((b) => `
      <div class="team-card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div class="name">${escapeHtml(b.name)}</div>
          <button type="button" style="background:0;color:var(--red);font-weight:800;font-size:12px" onclick="deleteBasket(${b.id})">Delete</button>
        </div>
        <div class="pills">
          <span class="pill p-bull">${logoImg(b.bull, 14)} Bull ${escapeHtml(b.bull)}</span>
          <span class="pill p-calf">${logoImg(b.calf, 14)} Calf ${escapeHtml(b.calf)}</span>
        </div>
        <button type="button" class="btn btn-g" style="padding:11px;font-size:13px" onclick="startJoinFlow('mega_daily',100,'Nifty Mega League')">Enter Mega · ₹100</button>
      </div>`).join('');
  }

  window.deleteBasket = async function (id) {
    setBaskets(getBaskets().filter((b) => Number(b.id) !== Number(id)));
    renderSavedBaskets();
    const user = getUser();
    if (user) {
      try {
        const data = await api(`/api/user/${encodeURIComponent(user.id)}/baskets/${id}`, { method: 'DELETE' });
        if (data.success && data.baskets) setBaskets(data.baskets);
      } catch (_) {}
    }
    toast('Team deleted');
  };

  async function syncBasketsFromServer() {
    const user = getUser();
    if (!user) return getBaskets();
    try {
      const data = await api(`/api/user/${encodeURIComponent(user.id)}/baskets`);
      if (data.success && Array.isArray(data.baskets)) {
        setBaskets(data.baskets);
        return data.baskets;
      }
    } catch (_) {}
    return getBaskets();
  }

  // ---------- LEADERBOARD ----------
  window.openStandings = async function (contestId, contestName) {
    $('drawerContestTitle').textContent = contestName || 'Standings';
    openModal('contestLeaderboardDrawer');
    const list = $('drawerLeaderboardList');
    list.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await api(`/api/contests/${encodeURIComponent(contestId)}/leaderboard`);
      if (data.success && data.leaderboard && data.leaderboard.length) {
        list.innerHTML = data.leaderboard.map((p, idx) => `
          <div class="lb">
            <div class="rank ${idx === 0 ? 'g' : ''}">${idx + 1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:800;font-size:13px">${escapeHtml(p.handle)}</div>
              <div style="font-size:11px;color:var(--muted)">${escapeHtml(p.basketName || 'Team')} · ${logoImg(p.bull, 12)} ${escapeHtml(p.bull)}</div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:900;color:var(--green2)">${p.current_points}</div>
              <button type="button" class="line-btn" style="padding:3px 6px;font-size:10px;margin-top:4px"
                onclick="auditCompetitorSquad('${escapeHtml(p.handle)}','${escapeHtml(p.basketName || '')}','${escapeHtml(p.bull)}','${escapeHtml(p.calf)}','${escapeHtml((p.normal || []).join(','))}')">View</button>
            </div>
          </div>`).join('');
      } else list.innerHTML = '<div class="empty">No entries yet</div>';
    } catch (_) {
      list.innerHTML = '<div class="empty">Could not load standings</div>';
    }
  };

  window.auditCompetitorSquad = function (handle, basketName, bull, calf, normalStr) {
    openModal('auditUserBasketModal');
    const norms = (normalStr || '').split(',').filter(Boolean);
    $('auditUserBasketContent').innerHTML = `
      <p style="margin:0 0 4px;font-weight:800">${escapeHtml(handle)}</p>
      <p style="margin:0 0 12px;color:var(--muted);font-size:13px">${escapeHtml(basketName)}</p>
      <div class="pills">
        <span class="pill p-bull">${logoImg(bull, 14)} Bull 2× ${escapeHtml(bull)}</span>
        <span class="pill p-calf">${logoImg(calf, 14)} Calf 1.5× ${escapeHtml(calf)}</span>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--muted);margin:10px 0 6px">Other picks</div>
      <div class="pills">${norms.map((s) => `<span class="pill p-n">${logoImg(s, 14)} ${escapeHtml(s)}</span>`).join('')}</div>`;
  };

  // ---------- WALLET ----------
  window.openDepositModal = function () {
    if (!getUser()) { openModal('loginModal'); return; }
    openModal('depositModal');
  };
  window.openWithdrawModal = function () {
    if (!getUser()) { openModal('loginModal'); return; }
    openModal('withdrawModal');
  };
  window.setDepositAmt = function (amt, el) {
    $('depositAmountInput').value = amt;
    document.querySelectorAll('.chips button').forEach((b) => b.classList.remove('on'));
    if (el) el.classList.add('on');
  };

  window.processDeposit = async function () {
    const user = getUser();
    if (!user) return;
    const amount = parseFloat($('depositAmountInput').value);
    if (!amount || amount < 10) { toast('Min ₹10', 'warn'); return; }
    const btn = $('depositBtn');
    btn.disabled = true; btn.textContent = 'Processing…';
    try {
      const data = await api('/api/cashfree/create-order', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, amount, phone: user.phone, name: user.handle })
      });
      if (data.success) {
        closeModal('depositModal');
        toast(`₹${amount} added to wallet`);
        await fetchUserProfileData();
      } else toast(data.message || 'Failed', 'err');
    } catch (err) { toast(err.message || 'Network error', 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Proceed to Pay'; }
  };

  window.submitWithdrawal = async function () {
    const user = getUser();
    if (!user) return;
    const amount = parseFloat($('withdrawAmtInput').value);
    const upiId = ($('withdrawUpiInput').value || '').trim();
    if (!upiId.includes('@')) { toast('Enter valid UPI ID', 'warn'); return; }
    if (!amount || amount < 100) { toast('Min ₹100', 'warn'); return; }
    const btn = $('withdrawBtn');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const data = await api('/api/cashfree/request-payout', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, amount, upiId })
      });
      if (data.success) {
        closeModal('withdrawModal');
        toast(`₹${amount} sent to ${upiId}`);
        $('withdrawAmtInput').value = '';
        $('withdrawUpiInput').value = '';
        await fetchUserProfileData();
      } else toast(data.message || 'Failed', 'err');
    } catch (err) { toast(err.message || 'Network error', 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Confirm payout'; }
  };

  // ---------- PROFILE / AUTH ----------
  window.openEditProfileModal = function () {
    if (!getUser()) { openModal('loginModal'); return; }
    openModal('editProfileModal');
  };
  window.openSupportModal = function () { openModal('supportModal'); };

  window.submitHandleChange = async function () {
    const user = getUser();
    if (!user) return;
    const handle = ($('newHandleInput').value || '').trim();
    if (!handle.startsWith('@') || handle.length < 3) { toast('Handle must start with @', 'warn'); return; }
    try {
      const data = await api('/api/user/update-handle', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, handle })
      });
      if (data.success) {
        user.handle = data.handle;
        setUser(user);
        closeModal('editProfileModal');
        checkSession();
        toast('Username updated');
      } else toast(data.message || 'Failed', 'err');
    } catch (err) { toast(err.message || 'Network error', 'err'); }
  };

  window.submitSupportTicket = function () {
    const msg = ($('supportMsgInput').value || '').trim();
    if (!msg) { toast('Describe your issue', 'warn'); return; }
    $('supportMsgInput').value = '';
    closeModal('supportModal');
    toast('Ticket submitted');
  };

  window.requestOtp = async function () {
    const phone = ($('phoneInput').value || '').trim();
    const subtext = $('modalSubtext');
    const btn = $('otpRequestBtn');
    const hint = $('otpHint');
    if (!/^\d{10}$/.test(phone)) { toast('Enter 10-digit mobile', 'warn'); return; }
    btn.disabled = true; btn.textContent = 'Sending…';
    subtext.textContent = 'Sending OTP…';
    hint.style.display = 'none';

    try {
      const data = await api('/api/auth/request-otp', {
        method: 'POST',
        body: JSON.stringify({ phone })
      });
      if (data.success) {
        $('stepPhone').style.display = 'none';
        $('stepOtp').style.display = 'block';

        if (data.demoOtp) {
          $('otpInput').value = data.demoOtp;
          hint.style.display = 'block';
          hint.textContent = 'Using fallback OTP for now. Verify with the code shown.';
          subtext.textContent = 'Enter the fallback OTP or wait for SMS';
        } else {
          subtext.textContent = 'Enter the OTP sent to your phone';
        }

        toast(data.message || 'OTP sent');
      } else {
        toast(data.message || 'OTP failed', 'err');
        subtext.textContent = 'Enter mobile number to continue';
      }
    } catch (err) {
      toast(err.message || 'SMS timeout', 'err');
      subtext.textContent = 'Enter mobile number to continue';
    } finally {
      btn.disabled = false; btn.textContent = 'Get OTP';
    }
  };

  window.verifyOtp = async function () {
    const phone = ($('phoneInput').value || '').trim();
    const otp = ($('otpInput').value || '').trim();
    const refCode = ($('loginReferralInput').value || '').trim();
    const btn = $('otpVerifyBtn');
    if (!/^\d{6}$/.test(otp)) { toast('Enter 6-digit OTP', 'warn'); return; }
    btn.disabled = true; btn.textContent = 'Verifying…';
    try {
      const data = await api('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ phone, otp, referralCode: refCode })
      });
      if (data.success) {
        setUser(data.user);
        if (data.token) setToken(data.token);
        closeModal('loginModal');
        await syncBasketsFromServer();
        checkSession();
        toast('Welcome to Nifty-7!');
      } else toast(data.message || 'Invalid OTP', 'err');
    } catch (err) { toast(err.message || 'Verification failed', 'err'); }
    finally { btn.disabled = false; btn.textContent = 'Verify & Play'; }
  };

  async function fetchUserProfileData() {
    const user = getUser();
    if (!user) return;
    try {
      const data = await api(`/api/user/${encodeURIComponent(user.id)}/profile`);
      if (!data.success) return;
      user.balance = parseFloat(data.user.balance).toFixed(2);
      user.handle = data.user.handle || user.handle;
      setUser(user);
      if ($('headerBalance')) $('headerBalance').textContent = user.balance;
      if ($('walletMainBal')) $('walletMainBal').textContent = user.balance;
      if ($('displayReferralCode')) $('displayReferralCode').textContent = data.user.referral_code || '—';
      if ($('refCountLabel')) $('refCountLabel').textContent = data.user.refCount || '0';
      if ($('refEarningsLabel')) $('refEarningsLabel').textContent = `₹${parseFloat(data.user.refEarnings || 0).toFixed(2)}`;
      const historyBox = $('walletHistoryList');
      if (historyBox) {
        if (data.transactions && data.transactions.length) {
          historyBox.innerHTML = data.transactions.map((t) => {
            const credit = ['CREDIT', 'DEPOSIT', 'REFERRAL_CREDIT'].includes(t.type);
            return `<div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;gap:8px">
              <div><b style="font-size:13px">${escapeHtml(t.desc || t.type)}</b><br>
              <small style="color:var(--muted)">${new Date(t.timestamp).toLocaleString('en-IN')}</small></div>
              <span style="color:${credit ? 'var(--green)' : 'var(--red)'};font-weight:800;white-space:nowrap">
                ${credit ? '+' : '−'} ₹${parseFloat(t.amount).toFixed(2)}
              </span></div>`;
          }).join('');
        } else historyBox.innerHTML = '<div class="empty">No transactions yet</div>';
      }
    } catch (_) {}
  }

  function checkSession() {
    const user = getUser();
    if (user) {
      if ($('authBtn')) $('authBtn').textContent = 'Account';
      if ($('profilePhoneDisplay')) $('profilePhoneDisplay').textContent = `+91 ${user.phone}`;
      if ($('profileHandleDisplay')) $('profileHandleDisplay').textContent = user.handle || '@player';
      if ($('profileAvatar')) {
        const h = (user.handle || 'N').replace('@', '');
        $('profileAvatar').textContent = (h[0] || 'N').toUpperCase();
      }
      if ($('headerBalance')) $('headerBalance').textContent = parseFloat(user.balance || 0).toFixed(2);
      if ($('loginModal')) $('loginModal').classList.remove('open');
      fetchUserProfileData();
      syncBasketsFromServer().then(() => renderSavedBaskets());
    } else {
      if ($('authBtn')) $('authBtn').textContent = 'Login';
      renderSavedBaskets();
    }
  }

  window.handleAuthClick = function () {
    if (getUser()) switchNav('profile');
    else openModal('loginModal');
  };

  window.logoutSession = function () {
    if (!confirm('Log out of Nifty-7?')) return;
    localStorage.removeItem('nifty7_user');
    localStorage.removeItem('nifty7_token');
    location.reload();
  };

  // ---------- BOOT ----------
  window.addEventListener('load', () => {
    if (!getUser()) openModal('loginModal');
    else closeModal('loginModal');

    checkSession();
    updateMarketFeed();
    refreshContests();
    updateLockCountdown();

    document.querySelectorAll('#homeFilters .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#homeFilters .chip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
        filterMode = chip.getAttribute('data-f');
        applyFilter();
      });
    });

    document.querySelectorAll('.ov').forEach((ov) => {
      ov.addEventListener('click', (e) => {
        if (e.target === ov && ov.id !== 'loginModal') ov.classList.remove('open');
      });
    });

    setInterval(updateMarketFeed, 4000);
    setInterval(refreshContests, 7000);
    setInterval(updateLockCountdown, 1000);
    // FOMO: local bump so spots feel alive between API polls
    setInterval(() => {
      localJoinedBump += Math.floor(Math.random() * 2);
      refreshContests();
    }, 9000);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
})();
