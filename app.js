// ── Bankroll Algo v2 · app.js ─────────────────────────────────────────────

// ── Session ───────────────────────────────────────────────────────────────
let currentSession = localStorage.getItem('ba_session') || 'ny'; // ny | asia

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
  document.getElementById('mkt-ctx-wrap').style.display = 'none';
  document.getElementById('signal-loading').style.display = 'block';
  document.getElementById('signal-body').style.display   = 'none';
  document.getElementById('signal-empty').style.display  = 'none';
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

  // Market context panel
  renderMarketContext(signal);
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

function renderMarketContext(signal) {
  const ctx = signal.market_context;
  if (!ctx) return;

  document.getElementById('mkt-ctx-wrap').style.display = 'block';

  const ctxRow = (label, val, color) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:11px;color:var(--text-muted)">${label}</span>
      <span style="font-size:12px;font-weight:500${color ? ';color:' + color : ''}">${val}</span>
    </div>`;

  // Market rows
  const mktEl = document.getElementById('ctx-market-rows');
  let mktHtml = '';
  if (ctx.es_price) mktHtml += ctxRow('ES Price', ctx.es_price);
  if (ctx.overnight_change) {
    const isPos = ctx.overnight_change.startsWith('+');
    mktHtml += ctxRow('Overnight', ctx.overnight_change, isPos ? '#0F6E56' : '#A32D2D');
  }
  if (ctx.pm_range) {
    const rc = parseFloat(ctx.pm_range) > 15 ? '#0F6E56' : parseFloat(ctx.pm_range) < 8 ? '#A32D2D' : null;
    mktHtml += ctxRow('PM Range', `${ctx.pm_range} pts`, rc);
  }
  if (ctx.vix) {
    const vc = parseFloat(ctx.vix) > 30 ? '#A32D2D' : parseFloat(ctx.vix) > 20 ? '#854F0B' : '#0F6E56';
    mktHtml += ctxRow('VIX', ctx.vix, vc);
  }
  mktEl.innerHTML = mktHtml || '<span style="font-size:11px;color:var(--text-muted)">No data</span>';

  // Walls rows
  const wallsEl = document.getElementById('ctx-walls-rows');
  let wallsHtml = '';
  if (ctx.call_wall?.spy) wallsHtml += ctxRow('Call Wall', `SPY ${ctx.call_wall.spy}`, '#0F6E56');
  if (ctx.put_wall?.spy)  wallsHtml += ctxRow('Put Wall',  `SPY ${ctx.put_wall.spy}`,  '#A32D2D');
  if (ctx.max_pain?.spy)  wallsHtml += ctxRow('Max Pain',  `SPY ${ctx.max_pain.spy}`);
  if (ctx.pc_ratio?.value) {
    const pc = parseFloat(ctx.pc_ratio.value);
    const pc_c = pc > 1.2 ? '#A32D2D' : pc < 0.8 ? '#0F6E56' : null;
    wallsHtml += ctxRow('P/C Ratio', `${ctx.pc_ratio.value} (${ctx.pc_ratio.tag})`, pc_c);
  }
  wallsEl.innerHTML = wallsHtml || '<span style="font-size:11px;color:var(--text-muted)">No data</span>';

  // News events
  const newsEl = document.getElementById('ctx-news-rows');
  if (ctx.news_events && ctx.news_events.length > 0) {
    const ic = { High: '#A32D2D', Medium: '#854F0B' };
    const bc = { bullish: '#0F6E56', bearish: '#A32D2D', neutral: 'var(--text-muted)', mixed: '#854F0B' };
    let newsHtml = `<div style="background:var(--bg);border-radius:8px;padding:10px;border:0.5px solid var(--border);margin-bottom:6px">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em">News Events</div>`;
    for (const ev of ctx.news_events) {
      const evBc = bc[ev.bias] || 'var(--text-muted)';
      const evIc = ic[ev.impact] || 'var(--text-muted)';
      newsHtml += `<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:0.5px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <span style="font-size:11px;font-weight:500;flex:1;margin-right:8px">${ev.name}</span>
          <span style="font-size:10px;color:${evIc};font-weight:600;white-space:nowrap">${ev.impact.toUpperCase()}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px">
          <span style="font-size:11px;color:var(--text-muted)">${ev.time}</span>
          ${ev.actual != null ? `<span style="font-size:11px">A: <b>${ev.actual}</b> F: ${ev.forecast ?? '—'}</span>` : '<span style="font-size:11px;color:var(--text-muted)">Pending</span>'}
        </div>
        ${ev.surprise ? `<div style="margin-top:3px;font-size:11px;color:${evBc}">${ev.surprise}</div>` : ''}
      </div>`;
    }
    newsHtml += '</div>';
    newsEl.innerHTML = newsHtml;
  } else {
    newsEl.innerHTML = '';
  }

  // Bias badge + warning row
  const badge   = document.getElementById('news-bias-badge');
  const biasRow = document.getElementById('ctx-bias-row');
  const biasTxt = document.getElementById('ctx-bias-text');

  if (ctx.news_bias && ctx.news_bias !== 'none') {
    badge.style.display = 'inline-block';
    const isLong = signal.direction === 'LONG';
    const conflicts = (ctx.news_bias === 'bullish' && !isLong) || (ctx.news_bias === 'bearish' && isLong);

    if (ctx.news_bias === 'bullish') {
      badge.textContent = '📈 Bullish news';
      badge.style.background = '#E1F5EE'; badge.style.color = '#0F6E56';
    } else if (ctx.news_bias === 'bearish') {
      badge.textContent = '📉 Bearish news';
      badge.style.background = '#FCEBEB'; badge.style.color = '#A32D2D';
    } else {
      badge.textContent = '⚡ Mixed news';
      badge.style.background = '#FFF8E6'; badge.style.color = '#854F0B';
    }

    if (conflicts) {
      biasRow.style.display = 'flex';
      biasRow.style.background = '#FFF8E6';
      biasRow.querySelector('i').style.color = '#854F0B';
      biasTxt.style.color = '#854F0B';
      biasTxt.textContent = `News bias conflicts with ${signal.direction} signal — consider lower confidence`;
    } else {
      biasRow.style.display = 'none';
    }
  } else {
    badge.style.display = 'none';
    biasRow.style.display = 'none';
  }
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
const STORAGE_KEY = 'bankroll_algo_results';
const TODAY_DAY = new Date().getDate();

