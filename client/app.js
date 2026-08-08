const API = window.API_BASE;
const TOKEN_KEY = 'orbit_token';

async function api(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ==================== LOGIN VISUAL ====================
// The login background is now a static SVG (see index.html) — no JS animation loop to init.

document.getElementById('togglePassEye').addEventListener('click', (e) => {
  const input = document.getElementById('loginPass');
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  e.currentTarget.classList.toggle('showing', !showing);
});

// ==================== LOGIN / SESSION ====================
function showLockout() {
  const formCard = document.getElementById('loginFormCard');
  const lockCard = document.getElementById('lockoutCard');
  formCard.classList.add('card-fade-out');
  setTimeout(() => {
    formCard.style.display = 'none';
    formCard.classList.remove('card-fade-out');
    lockCard.style.display = 'block';
    lockCard.classList.add('card-fade-out'); // start hidden
    requestAnimationFrame(() => requestAnimationFrame(() => lockCard.classList.remove('card-fade-out')));
  }, 150);
}
function showLoginForm() {
  const formCard = document.getElementById('loginFormCard');
  const lockCard = document.getElementById('lockoutCard');
  lockCard.classList.add('card-fade-out');
  setTimeout(() => {
    lockCard.style.display = 'none';
    lockCard.classList.remove('card-fade-out');
    formCard.style.display = 'block';
    formCard.classList.add('card-fade-out'); // start hidden
    requestAnimationFrame(() => requestAnimationFrame(() => formCard.classList.remove('card-fade-out')));
  }, 150);
}

// Shared full-page loading overlay — one element reused for both Sign in and Unlock,
// since only one of those flows can ever be active at a time.
function showLoadingOverlay(mode) {
  const overlay = document.getElementById('loadingOverlay');
  const text = document.getElementById('loadingText');
  const outer = document.getElementById('loadingSvg').querySelector('.ring-outer-circle');
  const mid = document.getElementById('loadingSvg').querySelector('.ring-mid-circle');
  const inner = document.getElementById('loadingSvg').querySelector('.ring-inner-circle');
  const dots = document.getElementById('loadingSvg').querySelector('.loading-dots-group');
  if (mode === 'unlock') {
    outer.setAttribute('stroke', '#FF4FCB');
    mid.setAttribute('stroke', '#FFC15E');
    inner.setAttribute('stroke', '#FF4FCB');
    dots.setAttribute('fill', '#FFC15E');
    text.style.color = 'var(--amber)';
    text.textContent = 'Unlocking';
  } else {
    outer.setAttribute('stroke', '#3DF5FF');
    mid.setAttribute('stroke', '#A97BFF');
    inner.setAttribute('stroke', '#FF4FCB');
    dots.setAttribute('fill', '#5FD8FF');
    text.style.color = 'var(--cyan)';
    text.textContent = 'Signing in';
  }
  overlay.classList.add('active');
}
function hideLoadingOverlay() {
  document.getElementById('loadingOverlay').classList.remove('active');
}

document.getElementById('loginBtn').addEventListener('click', async () => {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.style.display = 'none';
  showLoadingOverlay('login');
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    localStorage.setItem(TOKEN_KEY, data.token);
    document.getElementById('loginScreen').classList.add('hidden');
    document.body.classList.remove('pre-auth');
    document.getElementById('greetUsername').textContent = data.username;
    hideLoadingOverlay();
    startApp();
  } catch (err) {
    hideLoadingOverlay();
    if (err.status === 423) {
      showLockout();
    } else {
      errEl.textContent = err.data?.attemptsRemaining != null
        ? `${err.data.error} (${err.data.attemptsRemaining} attempt(s) remaining)`
        : err.data?.error || 'Incorrect username or password';
      errEl.style.display = 'block';
    }
  }
});

document.getElementById('unlockBtn').addEventListener('click', async () => {
  const username = document.getElementById('loginUser').value.trim();
  const masterPassphrase = document.getElementById('masterPassInput').value;
  const errEl = document.getElementById('unlockError');
  errEl.style.display = 'none';
  showLoadingOverlay('unlock');
  try {
    await api('/auth/unlock', { method: 'POST', body: JSON.stringify({ username, masterPassphrase }) });
    document.getElementById('masterPassInput').value = '';
    hideLoadingOverlay();
    showLoginForm();
  } catch (err) {
    hideLoadingOverlay();
    errEl.textContent = err.data?.error || 'Incorrect passphrase';
    errEl.style.display = 'block';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* ignore */ }
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
});

