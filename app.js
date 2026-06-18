// ── Bankroll Algo v2 · app.js ─────────────────────────────────────────────

// ── Session ───────────────────────────────────────────────────────────────
let currentSession = localStorage.getItem('ba_session') || 'ny'; // ny | asia

function buildBacktestCard(sess = 'ny') {
  const TP_USD = 450;
  const SL_USD = 550;
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const months = [];
  for (let y = 2026; y <= now.getFullYear(); y++) {
    const end = (y === now.getFullYear()) ? now.getMonth() : 11;
    for (let m = 0; m <= end; m++) months.push({y, m});
  }
  let totalW = 0, totalL = 0, totalPnl = 0;
  let equity = 0, peak = 0, maxDd = 0;
  let bestStreak = 0, worstStreak = 0, curW = 0, curL = 0;
  const monthlyData = [];
  const allTrades = [];
  for (const {y, m} of months) {
    const key = `ba_res_${sess}_${y}_${String(m+1).padStart(2,'0')}`;
    let dayMap; try { dayMap = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { continue; }
    if (!dayMap) continue;
    let mW = 0, mL = 0, mPnl = 0;
    for (const day of Object.keys(dayMap).map(Number).sort((a,b)=>a-b)) {
      const v = dayMap[String(day)];
      if (v === 'win')  { mW++; mPnl += TP_USD; allTrades.push('win'); }
      else if (v === 'loss') { mL++; mPnl -= SL_USD; allTrades.push('loss'); }
    }
    if (mW + mL === 0) continue;
    totalW += mW; totalL += mL; totalPnl += mPnl;
    monthlyData.push({y, m, mW, mL, mPnl});
  }
  // streaks + drawdown
  for (const t of allTrades) {
    if (t === 'win')  { curW++; curL = 0; bestStreak  = Math.max(bestStreak,  curW); }
    else              { curL++; curW = 0; worstStreak = Math.max(worstStreak, curL); }
  }
  equity = 0; peak = 0;
  for (const t of allTrades) {
    equity += t === 'win' ? TP_USD : -SL_USD;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }
  const total = totalW + totalL;
  const container = document.getElementById(`bt-${sess}`);
  if (!container) return;
  if (total === 0) {
    container.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px">No calendar data yet.<br>Tap days in the calendar to log W/L.</div>`;
    return;
  }
  const wr = (totalW / total * 100).toFixed(1);
  const wrColor = parseFloat(wr) >= 60 ? 'var(--green)' : parseFloat(wr) >= 50 ? 'var(--gold)' : 'var(--red)';
  const pf = totalL > 0 ? (totalW * TP_USD / (totalL * SL_USD)).toFixed(2) : '∞';
  const pfColor = parseFloat(pf) >= 1.5 ? 'var(--green)' : parseFloat(pf) >= 1 ? 'var(--gold)' : 'var(--red)';
  const pnlStr = (totalPnl >= 0 ? '+' : '-') + '$' + Math.abs(totalPnl).toLocaleString();
  const pnlColor = totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
  const monthRows = monthlyData.map(({y, m, mW, mL, mPnl}) => {
    const mt = mW + mL;
    const mWr = mt > 0 ? Math.round(mW / mt * 100) : 0;
    const mc = mPnl >= 0 ? 'var(--green)' : 'var(--red)';
    const ms = (mPnl >= 0 ? '+' : '-') + '$' + Math.abs(mPnl).toLocaleString();
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg);border-radius:7px;border:0.5px solid var(--border)">
      <span style="font-size:12px">${MN[m]} ${y}</span>
      <span style="font-size:11px;color:var(--text-muted)">${mW}W / ${mL}L</span>
      <span style="font-size:11px;color:var(--text-muted)">${mWr}%</span>
      <span style="font-size:12px;font-weight:500;color:${mc}">${ms}</span>
    </div>`;
  }).join('');
  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px">
      <div style="background:var(--bg);border-radius:8px;padding:10px;border:0.5px solid var(--border);text-align:center">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Win Rate</div>
        <div style="font-size:20px;font-weight:600;color:${wrColor}">${wr}%</div>
        <div style="font-size:11px;color:var(--text-muted)">${totalW}W / ${totalL}L</div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:10px;border:0.5px solid var(--border);text-align:center">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Net P&L</div>
        <div style="font-size:20px;font-weight:600;color:${pnlColor}">${pnlStr}</div>
        <div style="font-size:11px;color:var(--text-muted)">${total} trades</div>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:10px;border:0.5px solid var(--border);text-align:center">
        <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.04em">Profit Factor</div>
        <div style="font-size:20px;font-weight:600;color:${pfColor}">${pf}</div>
        <div style="font-size:11px;color:var(--text-muted)">Max DD: -$${maxDd.toLocaleString()}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:var(--bg);border-radius:8px;padding:8px 12px;border:0.5px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:var(--text-muted)">Best Streak</span>
        <span style="font-size:13px;font-weight:600;color:var(--green)">${bestStreak}W</span>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:8px 12px;border:0.5px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:var(--text-muted)">Worst Streak</span>
        <span style="font-size:13px;font-weight:600;color:var(--red)">${worstStreak}L</span>
      </div>
    </div>
    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Monthly Breakdown</div>
    <div style="display:flex;flex-direction:column;gap:5px">${monthRows}</div>`;
}

function applyBacktestUI(sess) {
  const btNY   = document.getElementById('bt-ny');
  const btAsia = document.getElementById('bt-asia');
  if (!btNY || !btAsia) return;
  btNY.style.display   = sess === 'ny'   ? 'block' : 'none';
  btAsia.style.display = sess === 'asia' ? 'block' : 'none';
}

function applySessionUI(sess) {
  const nyBtn   = document.getElementById('sess-ny');
  const asiaBtn = document.getElementById('sess-asia');
  if (!nyBtn || !asiaBtn) return;
  const base = 'flex:1;padding:9px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;letter-spacing:.01em';
  if (sess === 'ny') {
    nyBtn.style.cssText   = base + ';background:var(--purple,#6B5FD0);color:#fff';
    asiaBtn.style.cssText = base + ';background:transparent;color:var(--text-muted,#52526A)';
  } else {
    asiaBtn.style.cssText = base + ';background:var(--purple,#6B5FD0);color:#fff';
    nyBtn.style.cssText   = base + ';background:transparent;color:var(--text-muted,#52526A)';
  }
}

function switchSession(sess) {
  currentSession = sess;
  localStorage.setItem('ba_session', sess);
  applySessionUI(sess);
  applyBacktestUI(sess);
  document.getElementById('signal-loading').style.display = 'block';
  document.getElementById('signal-body').style.display   = 'none';
  document.getElementById('signal-empty').style.display  = 'none';
  buildCalendar();
  updateStats();
  loadSignal();
}

// ── Access control ────────────────────────────────────────────────────────
let userRole = localStorage.getItem('ba_role') || 'preview'; // preview | member | admin

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
  const badge = document.getElementById('access-badge');

  if (userRole === 'admin') {
    body.classList.add('unlocked');
    banner.classList.add('hidden');
    badge.className = 'access-badge admin';
    badge.innerHTML = '<i class="ti ti-shield-check"></i> Admin Access';
    document.getElementById('admin-panel').style.display = 'block';
  } else if (userRole === 'member') {
    body.classList.add('unlocked');
    banner.classList.add('hidden');
    badge.className = 'access-badge member';
    badge.innerHTML = '<i class="ti ti-lock-open"></i> Member Access';
  } else {
    body.classList.remove('unlocked');
    banner.classList.remove('hidden');
    badge.className = 'access-badge';
    badge.innerHTML = '<i class="ti ti-eye-off"></i> Preview Mode';
    document.getElementById('admin-panel').style.display = 'none';
  }
}

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['signal','performance','market'][i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'market') initCharts();
}

