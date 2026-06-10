// ── ES Levels Signals · app.js ─────────────────────────────────────────────

// ── Storage helpers ────────────────────────────────────────────────────────
const STORAGE_KEY = 'es_levels_signals';
const RESULTS_KEY = 'es_levels_results';

function loadSignals() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveSignals(signals) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(signals)); } catch {}
}

function loadResults() {
  try {
    const raw = localStorage.getItem(RESULTS_KEY);
    return raw ? JSON.parse(raw) : { 1: 'win', 3: 'win', 4: 'loss' };
  } catch { return { 1: 'win', 3: 'win', 4: 'loss' }; }
}

function saveResults(results) {
  try { localStorage.setItem(RESULTS_KEY, JSON.stringify(results)); } catch {}
}

let signals = loadSignals();
let results = loadResults();

// ── Tab switching ──────────────────────────────────────────────────────────
function switchTab(name) {
  const names = ['signal', 'input', 'performance', 'levels'];
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.classList.toggle('active', names[i] === name);
  });
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'levels') initChart();
}

// ── Date ───────────────────────────────────────────────────────────────────
const todayEl = document.getElementById('today-date');
if (todayEl) todayEl.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// ── Calendar ───────────────────────────────────────────────────────────────
const TODAY_DAY = 5;

function getWins() { return Object.values(results).filter(v => v === 'win').length; }
function getLosses() { return Object.values(results).filter(v => v === 'loss').length; }

function updateStats() {
  const w = getWins(), l = getLosses(), total = w + l;
  const pct = total > 0 ? Math.round(w / total * 100) : 0;
  document.getElementById('w-badge').textContent = w + 'W';
  document.getElementById('l-badge').textContent = l + 'L';
  document.getElementById('win-pct-txt').textContent = pct + '%';
  document.getElementById('win-bar').style.width = pct + '%';
  const stats = document.getElementById('cal-stats');
  stats.innerHTML = `
    <span class="cal-stat" style="background:#E1F5EE;color:#0F6E56">${w}W</span>
    <span class="cal-stat" style="background:#FCEBEB;color:#A32D2D">${l}L</span>
    <span class="cal-stat" style="background:#EEEDFE;color:#534AB7">${pct}% WR</span>`;
}

function buildCalendar() {
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-day-label';
    el.textContent = d;
    grid.appendChild(el);
  });
  // June 2026 starts on Monday (DOW = 1), so add 1 empty day
  for (let i = 0; i < 1; i++) {
    const el = document.createElement('div'); el.className = 'cal-day empty'; el.textContent = '·'; grid.appendChild(el);
  }
  for (let d = 1; d <= 30; d++) {
    const el = document.createElement('div');
    el.className = 'cal-day';
    el.innerHTML = `${d}<div class="day-tooltip">
      <button class="tt-btn w" onclick="setDay(${d},'win');event.stopPropagation()">W</button>
      <button class="tt-btn l" onclick="setDay(${d},'loss');event.stopPropagation()">L</button>
      <button class="tt-btn clr" onclick="setDay(${d},null);event.stopPropagation()">—</button>
    </div>`;
    if (d === TODAY_DAY) el.classList.add('today');
    else if (results[d] === 'win') el.classList.add('win');
    else if (results[d] === 'loss') el.classList.add('loss');
    else if (d > TODAY_DAY) el.classList.add('future');
    grid.appendChild(el);
  }
}

function setDay(d, val) {
  if (val === null) delete results[d];
  else results[d] = val;
  saveResults(results);
  buildCalendar();
  updateStats();
}

// ── Activity bars ──────────────────────────────────────────────────────────
const barsEl = document.getElementById('activity-bars');
if (barsEl) {
  [40, 60, 30, 70, 50, 80, 45, 90, 60, 35, 75, 100].forEach((h, i, arr) => {
    const b = document.createElement('div');
    b.className = 'bar-item';
    b.style.height = h + '%';
    b.style.background = i === arr.length - 1 ? '#534AB7' : '#EEEDFE';
    barsEl.appendChild(b);
  });
}

// ── Performance: trade history dots ────────────────────────────────────────
const tradeData = 'WWLWWLWWLWWLLWWWWWLWWLWWWWWLWLLWWWW'.split('');
const thEl = document.getElementById('trade-history');
if (thEl) {
  tradeData.forEach(r => {
    const dot = document.createElement('div');
    dot.className = 'th-dot ' + (r === 'W' ? 'w' : 'l');
    dot.textContent = r;
    thEl.appendChild(dot);
  });
}

