// ── Bankroll Algo · app.js (Dark Old Money Theme) ─────────────────────────

// ── Access control ─────────────────────────────────────────────────────────
let userRole = 'member';

function openUnlock() {
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('pw-input').focus(), 200);
}
function closeUnlock() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.getElementById('pw-error').classList.remove('show');
  document.getElementById('pw-input').value = '';
}

async function checkPassword() {
  const pw = document.getElementById('pw-input').value.trim();
  if (!pw) return;
  const btn = document.getElementById('pw-btn-text');
  btn.textContent = 'Checking...';
  try {
    const res = await fetch('/api/verify-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (data.role) {
      userRole = data.role;
      localStorage.setItem('ba_role', userRole);
      if (data.role === 'admin') localStorage.setItem('ba_admin_key', pw);
      applyRole();
      closeUnlock();
    } else {
      document.getElementById('pw-error').classList.add('show');
    }
  } catch {
    document.getElementById('pw-error').textContent = 'Connection error. Try again.';
    document.getElementById('pw-error').classList.add('show');
  }
  btn.textContent = 'Unlock';
}

function applyRole() {
  const body = document.body;
  const banner = document.getElementById('preview-banner');
  const adminPanel = document.getElementById('admin-panel');
  const asiaAdminPanel = document.getElementById('asia-admin-panel');
  if (userRole === 'admin') {
    body.classList.add('unlocked');
    if (banner) banner.classList.add('hidden');
    if (adminPanel) adminPanel.style.display = 'block';
    if (asiaAdminPanel && currentSession === 'asia') asiaAdminPanel.style.display = 'block';
  } else if (userRole === 'member') {
    body.classList.add('unlocked');
    if (banner) banner.classList.add('hidden');
  } else {
    body.classList.remove('unlocked');
    if (banner) banner.classList.remove('hidden');
    if (adminPanel) adminPanel.style.display = 'none';
    if (asiaAdminPanel) asiaAdminPanel.style.display = 'none';
  }
}

// ── Session Switching ──────────────────────────────────────────────────────
let currentSession = 'ny';

function switchSession(session) {
  currentSession = session;
  const nyEl = document.getElementById('ny-section');
  const asiaEl = document.getElementById('asia-section');
  const btnNY = document.getElementById('btn-ny');
  const btnAsia = document.getElementById('btn-asia');
  const nyWR = document.getElementById('ny-wr-display');
  const asiaWR = document.getElementById('asia-wr-display');

  if (session === 'asia') {
    if (nyEl) nyEl.style.display = 'none';
    if (asiaEl) asiaEl.style.display = 'block';
    if (btnNY) btnNY.classList.remove('active');
    if (btnAsia) btnAsia.classList.add('active');
    if (nyWR) nyWR.classList.add('hidden');
    if (asiaWR) asiaWR.classList.remove('hidden');
    loadAsiaSignal();
    const ap = document.getElementById('asia-admin-panel');
    if (ap && userRole === 'admin') ap.style.display = 'block';
  } else {
    if (nyEl) nyEl.style.display = 'block';
    if (asiaEl) asiaEl.style.display = 'none';
    if (btnNY) btnNY.classList.add('active');
    if (btnAsia) btnAsia.classList.remove('active');
    if (nyWR) nyWR.classList.remove('hidden');
    if (asiaWR) asiaWR.classList.add('hidden');
  }
}

// ── NY Tab Switching ───────────────────────────────────────────────────────
function switchNYTab(name, el) {
  document.querySelectorAll('#ny-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('#ny-tabs .tab').forEach((t, i) => {
      if (['signal','performance','market'][i] === name) t.classList.add('active');
    });
  }
  ['signal','performance','market'].forEach(id => {
    const el = document.getElementById('ny-tab-' + id);
    if (el) el.classList.remove('active');
  });
  const target = document.getElementById('ny-tab-' + name);
  if (target) target.classList.add('active');
  if (name === 'market') initCharts();
  if (name === 'performance') renderNYPerformance();
}

// ── Asia Tab Switching ─────────────────────────────────────────────────────
function switchAsiaTab(name, el) {
  document.querySelectorAll('#asia-tabs .tab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');
  ['signal','performance'].forEach(id => {
    const el = document.getElementById('asia-tab-' + id);
    if (el) el.classList.remove('active');
  });
  const target = document.getElementById('asia-tab-' + name);
  if (target) target.classList.add('active');
  if (name === 'performance') renderAsiaPerformance();
}