// ── Date display ──────────────────────────────────────────────────────────
document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
});

// ── Load today's signal from API ──────────────────────────────────────────
async function loadSignal() {
  const endpoint = currentSession === 'asia' ? '/api/get-asia-signal' : '/api/get-signal';
  try {
    const res = await fetch(endpoint);
    const data = await res.json();

    document.getElementById('signal-loading').style.display = 'none';

    if (!data.signal) {
      document.getElementById('signal-empty').style.display = 'block';
      return;
    }

    document.getElementById('signal-body').style.display = 'block';
    populateSignal(data.signal);

  } catch (err) {
    // Fallback: show a default signal if API not set up yet
    document.getElementById('signal-loading').style.display = 'none';
    document.getElementById('signal-body').style.display = 'block';
    populateSignal({
      direction: 'SHORT',
      bias: 'Bearish',
      confidence: 'High',
      take_profit: '5,481.25',
      stop_loss: '5,548.50',
      rr_ratio: '2.3:1',
      rr_target: '+$812',
      rr_risk: '-$350',
      confluence_1: 'Prior Day High Resistance',
      confluence_2: '15-min Bearish Engulfing',
      confluence_3: 'VWAP Rejection',
      confluence_public: 'Overnight Range Confirmed',
      generated_at: new Date().toISOString()
    });
  }
}

