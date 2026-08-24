// ── Bankroll Algo v2 · app.js ─────────────────────────────────────────────

// ── Session ───────────────────────────────────────────────────────────────
let currentSession = 'ny'; // NY only — London + Asia removed

// ── Next Signal Countdown Timer ───────────────────────────────────────────
(function startCountdown() {
  function getNextSignal() {
    // Signal fires at 6:15 AM PT (America/Los_Angeles) Mon–Fri
    const now = new Date();
    // Get current PT time
    const ptNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const target = new Date(ptNow);
    target.setHours(6, 15, 0, 0);

    // If we're past 6:15 today, jump to next day
    if (ptNow >= target) {
      target.setDate(target.getDate() + 1);
    }
    // Skip to Monday if it's weekend
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() + 1);
    }

    // Convert back to UTC ms delta
    const ptTargetStr = target.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
    const ptTargetDate = new Date(ptTargetStr);
    const offsetMs = target - ptTargetDate;
    return new Date(target.getTime() + offsetMs);
  }

  function tick() {
    const el = document.getElementById('next-signal-timer');
    if (!el) return;
    const now = new Date();
    const next = getNextSignal();
    let diff = Math.max(0, next - now);
    const h  = Math.floor(diff / 3600000);
    diff -= h * 3600000;
    const m  = Math.floor(diff / 60000);
    diff -= m * 60000;
    const s  = Math.floor(diff / 1000);
    const pad = n => String(n).padStart(2, '0');
    el.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
    if (diff === 0) el.textContent = 'Signal Live!';
  }

  tick();
  setInterval(tick, 1000);
})();

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
  // NY only — show NY backtest, hide others
  const btNY = document.getElementById('bt-ny');
  if (btNY) btNY.style.display = 'block';
  ['bt-london','bt-asia'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

// ── Access control ────────────────────────────────────────────────────────
let userRole = 'admin'; // always unlocked

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
  // Always unlocked — password removed
  document.body.classList.add('unlocked');
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) adminPanel.style.display = 'block';
  const emptyAdmin = document.getElementById('admin-panel-empty');
  if (emptyAdmin) emptyAdmin.style.display = 'block';
}

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', ['signal','calendar','journal','performance','market'][i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'market')      initCharts();
  if (name === 'calendar')   { buildCalendar(); updateCalStats(); }
  if (name === 'journal')    { initJournalForm(); renderJournal(); renderWeeklyReview(); }
  if (name === 'performance') { updateStats(); updateCalStats(); renderPerfWeeklyPnL(); }
}

// ── Journal ───────────────────────────────────────────────────────────────
const JOURNAL_KEY = 'bankroll_journal_v1';

function loadJournal() {
  try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); } catch { return []; }
}
function saveJournal(entries) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries));
}

let _jAction = 'long';
let _jResult = 'win';

