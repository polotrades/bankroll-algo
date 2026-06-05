// ── Extended Swing Signals · swing-app.js ───────────────────────────────

// ── Access control ────────────────────────────────────────────────────────
let userRole = localStorage.getItem('swing_role') || 'preview'; // preview | member | admin
let currentSession = localStorage.getItem('swing_session') || 'ny'; // ny | asia

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
      body: JSON.stringify({ password: pw, type: 'swing' })
    });
    const data = await res.json();
    if (data.role) {
      userRole = data.role;
      localStorage.setItem('swing_role', userRole);
      applyRole();
      closeUnlock();
      renderSwings();
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
  }
}

// ── Session switching ─────────────────────────────────────────────────────
function selectSession(session) {
  currentSession = session;
  localStorage.setItem('swing_session', session);
  document.querySelectorAll('.session-btn').forEach(btn => btn.classList.remove('active'));
  event.target.closest('.session-btn').classList.add('active');
  renderSwings();
  renderPending();
}

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['swings','pending','performance','journal'][i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

// ── Sample Extended Intraday Data ──────────────────────────────────────────
const sampleSwings = [
  {
    id: 1,
    instrument: 'ES Futures',
    symbol: 'ES',
    type: 'Futures',
    direction: 'LONG',
    entry: 5545.25,
    take_profit: 5612.50,
    stop_loss: 5512.00,
    rr_ratio: '2.2:1',
    current_price: 5580.00,
    entry_date: '2026-06-05',
    entry_time: '10:15 AM ET',
    expected_duration: '2-4 hours',
    confluence: ['5m Double Bottom Support', '15m Bullish Engulfing', '1m Volume Breakout Confirmed'],
    confluence_strength: 'High (3/3 timeframes confirmed)',
    volume_status: 'Above average - breakout confirmed',
    status: 'Open',
    hours_held: '1.5h',
    session: 'ny'
  },
  {
    id: 2,
    instrument: 'SPY Options',
    symbol: 'SPY',
    type: 'Call Options',
    direction: 'LONG',
    entry: 'Call spread $535',
    take_profit: 'Call spread $552',
    stop_loss: 'Call spread $518',
    rr_ratio: '2.8:1',
    current_price: '$543 wide',
    entry_date: '2026-06-05',
    entry_time: '11:45 AM ET',
    expected_duration: '3-5 hours',
    confluence: ['15m EMA20 Support', '5m Double Bottom', '1m MACD bullish crossover'],
    confluence_strength: 'Very High (3/3 timeframes + volume)',
    volume_status: 'Spike confirmed at entry - strong conviction',
    status: 'Open',
    hours_held: '0.5h',
    session: 'ny'
  },
  {
    id: 3,
    instrument: 'ES Futures',
    symbol: 'ES',
    type: 'Futures',
    direction: 'SHORT',
    entry: 5580.00,
    take_profit: 5520.50,
    stop_loss: 5610.00,
    rr_ratio: '2.0:1',
    current_price: 5545.00,
    entry_date: '2026-06-05',
    entry_time: '1:30 AM PT (4:30 AM ET)',
    expected_duration: '2-3 hours',
    confluence: ['15m R1 Rejection', '5m Bearish Engulfing', '1m Volume Breakdown'],
    confluence_strength: 'Very High (3/3 timeframes confirmed)',
    volume_status: 'Heavy selling volume - strong breakdown',
    status: 'Open',
    hours_held: '3.2h',
    session: 'asia'
  }
];

const samplePending = [
  {
    id: 3,
    instrument: 'ES Futures',
    symbol: 'ES',
    type: 'Futures',
    setup: 'Awaiting 1m volume spike at 15m resistance',
    current_level: 5595.00,
    target_entry: '5600 (15m R1 + 5m structure)',
    direction: 'SHORT',
    confluence_status: '15m + 5m aligned, waiting 1m volume confirmation',
    session: 'ny'
  },
  {
    id: 4,
    instrument: 'SPY Call Spread',
    symbol: 'SPY',
    type: 'Call Spread',
    setup: '5m engulfing forming - 1m volume needed',
    current_level: '$540.50',
    target_entry: '$541.50 (with 1m volume breakout)',
    direction: 'LONG',
    confluence_status: '15m + 5m forming, awaiting 1m confirmation',
    session: 'ny'
  },
  {
    id: 5,
    instrument: 'ES Futures',
    symbol: 'ES',
    type: 'Futures',
    setup: '15m support testing - 5m structure pending',
    current_level: 5540.00,
    target_entry: '5535 (15m key level + 5m + 1m volume)',
    direction: 'LONG',
    confluence_status: '15m tested, awaiting 5m + 1m alignment',
    session: 'asia'
  }
];

// ── Render Swings ─────────────────────────────────────────────────────────
function renderSwings() {
  const container = document.getElementById('swings-container');
  const empty = document.getElementById('swings-empty');
  const count = document.getElementById('swings-count');

  // Filter swings by current session
  const swings = sampleSwings.filter(s => s.session === currentSession);

  if (swings.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    const sessionName = currentSession === 'ny' ? 'NY Session' : 'Asia Session';
    count.textContent = '0 Active Swings';
    return;
  }

  empty.style.display = 'none';
  count.textContent = swings.length + ' Active Swing' + (swings.length !== 1 ? 's' : '') + ' (' + (currentSession === 'ny' ? 'NY' : 'Asia') + ')';

  container.innerHTML = swings.map(swing => {
    const isLong = swing.direction === 'LONG';
    const pnl = swing.current_price - swing.entry;
    const pnlPct = ((pnl / swing.entry) * 100).toFixed(2);
    const pnlClass = pnl >= 0 ? 'tp-color' : 'sl-color';

    return `
      <div class="swing-card">
        <div class="swing-header">
          <div class="swing-title">
            <div class="swing-instrument">${swing.instrument}</div>
            <div class="swing-type">${swing.type} • ${swing.entry_date} at ${swing.entry_time}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
            <div class="swing-direction ${isLong ? '' : 'short'}">
              <i class="ti ti-trending-${isLong ? 'up' : 'down'}"></i>
              ${swing.direction}
            </div>
            <div class="swing-duration"><i class="ti ti-clock"></i> ${swing.hours_held} held • Target: ${swing.expected_duration}</div>
          </div>
        </div>

        <div class="swing-grid">
          <div class="swing-level">
            <div class="level-label">Entry</div>
            <div class="level-price">${typeof swing.entry === 'number' ? swing.entry.toFixed(2) : swing.entry}</div>
          </div>
          <div class="swing-level">
            <div class="level-label tp-color">Take Profit</div>
            <div class="level-price tp-color ${userRole === 'preview' ? 'lockable' : ''}">
              <div class="locked-state"><span class="locked-blur">${typeof swing.take_profit === 'number' ? swing.take_profit.toFixed(2) : swing.take_profit}</span></div>
              <div class="unlocked-state">${typeof swing.take_profit === 'number' ? swing.take_profit.toFixed(2) : swing.take_profit}</div>
            </div>
          </div>
          <div class="swing-level">
            <div class="level-label sl-color">Stop Loss</div>
            <div class="level-price sl-color ${userRole === 'preview' ? 'lockable' : ''}">
              <div class="locked-state"><span class="locked-blur">${typeof swing.stop_loss === 'number' ? swing.stop_loss.toFixed(2) : swing.stop_loss}</span></div>
              <div class="unlocked-state">${typeof swing.stop_loss === 'number' ? swing.stop_loss.toFixed(2) : swing.stop_loss}</div>
            </div>
          </div>
        </div>

        <div class="swing-confluence">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span class="conf-title">Timeframe Confluence</span>
            <span class="confluence-badge" style="background:${swing.confluence_strength.includes('Very High') ? '#E1F5EE' : '#FEF3E0'};color:${swing.confluence_strength.includes('Very High') ? '#0F6E56' : '#854F0B'};padding:3px 8px;border-radius:3px;font-size:10px;font-weight:600">${swing.confluence_strength}</span>
          </div>
          <div class="conf-items">
            ${swing.confluence.map(c => `
              <div class="conf-item">
                <i class="ti ti-circle-check"></i>
                ${c}
              </div>
            `).join('')}
          </div>
          <div class="conf-item" style="background:var(--accent-light-gold);margin-top:8px">
            <i class="ti ti-volume-2" style="color:#854F0B"></i>
            <span style="font-size:11px;color:#854F0B">${swing.volume_status}</span>
          </div>
        </div>

        <div class="swing-rr">
          <div class="rr-label">Risk/Reward</div>
          <div class="rr-value">${swing.rr_ratio}</div>
        </div>

        <div class="swing-status">
          <div>
            <span class="status-key">Current Price:</span>
            <span class="status-val" style="margin-left:6px">${typeof swing.current_price === 'number' ? swing.current_price.toFixed(2) : swing.current_price}</span>
          </div>
          <div>
            <span class="rr-value" style="color:${pnl >= 0 ? '#0F6E56' : '#A32D2D'}">${pnl >= 0 ? '+' : ''}${typeof swing.current_price === 'number' ? (pnl).toFixed(2) : 'TBD'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Filter Swings ─────────────────────────────────────────────────────────
function filterSwings(type) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  // In a real app, filter the swings array here
  renderSwings();
}

// ── Render Pending Setups ──────────────────────────────────────────────────
function renderPending() {
  const container = document.getElementById('pending-container');
  const pending = samplePending.filter(s => s.session === currentSession);

  if (pending.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px"><i class="ti ti-inbox" style="font-size:24px;color:#534AB7;margin-bottom:8px"></i><div class="empty-title">No Pending Setups</div><div class="empty-sub">All confluences confirmed or awaiting next session.</div></div>';
    return;
  }

  container.innerHTML = pending.map(setup => `
    <div class="pending-card">
      <div class="pending-top">
        <div class="pending-name">${setup.instrument}</div>
        <div class="pending-badge">${setup.direction === 'LONG' ? 'BULLISH' : 'BEARISH'}</div>
      </div>
      <div class="pending-details">
        <div class="pending-detail">
          <div class="pending-label">Setup Status</div>
          <div class="pending-value">${setup.setup}</div>
        </div>
        <div class="pending-detail">
          <div class="pending-label">Current Level</div>
          <div class="pending-value">${typeof setup.current_level === 'number' ? setup.current_level.toFixed(2) : setup.current_level}</div>
        </div>
        <div class="pending-detail">
          <div class="pending-label">Target Entry</div>
          <div class="pending-value">${typeof setup.target_entry === 'number' ? setup.target_entry.toFixed(2) : setup.target_entry}</div>
        </div>
        <div class="pending-detail">
          <div class="pending-label" style="margin-top:6px">Confluence Status</div>
          <div class="pending-value" style="font-size:11px;color:#666">${setup.confluence_status}</div>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Trade History (Performance Tab) ────────────────────────────────────────
const tradeData = 'WWLWWLWWWWLWWWWWWWLWWWWWWWLWWWWWWWWWWWLWWWWWWWLWWWWWWWWWWLWWWWWWWWWWWWWWWWWWWLWWW'.split('');
const thEl = document.getElementById('trade-history');
tradeData.forEach(r => {
  const dot = document.createElement('div');
  dot.className = 'th-dot ' + (r === 'W' ? 'w' : 'l');
  dot.textContent = r;
  thEl.appendChild(dot);
});

// ── Month filter ───────────────────────────────────────────────────────────
function setMonthFilter(btn) {
  document.querySelectorAll('.mf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Journal Entries ────────────────────────────────────────────────────────
const journalEntries = [
  { result:'WIN', direction:'LONG', swing:'ES Swing #24', date:'June 4, 2026', pnl:'+$1,850', pts:'+74 pts', duration:'5 days', tags:['Technical Confluence','Patient'], well:'Waited for all 3 confluences to align. Perfect entry at support bounce. Held through noise and took full TP.', improve:'Next time, journal the exact conditions that would make me exit early.' },
  { result:'WIN', direction:'LONG', swing:'SPY Swing #23', date:'June 1, 2026', pnl:'+$920', pts:'+35 pts', duration:'4 days', tags:['Risk Management','Disciplined'], well:'Followed the daily chart setup perfectly. No overtrading, single entry at confluence.', improve:'Could have held longer — support held even after TP1 hit.' },
  { result:'WIN', direction:'SHORT', swing:'NQ Swing #22', date:'May 28, 2026', pnl:'+$1,320', pts:'-52 pts', duration:'3 days', tags:['Confluence','Patience'], well:'Shorted the breakdown of key support. Momentum confirmed the thesis. Clean exit at TP.', improve:'None — textbook swing trade.' },
  { result:'LOSS', direction:'LONG', swing:'ES Swing #21', date:'May 25, 2026', pnl:'-$640', pts:'-25 pts', duration:'2 days', tags:['Stopped Out'], well:'Setup looked good on the 4H. Entry was clean.', improve:'Should have waited for confirmed close above resistance, not just a touch.' },
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
      <span class="jc-date">${e.swing} • ${e.date}</span>
      <span class="jc-pnl ${isWin?'':'neg'}">${e.pnl} <span style="font-weight:400;font-size:12px;color:var(--text-muted)">(${e.pts}, ${e.duration})</span></span>
    </div>
    <div class="jc-tags">${e.tags.map(t=>`<span class="jc-tag">${t}</span>`).join('')}</div>
    <div class="jc-section-label">What went well</div>
    <div class="jc-text">${e.well}</div>
    <div class="jc-section-label">Improve next time</div>
    <div class="jc-text" style="margin-bottom:0">${e.improve}</div>
  </div>`;
});

// ── Load signals from API ──────────────────────────────────────────────────
async function loadSignals() {
  try {
    const res = await fetch('/api/swing-signals');
    const data = await res.json();
    // Use API data if available; otherwise use sample data
    if (data.swings && data.swings.length > 0) {
      Object.assign(sampleSwings[0], data.swings[0]);
    }
    renderSwings();
  } catch (err) {
    // Use sample data
    renderSwings();
  }
}

// ── Init ───────────────────────────────────────────────────────────────────
document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
});

applyRole();
loadSignals();
renderPending();

// ── Update time display ────────────────────────────────────────────────────
function updateTime() {
  const now = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short'
  });
  document.getElementById('signal-time').textContent = `Last updated: ${now}`;
}
updateTime();
setInterval(updateTime, 60000);