function populateSignal(signal) {
  const isLong = signal.direction === 'LONG';

  // Direction
  document.getElementById('dir-text').textContent = signal.direction;
  document.getElementById('dir-text').style.color = isLong ? '#0F6E56' : '#A32D2D';
  document.getElementById('dir-sub').textContent = isLong ? 'Buy Signal' : 'Sell Signal';
  const icon = document.getElementById('dir-icon');
  icon.style.background = isLong ? '#E1F5EE' : '#FCEBEB';
  icon.innerHTML = `<i class="ti ti-trending-${isLong ? 'up' : 'down'}" style="color:${isLong ? '#0F6E56' : '#A32D2D'};font-size:18px"></i>`;

  // Bias & Confidence
  const biasEl = document.getElementById('bias-txt');
  biasEl.textContent = signal.bias;
  biasEl.style.color = isLong ? '#0F6E56' : '#A32D2D';

  const confEl = document.getElementById('conf-lvl');
  confEl.textContent = signal.confidence;
  confEl.style.color = signal.confidence === 'High' ? '#534AB7' : signal.confidence === 'Medium' ? '#854F0B' : '#A32D2D';

  // Low confidence banner — signal still shows, just flagged
  const existingBanner = document.getElementById('no-trade-banner');
  if (existingBanner) existingBanner.remove();
  if (signal.confidence === 'Low') {
    const banner = document.createElement('div');
    banner.id = 'no-trade-banner';
    banner.style.cssText = 'margin:12px 0 4px;padding:10px 14px;background:#FCEBEB;border:0.5px solid #F09595;border-radius:8px;display:flex;align-items:center;gap:8px';
    banner.innerHTML = `<span style="font-size:15px">🚫</span><div><div style="font-size:13px;font-weight:500;color:#A32D2D">No trade today</div><div style="font-size:11px;color:#791F1F;margin-top:1px">Low confidence — signal shown for reference only</div></div>`;
    confEl.closest('.card') ? confEl.parentElement.insertBefore(banner, confEl.parentElement.nextSibling) : confEl.after(banner);
  }

  // TP / SL / RR (unlocked values — shown only when unlocked)
  document.getElementById('tp-val').textContent = signal.take_profit || '—';
  document.getElementById('sl-val').textContent = signal.stop_loss || '—';
  document.getElementById('rr-ratio').textContent = signal.rr_ratio || '—';
  document.getElementById('rr-target').textContent = signal.rr_target || '—';
  document.getElementById('rr-risk').textContent = signal.rr_risk || '—';

  // Confluences
  document.getElementById('conf-1-blur').textContent = signal.confluence_1 || 'Resistance level';
  document.getElementById('conf-2-blur').textContent = signal.confluence_2 || 'Volume divergence';
  document.getElementById('conf-3-blur').textContent = signal.confluence_3 || 'RSI overbought';
  document.getElementById('conf-1-val').textContent = signal.confluence_1 || '—';
  document.getElementById('conf-2-val').textContent = signal.confluence_2 || '—';
  document.getElementById('conf-3-val').textContent = signal.confluence_3 || '—';
  document.getElementById('conf-public').textContent = signal.confluence_public || 'Overnight Range';

  // Entry label — differs between sessions
  const entryEl = document.getElementById('entry-session-val');
  if (entryEl) {
    if (signal.session === 'Asia') {
      entryEl.textContent = signal.entry_range ? `Asia Open · ${signal.entry_range}` : 'Asia Market Open';
    } else {
      entryEl.textContent = 'NYSE Market Open';
    }
  }

  // Generated time
  if (signal.generated_at) {
    const t = new Date(signal.generated_at).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short'
    });
    const sess = signal.session === 'Asia' ? ' · Asia' : ' · NY';
    document.getElementById('signal-time').textContent = `Generated at ${t}${sess}`;
  }

  renderSpyOptions(signal);
}