// ── Month filter (performance) ─────────────────────────────────────────────
function setMonthFilter(btn, month) {
  document.querySelectorAll('.mf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Form: Manual Signal Submission ─────────────────────────────────────────
function updateFormPreview() {
  const dir = document.getElementById('form-direction').value;
  const entry = document.getElementById('form-entry').value;
  const tp = document.getElementById('form-tp').value;
  const sl = document.getElementById('form-sl').value;

  if (entry && tp && sl) {
    const riskPts = Math.abs(entry - sl);
    const targetPts = Math.abs(tp - entry);
    const ratio = (targetPts / riskPts).toFixed(2);

    document.getElementById('rr-ratio').textContent = ratio + ':1';
    document.getElementById('rr-target').textContent = targetPts > 0 ? '+' + targetPts.toFixed(2) + ' pts' : targetPts.toFixed(2) + ' pts';
    document.getElementById('rr-risk').textContent = '-' + riskPts.toFixed(2) + ' pts';
  }
}

function submitSignal() {
  const direction = document.getElementById('form-direction').value;
  const entry = parseFloat(document.getElementById('form-entry').value);
  const tp = parseFloat(document.getElementById('form-tp').value);
  const sl = parseFloat(document.getElementById('form-sl').value);
  const tpType = document.getElementById('form-tp-type').value;
  const slType = document.getElementById('form-sl-type').value;
  const conf1 = document.getElementById('form-conf-1').value;
  const conf2 = document.getElementById('form-conf-2').value;
  const conf3 = document.getElementById('form-conf-3').value;
  const notes = document.getElementById('form-notes').value;

  if (!direction || !entry || !tp || !sl || !tpType || !slType) {
    alert('Please fill in all required fields.');
    return;
  }

  const signal = {
    id: Date.now(),
    date: new Date().toISOString(),
    direction,
    entry,
    tp,
    sl,
    tpType,
    slType,
    confluences: [conf1, conf2, conf3].filter(c => c),
    notes
  };

  signals.push(signal);
  saveSignals(signals);

  // Update display
  const isLong = direction === 'LONG';
  document.getElementById('dir-text').textContent = direction;
  document.getElementById('dir-text').style.color = isLong ? '#0F6E56' : '#A32D2D';
  document.getElementById('dir-sub').textContent = isLong ? 'Buy Signal' : 'Sell Signal';

  const icon = document.getElementById('dir-icon');
  icon.style.background = isLong ? '#E1F5EE' : '#FCEBEB';
  icon.innerHTML = `<i class="ti ti-trending-${isLong ? 'up' : 'down'}" style="color:${isLong ? '#0F6E56' : '#A32D2D'};font-size:18px"></i>`;

  document.getElementById('tp-level').textContent = tp.toFixed(2);
  document.getElementById('tp-type').textContent = tpType;
  document.getElementById('sl-level').textContent = sl.toFixed(2);
  document.getElementById('sl-type').textContent = slType;

  const confEls = [document.getElementById('conf-1'), document.getElementById('conf-2'), document.getElementById('conf-3')];
  confEls.forEach((el, i) => {
    if (signal.confluences[i]) {
      el.textContent = signal.confluences[i];
    }
  });

  alert('Signal submitted successfully!');
  resetForm();
}

function resetForm() {
  document.getElementById('form-direction').value = '';
  document.getElementById('form-entry').value = '';
  document.getElementById('form-tp').value = '';
  document.getElementById('form-tp-type').value = '';
  document.getElementById('form-sl').value = '';
  document.getElementById('form-sl-type').value = '';
  document.getElementById('form-conf-1').value = '';
  document.getElementById('form-conf-2').value = '';
  document.getElementById('form-conf-3').value = '';
  document.getElementById('form-notes').value = '';
}

// ── AI Signal Generator (6am automation) ────────────────────────────────────
async function generateSignal() {
  const btn = document.getElementById('gen-btn');
  const txt = document.getElementById('gen-btn-text');
  btn.disabled = true;
  txt.textContent = 'Analyzing market...';

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You are an ES Futures technical analysis engine for long-range signals. Today is ${today}. Generate a realistic long-range signal using technical levels (demand zones, prior day close, overnight highs/lows, VWAP anchors, unfilled gaps) for entry, TP, and SL. Respond ONLY with valid JSON, no markdown: {"direction":"LONG or SHORT","bias":"Bullish or Bearish","confidence":"High, Medium, or Low","entry":5520.5,"tp":5548.0,"sl":5500.0,"tp_level":"Demand Zone or Supply Zone or Prior Day High/Low or Overnight High/Low or VWAP or Gap","sl_level":"same options","confluence":"one key confluence"}`
        }]
      })
    });

    const data = await res.json();
    const raw = data.content.map(c => c.text || '').join('');
    const signal = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const isLong = signal.direction === 'LONG';

    document.getElementById('dir-text').textContent = signal.direction;
    document.getElementById('dir-text').style.color = isLong ? '#0F6E56' : '#A32D2D';
    document.getElementById('dir-sub').textContent = isLong ? 'Buy Signal' : 'Sell Signal';

    const icon = document.getElementById('dir-icon');
    icon.style.background = isLong ? '#E1F5EE' : '#FCEBEB';
    icon.innerHTML = `<i class="ti ti-trending-${isLong ? 'up' : 'down'}" style="color:${isLong ? '#0F6E56' : '#A32D2D'};font-size:18px"></i>`;

    document.getElementById('bias-txt').textContent = signal.bias;
    document.getElementById('bias-txt').style.color = isLong ? '#0F6E56' : '#A32D2D';

    const confEl = document.getElementById('conf-lvl');
    confEl.textContent = signal.confidence;
    confEl.style.color = signal.confidence === 'High' ? '#534AB7' : signal.confidence === 'Medium' ? '#854F0B' : '#A32D2D';

    document.getElementById('tp-level').textContent = signal.tp.toFixed(2);
    document.getElementById('tp-type').textContent = signal.tp_level || 'Level';
    document.getElementById('sl-level').textContent = signal.sl.toFixed(2);
    document.getElementById('sl-type').textContent = signal.sl_level || 'Level';
    document.getElementById('entry-method').textContent = signal.entry.toFixed(2);

    const riskPts = Math.abs(signal.entry - signal.sl);
    const targetPts = Math.abs(signal.tp - signal.entry);
    const ratio = (targetPts / riskPts).toFixed(2);
    document.getElementById('rr-ratio').textContent = ratio + ':1';
    document.getElementById('rr-target').textContent = (targetPts > 0 ? '+' : '') + targetPts.toFixed(2) + ' pts';
    document.getElementById('rr-risk').textContent = '-' + riskPts.toFixed(2) + ' pts';

    document.getElementById('conf-1').textContent = signal.confluence || 'Technical confluence';

    txt.textContent = 'Signal Generated ✓';
    btn.style.background = '#1D9E75';
    setTimeout(() => { btn.disabled = false; txt.textContent = 'Regenerate Signal'; btn.style.background = ''; }, 3000);

  } catch (e) {
    console.error(e);
    txt.textContent = 'Error — Try again';
    btn.disabled = false;
    btn.style.background = '#A32D2D';
    setTimeout(() => { btn.style.background = ''; txt.textContent = 'Generate AI Signal'; }, 2500);
  }
}

// ── 6am Market Open Automation ──────────────────────────────────────────────
function scheduleAutoSignal() {
  function checkAndGenerateAt6am() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // 6 AM ET = 10 AM UTC (check 6:00-6:05 window)
    if (hours === 6 && minutes >= 0 && minutes < 5) {
      generateSignal();
      console.log('6am auto-signal generated');
    }
  }

  // Check every minute
  setInterval(checkAndGenerateAt6am, 60000);
}

// Initialize on page load
scheduleAutoSignal();

// ── Chart (Levels Tab) ─────────────────────────────────────────────────────
let chartBuilt = false;

function initChart() {
  if (chartBuilt) return;
  chartBuilt = true;

  const labels = ['18:00','20:00','22:00','00:00','02:00','04:00','06:00','08:00'];
  const priceData = [5545, 5552, 5548, 5535, 5541, 5558, 5574, 5562];
  const pdClose = 5574.50;
  const oh = 5598;
  const ol = 5529.75;
  const vwap = 5542.30;

  const ctx = document.getElementById('levelChart');
  if (!ctx) return;

  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'ES Price',
          data: priceData,
          borderColor: '#534AB7',
          backgroundColor: 'rgba(83,74,183,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          borderWidth: 2
        },
        {
          label: 'PD Close',
          data: Array(8).fill(pdClose),
          borderColor: '#FAC775',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'OH',
          data: Array(8).fill(oh),
          borderColor: '#AFA9EC',
          borderDash: [4, 4],
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'OL',
          data: Array(8).fill(ol),
          borderColor: '#F09595',
          borderDash: [4, 4],
          borderWidth: 1,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'VWAP',
          data: Array(8).fill(vwap),
          borderColor: '#534AB7',
          borderDash: [2, 2],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, color: '#888' } },
        y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, color: '#888' } }
      }
    }
  });
}

// ── Init ───────────────────────────────────────────────────────────────────
buildCalendar();
updateStats();