// ── Subtab switching (ES / Options) ───────────────────────────────────────
function switchSubtab(name) {
  document.querySelectorAll('.subtab').forEach((t, i) => {
    t.classList.toggle('active', ['futures','options'][i] === name);
  });
  const showOptions = name === 'options';
  const signalBody = document.getElementById('signal-body');
  const optionsPanel = document.getElementById('options-panel');
  const signalEmpty = document.getElementById('signal-empty');
  if (signalBody) signalBody.style.display = showOptions ? 'none' : (signalBody.dataset.loaded ? 'block' : 'none');
  if (signalEmpty) signalEmpty.style.display = showOptions ? 'none' : (signalEmpty.dataset.show ? 'block' : 'none');
  if (optionsPanel) optionsPanel.style.display = showOptions ? 'block' : 'none';
}

// ── Date display ───────────────────────────────────────────────────────────
const NOW = new Date();
document.getElementById('today-date').textContent = NOW.toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
});

// ── Load NY Signal ─────────────────────────────────────────────────────────
async function loadSignal() {
  try {
    const res = await fetch('/api/get-signal');
    const data = await res.json();
    document.getElementById('signal-loading').style.display = 'none';
    if (data.signal && data.signal.direction) {
      document.getElementById('signal-body').style.display = 'block';
      document.getElementById('signal-body').dataset.loaded = '1';
      populateSignal(data.signal);
    } else {
      document.getElementById('signal-empty').style.display = 'block';
      document.getElementById('signal-empty').dataset.show = '1';
    }
  } catch (err) {
    document.getElementById('signal-loading').style.display = 'none';
    document.getElementById('signal-empty').style.display = 'block';
    document.getElementById('signal-empty').dataset.show = '1';
  }
}