// ── Subtab switching ──────────────────────────────────────────────────────
let currentSubtab = 'es';
function switchSubtab(name) {
  currentSubtab = name;
  document.querySelectorAll('.subtab').forEach((t, i) => {
    t.classList.toggle('active', ['es','spy'][i] === name);
  });
  const signalBody = document.getElementById('signal-body');
  const spyPanel   = document.getElementById('spy-panel');
  if (name === 'spy') {
    if (signalBody) signalBody.style.display = 'none';
    if (spyPanel)   spyPanel.style.display   = 'block';
  } else {
    if (signalBody) signalBody.style.display = 'block';
    if (spyPanel)   spyPanel.style.display   = 'none';
  }
}

// ── Market context panel ──────────────────────────────────────────────────
function toggleMktCtx() {
  const body = document.getElementById('mkt-ctx-body');
  const chev = document.getElementById('mkt-ctx-chev');
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  chev.style.transform = isOpen ? '' : 'rotate(180deg)';
  chev.style.transition = 'transform 0.2s';
}

// ── SPY Options panel ─────────────────────────────────────────────────────
function renderSpyOptions(signal) {
  const el = document.getElementById('spy-options-body');
  if (!el) return;
  const ctx = signal.market_context;
  if (!ctx || (!ctx.call_wall && !ctx.put_wall)) {
    el.innerHTML = `<div style="text-align:center;padding:32px 0;color:var(--text-muted);font-size:13px">
      <i class="ti ti-refresh" style="font-size:24px;display:block;margin-bottom:8px"></i>
      Regenerate signal to load live options data</div>`;
    return;
  }
  const row = (label, val, sub, color) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid var(--border)">
      <div>
        <div style="font-size:13px;color:var(--text-muted)">${label}</div>
        ${sub ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${sub}</div>` : ''}
      </div>
      <div style="font-size:16px;font-weight:600;${color?'color:'+color:''}">${val}</div>
    </div>`;

  const c = ctx;
  let html = '';
  if (c.call_wall?.spy) html += row('Call Wall (Resistance)', `SPY ${c.call_wall.spy}`, `ES ~${c.call_wall.es} · OI ${c.call_wall.oi}`, 'var(--green)');
  if (c.put_wall?.spy)  html += row('Put Wall (Support)',     `SPY ${c.put_wall.spy}`,  `ES ~${c.put_wall.es} · OI ${c.put_wall.oi}`,  'var(--red)');
  if (c.max_pain?.spy)  html += row('Max Pain',               `SPY ${c.max_pain.spy}`,  `ES ~${c.max_pain.es} · price magnet`, 'var(--gold)');
  if (c.pc_ratio?.value) {
    const pc = parseFloat(c.pc_ratio.value);
    const col = pc > 1.2 ? 'var(--red)' : pc < 0.8 ? 'var(--green)' : 'var(--text-primary)';
    html += row('Put/Call Ratio', c.pc_ratio.value, c.pc_ratio.tag, col);
  }
  if (c.options_expiry) html += `<div style="font-size:11px;color:var(--text-muted);margin-top:8px">Expiry: ${c.options_expiry}</div>`;
  el.innerHTML = html || `<div style="color:var(--text-muted);font-size:13px;padding:16px 0">No options data available</div>`;
}

// ── Admin: regenerate signal manually ────────────────────────────────────
async function adminRegenerateSignal() {
  const btn = document.getElementById('regen-btn');
  const txt = document.getElementById('regen-btn-text');
  btn.disabled = true;
  txt.textContent = 'Generating...';

  try {
    const adminPw = localStorage.getItem('ba_admin_key') || '';
    const regenEndpoint = currentSession === 'asia' ? '/api/generate-asia-signal' : '/api/generate-signal';
    const res = await fetch(regenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_key: adminPw })
    });
    const data = await res.json();
    if (data.signal) {
      populateSignal(data.signal);
      txt.textContent = 'Signal Regenerated ✓';
      btn.style.background = '#1D9E75';
      setTimeout(() => { btn.disabled = false; txt.textContent = 'Regenerate Signal Now'; btn.style.background = ''; }, 3000);
    } else {
      alert('Error: ' + (data.error || 'Unknown error'));
      btn.disabled = false; txt.textContent = 'Regenerate Signal Now';
    }
  } catch (err) {
    alert('Failed: ' + err.message);
    btn.disabled = false; txt.textContent = 'Regenerate Signal Now';
  }
}