// Try to resume an existing session on page load (stored token still valid + not idle-expired server-side)
(async function tryResumeSession() {
  if (!localStorage.getItem(TOKEN_KEY)) return; // nothing to resume — show the login screen
  try {
    const me = await api('/auth/me');
    document.getElementById('loginScreen').classList.add('hidden');
    document.body.classList.remove('pre-auth');
    document.getElementById('greetUsername').textContent = me.username;
    startApp();
  } catch (e) {
    localStorage.removeItem(TOKEN_KEY); // stale/expired token — clear it
  }
})();

// ==================== NAV ====================
function switchView(viewName) {
  document.querySelectorAll('.navicon[data-view]').forEach((n) => n.classList.remove('active'));
  document.querySelectorAll(`[data-view="${viewName}"]`).forEach((n) => n.classList.add('active'));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(viewName).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.navicon[data-view]').forEach((nav) => {
  nav.addEventListener('click', () => switchView(nav.dataset.view));
});

document.getElementById('brandLogo').addEventListener('click', () => switchView('dashboard'));

// ==================== CURSOR GLOW ====================
const glow = document.getElementById('cursorGlow');
window.addEventListener('mousemove', (e) => {
  glow.style.left = e.clientX + 'px';
  glow.style.top = e.clientY + 'px';
  document.body.classList.add('glow-active');
});

// ==================== APP BOOTSTRAP ====================
let categories = [];
let charts = {};

async function startApp() {
  resetIdleTimer();
  await loadCategories();
  await Promise.all([loadDashboard(), loadPlanner(), loadJournal()]);
}

// ---- Idle timer (client-side UX hint only — the server enforces the real 20 min timeout) ----
const IDLE_LIMIT_MS = 20 * 60 * 1000;
let idleTimer = null;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch (e) { /* already expired server-side */ }
    localStorage.removeItem(TOKEN_KEY);
    location.reload();
  }, IDLE_LIMIT_MS);
}
['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, () => {
    if (document.getElementById('loginScreen').classList.contains('hidden')) resetIdleTimer();
  }, { passive: true });
});

// ==================== CATEGORIES ====================
async function loadCategories() {
  categories = await api('/planner/categories');
  renderCategoryChips();
}

function renderCategoryChips() {
  const row = document.getElementById('categoryChips');
  row.querySelectorAll('.chip:not(.addchip)').forEach((c) => c.remove());
  const addBtn = document.getElementById('addCategoryChip') || (() => {
    const b = document.createElement('div');
    b.className = 'chip addchip';
    b.id = 'addCategoryChip';
    b.textContent = '+ Add';
    row.appendChild(b);
    return b;
  })();
  categories.forEach((cat, i) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (i === 0 ? ' sel' : '');
    chip.dataset.id = cat.id;
    chip.style.setProperty('--chip-color', cat.color);
    chip.textContent = cat.name;
    chip.addEventListener('click', () => {
      row.querySelectorAll('.chip').forEach((c) => c.classList.remove('sel'));
      chip.classList.add('sel');
    });
    row.insertBefore(chip, addBtn);
  });
  addBtn.onclick = async () => {
    const name = prompt('New category name:');
    if (!name) return;
    try {
      const created = await api('/planner/categories', { method: 'POST', body: JSON.stringify({ name }) });
      categories.push({ id: created.id, name, color: created.color });
      renderCategoryChips();
    } catch (err) {
      alert(err.data?.error || 'Could not add category');
    }
  };
}

function selectedCategoryId() {
  const sel = document.querySelector('#categoryChips .chip.sel');
  return sel ? sel.dataset.id : null;
}

// ==================== DASHBOARD ====================
async function loadDashboard() {
  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric',
  });

  const today = new Date().toISOString().slice(0, 10);
  const blocks = await api(`/planner/blocks?from=${today}&to=${today}`);
  renderTodayBlocks(blocks);
  renderStatCards(blocks);

  await renderBreakdown('daily');
  await renderWeekChart();
  await renderMonthChart();
}