function populateSignal(signal) {
  const isLong = signal.direction === 'LONG';
  const color = isLong ? 'var(--green)' : 'var(--red)';
  const bgColor = isLong ? 'var(--green-bg)' : 'var(--red-bg)';

  // Direction
  const dirText = document.getElementById('dir-text');
  const dirSub = document.getElementById('dir-sub');
  const dirIcon = document.getElementById('dir-icon');
  if (dirText) { dirText.textContent = signal.direction; dirText.style.color = color; }
  if (dirSub) dirSub.textContent = isLong ? 'Buy Signal' : 'Sell Signal';
  if (dirIcon) {
    dirIcon.style.background = bgColor;
    dirIcon.innerHTML = `<i class="ti ti-trending-${isLong ? 'up' : 'down'}" style="color:${color};font-size:18px"></i>`;
  }

  // Bias & confidence
  const biasEl = document.getElementById('bias-txt');
  const confEl = document.getElementById('conf-lvl');
  if (biasEl) { biasEl.textContent = signal.bias || (isLong ? 'Bullish' : 'Bearish'); biasEl.style.color = color; }
  if (confEl) confEl.textContent = signal.confidence || 'High';

  // RR — fixed 9pt TP / 11pt SL for Bankroll Algo
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  set('rr-ratio', signal.rr_ratio || '1:1');
  set('rr-target', signal.rr_target || '+$450');
  set('rr-risk', signal.rr_risk || '-$550');
  set('tp-val', signal.take_profit);
  set('sl-val', signal.stop_loss);

  // Entry zone
  if (signal.entry_range) {
    const ezWrap = document.getElementById('entry-zone-wrap');
    const ezVal = document.getElementById('entry-zone-val');
    if (ezWrap) ezWrap.style.display = 'flex';
    if (ezVal) ezVal.textContent = signal.entry_range;
  }

  // Confluences
  set('conf-1-val', signal.confluence_1);
  set('conf-2-val', signal.confluence_2);
  set('conf-3-val', signal.confluence_3);
  set('conf-public', signal.confluence_public);

  // Generated time
  if (signal.generated_at) {
    const t = new Date(signal.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
    const el = document.getElementById('ny-gen-time');
    if (el) el.textContent = 'Generated at ' + t;
  }

  // Options panel
  populateOptions(signal);
}

// ── SPY Options ────────────────────────────────────────────────────────────
async function populateOptions(signal) {
  const isLong = signal.direction === 'LONG';
  const optType = isLong ? 'Call' : 'Put';
  const color = isLong ? 'var(--green)' : 'var(--red)';
  const bgColor = isLong ? 'var(--green-bg)' : 'var(--red-bg)';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  const setC = (id, c) => { const el = document.getElementById(id); if (el) el.style.color = c; };

  set('opt-dir-text', optType.toUpperCase());
  setC('opt-dir-text', color);
  set('opt-dir-sub', `Buy ${optType} · 0DTE`);
  const icon = document.getElementById('opt-dir-icon');
  if (icon) { icon.style.background = bgColor; icon.innerHTML = `<i class="ti ti-trending-${isLong ? 'up' : 'down'}" style="color:${color};font-size:18px"></i>`; }
  set('opt-bias', signal.bias || (isLong ? 'Bullish' : 'Bearish'));
  setC('opt-bias', color);
  set('opt-conf', signal.confidence || 'High');
  set('opt-type-label', optType);
  set('opt-premium', 'Loading...');

  try {
    const res = await fetch('/api/options-data');
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    const opt = isLong ? data.call : data.put;
    if (!opt) throw new Error('No contract found');
    const expiry = new Date(opt.expiry + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    set('opt-premium', `$${opt.premium} / contract`);
    set('opt-strike', `$${opt.strike}`);
    set('opt-expiry', expiry + ' (0DTE)');
    set('opt-tp', `$${opt.tp} (${opt.tp_pct})`);
    set('opt-sl', `$${opt.sl} (${opt.sl_pct})`);
    set('opt-tp-note', `$${opt.tp}`);
    set('opt-sl-note', `$${opt.sl}`);
  } catch {
    const premium = 2.10;
    set('opt-premium', `~$${premium.toFixed(2)} (est.)`);
    set('opt-strike', '—');
    set('opt-expiry', 'Today (0DTE)');
    set('opt-tp', `$${(premium * 1.3).toFixed(2)} (+30%)`);
    set('opt-sl', `$${(premium * 0.65).toFixed(2)} (-35%)`);
    set('opt-tp-note', `$${(premium * 1.3).toFixed(2)}`);
    set('opt-sl-note', `$${(premium * 0.65).toFixed(2)}`);
  }
}

// ── Admin Regenerate NY ────────────────────────────────────────────────────
async function adminRegenerateSignal() {
  const btn = document.getElementById('regen-btn');
  const txt = document.getElementById('regen-btn-text');
  if (!btn || !txt) return;
  btn.disabled = true; txt.textContent = 'Generating...';
  try {
    const res = await fetch('/api/generate-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_key: localStorage.getItem('ba_admin_key') || '' })
    });
    const data = await res.json();
    if (data.signal) {
      populateSignal(data.signal);
      txt.textContent = 'Generated ✓';
      btn.style.borderColor = 'var(--green-border)';
      btn.style.color = 'var(--green)';
      setTimeout(() => { btn.disabled = false; txt.textContent = 'Regenerate Signal Now'; btn.style.borderColor = ''; btn.style.color = ''; }, 3000);
    } else {
      alert('Error: ' + (data.error || 'Unknown'));
      btn.disabled = false; txt.textContent = 'Regenerate Signal Now';
    }
  } catch (e) {
    alert('Failed: ' + e.message);
    btn.disabled = false; txt.textContent = 'Regenerate Signal Now';
  }
}

// ── Activity Bars ──────────────────────────────────────────────────────────
function buildActivityBars(id) {
  const el = document.getElementById(id);
  if (!el) return;
  [40,60,30,70,50,80,45,90,60,35,75,100].forEach((h, i, arr) => {
    const b = document.createElement('div');
    b.className = 'bar-item';
    b.style.height = h + '%';
    b.style.background = i === arr.length - 1 ? 'var(--gold)' : 'var(--border)';
    el.appendChild(b);
  });
}
buildActivityBars('activity-bars');
buildActivityBars('asia-activity-bars');

// ── NY Calendar ────────────────────────────────────────────────────────────
const NY_KEY = 'bankroll_algo_results_all';
let nyCalMonth = NOW.getMonth();
let nyCalYear = NOW.getFullYear();
let nyAllResults = {};
let nyResults = {};

function getNYResults() {
  return nyAllResults[nyCalYear + '_' + nyCalMonth] || {};
}
function saveNYResults(r) {
  nyAllResults[nyCalYear + '_' + nyCalMonth] = r;
  try { localStorage.setItem(NY_KEY, JSON.stringify(nyAllResults)); } catch {}
  fetch('/api/cal-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: 'ny', results: nyAllResults })
  }).catch(() => {});
}
function getNYWins() { return Object.values(nyResults).filter(v => v === 'win').length; }
function getNYLosses() { return Object.values(nyResults).filter(v => v === 'loss').length; }