// ── Calendar ──────────────────────────────────────────────────────────────
const STORAGE_KEY_NY   = 'bankroll_algo_results_ny';
const STORAGE_KEY_ASIA = 'bankroll_algo_results_asia';
const _NOW        = new Date();
const TODAY_DAY   = _NOW.getDate();
const TODAY_MONTH = _NOW.getMonth();
const TODAY_YEAR  = _NOW.getFullYear();
let calViewYear   = TODAY_YEAR;
let calViewMonth  = TODAY_MONTH;
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Month-keyed local storage so each month is saved separately
function monthKey(sess, y, m) {
  return `ba_res_${sess}_${y}_${String(m+1).padStart(2,'0')}`;
}
function loadMonthData(sess, y, m) {
  try {
    const raw = localStorage.getItem(monthKey(sess, y, m));
    if (raw) return JSON.parse(raw);
    // Migrate old single-key data into current month slot on first load
    if (y === TODAY_YEAR && m === TODAY_MONTH) {
      const old = localStorage.getItem(sess === 'asia' ? STORAGE_KEY_ASIA : STORAGE_KEY_NY);
      if (old) { localStorage.setItem(monthKey(sess, y, m), old); return JSON.parse(old); }
    }
    return {};
  } catch { return {}; }
}
function saveMonthData(sess, y, m, r) {
  try {
    localStorage.setItem(monthKey(sess, y, m), JSON.stringify(r));
    // Keep old keys in sync for current month (backward compat)
    if (y === TODAY_YEAR && m === TODAY_MONTH) {
      localStorage.setItem(sess === 'asia' ? STORAGE_KEY_ASIA : STORAGE_KEY_NY, JSON.stringify(r));
    }
  } catch {}
}

// Calendar-view results (the month currently displayed)
function getCalResults() {
  const sess = currentSession === 'asia' ? 'asia' : 'ny';
  return loadMonthData(sess, calViewYear, calViewMonth);
}
function setCalResults(r) {
  const sess = currentSession === 'asia' ? 'asia' : 'ny';
  saveMonthData(sess, calViewYear, calViewMonth, r);
  // Sync in-memory + Redis only when editing the current month
  if (calViewYear === TODAY_YEAR && calViewMonth === TODAY_MONTH) {
    setResults(r);
    saveResults(r);
  }
}