function renderTodayBlocks(blocks) {
  const list = document.getElementById('todayBlocksList');
  if (!blocks.length) {
    list.innerHTML = '<div class="sub">No blocks planned yet — add one from Create Planner.</div>';
    return;
  }
  list.innerHTML = blocks.map((b) => `
    <div class="tl-item">
      <div class="tl-time">${b.start_time.slice(0,5)}</div>
      <div class="tl-rail"><div class="tl-dot" style="color:${b.category_color || '#3DF5FF'}; background:${b.category_color || '#3DF5FF'};"></div><div class="tl-line"></div></div>
      <div class="tl-content"><div class="t">${escapeHtml(b.title)}</div><div class="d">${b.category_name || 'Uncategorized'} · ${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</div></div>
    </div>`).join('');
}

function renderStatCards(blocks) {
  const totalHours = blocks.reduce((sum, b) => sum + hoursBetween(b.start_time, b.end_time), 0);
  document.getElementById('statCards').innerHTML = `
    <div class="stat glow-c"><div class="val">${blocks.length}</div><div class="lbl">Blocks today</div></div>
    <div class="stat glow-v"><div class="val">${totalHours.toFixed(1)}h</div><div class="lbl">Planned time</div></div>
  `;
}

function hoursBetween(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em - (sh * 60 + sm)) / 60;
}

// ---- Chart plugins (draw values directly on the chart) ----
const barValueLabels = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    if (!chart.options.plugins?.barValueLabels?.enabled) return;
    const { ctx } = chart;
    ctx.save();
    ctx.font = '600 10px Inter, sans-serif';
    ctx.textAlign = 'center';
    chart.data.datasets.forEach((ds, dIdx) => {
      const meta = chart.getDatasetMeta(dIdx);
      meta.data.forEach((bar, i) => {
        const val = ds.data[i];
        if (val === undefined || val === null) return;
        ctx.fillStyle = dIdx === 0 ? '#B9C2E6' : '#08222A';
        ctx.fillText(val, bar.x, bar.y - 5);
      });
    });
    ctx.restore();
  },
};
const pieValueLabels = {
  id: 'pieValueLabels',
  afterDatasetsDraw(chart) {
    if (!chart.options.plugins?.pieValueLabels?.enabled) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.font = '600 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#08121F';
    meta.data.forEach((arc, i) => {
      const raw = chart.data.datasets[0].data[i];
      const val = Number.isInteger(raw) ? raw : raw.toFixed(1);
      const angle = (arc.startAngle + arc.endAngle) / 2;
      const radius = (arc.innerRadius + arc.outerRadius) / 2;
      ctx.fillText(val, arc.x + Math.cos(angle) * radius, arc.y + Math.sin(angle) * radius);
    });
    ctx.restore();
  },
};
const pieGloss = {
  id: 'pieGloss',
  afterDatasetsDraw(chart) {
    if (!chart.options.plugins?.pieGloss?.enabled) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta.data.length) return;
    const arc = meta.data[0];
    const { x: cx, y: cy, innerRadius, outerRadius } = arc;
    ctx.save();
    // A soft light-from-above sheen across the top of the ring — the classic "glossy" cue,
    // done as a single gradient wash rather than per-segment shading (cheap, and reads as
    // one continuous glass ring rather than separately-lit slices).
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
    const grad = ctx.createLinearGradient(cx, cy - outerRadius, cx, cy + outerRadius);
    grad.addColorStop(0, 'rgba(255,255,255,0.22)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.04)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - outerRadius, cy - outerRadius, outerRadius * 2, outerRadius * 2);
    ctx.restore();
  },
};
const pieCenterText = {
  id: 'pieCenterText',
  afterDatasetsDraw(chart) {
    if (!chart.options.plugins?.pieCenterText?.enabled) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const total = chart.data.datasets[0].data.reduce((a, b) => a + Number(b), 0);
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#EAF0FF';
    ctx.font = "600 22px 'Space Grotesk', sans-serif";
    ctx.fillText(`${total.toFixed(1)}h`, cx, cy - 9);
    ctx.fillStyle = '#8792B0';
    ctx.font = "600 10px Inter, sans-serif";
    ctx.fillText('TOTAL', cx, cy + 14);
    ctx.restore();
  },
};
Chart.register(barValueLabels, pieValueLabels, pieGloss, pieCenterText);