function buildNYCalendar() {
  const grid = document.getElementById('ny-cal-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const titleEl = document.getElementById('ny-cal-title');
  if (titleEl) titleEl.textContent = monthNames[nyCalMonth] + ' ' + nyCalYear;

  ['S','M','T','W','T','F','S'].forEach(d => {
    const el = document.createElement('div'); el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el);
  });

  const firstDOW = new Date(nyCalYear, nyCalMonth, 1).getDay();
  const daysInMonth = new Date(nyCalYear, nyCalMonth + 1, 0).getDate();
  const todayDay = (NOW.getFullYear() === nyCalYear && NOW.getMonth() === nyCalMonth) ? NOW.getDate() : -1;
  // Only allow June 2026 onwards
  const minYear = 2026, minMonth = 5;

  for (let i = 0; i < firstDOW; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    const isFuture = d > todayDay && todayDay !== -1;
    if (d === todayDay) el.classList.add('today');
    else if (nyResults[d] === 'win') el.classList.add('win');
    else if (nyResults[d] === 'loss') el.classList.add('loss');
    else if (isFuture) el.classList.add('future');
    if (!isFuture) {
      el.addEventListener('click', function() {
        const cur = nyResults[d];
        if (!cur) setNYDay(d, 'win');
        else if (cur === 'win') setNYDay(d, 'loss');
        else setNYDay(d, null);
      });
    }
    grid.appendChild(el);
  }
  updateNYStats();
}

function updateNYStats() {
  const w = getNYWins(), l = getNYLosses(), total = w + l;
  const pct = total > 0 ? Math.round(w / total * 100) : 0;
  // Header badges
  const wBadge = document.getElementById('ny-w-badge');
  const lBadge = document.getElementById('ny-l-badge');
  const pctEl = document.getElementById('ny-wr-pct');
  if (wBadge) wBadge.textContent = w + 'W';
  if (lBadge) lBadge.textContent = l + 'L';
  if (pctEl) pctEl.textContent = total > 0 ? pct + '%' : '—';
  // Cal stats
  const stats = document.getElementById('ny-cal-stats');
  if (stats) stats.innerHTML = `
    <span class="cal-stat" style="background:var(--green-bg);color:var(--green)">${w}W</span>
    <span class="cal-stat" style="background:var(--red-bg);color:var(--red)">${l}L</span>
    <span class="cal-stat" style="background:var(--gold-dim);color:var(--gold)">${pct}% WR</span>`;
}

function setNYDay(d, val) {
  if (val === null) delete nyResults[d];
  else nyResults[d] = val;
  saveNYResults(nyResults);
  buildNYCalendar();
  renderNYPerformance();
}

function shiftNYCal(dir) {
  nyCalMonth += dir;
  if (nyCalMonth > 11) { nyCalMonth = 0; nyCalYear++; }
  if (nyCalMonth < 0) { nyCalMonth = 11; nyCalYear--; }
  // Don't go before June 2026
  if (nyCalYear < 2026 || (nyCalYear === 2026 && nyCalMonth < 5)) {
    nyCalMonth = 5; nyCalYear = 2026;
  }
  nyResults = getNYResults();
  buildNYCalendar();
}

// ── Asia Calendar ──────────────────────────────────────────────────────────
const ASIA_KEY = 'bankroll_algo_asia_results_all';
let asiaCalMonth = NOW.getMonth();
let asiaCalYear = NOW.getFullYear();
let asiaAllResults = {};
let asiaResults = {};

