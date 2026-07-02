// ── Bankroll Algo v2 · app.js ─────────────────────────────────────────────

// ── Session ───────────────────────────────────────────────────────────────
let currentSession = localStorage.getItem('ba_session') || 'ny'; // ny | london | asia

function buildBacktestCard(sess = 'ny') {
  const TP_USD = 450;
  const SL_USD = 550;
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  const activeFilter = document.querySelector('.mf-btn.active')?.textContent.trim() || 'All Time';
  const months = [];
  if (activeFilter === 'All Time') {
    for (let y = 2026; y <= now.getFullYear(); y++) {
      const end = (y === now.getFullYear()) ? now.getMonth() : 11;
      for (let m = 0; m <= end; m++) months.push({y, m});
    }
  } else {
    const idx = MN.indexOf(activeFilter);
    if (idx !== -1) months.push({y: now.getFullYear(), m: idx});
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
      const isW = v === 'win' || v === 'lw' || v === 'sw';
      const isL = v === 'loss' || v === 'll' || v === 'sl';
      if (isW)  { mW++; mPnl += TP_USD; allTrades.push('win'); }
      else if (isL) { mL++; mPnl -= SL_USD; allTrades.push('loss'); }
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
  const btNY     = document.getElementById('bt-ny');
  const btLondon = document.getElementById('bt-london');
  const btAsia   = document.getElementById('bt-asia');
  if (btNY)     btNY.style.display     = sess === 'ny'     ? 'block' : 'none';
  if (btLondon) btLondon.style.display = sess === 'london' ? 'block' : 'none';
  if (btAsia)   btAsia.style.display   = sess === 'asia'   ? 'block' : 'none';
}

function applySessionUI(sess) {
  const nyBtn     = document.getElementById('sess-ny');
  const londonBtn = document.getElementById('sess-london');
  const asiaBtn   = document.getElementById('sess-asia');
  const base = 'flex:1;padding:9px;border-radius:8px;border:none;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .2s;letter-spacing:.01em';
  const active   = base + ';background:var(--purple,#6B5FD0);color:#fff';
  const inactive = base + ';background:transparent;color:var(--text-muted,#52526A)';
  if (nyBtn)     nyBtn.style.cssText     = sess === 'ny'     ? active : inactive;
  if (londonBtn) londonBtn.style.cssText = sess === 'london' ? active : inactive;
  if (asiaBtn)   asiaBtn.style.cssText   = sess === 'asia'   ? active : inactive;
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
    const emptyAdmin = document.getElementById('admin-panel-empty');
    if (emptyAdmin) emptyAdmin.style.display = 'block';
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
  const endpoint = currentSession === 'asia' ? '/api/get-asia-signal'
                 : currentSession === 'london' ? '/api/get-london-signal'
                 : '/api/get-signal';
  try {
    const res = await fetch(endpoint + '?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();

    document.getElementById('signal-loading').style.display = 'none';

    if (!data.signal) {
      document.getElementById('signal-empty').style.display = 'block';
      return;
    }

    document.getElementById('signal-body').style.display = 'block';
    populateSignal(data.signal);

  } catch (err) {
    // Real failure (network/parse error) — show empty state, never fake data
    console.error('loadSignal failed:', err);
    document.getElementById('signal-loading').style.display = 'none';
    document.getElementById('signal-empty').style.display = 'block';
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
  const hitRate = signal.hit_rate ?? (signal.confidence === 'High' ? 70 : signal.confidence === 'Medium' ? 56 : 29);
  confEl.textContent = `${signal.confidence} · ${hitRate}% hit rate`;
  confEl.style.color = signal.confidence === 'High' ? '#534AB7' : signal.confidence === 'Medium' ? '#854F0B' : '#A32D2D';

  // No-trade banner — moderate-conviction filter OR low confidence, signal still shows for reference
  const existingBanner = document.getElementById('no-trade-banner');
  if (existingBanner) existingBanner.remove();
  if (signal.no_trade) {
    const banner = document.createElement('div');
    banner.id = 'no-trade-banner';
    banner.style.cssText = 'margin:12px 0 4px;padding:10px 14px;background:#FCEBEB;border:0.5px solid #F09595;border-radius:8px;display:flex;align-items:center;gap:8px';
    banner.innerHTML = `<span style="font-size:15px">🚫</span><div><div style="font-size:13px;font-weight:500;color:#A32D2D">No trade today</div><div style="font-size:11px;color:#791F1F;margin-top:1px">${signal.no_trade_reason || 'Moderate-conviction setup — below backtested breakeven.'}</div></div>`;
    confEl.parentElement.insertAdjacentElement('afterend', banner);
  } else if (signal.confidence === 'Low') {
    const banner = document.createElement('div');
    banner.id = 'no-trade-banner';
    banner.style.cssText = 'margin:12px 0 4px;padding:10px 14px;background:#FCEBEB;border:0.5px solid #F09595;border-radius:8px;display:flex;align-items:center;gap:8px';
    banner.innerHTML = `<span style="font-size:15px">🚫</span><div><div style="font-size:13px;font-weight:500;color:#A32D2D">No trade today</div><div style="font-size:11px;color:#791F1F;margin-top:1px">Low confidence — signal shown for reference only</div></div>`;
    confEl.parentElement.insertAdjacentElement('afterend', banner);
  }

  // TP / SL / RR (unlocked values — shown only when unlocked)
  document.getElementById('tp-val').textContent = signal.take_profit || '—';
  document.getElementById('sl-val').textContent = signal.stop_loss || '—';
  document.getElementById('rr-ratio').textContent = signal.rr_ratio || '—';
  document.getElementById('rr-target').textContent = signal.rr_target || '—';
  document.getElementById('rr-risk').textContent = signal.rr_risk || '—';

  // Confluences — render all 9 from market_context.confluences
  const confGrid = document.getElementById('conf-grid');
  const confData = signal.market_context?.confluences;
  if (confGrid && confData && confData.length) {
    const signalDir = (signal.direction || '').toUpperCase(); // LONG or SHORT
    confGrid.innerHTML = confData.map((c, i) => {
      const v = c.value.toLowerCase();
      const isBullish = v.includes('bullish') || v.includes('above') || v.includes('hh/hl') || v.includes('aligned bullish');
      const isBearish = v.includes('bearish') || v.includes('below') || v.includes('ll/lh') || v.includes('aligned bearish');
      // Aligned = confluence matches signal direction
      const aligned = (signalDir === 'LONG' && isBullish) || (signalDir === 'SHORT' && isBearish);
      const conflicting = (signalDir === 'LONG' && isBearish) || (signalDir === 'SHORT' && isBullish);
      const iconColor = aligned ? '#0F6E56' : conflicting ? '#E05252' : '#8A8A8A';
      const icon = aligned ? 'ti-circle-check' : conflicting ? 'ti-circle-x' : 'ti-minus';
      return `<div class="conf-item conf-visible">
        <div class="conf-item-text" style="gap:8px">
          <i class="ti ${icon}" style="color:${iconColor};font-size:14px;flex-shrink:0"></i>
          <span style="color:var(--text-muted);font-size:11px;min-width:105px;flex-shrink:0">${c.label}</span>
          <span style="font-size:12px;color:var(--text)">${c.value}</span>
        </div>
      </div>`;
    }).join('');
  } else {
    // fallback to old single public confluence
    const pub = signal.confluence_public || 'Overnight Range';
    if (confGrid) confGrid.innerHTML = `<div class="conf-item conf-visible"><div class="conf-item-text"><div class="conf-check"><i class="ti ti-check" style="font-size:11px;color:#0F6E56"></i></div><span>${pub}</span></div></div>`;
  }

  // Entry label — differs between sessions
  const entryEl = document.getElementById('entry-session-val');
  if (entryEl) {
    if (signal.session === 'Asia') {
      entryEl.textContent = signal.entry_range ? `Asia Open · ${signal.entry_range}` : 'Asia Market Open';
    } else if (signal.session === 'London') {
      entryEl.textContent = signal.entry_range ? `London Open · ${signal.entry_range}` : 'London Open · 8:00 UTC';
    } else {
      entryEl.textContent = 'NYSE Market Open';
    }
  }

  // Generated time
  if (signal.generated_at) {
    const t = new Date(signal.generated_at).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short'
    });
    const sess = signal.session === 'Asia' ? ' · Asia' : signal.session === 'London' ? ' · London' : ' · NY';
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
  // Use whichever regen button is currently visible
  const btnMain  = document.getElementById('regen-btn');
  const btnEmpty = document.getElementById('regen-btn-empty');
  const btn = (btnEmpty && btnEmpty.offsetParent !== null) ? btnEmpty : btnMain;
  const txtId = (btn && btn.id === 'regen-btn-empty') ? 'regen-btn-empty-text' : 'regen-btn-text';
  const txt = document.getElementById(txtId);
  if (!btn) return;
  btn.disabled = true;

  const adminPw = localStorage.getItem('ba_admin_key') || '';
  const regenEndpoint = currentSession === 'asia' ? '/api/generate-asia-signal'
                      : currentSession === 'london' ? '/api/generate-london-signal'
                      : '/api/generate-signal';
  const getEndpoint   = currentSession === 'asia' ? '/api/get-asia-signal'
                      : currentSession === 'london' ? '/api/get-london-signal'
                      : '/api/get-signal';

  // Track whether the regenerate call itself succeeded, so we can show
  // the REAL reason on failure instead of silently doing nothing.
  let regenStatus = null, regenBody = null;
  const regenPromise = fetch(regenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_key: adminPw })
  }).then(async r => {
    regenStatus = r.status;
    try { regenBody = await r.json(); } catch (e) {}
  }).catch(e => { regenStatus = 'network-error'; regenBody = { error: e.message }; });

  // Poll Redis for the new signal after 6s
  let secs = 6;
  txt.textContent = `Generating… ${secs}s`;
  const countdown = setInterval(() => {
    secs--;
    txt.textContent = secs > 0 ? `Generating… ${secs}s` : 'Checking…';
  }, 1000);

  setTimeout(async () => {
    clearInterval(countdown);
    await regenPromise; // make sure we know the real outcome before deciding what to show

    if (regenStatus === 401) {
      txt.textContent = 'Unauthorized — re-enter admin key';
      btn.disabled = false;
      return;
    }
    if (regenStatus && regenStatus !== 200) {
      txt.textContent = `Failed (${regenStatus}): ${regenBody?.error || 'unknown error'}`;
      btn.disabled = false;
      return;
    }

    try {
      const r = await fetch(getEndpoint + '?t=' + Date.now(), { cache: 'no-store' });
      const d = await r.json();
      if (d.signal) {
        populateSignal(d.signal);
        txt.textContent = 'Signal Regenerated ✓';
        btn.style.background = '#1D9E75';
        setTimeout(() => { btn.disabled = false; txt.textContent = 'Regenerate Signal Now'; btn.style.background = ''; }, 3000);
      } else {
        txt.textContent = 'No signal returned — try again';
        btn.disabled = false;
      }
    } catch(e) {
      txt.textContent = 'Error checking signal: ' + e.message;
      btn.disabled = false;
    }
  }, 6000);
}