// Consistent, theme-matching tooltip styling across every chart, instead of Chart.js's
// plain default black box.
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17,21,42,0.94)';
Chart.defaults.plugins.tooltip.titleColor = '#EAF0FF';
Chart.defaults.plugins.tooltip.bodyColor = '#B9C2E6';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(140,160,255,0.25)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.tooltip.boxPadding = 4;
Chart.defaults.plugins.tooltip.titleFont = { family: "'Space Grotesk', sans-serif", weight: '600', size: 12 };
Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 11 };

const gridColor = 'rgba(140,160,255,0.08)';
const mutedColor = '#8792B0';

async function renderBreakdown(range) {
  const data = await api(`/stats/breakdown/${range}`);
  const labels = data.map((d) => d.name);
  const values = data.map((d) => Number(d.hours));
  const colors = data.map((d) => d.color);

  if (!charts.pie) {
    charts.pie = new Chart(document.getElementById('pieChart'), {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: 'rgba(10,13,24,0.5)', borderWidth: 1.5, hoverOffset: 10 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { display: false }, pieValueLabels: { enabled: true }, pieGloss: { enabled: true }, pieCenterText: { enabled: true } } },
    });
  } else {
    charts.pie.data.labels = labels;
    charts.pie.data.datasets[0].data = values;
    charts.pie.data.datasets[0].backgroundColor = colors;
    charts.pie.update();
  }

  const total = values.reduce((a, b) => a + b, 0) || 1;
  document.getElementById('pieLegend').innerHTML = data.map((d, i) => `
    <div class="leg-row">
      <span class="leg-dot" style="color:${d.color}; background:${d.color};"></span>
      <span class="leg-name">${d.name}</span>
      <span class="leg-time">${d.hours}h · ${Math.round((values[i] / total) * 100)}%</span>
    </div>`).join('') || '<div class="sub">No data yet for this range.</div>';
}

document.querySelectorAll('#breakdownTabs .tabbtn').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#breakdownTabs .tabbtn').forEach((t) => t.classList.remove('sel'));
    tab.classList.add('sel');
    renderBreakdown(tab.dataset.range);
  });
});

async function renderWeekChart() {
  const rows = await api('/stats/week');
  const labels = rows.map((r) => new Date(r.block_date).toLocaleDateString(undefined, { weekday: 'short' }));
  const planned = rows.map((r) => Number(r.planned_hours));
  const completed = rows.map((r) => Number(r.completed_hours));

  if (charts.week) charts.week.destroy();
  const weekCanvas = document.getElementById('weekChart');
  charts.week = new Chart(weekCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Planned (h)', data: planned, borderRadius: 6, barPercentage: 0.6,
          backgroundColor: (ctx) => {
            const { chartArea } = ctx.chart;
            if (!chartArea) return 'rgba(169,123,255,0.18)';
            const g = ctx.chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(169,123,255,0.32)');
            g.addColorStop(1, 'rgba(169,123,255,0.06)');
            return g;
          },
        },
        {
          label: 'Completed (h)', data: completed, borderRadius: 6, barPercentage: 0.6,
          backgroundColor: (ctx) => {
            const { chartArea } = ctx.chart;
            if (!chartArea) return '#3DF5FF';
            const g = ctx.chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, '#7CF5FF');
            g.addColorStop(1, '#17B8D4');
            return g;
          },
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false, layout: { padding: { top: 16 } },
      plugins: { legend: { labels: { color: mutedColor, font: { family: 'Inter', size: 11 }, boxWidth: 10 } }, barValueLabels: { enabled: true } },
      scales: {
        x: { grid: { display: false }, ticks: { color: mutedColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: mutedColor, font: { size: 11 } } },
      },
    },
  });
}