function getAsiaResults() {
  return asiaAllResults[asiaCalYear + '_' + asiaCalMonth] || {};
}
function saveAsiaResults(r) {
  asiaAllResults[asiaCalYear + '_' + asiaCalMonth] = r;
  try { localStorage.setItem(ASIA_KEY, JSON.stringify(asiaAllResults)); } catch {}
  fetch('/api/cal-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: 'asia', results: asiaAllResults })
  }).catch(() => {});
}
function getAsiaWins() { return Object.values(asiaResults).filter(v => v === 'win').length; }
function getAsiaLosses() { return Object.values(asiaResults).filter(v => v === 'loss').length; }

function buildAsiaCalendar() {
  const grid = document.getElementById('asia-cal-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const titleEl = document.getElementById('asia-cal-title');
  if (titleEl) titleEl.textContent = monthNames[asiaCalMonth] + ' ' + asiaCalYear;

  ['S','M','T','W','T','F','S'].forEach(d => {
    const el = document.createElement('div'); el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el);
  });

  const firstDOW = new Date(asiaCalYear, asiaCalMonth, 1).getDay();
  const daysInMonth = new Date(asiaCalYear, asiaCalMonth + 1, 0).getDate();
  const todayDay = (NOW.getFullYear() === asiaCalYear && NOW.getMonth() === asiaCalMonth) ? NOW.getDate() : -1;

  for (let i = 0; i < firstDOW; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; grid.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    const isFuture = d > todayDay && todayDay !== -1;
    if (d === todayDay) el.classList.add('today');
    else if (asiaResults[d] === 'win') el.classList.add('win');
    else if (asiaResults[d] === 'loss') el.classList.add('loss');
    else if (isFuture) el.classList.add('future');
    if (!isFuture) {
      el.addEventListener('click', function() {
        const cur = asiaResults[d];
        if (!cur) setAsiaDay(d, 'win');
        else if (cur === 'win') setAsiaDay(d, 'loss');
        else setAsiaDay(d, null);
      });
    }
    grid.appendChild(el);
  }
  updateAsiaStats();
}

function updateAsiaStats() {
  const w = getAsiaWins(), l = getAsiaLosses(), total = w + l;
  const pct = total > 0 ? Math.round(w / total * 100) : 0;
  const wBadge = document.getElementById('asia-w-badge');
  const lBadge = document.getElementById('asia-l-badge');
  const pctEl = document.getElementById('asia-wr-pct');
  if (wBadge) wBadge.textContent = w + 'W';
  if (lBadge) lBadge.textContent = l + 'L';
  if (pctEl) pctEl.textContent = total > 0 ? pct + '%' : '—';
  const stats = document.getElementById('asia-cal-stats');
  if (stats) stats.innerHTML = `
    <span class="cal-stat" style="background:var(--green-bg);color:var(--green)">${w}W</span>
    <span class="cal-stat" style="background:var(--red-bg);color:var(--red)">${l}L</span>
    <span class="cal-stat" style="background:var(--gold-dim);color:var(--gold)">${pct}% WR</span>`;
}

function setAsiaDay(d, val) {
  if (val === null) delete asiaResults[d];
  else asiaResults[d] = val;
  saveAsiaResults(asiaResults);
  buildAsiaCalendar();
  renderAsiaPerformance();
}

function shiftAsiaCal(dir) {
  asiaCalMonth += dir;
  if (asiaCalMonth > 11) { asiaCalMonth = 0; asiaCalYear++; }
  if (asiaCalMonth < 0) { asiaCalMonth = 11; asiaCalYear--; }
  if (asiaCalYear < 2026 || (asiaCalYear === 2026 && asiaCalMonth < 5)) {
    asiaCalMonth = 5; asiaCalYear = 2026;
  }
  asiaResults = getAsiaResults();
  buildAsiaCalendar();
}