// ── Calendar ──────────────────────────────────────────────────────────────
const STORAGE_KEY_NY     = 'bankroll_algo_results_ny';
const STORAGE_KEY_LONDON = 'bankroll_algo_results_london';
const STORAGE_KEY_ASIA   = 'bankroll_algo_results_asia';
const _NOW        = new Date();
const TODAY_DAY   = _NOW.getDate();
const TODAY_MONTH = _NOW.getMonth();
const TODAY_YEAR  = _NOW.getFullYear();
const CUR_YM      = `${TODAY_YEAR}-${String(TODAY_MONTH+1).padStart(2,'0')}`;
let calViewYear   = TODAY_YEAR;
let calViewMonth  = TODAY_MONTH;
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Month-keyed local storage so each month is saved separately
function monthKey(sess, y, m) {
  return `ba_res_${sess}_${y}_${String(m+1).padStart(2,'0')}`;
}
function migrateToDirectional(data) {
  let changed = false;
  for (const k of Object.keys(data)) {
    if (data[k] === 'win')  { data[k] = 'lw'; changed = true; }
    if (data[k] === 'loss') { data[k] = 'll'; changed = true; }
  }
  return { data, changed };
}
function loadMonthData(sess, y, m) {
  try {
    const raw = localStorage.getItem(monthKey(sess, y, m));
    if (raw) {
      let data = JSON.parse(raw);
      const { data: migrated, changed } = migrateToDirectional(data);
      if (changed) localStorage.setItem(monthKey(sess, y, m), JSON.stringify(migrated));
      return migrated;
    }
    return {};
  } catch { return {}; }
}
function saveMonthData(sess, y, m, r) {
  try {
    localStorage.setItem(monthKey(sess, y, m), JSON.stringify(r));
  } catch {}
}