async function renderMonthChart() {
  const rows = await api('/stats/month');
  const labels = rows.map((r, i) => `W${i + 1}`);
  const values = rows.map((r) => Number(r.completion_pct) || 0);

  if (charts.month) charts.month.destroy();
  charts.month = new Chart(document.getElementById('monthChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Completion %', data: values, borderColor: '#FF4FCB',
        backgroundColor: (ctx) => {
          const { chartArea } = ctx.chart;
          if (!chartArea) return 'rgba(255,79,203,0.12)';
          const g = ctx.chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, 'rgba(255,79,203,0.30)');
          g.addColorStop(1, 'rgba(255,79,203,0)');
          return g;
        },
        fill: true, tension: 0.4, pointBackgroundColor: '#FF4FCB', pointBorderColor: '#0A0D18',
        pointBorderWidth: 2, pointRadius: 4, pointHoverRadius: 6, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: mutedColor, font: { size: 11 } } },
        y: { grid: { color: gridColor }, ticks: { color: mutedColor, font: { size: 11 } }, min: 0, max: 100 },
      },
    },
  });
}

// ==================== CREATE PLANNER ====================
document.querySelectorAll('#timelineTabs .tabbtn').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#timelineTabs .tabbtn').forEach((t) => t.classList.remove('sel'));
    tab.classList.add('sel');
    const isPast = tab.dataset.range === 'pastweek';
    document.getElementById('timelineToday').style.display = isPast ? 'none' : 'block';
    document.getElementById('timelinePastWeek').style.display = isPast ? 'block' : 'none';
    document.getElementById('timelineSub').textContent = isPast ? 'Last 7 days · tap to edit or delete' : 'Tap a block to edit';
  });
});

async function loadPlanner() {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [todayBlocks, weekBlocks] = await Promise.all([
    api(`/planner/blocks?from=${today}&to=${today}`),
    api(`/planner/blocks?from=${weekAgo}&to=${today}`),
  ]);

  const pastBlocks = weekBlocks.filter((b) => b.block_date !== today);
  renderTimeline('timelineToday', todayBlocks, true);
  renderTimeline('timelinePastWeek', pastBlocks, false);
  plannerPastEntriesCache = pastBlocks;
  renderPastPlannerEntries();
  syncTimelineHeight();
}

// Match the Timeline card's height to "Add a block" so their bottoms align — the timeline
// list scrolls internally instead of the card growing taller than its neighbor.
function syncTimelineHeight() {
  const addCard = document.getElementById('addBlockCard');
  const timelineCard = document.getElementById('timelineCard');
  if (!addCard || !timelineCard) return;
  // Only enforce a matched height on wide layouts where the two cards actually sit
  // side-by-side; on narrow/stacked layouts, let both size naturally.
  if (window.innerWidth < 980) {
    timelineCard.style.height = '';
    return;
  }
  timelineCard.style.height = addCard.offsetHeight + 'px';
}
window.addEventListener('resize', () => {
  clearTimeout(window._timelineResizeT);
  window._timelineResizeT = setTimeout(syncTimelineHeight, 150);
});

let plannerPastEntriesCache = [];
let plannerEntriesShowAll = false;
const PLANNER_ENTRIES_PREVIEW_COUNT = 4;