// ── NY Performance Rendering ───────────────────────────────────────────────
function renderNYPerformance() {
  // Always use June 2026 live calendar data
  const junData = nyAllResults['2026_5'] || {};
  const wins = Object.values(junData).filter(v => v === 'win').length;
  const losses = Object.values(junData).filter(v => v === 'loss').length;
  const total = wins + losses;
  const wr = total > 0 ? (wins / total * 100).toFixed(1) + '%' : '—';
  const pnlVal = (wins * 450) - (losses * 550);
  const ptsVal = (wins * 9) - (losses * 11);
  const pf = losses > 0 ? ((wins * 450) / (losses * 550)).toFixed(2) : '—';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('ny-p-total', total);
  set('ny-p-wl', wins + 'W / ' + losses + 'L');
  set('ny-p-wr', wr);
  set('ny-p-pnl', (pnlVal >= 0 ? '+' : '') + '$' + Math.abs(pnlVal).toLocaleString());
  set('ny-p-pts', (ptsVal >= 0 ? '+' : '') + ptsVal + ' pts');
  set('ny-p-pf', pf);

  // Trade history dots
  const thEl = document.getElementById('ny-trade-history');
  if (thEl) {
    thEl.innerHTML = '';
    Object.keys(junData).sort((a,b) => a - b).forEach(d => {
      const isWin = junData[d] === 'win';
      const dot = document.createElement('div');
      dot.className = 'th-dot ' + (isWin ? 'w' : 'l');
      dot.textContent = isWin ? 'W' : 'L';
      thEl.appendChild(dot);
    });
  }
}

// ── Asia Performance Rendering ─────────────────────────────────────────────
function renderAsiaPerformance() {
  const junData = asiaAllResults['2026_5'] || {};
  const wins = Object.values(junData).filter(v => v === 'win').length;
  const losses = Object.values(junData).filter(v => v === 'loss').length;
  const total = wins + losses;
  const wr = total > 0 ? (wins / total * 100).toFixed(1) + '%' : '—';
  const pnlVal = (wins * 450) - (losses * 550);
  const ptsVal = (wins * 9) - (losses * 11);
  const pf = losses > 0 ? ((wins * 450) / (losses * 550)).toFixed(2) : '—';

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('asia-p-total', total);
  set('asia-p-wl', wins + 'W / ' + losses + 'L');
  set('asia-p-wr', wr);
  set('asia-p-pnl', (pnlVal >= 0 ? '+' : '') + '$' + Math.abs(pnlVal).toLocaleString());
  set('asia-p-pts', (ptsVal >= 0 ? '+' : '') + ptsVal + ' pts');
  set('asia-p-pf', pf);

  const thEl = document.getElementById('asia-trade-history');
  if (thEl) {
    thEl.innerHTML = '';
    Object.keys(junData).sort((a,b) => a - b).forEach(d => {
      const isWin = junData[d] === 'win';
      const dot = document.createElement('div');
      dot.className = 'th-dot ' + (isWin ? 'w' : 'l');
      dot.textContent = isWin ? 'W' : 'L';
      thEl.appendChild(dot);
    });
  }
}

// ── Load Asia Signal ───────────────────────────────────────────────────────
let asiaSignalLoaded = false;

async function loadAsiaSignal() {
  if (asiaSignalLoaded) return;
  asiaSignalLoaded = true;
  const loading = document.getElementById('asia-signal-loading');
  const body = document.getElementById('asia-signal-body');
  if (!loading || !body) return;
  try {
    const res = await fetch('/api/get-asia-signal');
    const data = await res.json();
    loading.style.display = 'none';
    body.style.display = 'block';
    populateAsiaSignal(data.signal && data.signal.direction ? data.signal : fallbackAsiaSignal());
  } catch (e) {
    if (loading) loading.style.display = 'none';
    if (body) body.style.display = 'block';
    populateAsiaSignal(fallbackAsiaSignal());
  }
}

function fallbackAsiaSignal() {
  return {
    direction: 'LONG', bias: 'Bullish', confidence: 'High', session: 'Asia',
    take_profit: '—', stop_loss: '—', rr_ratio: '1:1', rr_target: '+$450', rr_risk: '-$550',
    confluence_1: 'Prior NY Session High as Support',
    confluence_2: 'Nikkei Overnight Confirmation',
    confluence_3: 'Overnight Low Holds as Demand Zone',
    confluence_public: 'Asia Session Range Expansion',
    generated_at: new Date().toISOString()
  };
}