// Clear any old single-key data and wrongly migrated current-month data on startup
(function cleanupOldKeys() {
  const sessions = ['ny', 'asia', 'london'];
  const oldKeys  = { ny: STORAGE_KEY_NY, london: STORAGE_KEY_LONDON, asia: STORAGE_KEY_ASIA };
  sessions.forEach(sess => {
    const oldKey = oldKeys[sess];
    const curKey = monthKey(sess, TODAY_YEAR, TODAY_MONTH);
    // Remove the old single key — no longer used
    localStorage.removeItem(oldKey);
    // If current month data has no _ym tag or wrong month — wrongly migrated, clear it
    try {
      const curRaw = localStorage.getItem(curKey);
      if (curRaw) {
        const curData = JSON.parse(curRaw);
        if (!curData._ym || curData._ym !== CUR_YM) {
          localStorage.removeItem(curKey);
        }
      }
    } catch { localStorage.removeItem(curKey); }
  });
})();

// Calendar-view results (the month currently displayed)
function getCalResults() {
  return loadMonthData(currentSession, calViewYear, calViewMonth);
}
function setCalResults(r) {
  saveMonthData(currentSession, calViewYear, calViewMonth, r);
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
  updateStats();
}

function getStorageKey() {
  if (currentSession === 'asia')   return STORAGE_KEY_ASIA;
  if (currentSession === 'london') return STORAGE_KEY_LONDON;
  return STORAGE_KEY_NY;
}