function loadResults() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { 3: 'win', 4: 'win', 9: 'loss' };
  } catch { return { 3: 'win', 4: 'win', 9: 'loss' }; }
}
function saveResults(r) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {}
}

let results = loadResults();

function getWins() { return Object.values(results).filter(v => v === 'win').length; }
function getLosses() { return Object.values(results).filter(v => v === 'loss').length; }

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
    const days = Object.keys(results).map(Number).sort((a,b) => a - b);
    days.forEach(d => {
      const r = results[d];
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
  grid.innerHTML = '';
  ['S','M','T','W','T','F','S'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-label'; el.textContent = d; grid.appendChild(el);
  });
  for (let i = 0; i < 1; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; el.textContent = '·'; grid.appendChild(el);
  }
  for (let d = 1; d <= 30; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    el.onclick = () => cycleDay(d);
    if (d === TODAY_DAY) el.classList.add('today');
    else if (results[d] === 'win') el.classList.add('win');
    else if (results[d] === 'loss') el.classList.add('loss');
    else if (d > TODAY_DAY) el.classList.add('future');
    grid.appendChild(el);
  }
}

function cycleDay(d) {
  const cur = results[d];
  if (!cur) results[d] = 'win';
  else if (cur === 'win') results[d] = 'loss';
  else delete results[d];
  saveResults(results);
  buildCalendar();
  updateStats();
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
buildCalendar();
updateStats();
loadSignal();