function populateAsiaSignal(s) {
  const isLong = s.direction === 'LONG';
  const color = isLong ? 'var(--green)' : 'var(--red)';
  const bgColor = isLong ? 'var(--green-bg)' : 'var(--red-bg)';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || '—'; };
  const setC = (id, c) => { const el = document.getElementById(id); if (el) el.style.color = c; };

  set('asia-dir-text', s.direction); setC('asia-dir-text', color);
  set('asia-dir-sub', isLong ? 'Buy Signal' : 'Sell Signal');
  const icon = document.getElementById('asia-dir-icon');
  if (icon) { icon.style.background = bgColor; icon.innerHTML = `<i class="ti ti-trending-${isLong ? 'up' : 'down'}" style="color:${color};font-size:18px"></i>`; }

  set('asia-tp-val', s.take_profit); setC('asia-tp-val', 'var(--green)');
  set('asia-sl-val', s.stop_loss); setC('asia-sl-val', 'var(--red)');
  set('asia-rr-ratio', s.rr_ratio || '1:1');
  set('asia-rr-target', s.rr_target || '+$450');
  set('asia-rr-risk', s.rr_risk || '-$550');
  set('asia-conf-1', s.confluence_1);
  set('asia-conf-2', s.confluence_2);
  set('asia-conf-3', s.confluence_3);
  set('asia-conf-public', s.confluence_public);
  set('asia-bias-txt', s.bias); setC('asia-bias-txt', color);
  set('asia-conf-lvl', s.confidence);

  // Entry zone
  if (s.entry_range) {
    const ezWrap = document.getElementById('asia-entry-zone-wrap');
    const ezVal = document.getElementById('asia-entry-zone-val');
    if (ezWrap) ezWrap.style.display = 'flex';
    if (ezVal) ezVal.textContent = s.entry_range;
  }

  if (s.generated_at) {
    const t = new Date(s.generated_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
    const el = document.getElementById('asia-date');
    if (el) el.textContent = 'Generated at ' + t;
  }
}

// ── Admin Regenerate Asia ──────────────────────────────────────────────────
async function adminRegenerateAsiaSignal() {
  const btn = document.getElementById('asia-regen-btn');
  const txt = document.getElementById('asia-regen-btn-text');
  if (!btn || !txt) return;
  btn.disabled = true; txt.textContent = 'Generating...';
  try {
    const res = await fetch('/api/generate-asia-signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_key: localStorage.getItem('ba_admin_key') || '' })
    });
    const data = await res.json();
    if (data.signal) {
      asiaSignalLoaded = false;
      populateAsiaSignal(data.signal);
      txt.textContent = 'Generated ✓';
      btn.style.borderColor = 'var(--green-border)';
      btn.style.color = 'var(--green)';
      setTimeout(() => { btn.disabled = false; txt.textContent = 'Regenerate Asia Signal'; btn.style.borderColor = ''; btn.style.color = ''; }, 3000);
    } else {
      alert('Error: ' + (data.error || 'Unknown'));
      btn.disabled = false; txt.textContent = 'Regenerate Asia Signal';
    }
  } catch (e) {
    alert('Failed: ' + e.message);
    btn.disabled = false; txt.textContent = 'Regenerate Asia Signal';
  }
}

// ── Market Data (NY) ───────────────────────────────────────────────────────
let marketLoaded = false;
let priceChartInstance = null;
let volChartInstance = null;