function loadResults(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function saveResults(r) {
  // Tag with current month so Redis sync knows which month this data belongs to
  const tagged = { ...r, _ym: CUR_YM };
  fetch('/api/save-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: currentSession, results: tagged })
  }).catch(() => {});
}

async function fetchResultsFromRedis(sess) {
  try {
    const res  = await fetch(`/api/get-results?session=${sess}`);
    const data = await res.json();
    return data.results || {};
  } catch { return {}; }
}

let nyResults     = loadMonthData('ny',     TODAY_YEAR, TODAY_MONTH);
let londonResults = loadMonthData('london', TODAY_YEAR, TODAY_MONTH);
let asiaResults   = loadMonthData('asia',   TODAY_YEAR, TODAY_MONTH);

function getResults() {
  const sess = currentSession === 'asia' ? 'asia' : currentSession === 'london' ? 'london' : 'ny';
  return loadMonthData(sess, calViewYear, calViewMonth);
}
function setResults(r) {
  const sess = currentSession === 'asia' ? 'asia' : currentSession === 'london' ? 'london' : 'ny';
  saveMonthData(sess, calViewYear, calViewMonth, r);
  if (calViewYear === TODAY_YEAR && calViewMonth === TODAY_MONTH) {
    if (currentSession === 'asia') asiaResults = r;
    else if (currentSession === 'london') londonResults = r;
    else nyResults = r;
  }
}

function getWins()   { return Object.values(getResults()).filter(v => v === 'win' || v === 'lw' || v === 'sw').length; }
function getLosses() { return Object.values(getResults()).filter(v => v === 'loss' || v === 'll' || v === 'sl').length; }
function getLongWins()    { return Object.values(getResults()).filter(v => v === 'lw').length; }
function getLongLosses()  { return Object.values(getResults()).filter(v => v === 'll').length; }
function getShortWins()   { return Object.values(getResults()).filter(v => v === 'sw').length; }
function getShortLosses() { return Object.values(getResults()).filter(v => v === 'sl').length; }