function calNav(dir) {
  calViewMonth += dir;
  if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
  if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }
  buildCalendar();
}

function getStorageKey() {
  return currentSession === 'asia' ? STORAGE_KEY_ASIA : STORAGE_KEY_NY;
}

function loadResults(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function saveResults(r) {
  try { localStorage.setItem(getStorageKey(), JSON.stringify(r)); } catch {}
  fetch('/api/save-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: currentSession, results: r })
  }).catch(() => {});
}

async function fetchResultsFromRedis(sess) {
  try {
    const res  = await fetch(`/api/get-results?session=${sess}`);
    const data = await res.json();
    return data.results || {};
  } catch { return {}; }
}

let nyResults   = loadResults(STORAGE_KEY_NY);
let asiaResults = loadResults(STORAGE_KEY_ASIA);

function getResults() {
  return currentSession === 'asia' ? asiaResults : nyResults;
}
function setResults(r) {
  if (currentSession === 'asia') asiaResults = r;
  else nyResults = r;
}

function getWins() { return Object.values(getResults()).filter(v => v === 'win').length; }
function getLosses() { return Object.values(getResults()).filter(v => v === 'loss').length; }

function updateStats() {
  const w = getWins(), l = getLosses(), total = w + l;
  const pct = total > 0 ? Math.round(w / total * 100) : 0;

  // Header bar
  document.getElementById('w-badge').textContent = w + 'W';
  document.getElementById('l-badge').textContent = l + 'L';
  document.getElementById('win-pct-txt').textContent = pct + '%';
  document.getElementById('win-bar').style.width = pct + '%';

  // Calendar mini stats
  const stats = document.getElementById('cal-stats');
  stats.innerHTML = `
    <span class="cal-stat" style="background:var(--green-light);color:var(--green)">${w}W</span>
    <span class="cal-stat" style="background:var(--red-light);color:var(--red)">${l}L</span>
    <span class="cal-stat" style="background:var(--gold-light);color:var(--gold)">${pct}% WR</span>`;

  // Performance tab stats
  const netDollars = w * 450 - l * 550;
  const netPts     = w * 9  - l * 11;
  const pf         = l > 0 ? ((w * 450) / (l * 550)).toFixed(2) : w > 0 ? '∞' : '—';

  const el = (id) => document.getElementById(id);
  if (el('perf-total')) {
    el('perf-total').textContent = total;
    el('perf-wl').textContent    = `${w}W / ${l}L`;
    el('perf-wr').textContent    = pct + '%';
    el('perf-wr-sub').textContent = `${w} of ${total}`;
    el('perf-pf').textContent    = pf;
    el('perf-pnl').textContent   = (netDollars >= 0 ? '+' : '') + '$' + Math.abs(netDollars).toLocaleString();
    el('perf-pnl').style.color   = netDollars >= 0 ? 'var(--green)' : 'var(--red)';
    el('perf-pts').textContent   = (netPts >= 0 ? '+' : '') + netPts + ' pts';
  }

  // Trade history dots — rebuild from actual calendar results in day order
  const th = document.getElementById('trade-history');
  if (th) {
    th.innerHTML = '';
    const cur = getResults();
    const days = Object.keys(cur).map(Number).sort((a,b) => a - b);
    days.forEach(d => {
      const r = cur[d];
      if (r === 'win' || r === 'loss') {
        const dot = document.createElement('div');
        dot.className = 'th-dot ' + (r === 'win' ? 'w' : 'l');
        dot.textContent = r === 'win' ? 'W' : 'L';
        th.appendChild(dot);
      }
    });
  }
}