function selectJAction(btn) {
  document.querySelectorAll('.j-action-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _jAction = btn.dataset.val;
  const resultRow = document.getElementById('j-result-row');
  if (resultRow) resultRow.style.display = _jAction === 'skipped' ? 'none' : 'block';
}

function selectJResult(btn) {
  document.querySelectorAll('.j-result-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _jResult = btn.dataset.val;
}

function initJournalForm() {
  const dateEl = document.getElementById('j-date');
  if (dateEl && !dateEl.value) {
    dateEl.value = new Date().toISOString().split('T')[0];
  }
}

function saveJournalEntry() {
  const date    = document.getElementById('j-date').value;
  const notes   = (document.getElementById('j-notes').value || '').trim();
  if (!date) { alert('Please select a date.'); return; }

  const entry = {
    id:      Date.now(),
    date,
    action:  _jAction,
    result:  _jAction === 'skipped' ? null : _jResult,
    notes,
  };

  const entries = loadJournal();
  entries.unshift(entry);
  saveJournal(entries);

  // Reset notes
  document.getElementById('j-notes').value = '';
  renderJournal();
}

function deleteJournalEntry(id) {
  const entries = loadJournal().filter(e => e.id !== id);
  saveJournal(entries);
  renderJournal();
}

function renderJournal() {
  const el = document.getElementById('journal-entries');
  if (!el) return;
  const entries = loadJournal();
  if (entries.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:28px;color:var(--text-muted);font-size:13px;background:var(--surface-1);border-radius:12px;border:0.5px solid var(--border)">No entries yet — log your first trade above.</div>`;
    return;
  }

  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  el.innerHTML = entries.map(e => {
    const d   = new Date(e.date + 'T12:00:00');
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    const dateStr = `${dow}, ${MN[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

    const actionColor = e.action === 'long' ? 'var(--green)' : e.action === 'short' ? 'var(--red)' : 'var(--text-muted)';
    const actionLabel = e.action === 'long' ? '📈 LONG' : e.action === 'short' ? '📉 SHORT' : '⏭ SKIPPED';

    let resultBadge = '';
    if (e.result) {
      const isWin = e.result === 'win';
      resultBadge = `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${isWin ? 'var(--green-light)' : 'var(--red-light)'};color:${isWin ? 'var(--green)' : 'var(--red)'};">${isWin ? '✅ WIN' : '❌ LOSS'}</span>`;
      const pnl = isWin ? '+$450' : '-$550';
      const pnlColor = isWin ? 'var(--green)' : 'var(--red)';
      resultBadge += `<span style="font-size:13px;font-weight:700;color:${pnlColor};margin-left:8px">${pnl}</span>`;
    }

    return `<div style="background:var(--surface-1);border:0.5px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:3px">${dateStr}</div>
          <div style="font-size:16px;font-weight:700;color:${actionColor}">${actionLabel}</div>
        </div>
        <button onclick="deleteJournalEntry(${e.id})" style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer;padding:0;line-height:1" title="Delete">×</button>
      </div>
      ${resultBadge ? `<div style="margin-bottom:${e.notes ? '8px' : '0'}">${resultBadge}</div>` : ''}
      ${e.notes ? `<div style="font-size:13px;color:var(--text-muted);line-height:1.6;padding:9px 11px;background:var(--bg);border-radius:7px;border:0.5px solid var(--border)">${e.notes}</div>` : ''}
    </div>`;
  }).join('');
}

// ── Weekly Review ─────────────────────────────────────────────────────────
const WEEK_NOTES_KEY = 'ba_week_notes_v1';
let weekOffset = 0; // 0 = current week, -1 = last week, etc.

function getWeekRange(offset) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon...
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0,0,0,0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23,59,59,999);
  return { monday, friday };
}

function weekKey(offset) {
  const { monday } = getWeekRange(offset);
  return monday.toISOString().slice(0, 10);
}

function saveWeekNotes() {
  const notes = (document.getElementById('week-notes')?.value || '').trim();
  const stored = JSON.parse(localStorage.getItem(WEEK_NOTES_KEY) || '{}');
  stored[weekKey(weekOffset)] = notes;
  localStorage.setItem(WEEK_NOTES_KEY, JSON.stringify(stored));
  const btn = document.querySelector('#weekly-review-card button');
  if (btn) { btn.textContent = 'Saved ✓'; btn.style.background = '#1D9E75'; setTimeout(() => { btn.textContent = 'Save Notes'; btn.style.background = '#534AB7'; }, 2000); }
}

function weekNav(dir) {
  weekOffset += dir;
  renderWeeklyReview();
}