function renderPastPlannerEntries() {
  const blocks = plannerPastEntriesCache;
  const list = document.getElementById('pastPlannerEntries');
  if (!blocks.length) {
    list.innerHTML = '<div class="sub">Nothing logged in the past week yet.</div>';
    document.getElementById('viewAllPlannerEntries').style.display = 'none';
    return;
  }
  document.getElementById('viewAllPlannerEntries').style.display = 'inline';

  // most recent first
  const sorted = [...blocks].sort((a, b) => (a.block_date === b.block_date
    ? b.start_time.localeCompare(a.start_time)
    : b.block_date.localeCompare(a.block_date)));
  const visible = plannerEntriesShowAll ? sorted : sorted.slice(0, PLANNER_ENTRIES_PREVIEW_COUNT);

  list.classList.toggle('scrollable', plannerEntriesShowAll && sorted.length > PLANNER_ENTRIES_PREVIEW_COUNT);

  list.innerHTML = visible.map((b) => `
    <div class="entry-card" data-id="${b.id}" style="border-left-color:${b.category_color || 'var(--violet)'};">
      <div class="entry-actions">
        <div class="icon-btn edit-planner-entry" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19l4-1 11-11-3-3L5 15l-1 4z"/></svg></div>
        <div class="icon-btn danger delete-planner-entry" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"/></svg></div>
      </div>
      <div class="entry-head">
        <span>${new Date(b.block_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'long' })}</span>
        <span class="mono" style="font-size:11px; color:var(--muted);">${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</span>
      </div>
      <div class="entry-block-title" style="font-size:13.5px; font-weight:500; margin-top:6px;">${escapeHtml(b.title)}</div>
      <div class="entry-text" style="margin-top:6px; ${b.notes ? '' : 'font-style:italic; color:var(--faint);'}">${b.notes ? escapeHtml(b.notes) : 'No additional notes'}</div>
      <div class="entry-tags"><span class="etag" style="--tag-color:${b.category_color || '#A97BFF'}">${b.category_name || 'Uncategorized'}</span></div>
    </div>`).join('');

  list.querySelectorAll('.edit-planner-entry').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.entry-card');
      const titleEl = card.querySelector('.entry-block-title');
      const notesEl = card.querySelector('.entry-text');
      const editing = titleEl.getAttribute('contenteditable') === 'true';
      if (editing) {
        titleEl.removeAttribute('contenteditable');
        notesEl.removeAttribute('contenteditable');
        btn.style.color = '';
        const newNotes = notesEl.textContent.trim();
        try {
          // Only title/notes are ever sent here — block_date/start_time/end_time are left
          // untouched, so the original time always stays exactly as it was.
          await api(`/planner/blocks/${card.dataset.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              title: titleEl.textContent.trim(),
              notes: newNotes === 'No additional notes' ? '' : newNotes,
            }),
          });
          await loadPlanner(); // keeps the (now read-only) Timeline in sync with this edit
        } catch (err) { alert(err.data?.error || 'Could not save changes'); }
      } else {
        titleEl.setAttribute('contenteditable', 'true');
        notesEl.setAttribute('contenteditable', 'true');
        titleEl.focus();
        btn.style.color = 'var(--cyan)';
      }
    });
  });
  list.querySelectorAll('.delete-planner-entry').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.entry-card');
      if (!confirm('Delete this entry?')) return;
      try {
        await api(`/planner/blocks/${card.dataset.id}`, { method: 'DELETE' });
        await loadPlanner();   // keeps Timeline in sync
        await loadDashboard(); // hours/category totals changed
      } catch (err) { alert(err.data?.error || 'Could not delete'); }
    });
  });
}

document.getElementById('viewAllPlannerEntries').addEventListener('click', () => {
  plannerEntriesShowAll = !plannerEntriesShowAll;
  document.getElementById('viewAllPlannerEntries').textContent = plannerEntriesShowAll ? 'Show less ←' : 'View all →';
  document.getElementById('pastPlannerSub').textContent = 'Entries from past 7 days';
  renderPastPlannerEntries();
});

function renderTimeline(containerId, blocks, showTimeOnly) {
  const el = document.getElementById(containerId);
  if (!blocks.length) {
    el.innerHTML = '<div class="sub">Nothing here yet.</div>';
    return;
  }
  el.innerHTML = blocks.map((b) => `
    <div class="tl-item" data-id="${b.id}">
      <div class="tl-time">${showTimeOnly ? b.start_time.slice(0,5) : new Date(b.block_date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</div>
      <div class="tl-rail"><div class="tl-dot" style="color:${b.category_color || '#3DF5FF'}; background:${b.category_color || '#3DF5FF'};"></div><div class="tl-line"></div></div>
      <div class="tl-content">
        <div class="t">${escapeHtml(b.title)}</div>
        <div class="d">${b.category_name || 'Uncategorized'} · ${b.start_time.slice(0,5)}–${b.end_time.slice(0,5)}</div>
      </div>
    </div>`).join('');
}

document.getElementById('addBlockBtn').addEventListener('click', async () => {
  const title = document.getElementById('blockTitle').value.trim();
  const start = document.getElementById('blockStart').value;
  const end = document.getElementById('blockEnd').value;
  const notes = document.getElementById('blockNotes').value.trim();
  const category_id = selectedCategoryId();
  const msg = document.getElementById('blockFormMsg');

  if (!title || !start || !end) {
    msg.style.color = 'var(--magenta)';
    msg.textContent = 'Activity name and both times are required.';
    msg.style.display = 'block';
    return;
  }

  try {
    await api('/planner/blocks', {
      method: 'POST',
      body: JSON.stringify({
        title, notes, category_id,
        block_date: new Date().toISOString().slice(0, 10),
        start_time: start, end_time: end,
      }),
    });
    document.getElementById('blockTitle').value = '';
    document.getElementById('blockNotes').value = '';
    msg.style.color = 'var(--cyan)';
    msg.textContent = 'Added to today\'s plan.';
    msg.style.display = 'block';
    await loadPlanner();
    await loadDashboard();
  } catch (err) {
    msg.style.color = 'var(--magenta)';
    msg.textContent = err.data?.error || 'Could not add block';
    msg.style.display = 'block';
  }
});

// ==================== JOURNAL ====================
let selectedMood = null; // nothing selected until the user actually picks one
document.querySelectorAll('#moodRow .mood').forEach((m) => {
  m.addEventListener('click', () => {
    document.querySelectorAll('#moodRow .mood').forEach((x) => x.classList.remove('sel'));
    m.classList.add('sel');
    selectedMood = Number(m.dataset.mood);
  });
});

const TAG_COLORS = ['#3DF5FF', '#A97BFF', '#FF4FCB', '#FFC15E'];
// Same tag name always maps to the same color, wherever it's rendered (compose form or past entries) —
// no DB column needed, just a stable hash over the name.
function colorForTag(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TAG_COLORS[hash % TAG_COLORS.length];
}

const PRESET_TAGS = ['Blessed', 'Happy', 'Mindful', 'Serenity', 'Thoughtful', 'Productive', 'Divine'];
function freshTagList() {
  return PRESET_TAGS.map((name) => ({ name, selected: false, color: colorForTag(name) }));
}
let pendingTags = freshTagList();

document.getElementById('addTagChip').addEventListener('click', () => {
  const name = prompt('New tag name:');
  if (!name) return;
  pendingTags.push({ name: name.trim(), selected: true, color: colorForTag(name.trim()) });
  renderPendingTags();
});
function renderPendingTags() {
  const row = document.getElementById('journalTags');
  row.querySelectorAll('.chip:not(.addchip)').forEach((c) => c.remove());
  const addBtn = document.getElementById('addTagChip');
  pendingTags.forEach((tag) => {
    const chip = document.createElement('div');
    chip.className = 'chip' + (tag.selected ? ' sel' : '');
    chip.style.setProperty('--chip-color', tag.color);
    chip.textContent = tag.name;
    chip.addEventListener('click', () => {
      tag.selected = !tag.selected;
      chip.classList.toggle('sel', tag.selected);
    });
    row.insertBefore(chip, addBtn);
  });
}
renderPendingTags();

// ---- Entry date: defaults to today, switchable to a past date so a forgotten day can be logged ----
const todayISO = new Date().toISOString().slice(0, 10);
let journalEntryDate = todayISO;
const journalDateInput = document.getElementById('journalDateInput');
journalDateInput.max = todayISO; // no future-dated entries
journalDateInput.value = todayISO;

document.querySelectorAll('#journalDateTabs .tabbtn').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#journalDateTabs .tabbtn').forEach((t) => t.classList.remove('sel'));
    tab.classList.add('sel');
    const isCustom = tab.dataset.mode === 'custom';
    document.getElementById('journalDateField').style.display = isCustom ? 'block' : 'none';
    if (!isCustom) {
      journalEntryDate = todayISO;
      document.getElementById('journalEntryTitle').textContent = 'New entry — today';
    } else {
      journalEntryDate = journalDateInput.value || todayISO;
      updateJournalEntryTitle();
    }
  });
});
journalDateInput.addEventListener('change', () => {
  journalEntryDate = journalDateInput.value || todayISO;
  updateJournalEntryTitle();
});
function updateJournalEntryTitle() {
  const label = new Date(journalEntryDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('journalEntryTitle').textContent = `New entry — ${label}`;
}

document.getElementById('saveEntryBtn').addEventListener('click', async () => {
  const content = document.getElementById('journalContent').value.trim();
  const msg = document.getElementById('journalFormMsg');
  if (!content) {
    msg.style.color = 'var(--magenta)';
    msg.textContent = 'Write something before saving.';
    msg.style.display = 'block';
    return;
  }
  if (!selectedMood) {
    msg.style.color = 'var(--magenta)';
    msg.textContent = 'Pick a mood before saving.';
    msg.style.display = 'block';
    return;
  }
  try {
    await api('/journal/entries', {
      method: 'POST',
      body: JSON.stringify({
        entry_date: journalEntryDate,
        mood: selectedMood,
        content,
        tags: pendingTags.filter((t) => t.selected).map((t) => t.name),
      }),
    });
    document.getElementById('journalContent').value = '';
    pendingTags = freshTagList();
    renderPendingTags();
    document.querySelectorAll('#moodRow .mood').forEach((x) => x.classList.remove('sel'));
    selectedMood = null;
    document.querySelectorAll('#journalDateTabs .tabbtn').forEach((t) => t.classList.remove('sel'));
    document.querySelector('#journalDateTabs .tabbtn[data-mode="today"]').classList.add('sel');
    document.getElementById('journalDateField').style.display = 'none';
    journalEntryDate = todayISO;
    journalDateInput.value = todayISO;
    document.getElementById('journalEntryTitle').textContent = 'New entry — today';
    msg.style.color = 'var(--cyan)';
    msg.textContent = 'Entry saved.';
    msg.style.display = 'block';
    await loadJournal();
  } catch (err) {
    msg.style.color = 'var(--magenta)';
    msg.textContent = err.data?.error || 'Could not save entry';
    msg.style.display = 'block';
  }
});

const MOOD_EMOJI = { 1: '😔', 2: '😐', 3: '🙂', 4: '😄', 5: '🤩' };
let allEntriesShown = false;

async function loadJournal() {
  const entries = await api('/journal/entries');
  renderJournalList(entries);
}

function renderJournalList(entries) {
  const list = document.getElementById('journalEntryList');
  const visible = allEntriesShown ? entries : entries.slice(0, 3);
  list.classList.toggle('scrollable', allEntriesShown && entries.length > 3);
  if (!visible.length) {
    list.innerHTML = '<div class="sub">No journal entries yet.</div>';
    return;
  }
  list.innerHTML = visible.map((e) => `
    <div class="entry-card" data-id="${e.id}">
      <div class="entry-actions">
        <div class="icon-btn edit-entry" title="Edit"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19l4-1 11-11-3-3L5 15l-1 4z"/></svg></div>
        <div class="icon-btn danger delete-entry" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0v12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"/></svg></div>
      </div>
      <div class="entry-head"><span>${new Date(e.entry_date).toLocaleDateString(undefined,{month:'short',day:'numeric',weekday:'long'})}</span><span>${MOOD_EMOJI[e.mood] || ''}</span></div>
      <div class="entry-text">${escapeHtml(e.content)}</div>
      <div class="entry-tags">${(e.tags||[]).map(t=>`<span class="etag" style="--tag-color:${colorForTag(t.name)}">${escapeHtml(t.name)}</span>`).join('')}</div>
    </div>`).join('');

  list.querySelectorAll('.edit-entry').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.entry-card');
      const text = card.querySelector('.entry-text');
      const editing = text.getAttribute('contenteditable') === 'true';
      if (editing) {
        text.removeAttribute('contenteditable');
        btn.style.color = '';
        try {
          await api(`/journal/entries/${card.dataset.id}`, { method: 'PUT', body: JSON.stringify({ content: text.textContent.trim() }) });
        } catch (err) { alert(err.data?.error || 'Could not save changes'); }
      } else {
        text.setAttribute('contenteditable', 'true');
        text.focus();
        btn.style.color = 'var(--cyan)';
      }
    });
  });
  list.querySelectorAll('.delete-entry').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('.entry-card');
      if (!confirm('Delete this journal entry?')) return;
      try {
        await api(`/journal/entries/${card.dataset.id}`, { method: 'DELETE' });
        card.remove();
      } catch (err) { alert(err.data?.error || 'Could not delete'); }
    });
  });
}

document.getElementById('viewAllJournals').addEventListener('click', async () => {
  allEntriesShown = !allEntriesShown;
  document.getElementById('viewAllJournals').textContent = allEntriesShown ? 'Show less ←' : 'View all →';
  document.getElementById('pastEntriesSub').textContent = allEntriesShown ? 'All entries' : 'Last 3 entries';
  await loadJournal();
});

// ==================== UTIL ====================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