function buildCalendar() {
  const grid = document.getElementById('cal-grid');
  const isCurrentMonth = (calViewYear === TODAY_YEAR && calViewMonth === TODAY_MONTH);

  // Update header title + hint visibility
  const titleEl = document.getElementById('cal-title');
  const hintEl  = document.getElementById('cal-hint');
  if (titleEl) titleEl.textContent = `${MONTH_NAMES[calViewMonth]} ${calViewYear}`;
  if (hintEl)  hintEl.style.display = isCurrentMonth ? '' : 'none';

  grid.innerHTML = '';
  ['S','M','T','W','T','F','S'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el);
  });

  const firstDay    = new Date(calViewYear, calViewMonth, 1).getDay();
  const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
  const r = getCalResults();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; el.textContent = '·'; grid.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    el.onclick = () => cycleDay(d);
    if (isCurrentMonth && d === TODAY_DAY) el.classList.add('today');
    else if (r[d] === 'win')  el.classList.add('win');
    else if (r[d] === 'loss') el.classList.add('loss');
    else if (isCurrentMonth && d > TODAY_DAY) el.classList.add('future');
    grid.appendChild(el);
  }
}

function cycleDay(d) {
  const r = getCalResults();
  if (!r[d]) r[d] = 'win';
  else if (r[d] === 'win') r[d] = 'loss';
  else delete r[d];
  setCalResults(r);
  buildCalendar();
  updateStats();
  buildBacktestCard('ny');
  buildBacktestCard('asia');
}

// ── Activity bars ─────────────────────────────────────────────────────────
const barsEl = document.getElementById('activity-bars');
[40,60,30,70,50,80,45,90,60,35,75,100].forEach((h, i, arr) => {
  const b = document.createElement('div');
  b.className = 'bar-item';
  b.style.height = h + '%';
  b.style.background = i === arr.length - 1 ? '#7065D4' : 'rgba(112,101,212,0.2)';
  barsEl.appendChild(b);
});

// ── Performance dots ──────────────────────────────────────────────────────
const tradeData = 'WWLLWWLWWLWWLWWLLWWWWWWWLLWWWLWWWWWLWLLWLWWWWWWWWWWWWWWWWWWLLLWWWWWWWLWWLWWWWWL'.split('');
const thEl = document.getElementById('trade-history');
tradeData.forEach(r => {
  const dot = document.createElement('div');
  dot.className = 'th-dot ' + (r === 'W' ? 'w' : 'l');
  dot.textContent = r;
  thEl.appendChild(dot);
});