function renderWeeklyReview() {
  const { monday, friday } = getWeekRange(weekOffset);
  const entries = loadJournal();
  const weekLabel = document.getElementById('week-label');
  const dayStrip  = document.getElementById('week-day-strip');
  const weekStats = document.getElementById('week-stats');
  const weekNotes = document.getElementById('week-notes');
  if (!weekLabel || !dayStrip || !weekStats) return;

  // Label
  const fmt = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  weekLabel.textContent = `${fmt(monday)} – ${fmt(friday)}`;

  // Get entries for this week
  const weekEntries = entries.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d >= monday && d <= friday;
  });

  // Day strip Mon-Fri
  const days = ['Mon','Tue','Wed','Thu','Fri'];
  dayStrip.innerHTML = days.map((d, i) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = dayDate.toISOString().slice(0,10);
    const entry = weekEntries.find(e => e.date === dateStr);
    let bg = 'var(--surface-2)', border = 'var(--border)', icon = '—', iconColor = 'var(--text-muted)';
    if (entry) {
      if (entry.action === 'skipped') { bg='rgba(83,74,183,0.1)'; border='#534AB7'; icon='⏭'; iconColor='#534AB7'; }
      else if (entry.result === 'win') { bg='rgba(15,110,86,0.12)'; border='var(--green)'; icon='W'; iconColor='var(--green)'; }
      else if (entry.result === 'loss') { bg='rgba(163,45,45,0.12)'; border='var(--red)'; icon='L'; iconColor='var(--red)'; }
    }
    return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:8px 4px;text-align:center">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">${d}</div>
      <div style="font-size:16px;font-weight:700;color:${iconColor}">${icon}</div>
      <div style="font-size:9px;color:var(--text-muted);margin-top:2px">${entry ? (entry.action==='skipped'?'Skip':entry.action.toUpperCase()) : ''}</div>
    </div>`;
  }).join('');

  // Stats
  const trades = weekEntries.filter(e => e.action !== 'skipped');
  const wins   = trades.filter(e => e.result === 'win').length;
  const losses = trades.filter(e => e.result === 'loss').length;
  const skips  = weekEntries.filter(e => e.action === 'skipped').length;
  const pnl    = (wins * 450) - (losses * 550);
  const wr     = trades.length > 0 ? Math.round(wins / trades.length * 100) : 0;

  const stat = (label, val, color) => `<div style="background:var(--surface-2);border:0.5px solid var(--border);border-radius:8px;padding:10px;text-align:center">
    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">${label}</div>
    <div style="font-size:18px;font-weight:700;color:${color || 'var(--text-primary)'}">${val}</div>
  </div>`;

  weekStats.innerHTML =
    stat('Win Rate', trades.length ? wr + '%' : '—', wr >= 60 ? 'var(--green)' : wr > 0 ? 'var(--red)' : 'var(--text-muted)') +
    stat('P&L', trades.length ? (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl) : '—', pnl > 0 ? 'var(--green)' : pnl < 0 ? 'var(--red)' : 'var(--text-muted)') +
    stat('Trades', trades.length, 'var(--text-primary)') +
    stat('Skipped', skips, '#534AB7');

  // Notes
  const stored = JSON.parse(localStorage.getItem(WEEK_NOTES_KEY) || '{}');
  if (weekNotes) weekNotes.value = stored[weekKey(weekOffset)] || '';
}

// ── Performance Tab Weekly P&L ────────────────────────────────────────────
let perfWeekOffset = 0;

function perfWeekNav(dir) {
  perfWeekOffset += dir;
  renderPerfWeeklyPnL();
}

function renderPerfWeeklyPnL() {
  const { monday, friday } = getWeekRange(perfWeekOffset);
  const entries = loadJournal();
  const labelEl     = document.getElementById('perf-week-label');
  const dayStripEl  = document.getElementById('perf-week-day-strip');
  const statsEl     = document.getElementById('perf-week-stats');
  if (!labelEl || !dayStripEl || !statsEl) return;

  const fmt = d => d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  labelEl.textContent = `${fmt(monday)} – ${fmt(friday)}`;

  const weekEntries = entries.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d >= monday && d <= friday;
  });

  const days = ['Mon','Tue','Wed','Thu','Fri'];
  dayStripEl.innerHTML = days.map((d, i) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = dayDate.toISOString().slice(0,10);
    const entry = weekEntries.find(e => e.date === dateStr);
    let bg = 'var(--surface-2)', border = 'var(--border)', icon = '—', iconColor = 'var(--text-muted)', pnl = '';
    if (entry) {
      if (entry.action === 'skipped') { bg='rgba(83,74,183,0.1)'; border='#534AB7'; icon='⏭'; iconColor='#534AB7'; pnl='Skip'; }
      else if (entry.result === 'win')  { bg='rgba(15,110,86,0.12)'; border='var(--green)'; icon='+$450'; iconColor='var(--green)'; pnl='Win'; }
      else if (entry.result === 'loss') { bg='rgba(163,45,45,0.12)'; border='var(--red)'; icon='-$550'; iconColor='var(--red)'; pnl='Loss'; }
    }
    return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:8px 4px;text-align:center">
      <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">${d}</div>
      <div style="font-size:12px;font-weight:700;color:${iconColor};line-height:1.2">${icon}</div>
      <div style="font-size:9px;color:var(--text-muted);margin-top:2px">${pnl}</div>
    </div>`;
  }).join('');

  const trades = weekEntries.filter(e => e.action !== 'skipped');
  const wins   = trades.filter(e => e.result === 'win').length;
  const losses = trades.filter(e => e.result === 'loss').length;
  const netPnl = (wins * 450) - (losses * 550);
  const wr     = trades.length > 0 ? Math.round(wins / trades.length * 100) : 0;

  const stat = (label, val, sub, valColor) => `<div style="background:var(--surface-2);border:0.5px solid var(--border);border-radius:8px;padding:10px;text-align:center">
    <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em">${label}</div>
    <div style="font-size:18px;font-weight:700;color:${valColor || 'var(--text-primary)'}">${val}</div>
    ${sub ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${sub}</div>` : ''}
  </div>`;

  const pnlColor = netPnl > 0 ? 'var(--green)' : netPnl < 0 ? 'var(--red)' : 'var(--text-muted)';
  const pnlStr   = trades.length ? ((netPnl >= 0 ? '+$' : '-$') + Math.abs(netPnl)) : '—';
  const wrColor  = wr >= 60 ? 'var(--green)' : wr > 0 ? 'var(--red)' : 'var(--text-muted)';

  statsEl.innerHTML =
    stat('Net P&L', pnlStr, trades.length ? `${wins}W / ${losses}L` : 'No trades', pnlColor) +
    stat('Win Rate', trades.length ? wr + '%' : '—', trades.length ? `${trades.length} trade${trades.length!==1?'s':''}` : '', wrColor) +
    stat('Gross', trades.length ? `${wins}×$450` : '—', losses ? `-${losses}×$550` : 'No losses', 'var(--text-primary)');
}

// ── Date display ──────────────────────────────────────────────────────────
document.getElementById('today-date').textContent = new Date().toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric'
});

// ── Load today's signal from API ──────────────────────────────────────────
function showEmpty() {
  const loading   = document.getElementById('signal-loading');
  const body      = document.getElementById('signal-body');
  const empty     = document.getElementById('signal-empty');
  const checklist = document.getElementById('trade-checklist');
  const szCard    = document.getElementById('sz-card');
  if (loading)   loading.style.display   = 'none';
  if (body)      body.style.display      = 'none';
  if (empty)     empty.style.display     = 'block';
  if (checklist) checklist.style.display = 'none';
  if (szCard)    szCard.style.display    = 'none';
  // spy-input-card stays visible always — do not hide here
}

async function loadSignal() {
  // Start in empty/pending state — no spinner blocking the page
  showEmpty();
  buildCalendar();
  applyBacktestUI('ny');
  buildBacktestCard('ny');

  // Weekends: cron doesn't fire, no signal available
  const day = new Date().getDay();
  if (day === 0 || day === 6) return;

  // Try to load signal with 7s timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res  = await fetch('/api/get-signal?t=' + Date.now(), { cache: 'no-store', signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();

    // If Redis returned nothing, try today's localStorage cache
    if (!data.signal) {
      const todayKey = 'ba_signal_' + new Date().toISOString().slice(0, 10);
      try {
        const cached = localStorage.getItem(todayKey);
        if (cached) data.signal = JSON.parse(cached);
      } catch {}
    }

    if (!data.signal) return; // nothing anywhere — stay pending

    // Always keep a local copy for same-day reloads
    const todayKey = 'ba_signal_' + new Date().toISOString().slice(0, 10);
    try { localStorage.setItem(todayKey, JSON.stringify(data.signal)); } catch {}

    const body    = document.getElementById('signal-body');
    const empty   = document.getElementById('signal-empty');
    const spyCard = document.getElementById('spy-input-card');
    if (body)    body.style.display    = 'block';
    if (empty)   empty.style.display   = 'none';
    if (spyCard) spyCard.style.display = 'block';
    // Restore saved SPY inputs for today
    try {
      const saved = JSON.parse(localStorage.getItem('ba_spy_inputs_' + new Date().toISOString().slice(0,10)) || 'null');
      if (saved) {
        const ri = document.getElementById('spy-range-input');
        const vi = document.getElementById('spy-vol-input');
        if (ri && saved.range) ri.value = saved.range;
        if (vi && saved.vol)   vi.value = saved.vol;
      }
    } catch {}
    populateSignal(data.signal);

  } catch (err) {
    clearTimeout(timer);
    console.error('loadSignal:', err.message);
    // Already showing empty state — nothing more to do
  }
}

function populateSignal(signal) {
  try {
  const isLong = signal.direction === 'LONG';

  // Direction
  const dirText = document.getElementById('dir-text');
  if (dirText) { dirText.textContent = signal.direction; dirText.style.color = isLong ? '#0F6E56' : '#A32D2D'; }
  const dirSub = document.getElementById('dir-sub');
  if (dirSub) dirSub.textContent = isLong ? 'Buy Signal' : 'Sell Signal';
  const icon = document.getElementById('dir-icon');
  if (icon) {
    icon.style.background = isLong ? '#E1F5EE' : '#FCEBEB';
    icon.innerHTML = `<i class="ti ti-trending-${isLong ? 'up' : 'down'}" style="color:${isLong ? '#0F6E56' : '#A32D2D'};font-size:18px"></i>`;
  }

  // Bias & Confidence
  const biasEl = document.getElementById('bias-txt');
  if (biasEl) { biasEl.textContent = signal.bias; biasEl.style.color = isLong ? '#0F6E56' : '#A32D2D'; }

  const confEl = document.getElementById('conf-lvl');
  const hitRate = signal.hit_rate ?? (signal.confidence === 'High' ? 70 : signal.confidence === 'Medium' ? 56 : 29);
  if (confEl) {
    confEl.textContent = `${signal.confidence} · ${hitRate}% hit rate`;
    confEl.style.color = signal.confidence === 'High' ? '#534AB7' : signal.confidence === 'Medium' ? '#854F0B' : '#A32D2D';
  }

  // No-trade banner — moderate-conviction filter OR low confidence, signal still shows for reference
  const existingBanner = document.getElementById('no-trade-banner');
  if (existingBanner) existingBanner.remove();
  if (confEl && (signal.no_trade || signal.confidence === 'Low')) {
    const banner = document.createElement('div');
    banner.id = 'no-trade-banner';
    banner.style.cssText = 'margin:12px 0 4px;padding:10px 14px;background:#FCEBEB;border:0.5px solid #F09595;border-radius:8px;display:flex;align-items:center;gap:8px';
    const reason = signal.no_trade
      ? (signal.no_trade_reason || 'Moderate-conviction setup — below backtested breakeven.')
      : 'Low confidence — signal shown for reference only';
    banner.innerHTML = `<span style="font-size:15px">🚫</span><div><div style="font-size:13px;font-weight:500;color:#A32D2D">No trade today</div><div style="font-size:11px;color:#791F1F;margin-top:1px">${reason}</div></div>`;
    if (confEl.parentElement) confEl.parentElement.insertAdjacentElement('afterend', banner);
  }

  // TP / SL / RR
  const tpEl = document.getElementById('tp-val');   if (tpEl) tpEl.textContent = signal.take_profit || '—';
  const slEl = document.getElementById('sl-val');   if (slEl) slEl.textContent = signal.stop_loss   || '—';
  const rrEl = document.getElementById('rr-ratio'); if (rrEl) rrEl.textContent = signal.rr_ratio    || '—';
  const rtEl = document.getElementById('rr-target');if (rtEl) rtEl.textContent = signal.rr_target   || '—';
  const rkEl = document.getElementById('rr-risk');  if (rkEl) rkEl.textContent = signal.rr_risk     || '—';

  // Confluences — render all 9 from market_context.confluences
  const confGrid = document.getElementById('conf-grid');
  const confData = signal.market_context?.confluences;
  if (confGrid && confData && confData.length) {
    const signalDir = (signal.direction || '').toUpperCase(); // LONG or SHORT
    confGrid.innerHTML = confData.map((c, i) => {
      const v = c.value.toLowerCase();
      const label = (c.label || '').toLowerCase();
      // SPY rows are pass/fail, not directional — check confirmed vs failed
      const isSPY = label.includes('spy');
      let iconColor, icon;
      if (isSPY) {
        const passed = v.includes('confirmed') || v.includes('✅');
        const failed = v.includes('below') || v.includes('❌');
        iconColor = passed ? '#0F6E56' : failed ? '#E05252' : '#8A8A8A';
        icon = passed ? 'ti-circle-check' : failed ? 'ti-circle-x' : 'ti-minus';
      } else {
        const isBullish = v.includes('bullish') || v.includes('above') || v.includes('hh/hl') || v.includes('aligned bullish');
        const isBearish = v.includes('bearish') || v.includes('below') || v.includes('ll/lh') || v.includes('aligned bearish');
        const aligned = (signalDir === 'LONG' && isBullish) || (signalDir === 'SHORT' && isBearish);
        const conflicting = (signalDir === 'LONG' && isBearish) || (signalDir === 'SHORT' && isBullish);
        iconColor = aligned ? '#0F6E56' : conflicting ? '#E05252' : '#8A8A8A';
        icon = aligned ? 'ti-circle-check' : conflicting ? 'ti-circle-x' : 'ti-minus';
      }
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
    const stEl = document.getElementById('signal-time');
    if (stEl) stEl.textContent = `Generated at ${t}${sess}`;
  }

  renderSpyOptions(signal);
  renderChecklist(signal);
  } catch (e) {
    console.error('populateSignal crash:', e.message, e.stack);
  }
}

// ── Trade Checklist ───────────────────────────────────────────────────────
function applySpyInputs() {
  const rangeVal = parseFloat(document.getElementById('spy-range-input')?.value || '0');
  const volRaw   = (document.getElementById('spy-vol-input')?.value || '').trim().toLowerCase();
  const volVal   = volRaw.endsWith('k') ? parseFloat(volRaw) * 1000 : parseFloat(volRaw) || 0;
  if (!rangeVal && !volVal) return;

  // Store in localStorage for the day
  const key = 'ba_spy_inputs_' + new Date().toISOString().slice(0,10);
  localStorage.setItem(key, JSON.stringify({ range: rangeVal, vol: volVal }));

  // Update signal confluences with manual values
  const todayKey = 'ba_signal_' + new Date().toISOString().slice(0,10);
  try {
    const cached = JSON.parse(localStorage.getItem(todayKey) || 'null');
    if (cached && cached.market_context?.confluences) {
      const confs = cached.market_context.confluences;
      const rIdx = confs.findIndex(c => c.label.toLowerCase().includes('spy 30m range'));
      const vIdx = confs.findIndex(c => c.label.toLowerCase().includes('spy 30m vol'));
      const rOk  = rangeVal >= 2.50;
      const vOk  = volVal   >= 50000;
      if (rIdx >= 0) confs[rIdx].value = `$${rangeVal.toFixed(2)} — ${rOk ? '✅ confirmed (≥$2.50)' : '❌ below $2.50 min'}`;
      if (vIdx >= 0) confs[vIdx].value = `${volVal.toFixed(1)}k — ${vOk ? '✅ confirmed (≥50k)' : '❌ below 50k min'}`;
      cached.no_trade = !(rOk && vOk && cached.market_context?.imb_direction !== 'NEUTRAL');
      cached.no_trade_reason = !rOk ? `SPY range $${rangeVal.toFixed(2)} below $2.50 min.` : !vOk ? `SPY volume ${volVal}k below 50k min.` : null;
      localStorage.setItem(todayKey, JSON.stringify(cached));
      populateSignal(cached);
      // Flash button
      const btn = document.querySelector('#spy-input-card button');
      if (btn) { btn.textContent = 'Applied ✓'; btn.style.background = '#1D9E75'; setTimeout(() => { btn.textContent = 'Apply'; btn.style.background = '#534AB7'; }, 2000); }
    }
  } catch(e) { console.error('applySpyInputs:', e); }
}

function renderChecklist(signal) {
  const card      = document.getElementById('trade-checklist');
  const itemsEl   = document.getElementById('checklist-items');
  const verdictEl = document.getElementById('checklist-verdict');
  const dirLabel  = document.getElementById('checklist-dir-label');
  if (!card || !itemsEl || !verdictEl) return;

  const dir      = (signal.direction || '').toUpperCase();
  const confData = signal.market_context?.confluences || [];
  if (!confData.length) { card.style.display = 'none'; return; }

  const find = label => {
    const c = confData.find(c => c.label.toLowerCase().includes(label.toLowerCase()));
    return c ? c.value.toLowerCase() : '';
  };

  const accumPos = find('accum. breakout');
  const imbEdge  = find('imbalance edge');
  const spyRange = find('spy 30m range');
  const spyVol   = find('spy 30m vol');

  if (dirLabel) dirLabel.textContent = dir === 'LONG' ? 'Long Filters' : 'Short Filters';

  const keyChecks = [
    {
      label: 'Accum. Breakout',
      desc:  dir === 'LONG' ? 'Price must be above accumulation zone' : 'Price must be below accumulation zone',
      pass:  dir === 'LONG' ? accumPos.includes('above') : accumPos.includes('below')
    },
    {
      label: 'Imbalance Direction',
      desc:  dir === 'LONG' ? 'More weighted FVGs above price' : 'More weighted FVGs below price',
      pass:  dir === 'LONG' ? imbEdge.includes('bullish') : imbEdge.includes('bearish')
    },
    {
      label: 'SPY 30M Range',
      desc:  'Must be ≥ $2.50',
      pass:  spyRange.includes('✅') || spyRange.includes('confirmed')
    },
    {
      label: 'SPY 30M Volume',
      desc:  'Must be ≥ 50k',
      pass:  spyVol.includes('✅') || spyVol.includes('confirmed')
    },
  ];

  const keyPasses = keyChecks.filter(c => c.pass).length;

  // Verdict
  let verdict, vClass;
  if (keyPasses === 4)      { verdict = 'A+ GO';    vClass = 'verdict-go'; }
  else if (keyPasses === 3) { verdict = 'GO ⚠';    vClass = 'verdict-go-warn'; }
  else if (keyPasses === 2) { verdict = 'MARGINAL'; vClass = 'verdict-marginal'; }
  else                      { verdict = 'NO-GO';    vClass = 'verdict-nogo'; }

  verdictEl.className  = `checklist-verdict ${vClass}`;
  verdictEl.textContent = verdict;

  const renderItem = (c) => `
    <div class="chk-item">
      <span class="chk-icon ${c.pass ? 'chk-pass' : 'chk-fail'}">
        <i class="ti ${c.pass ? 'ti-circle-check' : 'ti-circle-x'}"></i>
      </span>
      <div style="flex:1">
        <div class="chk-label">${c.label} <span class="chk-key-badge">KEY</span></div>
        <div class="chk-desc">${c.desc}</div>
      </div>
    </div>`;

  itemsEl.innerHTML = keyChecks.map(c => renderItem(c)).join('');
  card.style.display = 'block';
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

    if (regenStatus && regenStatus !== 200) {
      txt.textContent = `Failed (${regenStatus}): ${regenBody?.error || 'unknown error'}`;
      btn.disabled = false;
      return;
    }

    // Use signal directly from the generate response — no Redis dependency
    const signal = regenBody?.signal;
    if (signal) {
      const todayKey = 'ba_signal_' + new Date().toISOString().slice(0, 10);
      try { localStorage.setItem(todayKey, JSON.stringify(signal)); } catch {}
      const bodyEl    = document.getElementById('signal-body');
      const emptyEl   = document.getElementById('signal-empty');
      const spyCardEl = document.getElementById('spy-input-card');
      if (bodyEl)    bodyEl.style.display    = 'block';
      if (emptyEl)   emptyEl.style.display   = 'none';
      if (spyCardEl) spyCardEl.style.display = 'block';
      populateSignal(signal);
      // Auto-re-apply any saved SPY inputs from today
      try {
        const savedSpy = JSON.parse(localStorage.getItem('ba_spy_inputs_' + new Date().toISOString().slice(0,10)) || 'null');
        if (savedSpy) {
          const ri = document.getElementById('spy-range-input');
          const vi = document.getElementById('spy-vol-input');
          if (ri && savedSpy.range) { ri.value = savedSpy.range; }
          if (vi && savedSpy.vol)   { vi.value = savedSpy.vol;   }
          applySpyInputs();
        }
      } catch {}
      txt.textContent = 'Signal Regenerated ✓';
      btn.style.background = '#1D9E75';
      setTimeout(() => { btn.disabled = false; txt.textContent = 'Regenerate Signal Now'; btn.style.background = ''; }, 3000);
    } else {
      txt.textContent = 'No signal returned — try again';
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
    const ym = `${y}-${String(m+1).padStart(2,'0')}`;
    const tagged = { ...r, _ym: ym };
    localStorage.setItem(monthKey(sess, y, m), JSON.stringify(tagged));
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
  if (!grid) return;
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
    el.onclick = () => cycleDay(d);
    const v = r[d];
    const isWin  = v === 'win' || v === 'lw' || v === 'sw';
    const isLoss = v === 'loss' || v === 'll' || v === 'sl';
    const isLong  = v === 'lw' || v === 'll';
    const isShort = v === 'sw' || v === 'sl';
    const dirLabel = isLong ? 'LONG' : isShort ? 'SHORT' : '';
    if (isCurrentMonth && d === TODAY_DAY) el.classList.add('today');
    else if (isWin)  el.classList.add('win');
    else if (isLoss) el.classList.add('loss');
    else if (isCurrentMonth && d > TODAY_DAY) el.classList.add('future');
    el.innerHTML = `<span style="font-size:12px;font-weight:600">${d}</span>` +
      (dirLabel ? `<span style="display:block;font-size:7px;font-weight:700;letter-spacing:.03em;margin-top:1px;opacity:0.85">${dirLabel}</span>` : '');
    grid.appendChild(el);
  }
  // Trade log below calendar (only in calendar tab)
  buildTradeLog(r, calViewYear, calViewMonth);
}

function buildTradeLog(r, y, m) {
  const el = document.getElementById('cal-trade-log');
  if (!el) return;
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = Object.keys(r).filter(k => k !== '_ym').map(Number).filter(n => !isNaN(n)).sort((a,b) => b-a);
  if (days.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">No trades logged yet this month.<br>Tap a calendar day to log a trade.</div>`;
    return;
  }
  el.innerHTML = days.map(d => {
    const v = r[String(d)];
    const isWin   = v === 'win' || v === 'lw' || v === 'sw';
    const isLong  = v === 'lw' || v === 'll';
    const isShort = v === 'sw' || v === 'sl';
    const dir     = isLong ? 'LONG' : isShort ? 'SHORT' : '—';
    const dirColor = isLong ? 'var(--green)' : 'var(--red)';
    const result  = isWin ? 'WIN' : 'LOSS';
    const resColor = isWin ? 'var(--green)' : 'var(--red)';
    const resBg    = isWin ? 'var(--green-light)' : 'var(--red-light)';
    const pnl     = isWin ? '+$450' : '-$550';
    const pnlColor = isWin ? 'var(--green)' : 'var(--red)';
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(y, m, d).getDay()];
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg);border-radius:9px;border:0.5px solid var(--border);margin-bottom:6px">
      <div style="text-align:center;min-width:32px">
        <div style="font-size:18px;font-weight:700;color:var(--text-primary);line-height:1">${d}</div>
        <div style="font-size:10px;color:var(--text-muted)">${dow} ${MN[m]}</div>
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:${dirColor}">${dir}</div>
        <div style="font-size:11px;color:var(--text-muted)">ES Futures · NY Open</div>
      </div>
      <div style="text-align:right">
        <div style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${resBg};color:${resColor}">${result}</div>
        <div style="font-size:13px;font-weight:700;color:${pnlColor};margin-top:4px">${pnl}</div>
      </div>
    </div>`;
  }).join('');
}

function cycleDay(d) {
  const r = getCalResults();
  const cur = r[d];
  // Cycle: empty → Long Win → Long Loss → Short Win → Short Loss → clear
  if (!cur)              r[d] = 'lw';
  else if (cur === 'lw') r[d] = 'll';
  else if (cur === 'll') r[d] = 'sw';
  else if (cur === 'sw') r[d] = 'sl';
  else                   delete r[d];
  setCalResults(r);
  buildCalendar();
  updateStats();
  updateCalStats();
  buildBacktestCard('ny');
}

function updateCalStats() {
  const r = getCalResults();
  const vals = Object.values(r).filter(v => v !== '_ym');
  const w = vals.filter(v => v === 'win' || v === 'lw' || v === 'sw').length;
  const l = vals.filter(v => v === 'loss' || v === 'll' || v === 'sl').length;
  const total = w + l;
  const pct = total > 0 ? Math.round(w / total * 100) : 0;
  const pnl = w * 450 - l * 550;
  const pnlStr = (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toLocaleString();

  // Current streak
  const days = Object.keys(r).filter(k => k !== '_ym').map(Number).sort((a,b)=>a-b);
  let streak = 0, streakLabel = '—';
  for (let i = days.length - 1; i >= 0; i--) {
    const v = r[String(days[i])];
    const isW = v === 'win' || v === 'lw' || v === 'sw';
    const isL = v === 'loss' || v === 'll' || v === 'sl';
    if (i === days.length - 1) { streak = isW ? 1 : isL ? -1 : 0; }
    else {
      const isWin2 = streak > 0;
      if (isWin2 && isW) streak++;
      else if (!isWin2 && isL) streak--;
      else break;
    }
  }
  if (streak > 0)  streakLabel = `${streak}W streak 🔥`;
  else if (streak < 0) streakLabel = `${Math.abs(streak)}L streak`;

  const el = id => document.getElementById(id);
  if (el('cal-wr-pct'))  { el('cal-wr-pct').textContent = pct + '%'; el('cal-wr-pct').style.color = pct >= 60 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)'; }
  if (el('cal-wr-sub'))  el('cal-wr-sub').textContent = `${w}W / ${l}L`;
  if (el('cal-pnl'))     { el('cal-pnl').textContent = pnlStr; el('cal-pnl').style.color = pnl >= 0 ? 'var(--green)' : 'var(--red)'; }
  if (el('cal-total'))   el('cal-total').textContent = total;
  if (el('cal-streak'))  el('cal-streak').textContent = streakLabel;
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
applyBacktestUI('ny');
buildCalendar();
updateStats();
buildBacktestCard('ny');
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
      // Current month data — only overwrite localStorage if Redis has MORE data than local
      const local = loadMonthData(sess, TODAY_YEAR, TODAY_MONTH);
      const localCount = Object.keys(local).filter(k => k !== '_ym').length;
      const redisCount = Object.keys(clean).length;
      setter(clean);
      if (redisCount >= localCount) {
        saveMonthData(sess, TODAY_YEAR, TODAY_MONTH, clean);
      }
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