async function initCharts() {
  if (marketLoaded) return;
  marketLoaded = true;
  try {
    const res = await fetch('/api/market-data');
    const d = await res.json();
    if (d.error) throw new Error(d.error);

    document.getElementById('market-loading').style.display = 'none';
    document.getElementById('market-body').style.display = 'block';

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('md-range', d.overnightRange);
    set('md-current', d.current);
    set('md-volume', d.volume);
    set('md-prevclose', d.prevClose);
    set('md-change-pct', d.changePct);
    const cpEl = document.getElementById('md-change-pct');
    if (cpEl) cpEl.style.color = d.isPositive ? 'var(--green)' : 'var(--red)';
    const updEl = document.getElementById('market-updated');
    if (updEl) updEl.textContent = 'Updated ' + d.updatedAt;

    const trendEl = document.getElementById('md-trend');
    if (trendEl) { trendEl.textContent = d.changePct; trendEl.style.color = d.isPositive ? 'var(--green)' : 'var(--red)'; }

    if (d.chartData && d.chartData.length > 1) {
      const labels = d.chartData.map(p => p.time);
      const prices = d.chartData.map(p => p.price);
      const vols = d.chartData.map(p => p.volume);
      const dayHigh = parseFloat(d.dayHigh);
      const dayLow = parseFloat(d.dayLow);
      const prevClose = parseFloat(d.prevClose);

      const chartDefaults = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { font: { size: 11 }, color: 'var(--text-muted)' } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { font: { size: 11 }, color: 'var(--text-muted)' } }
        }
      };

      if (priceChartInstance) priceChartInstance.destroy();
      const pCtx = document.getElementById('priceChart').getContext('2d');
      priceChartInstance = new Chart(pCtx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'ES Price', data: prices, borderColor: '#c9a84c', backgroundColor: 'rgba(201,168,76,0.06)', fill: true, tension: 0.4, pointRadius: 2, borderWidth: 2 },
            { label: 'Prev Close', data: Array(labels.length).fill(prevClose), borderColor: '#4a5568', borderDash: [5,5], borderWidth: 1.5, pointRadius: 0, fill: false },
            { label: 'Day High', data: Array(labels.length).fill(dayHigh), borderColor: '#4ade80', borderDash: [4,4], borderWidth: 1, pointRadius: 0, fill: false },
            { label: 'Day Low', data: Array(labels.length).fill(dayLow), borderColor: '#f87171', borderDash: [4,4], borderWidth: 1, pointRadius: 0, fill: false }
          ]
        },
        options: chartDefaults
      });

      if (volChartInstance) volChartInstance.destroy();
      const vCtx = document.getElementById('volChart').getContext('2d');
      volChartInstance = new Chart(vCtx, {
        type: 'bar',
        data: { labels, datasets: [{ data: vols, backgroundColor: 'rgba(201,168,76,0.3)', borderRadius: 3 }] },
        options: { ...chartDefaults, scales: { ...chartDefaults.scales, y: { ...chartDefaults.scales.y, ticks: { ...chartDefaults.scales.y.ticks, callback: v => v >= 1000 ? (v/1000).toFixed(0) + 'K' : v } } } }
      });
    }
  } catch (err) {
    const el = document.getElementById('market-loading');
    if (el) el.innerHTML = '<div style="color:var(--red);font-size:12px">Could not load live data. Try again later.</div>';
  }
}

// ── Click outside closes tooltips ──────────────────────────────────────────
document.addEventListener('click', () => {
  document.querySelectorAll('.cal-day.open').forEach(x => x.classList.remove('open'));
});

// ── Init ───────────────────────────────────────────────────────────────────
try {
  const savedRole = localStorage.getItem('ba_role');
  if (savedRole) userRole = savedRole;
  applyRole();
} catch(e) {
  document.body.classList.add('unlocked');
}

// Load localStorage immediately, then sync from Redis
try { nyAllResults = JSON.parse(localStorage.getItem(NY_KEY) || '{}'); } catch {}
try { asiaAllResults = JSON.parse(localStorage.getItem(ASIA_KEY) || '{}'); } catch {}
nyResults = getNYResults();
asiaResults = getAsiaResults();
try { buildNYCalendar(); } catch(e) {}
try { buildAsiaCalendar(); } catch(e) {}

// Sync from Redis (cloud) — overwrites local if cloud has data
(async () => {
  try {
    const [nyRes, asiaRes] = await Promise.all([
      fetch('/api/cal-results?session=ny').then(r => r.json()),
      fetch('/api/cal-results?session=asia').then(r => r.json())
    ]);
    if (nyRes.results && Object.keys(nyRes.results).length > 0) {
      nyAllResults = nyRes.results;
      try { localStorage.setItem(NY_KEY, JSON.stringify(nyAllResults)); } catch {}
    }
    if (asiaRes.results && Object.keys(asiaRes.results).length > 0) {
      asiaAllResults = asiaRes.results;
      try { localStorage.setItem(ASIA_KEY, JSON.stringify(asiaAllResults)); } catch {}
    }
    nyResults = getNYResults();
    asiaResults = getAsiaResults();
    buildNYCalendar();
    buildAsiaCalendar();
    renderNYPerformance();
    renderAsiaPerformance();
  } catch {}
})();

loadSignal();