// ── Month filter ──────────────────────────────────────────────────────────
function setMonthFilter(btn) {
  document.querySelectorAll('.mf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Journal ───────────────────────────────────────────────────────────────
const journalEntries = [
  { result:'WIN', direction:'LONG', date:'June 3, 2026', pnl:'+$900', pts:'+18 pts', tags:['Disciplined','Followed Plan'], well:'Ran 2 contracts, all confluences lined up. Held to full TP.', improve:'Nothing — textbook A+ setup.' },
  { result:'WIN', direction:'LONG', date:'June 3, 2026', pnl:'+$450', pts:'+9 pts', tags:['Calm','Followed Plan'], well:'Waited for the signal, no early entries.', improve:'Next time size up when all 4 confluences are active.' },
  { result:'WIN', direction:'LONG', date:'June 1, 2026', pnl:'+$900', pts:'+18 pts', tags:['Confident','Followed Plan'], well:'Signal was spot on — doubled my size. Gap up confirmed all 4 confluences.', improve:'Nothing — great execution.' },
  { result:'WIN', direction:'LONG', date:'June 1, 2026', pnl:'+$450', pts:'+9 pts', tags:['Calm','Followed Plan'], well:'Clean entry at market open, followed the plan perfectly.', improve:'Could have sized up — setup was A+.' },
  { result:'WIN', direction:'LONG', date:'June 1, 2026', pnl:'+$450', pts:'+9 pts', tags:['Followed Plan'], well:'Straightforward market open trade.', improve:'Watch for gap fills earlier in session.' },
  { result:'WIN', direction:'LONG', date:'June 1, 2026', pnl:'+$450', pts:'+9 pts', tags:['Calm','Followed Plan'], well:'Solid execution across the board.', improve:'None — clean trade.' },
];
const jGrid = document.getElementById('journal-grid');
journalEntries.forEach(e => {
  const isWin = e.result === 'WIN', isLong = e.direction === 'LONG';
  jGrid.innerHTML += `<div class="journal-card">
    <div class="jc-badges">
      <div class="jc-check"><i class="ti ti-check" style="font-size:11px;color:#0F6E56"></i></div>
      <span class="jc-badge ${isWin?'jc-win':'jc-loss'}">${e.result}</span>
      <span class="jc-badge ${isLong?'jc-long':'jc-short'}">${e.direction}</span>
    </div>
    <div class="jc-date-row">
      <span class="jc-date">${e.date}</span>
      <span class="jc-pnl ${isWin?'':'neg'}">${e.pnl} <span style="font-weight:400;font-size:12px;color:var(--text-muted)">(${e.pts})</span></span>
    </div>
    <div class="jc-tags">${e.tags.map(t=>`<span class="jc-tag">${t}</span>`).join('')}</div>
    <div class="jc-section-label">What went well</div>
    <div class="jc-text">${e.well}</div>
    <div class="jc-section-label">Improve next time</div>
    <div class="jc-text" style="margin-bottom:0">${e.improve}</div>
  </div>`;
});

// ── Charts ────────────────────────────────────────────────────────────────
let chartsBuilt = false;
function initCharts() {
  if (chartsBuilt) return;
  chartsBuilt = true;
  const labels = ['18:00','18:15','18:30','18:45','19:00','19:15','19:30','19:45'];
  const priceCtx = document.getElementById('priceChart').getContext('2d');
  new Chart(priceCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'ES Price', data:[5531,5538,5541,5535,5558,5574,5569,5562], borderColor:'#534AB7', backgroundColor:'rgba(83,74,183,0.08)', fill:true, tension:0.4, pointRadius:2, borderWidth:2 },
        { label:'PD Close', data:Array(8).fill(5571), borderColor:'#FAC775', borderDash:[5,5], borderWidth:1.5, pointRadius:0, fill:false },
        { label:'OH', data:Array(8).fill(5578), borderColor:'#AFA9EC', borderDash:[4,4], borderWidth:1, pointRadius:0, fill:false },
        { label:'OL', data:Array(8).fill(5529), borderColor:'#F09595', borderDash:[4,4], borderWidth:1, pointRadius:0, fill:false }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:11},color:'#888'}}, y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:11},color:'#888'}} } }
  });
  const volCtx = document.getElementById('volChart').getContext('2d');
  new Chart(volCtx, {
    type: 'bar',
    data: { labels, datasets:[{ data:[1200,800,3800,900,1100,4200,2100,1600], backgroundColor:'rgba(83,74,183,0.35)', borderRadius:3 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{grid:{display:false},ticks:{font:{size:11},color:'#888'}}, y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{font:{size:11},color:'#888',callback:v=>v>=1000?(v/1000).toFixed(0)+'K':v}} } }
  });
}

// ── Init ──────────────────────────────────────────────────────────────────
applyRole();
applySessionUI(currentSession);
applyBacktestUI(currentSession);
buildCalendar();
updateStats();
buildBacktestCard('ny');
buildBacktestCard('asia');
loadSignal();

// Load real results from Redis (syncs phone + desktop)
Promise.all([
  fetchResultsFromRedis('ny'),
  fetchResultsFromRedis('asia')
]).then(([ny, asia]) => {
  if (Object.keys(ny).length)   { nyResults   = ny;   localStorage.setItem(STORAGE_KEY_NY,   JSON.stringify(ny));   }
  if (Object.keys(asia).length) { asiaResults = asia; localStorage.setItem(STORAGE_KEY_ASIA, JSON.stringify(asia)); }
  buildCalendar();
  updateStats();
});