function updateStats() {
  // If "All Time" filter is active, aggregate all months; otherwise use current calendar month
  const activeFilter = document.querySelector('.mf-btn.active')?.textContent.trim() || '';
  let w, l, lw, ll, sw, sl;
  if (activeFilter === 'All Time') {
    w = 0; l = 0; lw = 0; ll = 0; sw = 0; sl = 0;
    const sess = currentSession === 'asia' ? 'asia' : currentSession === 'london' ? 'london' : 'ny';
    const now = new Date();
    for (let y = 2026; y <= now.getFullYear(); y++) {
      const end = (y === now.getFullYear()) ? now.getMonth() : 11;
      for (let m = 0; m <= end; m++) {
        const key = `ba_res_${sess}_${y}_${String(m+1).padStart(2,'0')}`;
        let dm; try { dm = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { continue; }
        if (!dm) continue;
        for (const v of Object.values(dm)) {
          if (v === '_ym') continue;
          if (v === 'win' || v === 'lw') { w++; lw++; }
          else if (v === 'sw') { w++; sw++; }
          else if (v === 'loss' || v === 'll') { l++; ll++; }
          else if (v === 'sl') { l++; sl++; }
        }
      }
    }
  } else {
    w = getWins(); l = getLosses();
    lw = getLongWins(); ll = getLongLosses();
    sw = getShortWins(); sl = getShortLosses();
  }
  const total = w + l;
  const pct = total > 0 ? Math.round(w / total * 100) : 0;

  // Header bar + calendar mini stats always use current calendar month (not filter)
  const mW = getWins(), mL = getLosses(), mTotal = mW + mL;
  const mPct = mTotal > 0 ? Math.round(mW / mTotal * 100) : 0;
  document.getElementById('w-badge').textContent = mW + 'W';
  document.getElementById('l-badge').textContent = mL + 'L';
  document.getElementById('win-pct-txt').textContent = mPct + '%';
  document.getElementById('win-bar').style.width = mPct + '%';

  // Calendar mini stats
  const stats = document.getElementById('cal-stats');
  stats.innerHTML = `
    <span class="cal-stat" style="background:var(--green-light);color:var(--green)">${mW}W</span>
    <span class="cal-stat" style="background:var(--red-light);color:var(--red)">${mL}L</span>
    <span class="cal-stat" style="background:var(--gold-light);color:var(--gold)">${mPct}% WR</span>`;

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

  // Direction breakdown card (lw/ll/sw/sl already set above)
  const lTotal = lw + ll, sTotal = sw + sl;
  const lWR = lTotal > 0 ? Math.round(lw / lTotal * 100) : null;
  const sWR = sTotal > 0 ? Math.round(sw / sTotal * 100) : null;
  const lPnl = lw * 450 - ll * 550;
  const sPnl = sw * 450 - sl * 550;
  const dirEl = el('dir-breakdown');
  if (dirEl) {
    if (lTotal === 0 && sTotal === 0) {
      dirEl.innerHTML = `<div style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px 0">No direction data yet — tap a calendar day to log trades with direction.</div>`;
    } else {
      const card = (label, wins, losses, wr, pnl, color) => {
        const t = wins + losses;
        const pnlStr = (pnl >= 0 ? '+' : '-') + '$' + Math.abs(pnl).toLocaleString();
        const pnlColor = pnl >= 0 ? 'var(--green)' : 'var(--red)';
        return `<div style="background:var(--bg);border-radius:8px;padding:12px;border:0.5px solid var(--border);flex:1">
          <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${label}</div>
          <div style="font-size:22px;font-weight:700;color:${color};margin-bottom:2px">${wr !== null ? wr + '%' : '—'}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${wins}W / ${losses}L · ${t} trades</div>
          <div style="font-size:12px;font-weight:500;color:${pnlColor}">${t > 0 ? pnlStr : '—'}</div>
        </div>`;
      };
      dirEl.innerHTML = `<div style="display:flex;gap:8px">
        ${card('LONG signals', lw, ll, lWR, lPnl, 'var(--green)')}
        ${card('SHORT signals', sw, sl, sWR, sPnl, 'var(--red)')}
      </div>`;
    }
  }

  // Header month label
  const perfLabel = document.getElementById('perf-month-label');
  if (perfLabel) {
    const mn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    perfLabel.textContent = mn[TODAY_MONTH] + ' ' + TODAY_YEAR + ' Performance';
  }

  // Day win rate card
  buildDayWinRate();

  // Trade history dots — all months on "All Time", current month otherwise
  const th = document.getElementById('trade-history');
  if (th) {
    th.innerHTML = '';
    const sess2 = currentSession === 'asia' ? 'asia' : currentSession === 'london' ? 'london' : 'ny';
    const allVals = [];
    if (activeFilter === 'All Time') {
      const now2 = new Date();
      for (let y = 2026; y <= now2.getFullYear(); y++) {
        const end = (y === now2.getFullYear()) ? now2.getMonth() : 11;
        for (let m = 0; m <= end; m++) {
          const key = `ba_res_${sess2}_${y}_${String(m+1).padStart(2,'0')}`;
          let dm; try { dm = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { continue; }
          if (!dm) continue;
          Object.keys(dm).filter(k => k !== '_ym').map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b).forEach(d => allVals.push(dm[String(d)]));
        }
      }
    } else {
      const cur = getResults();
      Object.keys(cur).filter(k => k !== '_ym').map(Number).filter(n => !isNaN(n)).sort((a,b)=>a-b).forEach(d => allVals.push(cur[String(d)]));
    }
    allVals.forEach(r => {
      const isW = r === 'win' || r === 'lw' || r === 'sw';
      const isL = r === 'loss' || r === 'll' || r === 'sl';
      if (isW || isL) {
        const dot = document.createElement('div');
        dot.className = 'th-dot ' + (isW ? 'w' : 'l');
        dot.textContent = isW ? 'W' : 'L';
        th.appendChild(dot);
      }
    });
  }
  // Refresh bottom stats card so it reflects latest logged trades
  const sess3 = currentSession === 'asia' ? 'asia' : currentSession === 'london' ? 'london' : 'ny';
  buildBacktestCard(sess3);
}

function buildDayWinRate() {
  const el = document.getElementById('day-wr');
  const dateEl = document.getElementById('day-wr-date');
  if (!el) return;

  const isAsia   = currentSession === 'asia';
  const isLondon = currentSession === 'london';
  const sess = currentSession;

  // Asia:   Sun(0) Mon(1) Tue(2) Wed(3) Thu(4)  — skip Fri(5) Sat(6)
  // NY/London: Mon(1) Tue(2) Wed(3) Thu(4) Fri(5) — skip Sun(0) Sat(6)
  const dayNames = isAsia ? ['Sun','Mon','Tue','Wed','Thu'] : ['Mon','Tue','Wed','Thu','Fri'];
  const tally = Array.from({length: 5}, () => ({w:0, l:0}));

  function dowToIdx(dow) {
    if (isAsia) {
      // Sun=0→0, Mon=1→1, Tue=2→2, Wed=3→3, Thu=4→4, Fri/Sat→-1
      return dow <= 4 ? dow : -1;
    } else {
      // Mon=1→0, Tue=2→1, Wed=3→2, Thu=4→3, Fri=5→4, Sun/Sat→-1
      return (dow >= 1 && dow <= 5) ? dow - 1 : -1;
    }
  }

  const now = new Date();
  for (let y = 2026; y <= now.getFullYear(); y++) {
    const endM = (y === now.getFullYear()) ? now.getMonth() : 11;
    for (let m = 0; m <= endM; m++) {
      const data = loadMonthData(sess, y, m);
      for (const [dayStr, val] of Object.entries(data)) {
        const d   = parseInt(dayStr);
        const dow = new Date(y, m, d).getDay(); // 0=Sun … 6=Sat
        const idx = dowToIdx(dow);
        if (idx === -1) continue;
        const isW = val === 'win' || val === 'lw' || val === 'sw';
        const isL = val === 'loss' || val === 'll' || val === 'sl';
        if (isW) tally[idx].w++;
        else if (isL) tally[idx].l++;
      }
    }
  }

  const total = tally.reduce((s,t) => s + t.w + t.l, 0);

  if (dateEl) {
    dateEl.textContent = 'As of ' + now.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'});
  }

  if (total === 0) {
    el.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">No data yet — log trades in the calendar.</div>`;
    return;
  }

  let bestIdx = -1, bestWR = -1, worstIdx = -1, worstWR = 101;
  tally.forEach((t, i) => {
    const tot = t.w + t.l;
    if (tot === 0) return;
    const wr = t.w / tot * 100;
    if (wr > bestWR)  { bestWR = wr;  bestIdx = i; }
    if (wr < worstWR) { worstWR = wr; worstIdx = i; }
  });

  const rows = dayNames.map((name, i) => {
    const t = tally[i];
    const tot = t.w + t.l;
    if (tot === 0) {
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:600;color:var(--text-muted);width:28px">${name}</span>
        <div style="flex:1;height:20px;background:var(--surface-2);border-radius:6px;"></div>
        <span style="font-size:10px;color:var(--text-muted);width:44px;text-align:right">—</span>
      </div>`;
    }
    const wr = t.w / tot * 100;
    const color   = wr >= 70 ? 'var(--green)' : wr >= 55 ? 'var(--gold)' : 'var(--red)';
    const bgColor = wr >= 70 ? 'rgba(23,160,106,0.2)' : wr >= 55 ? 'rgba(196,151,60,0.18)' : 'rgba(201,64,64,0.15)';
    const badge = i === bestIdx
      ? `<span style="font-size:8px;font-weight:700;background:rgba(23,160,106,0.15);color:var(--green);padding:1px 5px;border-radius:4px;margin-left:4px">BEST</span>`
      : (i === worstIdx && bestIdx !== worstIdx)
        ? `<span style="font-size:8px;font-weight:700;background:rgba(201,64,64,0.12);color:var(--red);padding:1px 5px;border-radius:4px;margin-left:4px">WATCH</span>`
        : '';
    return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-size:11px;font-weight:600;color:var(--text-muted);width:28px">${name}</span>
      <div style="flex:1;height:20px;background:var(--surface-2);border-radius:6px;overflow:hidden;position:relative">
        <div style="height:100%;width:${Math.round(wr)}%;background:${bgColor};border-radius:6px"></div>
        <span style="position:absolute;right:7px;top:50%;transform:translateY(-50%);font-size:10px;font-weight:700;color:${color}">${Math.round(wr)}%</span>
      </div>
      <span style="font-size:10px;color:var(--text-muted);width:44px;text-align:right">${t.w}W ${t.l}L</span>
      ${badge}
    </div>`;
  }).join('');

  el.innerHTML = rows + `<div style="border-top:0.5px solid var(--border);padding-top:8px;margin-top:2px;font-size:10px;color:var(--text-muted);text-align:center">${total} trades logged</div>`;
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
    const v = r[d];
    const isWin  = v === 'win' || v === 'lw' || v === 'sw';
    const isLoss = v === 'loss' || v === 'll' || v === 'sl';
    const dirLabel = (v === 'lw' || v === 'll') ? 'L' : (v === 'sw' || v === 'sl') ? 'S' : '';
    if (isCurrentMonth && d === TODAY_DAY) el.classList.add('today');
    else if (isWin)  el.classList.add('win');
    else if (isLoss) el.classList.add('loss');
    else if (isCurrentMonth && d > TODAY_DAY) el.classList.add('future');
    el.innerHTML = d + (dirLabel ? `<span class="dir-badge">${dirLabel}</span>` : '');
    grid.appendChild(el);
  }
}

function cycleDay(d) {
  const r = getCalResults();
  const cur = r[d];
  // Cycle: empty → lw (long win) → ll (long loss) → sw (short win) → sl (short loss) → empty
  // Backward compat: old 'win' continues from lw, old 'loss' continues from ll
  if (!cur)              r[d] = 'lw';
  else if (cur === 'lw') r[d] = 'll';
  else if (cur === 'll') r[d] = 'sw';
  else if (cur === 'sw') r[d] = 'sl';
  else delete r[d];
  setCalResults(r);
  buildCalendar();
  updateStats();
  buildBacktestCard('ny');
  buildBacktestCard('london');
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
  const label = btn.textContent.trim();
  const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if (label === 'All Time') {
    calViewMonth = TODAY_MONTH; calViewYear = TODAY_YEAR;
  } else {
    const idx = mn.indexOf(label);
    if (idx !== -1) { calViewMonth = idx; calViewYear = TODAY_YEAR; }
  }
  buildCalendar();
  updateStats();
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

// ── Asia Indices (Nikkei + Hang Seng) ────────────────────────────────────
async function loadAsiaIndices() {
  const indices = [
    { symbol: '%5EN225', priceId: 'nikkei-price', chgId: 'nikkei-chg', badgeId: 'nikkei-badge', cardId: 'nikkei-card' },
    { symbol: '%5EHSI',  priceId: 'hsi-price',    chgId: 'hsi-chg',    badgeId: 'hsi-badge',    cardId: 'hsi-card'    }
  ];
  for (const idx of indices) {
    try {
      const res  = await fetch(`/api/get-index?symbol=${idx.symbol}`);
      const data = await res.json();
      if (!data || data.error) continue;
      const price = data.price;
      const chg   = data.changePercent;
      const isUp  = chg >= 0;
      const color = isUp ? 'var(--green)' : 'var(--red)';
      const card  = document.getElementById(idx.cardId);
      if (card) {
        card.style.background    = isUp ? 'rgba(23,160,106,0.05)' : 'rgba(201,64,64,0.05)';
        card.style.borderColor   = isUp ? 'rgba(23,160,106,0.2)'  : 'rgba(201,64,64,0.2)';
      }
      const priceEl = document.getElementById(idx.priceId);
      if (priceEl) { priceEl.textContent = price.toLocaleString(undefined, {maximumFractionDigits:0}); priceEl.style.color = color; }
      const chgEl = document.getElementById(idx.chgId);
      if (chgEl) { chgEl.textContent = (isUp ? '▲ +' : '▼ ') + chg.toFixed(2) + '%'; chgEl.style.color = color; }
      const badgeEl = document.getElementById(idx.badgeId);
      if (badgeEl) {
        badgeEl.innerHTML = `<span style="display:inline-block;font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:.05em;background:${isUp?'rgba(23,160,106,0.15)':'rgba(201,64,64,0.15)'};color:${color}">${isUp?'BULL POINT':'BEAR POINT'}</span>`;
      }
    } catch(e) { console.warn('Asia index fetch failed:', e); }
  }
}

// ── Charts ────────────────────────────────────────────────────────────────
let chartsBuilt = false;
function initCharts() {
  if (chartsBuilt) return;
  chartsBuilt = true;
  loadAsiaIndices();
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
buildBacktestCard('london');
buildBacktestCard('asia');
loadSignal();

// Load real results from Redis (syncs phone + desktop)
// Only apply Redis data if it's tagged for the current month
Promise.all([
  fetchResultsFromRedis('ny'),
  fetchResultsFromRedis('london'),
  fetchResultsFromRedis('asia')
]).then(([ny, london, asia]) => {
  const apply = (data, setter, sess) => {
    if (!Object.keys(data).length) return;
    const { _ym, ...clean } = data;
    if (_ym === CUR_YM) {
      // Current month data — apply to memory + current month slot
      setter(clean);
      saveMonthData(sess, TODAY_YEAR, TODAY_MONTH, clean);
    } else if (!_ym) {
      // No tag = old data from before tagging was added → save to previous month
      const prevMonth = TODAY_MONTH === 0 ? 11 : TODAY_MONTH - 1;
      const prevYear  = TODAY_MONTH === 0 ? TODAY_YEAR - 1 : TODAY_YEAR;
      const existing  = loadMonthData(sess, prevYear, prevMonth);
      if (!Object.keys(existing).length) {
        // Only restore if prev month is empty (don't overwrite real data)
        saveMonthData(sess, prevYear, prevMonth, clean);
      }
    }
    // Wrong _ym = skip entirely
  };
  apply(ny,     r => { nyResults     = r; }, 'ny');
  apply(london, r => { londonResults = r; }, 'london');
  apply(asia,   r => { asiaResults   = r; }, 'asia');
  buildCalendar();
  updateStats();
});
