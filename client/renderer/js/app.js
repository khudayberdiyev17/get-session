/* ═══════════════════════════════════════════════════════════════════════════
   EXAM CLIENT — Renderer process logic
   Screens: login → profile → subjects → test → results
═══════════════════════════════════════════════════════════════════════════ */

/* ── Global state ─────────────────────────────────────────────────────────── */
const S = {
  cfg:   { serverUrl: 'http://localhost:3000/api', wsUrl: 'ws://localhost:3000' },
  token: null,
  user:  null,

  subjects: [],

  test: {
    sessionId:     null,
    subjectId:     null,
    subjectName:   null,
    questions:     [],
    answers:       {},   // { questionIndex: selectedOptionIndex }
    currentIndex:  0,
    totalSeconds:  0,
    remainSeconds: 0,
    timerHandle:   null,
    heartbeatHandle: null,
  },

  ws: null,
};

/* ══════════════════════════════════════════════════════════════════════════
   UTILS
══════════════════════════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

const SCREENS_WITH_TOGGLE = ['subjects', 'test', 'results'];

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = $(`screen-${name}`);
  if (el) el.classList.add('active');

  // Show theme toggle only on dark screens
  const toggle = $('theme-toggle');
  if (toggle) {
    toggle.classList.toggle('hidden', !SCREENS_WITH_TOGGLE.includes(name));
  }
}

function setLoading(btn, loading) {
  const text   = btn.querySelector('.btn-text');
  const icon   = btn.querySelector('.btn-icon');
  const loader = btn.querySelector('.btn-loader');
  btn.disabled = loading;
  if (text)   text.classList.toggle('hidden', loading);
  if (icon)   icon.classList.toggle('hidden', loading);
  if (loader) loader.classList.toggle('hidden', !loading);
}

function showError(elId, msg) {
  const el = $(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function hideError(elId) {
  const el = $(elId);
  if (el) el.classList.add('hidden');
}

function toast(msg, type = 'info') {
  const wrap = $('toast-wrap');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function fmtTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* ══════════════════════════════════════════════════════════════════════════
   HTTP API helpers
══════════════════════════════════════════════════════════════════════════ */
async function api(method, path, body, token) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);

  const res  = await fetch(S.cfg.serverUrl + path, opts);
  const data = await res.json().catch(() => ({}));

  // Bloklangan foydalanuvchi → maxsus ishlov
  if (res.status === 403 && data.blockReason) {
    handleBlocked(data.blockReason, data.message);
    throw Object.assign(new Error('blocked'), { blocked: true, data });
  }

  if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'Xato'), { data });
  return data;
}

const GET  = (path, token)       => api('GET',  path, null, token);
const POST = (path, body, token) => api('POST', path, body, token);
const PUT  = (path, body, token) => api('PUT',  path, body, token);

/* ══════════════════════════════════════════════════════════════════════════
   WEBSOCKET
══════════════════════════════════════════════════════════════════════════ */
function connectWS(userId) {
  if (S.ws) { try { S.ws.close(); } catch(_){} }

  try {
    S.ws = new WebSocket(S.cfg.wsUrl);
  } catch(e) {
    console.warn('[WS] connect error', e);
    return;
  }

  S.ws.addEventListener('open', () => {
    console.log('[WS] connected');
    S.ws.send(JSON.stringify({ type: 'auth', userId, token: S.token }));
  });

  S.ws.addEventListener('message', (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'blocked') {
        handleBlocked(msg.reason, msg.message);
      }
    } catch(_) {}
  });

  S.ws.addEventListener('close', () => console.log('[WS] closed'));
  S.ws.addEventListener('error', e => console.warn('[WS] error', e));
}

function wsSend(obj) {
  if (S.ws && S.ws.readyState === WebSocket.OPEN) {
    S.ws.send(JSON.stringify(obj));
  }
}

const BLOCK_TITLES = {
  excessive_keys:    'Klaviatura cheating aniqlandi!',
  internet_lost:     'Internet uzildi',
  test_interrupted:  'Test to\'xtatildi',
  admin_blocked:     'Admin tomonidan bloklandi',
  websocket_lost:    'Aloqa uzildi',
};
const BLOCK_ICONS = {
  excessive_keys:    '⌨️',
  internet_lost:     '📡',
  test_interrupted:  '🛑',
  admin_blocked:     '🔒',
};

function handleBlocked(reason, message) {
  clearTest();
  // Show full-screen blocked overlay
  const overlay    = $('blocked-overlay');
  const titleEl    = $('blocked-title');
  const msgEl      = $('blocked-msg');
  const iconEl     = $('blocked-icon');
  const countdownEl= $('blocked-countdown');

  if (overlay) {
    titleEl.textContent = BLOCK_TITLES[reason] || 'Bloklangiz';
    iconEl.textContent  = BLOCK_ICONS[reason]  || '🚫';
    msgEl.textContent   = message || 'Adminga murojaat qiling.';
    overlay.classList.remove('hidden');

    // Countdown 5 → 0
    let sec = 5;
    if (countdownEl) countdownEl.textContent = sec;
    const iv = setInterval(() => {
      sec--;
      if (countdownEl) countdownEl.textContent = Math.max(0, sec);
      if (sec <= 0) {
        clearInterval(iv);
        overlay.classList.add('hidden');
        S.token = null; S.user = null;
        showScreen('login');
      }
    }, 1000);
  } else {
    // Fallback
    toast(message || 'Siz bloklandingiz.', 'error');
    setTimeout(() => { S.token = null; S.user = null; showScreen('login'); }, 4000);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   LOGIN SCREEN
══════════════════════════════════════════════════════════════════════════ */
function initLogin() {
  const btn = $('btn-login');
  const inp = $('inp-password');

  const doLogin = async () => {
    const username = $('inp-username').value.trim();
    const password = inp.value;
    if (!username || !password) {
      return showError('login-err', 'Login va parolni kiriting.');
    }
    hideError('login-err');
    setLoading(btn, true);

    try {
      const data = await POST('/auth/login', { username, password });

      if (data.blockReason) {
        showError('login-err', data.message || 'Siz bloklandingiz.');
        return;
      }

      S.token = data.token;
      S.user  = data.user;

      connectWS(S.user._id || S.user.id || username);

      const firstName = (S.user.firstName || '').trim();
      const lastName  = (S.user.lastName  || '').trim();

      if (!firstName && !lastName) {
        goToProfile();
      } else {
        goToSubjects();
      }
    } catch(e) {
      if (e.data && e.data.blockReason) {
        showError('login-err', e.data.message || 'Bloklandingiz.');
      } else {
        showError('login-err', e.message || 'Login yoki parol xato.');
      }
    } finally {
      setLoading(btn, false);
    }
  };

  btn.addEventListener('click', doLogin);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  $('inp-username').addEventListener('keydown', e => { if (e.key === 'Enter') inp.focus(); });
}

/* ══════════════════════════════════════════════════════════════════════════
   PROFILE SCREEN
══════════════════════════════════════════════════════════════════════════ */
function goToProfile() {
  const display = $('profile-username-display');
  if (display && S.user) {
    display.textContent = S.user.username || '';
    display.classList.remove('hidden');
  }
  // Clear fields
  $('inp-firstname').value = S.user.firstName || '';
  $('inp-lastname').value  = S.user.lastName  || '';
  $('inp-class').value     = S.user.className || '';
  hideError('profile-err');
  showScreen('profile');
}

function initProfile() {
  const btn = $('btn-profile-save');

  btn.addEventListener('click', async () => {
    const firstName = $('inp-firstname').value.trim();
    const lastName  = $('inp-lastname').value.trim();
    const className = $('inp-class').value.trim();

    if (!firstName || !lastName) {
      return showError('profile-err', 'Ism va familiyani kiriting.');
    }
    hideError('profile-err');
    setLoading(btn, true);

    try {
      const data = await PUT('/auth/profile', { firstName, lastName, className }, S.token);
      S.user = { ...S.user, ...data.user };
      goToSubjects();
    } catch(e) {
      showError('profile-err', e.message || 'Saqlashda xato yuz berdi.');
    } finally {
      setLoading(btn, false);
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   SUBJECTS SCREEN
══════════════════════════════════════════════════════════════════════════ */
async function goToSubjects() {
  showScreen('subjects');

  // User chip
  if (S.user) {
    const fn   = S.user.firstName || '';
    const ln   = S.user.lastName  || '';
    const name = [fn, ln].filter(Boolean).join(' ') || S.user.username || '';
    $('user-chip-name').textContent = name;
  }

  // Clear grid
  const grid = $('subjects-grid');
  grid.innerHTML = `
    <div class="subjects-loading" id="subjects-loading">
      <div class="spinner"></div>
      <p>Fanlar yuklanmoqda...</p>
    </div>`;

  try {
    const subjects = await GET('/subjects', S.token);
    S.subjects = subjects;
    renderSubjects(subjects);
  } catch(e) {
    grid.innerHTML = `<div class="subjects-loading"><p style="color:var(--red)">
      Fanlarni yuklashda xato: ${e.message}
    </p></div>`;
  }
}

const ICON_COLORS = [
  { bg: 'rgba(59,130,246,0.22)',  fg: 'rgba(59,130,246,0.90)',  border: 'rgba(59,130,246,0.35)'  },
  { bg: 'rgba(139,92,246,0.22)', fg: 'rgba(139,92,246,0.90)',  border: 'rgba(139,92,246,0.35)'  },
  { bg: 'rgba(16,185,129,0.22)', fg: 'rgba(16,185,129,0.90)',  border: 'rgba(16,185,129,0.35)'  },
  { bg: 'rgba(245,158,11,0.22)', fg: 'rgba(245,158,11,0.90)',  border: 'rgba(245,158,11,0.35)'  },
  { bg: 'rgba(239,68,68,0.22)',  fg: 'rgba(239,68,68,0.90)',   border: 'rgba(239,68,68,0.35)'   },
  { bg: 'rgba(6,182,212,0.22)',  fg: 'rgba(6,182,212,0.90)',   border: 'rgba(6,182,212,0.35)'   },
  { bg: 'rgba(236,72,153,0.22)', fg: 'rgba(236,72,153,0.90)',  border: 'rgba(236,72,153,0.35)'  },
  { bg: 'rgba(234,88,12,0.22)',  fg: 'rgba(234,88,12,0.90)',   border: 'rgba(234,88,12,0.35)'   },
];

function colorForName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = h * 31 + name.charCodeAt(i);
  return ICON_COLORS[Math.abs(h) % ICON_COLORS.length];
}

function renderSubjects(subjects) {
  const grid = $('subjects-grid');
  grid.innerHTML = '';

  if (!subjects.length) {
    grid.innerHTML = `<div class="subjects-loading">
      <p style="color:var(--text-2)">Sizga biriktirilgan fanlar topilmadi.</p>
    </div>`;
    return;
  }

  // Subtitle
  const completed = subjects.filter(s => s.isCompleted).length;
  const remaining = subjects.length - completed;
  let sub = '';
  const fn = (S.user.firstName || '').trim();
  if (fn) sub = `${fn}   ·   `;
  sub += remaining > 0
    ? `${subjects.length} ta fan  ·  ${completed} ta bajarildi`
    : `Barcha ${subjects.length} ta fan topshirildi 🎉`;
  $('subjects-subtitle').textContent = sub;

  // "Finish exam" button — only visible when ALL subjects completed
  const finishBtn = $('btn-finish-exam');
  if (finishBtn) {
    const allDone = subjects.length > 0 && remaining === 0;
    finishBtn.classList.toggle('hidden', !allDone);
  }

  subjects.forEach(subj => {
    const c       = colorForName(subj.name);
    const initial = subj.name.charAt(0).toUpperCase();
    const done    = subj.isCompleted;
    const score   = done && subj.completedData ? subj.completedData.score : null;

    const card = document.createElement('div');
    card.className = `subject-card${done ? ' completed' : ''}`;
    card.style.setProperty('--card-color', c.fg);

    const badge = done
      ? `<span class="card-badge badge-done">${score != null ? `✓  ${score}%` : '✓ Topshirildi'}</span>`
      : `<span class="badge-arrow">›</span>`;

    const qCount = subj.questionCount > 0
      ? `<span class="card-stat">📋 ${subj.questionCount} savol</span>` : '';

    card.innerHTML = `
      <div class="card-top">
        <div class="card-icon"
             style="background:${c.bg};color:${c.fg};border:1.5px solid ${c.border};">
          ${initial}
        </div>
        <span class="card-name">${subj.name}</span>
        ${badge}
      </div>
      <div class="card-sep"></div>
      <div class="card-stats">
        ${qCount}
        <span class="card-stat">⏱ ${subj.totalTimeLimit} daqiqa</span>
        ${done ? '<span class="card-done-hint" style="margin-left:auto">Qayta topshirib bo\'lmaydi</span>' : ''}
      </div>`;

    if (!done) {
      card.addEventListener('click', () =>
        startTest(subj.id, subj.name, subj.totalTimeLimit));
    }

    // Threshold chip
    const thr = subj.passingThreshold;
    if (thr && !done) {
      const thrEl   = document.createElement('span');
      thrEl.className = 'card-stat card-stat--pass';
      thrEl.textContent = thr.thresholdType === 'count'
        ? `✓ min ${thr.thresholdValue} ta`
        : `✓ min ${thr.thresholdValue}%`;
      card.querySelector('.card-stats')?.appendChild(thrEl);
    }

    grid.appendChild(card);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   TEST SCREEN
══════════════════════════════════════════════════════════════════════════ */
async function startTest(subjectId, subjectName, timeLimitMin) {
  showScreen('test');
  $('test-subject-name').textContent = subjectName;
  $('timer-value').textContent = fmtTime(timeLimitMin * 60);
  $('timer-value').className   = 'timer-value';
  $('options-list').innerHTML  = '';
  $('q-dots').innerHTML        = '';
  $('test-progress-fill').style.width = '0%';

  try {
    const data = await GET(`/test/questions?subjectId=${subjectId}`, S.token);

    S.test.sessionId        = data.sessionId;
    S.test.subjectId        = subjectId;
    S.test.subjectName      = subjectName;
    S.test.questions        = data.questions || [];
    S.test.answers          = {};
    S.test.currentIndex     = 0;
    S.test.totalSeconds     = (data.totalTimeLimit || timeLimitMin) * 60;
    S.test.remainSeconds    = S.test.totalSeconds;
    S.test.passingThreshold = data.passingThreshold || { thresholdType: 'percent', thresholdValue: 60 };

    if (!S.test.questions.length) {
      toast('Bu fanda savollar topilmadi.', 'error');
      goToSubjects();
      return;
    }

    buildDots();
    renderQuestion(0);
    startTimer();
    startHeartbeat();

    // Track keypresses in test mode
    document.addEventListener('keydown', onTestKeyDown);

  } catch(e) {
    toast(e.message || 'Testni boshlashda xato.', 'error');
    showScreen('subjects');
  }
}

/* ── Question rendering ───────────────────────────────────────────────────── */
function renderQuestion(index) {
  const q   = S.test.questions[index];
  if (!q) return;
  S.test.currentIndex = index;

  const total = S.test.questions.length;

  // Labels
  $('question-num').textContent  = `${index + 1}-savol`;
  $('question-text').textContent = q.text || '';
  $('test-q-label').textContent  = `Savol ${index + 1} / ${total}`;
  $('test-progress-fill').style.width = `${((index + 1) / total) * 100}%`;

  // Image
  const imgWrap = $('question-img-wrap');
  const img     = $('question-img');
  if (q.imageBase64) {
    img.src = q.imageBase64.startsWith('data:') ? q.imageBase64 : `data:image/png;base64,${q.imageBase64}`;
    imgWrap.classList.remove('hidden');
  } else {
    imgWrap.classList.add('hidden');
    img.src = '';
  }

  // Options
  const opts = $('options-list');
  opts.innerHTML = '';
  const letters = ['A', 'B', 'C', 'D'];

  (q.options || []).forEach((text, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.style.animationDelay = `${i * 55}ms`;
    if (S.test.answers[index] === i) btn.classList.add('selected');

    btn.innerHTML = `
      <span class="opt-letter">${letters[i]}</span>
      <span class="opt-text">${text}</span>`;

    btn.addEventListener('click', () => selectAnswer(index, i));
    opts.appendChild(btn);
  });

  // Nav buttons
  $('btn-prev').disabled = index === 0;
  $('btn-next').disabled = index === total - 1;

  // Update dots
  updateDots(index);
}

function selectAnswer(qIndex, optIndex) {
  S.test.answers[qIndex] = optIndex;

  // Reflect visually
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === optIndex);
    const letter = btn.querySelector('.opt-letter');
    if (letter) {
      letter.style.background    = i === optIndex ? '' : '';
    }
  });

  updateDots(S.test.currentIndex);

  // Auto-advance to next question after short delay
  const total = S.test.questions.length;
  if (qIndex < total - 1) {
    setTimeout(() => renderQuestion(qIndex + 1), 450);
  }
}

/* ── Question dots ────────────────────────────────────────────────────────── */
function buildDots() {
  const wrap = $('q-dots');
  wrap.innerHTML = '';
  const total = S.test.questions.length;
  const MAX_DOTS = 20;

  if (total <= MAX_DOTS) {
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className   = 'q-dot';
      d.dataset.idx = i;
      d.title       = `${i + 1}-savol`;
      d.addEventListener('click', () => renderQuestion(i));
      wrap.appendChild(d);
    }
  } else {
    // Show compact dots with ellipsis
    wrap.innerHTML = `<span style="font-size:12px;color:var(--text-3)">${total} ta savol</span>`;
  }
}

function updateDots(currentIndex) {
  document.querySelectorAll('.q-dot').forEach(d => {
    const i = parseInt(d.dataset.idx);
    d.classList.remove('current', 'answered');
    if (i === currentIndex)             d.classList.add('current');
    else if (S.test.answers[i] != null) d.classList.add('answered');
  });
}

/* ── Timer ────────────────────────────────────────────────────────────────── */
function startTimer() {
  clearInterval(S.test.timerHandle);
  const timerEl = $('timer-value');
  timerEl.className = 'timer-value';

  S.test.timerHandle = setInterval(() => {
    S.test.remainSeconds--;

    timerEl.textContent = fmtTime(Math.max(0, S.test.remainSeconds));

    if (S.test.remainSeconds <= 300 && S.test.remainSeconds > 60) {
      timerEl.className = 'timer-value warning';
    } else if (S.test.remainSeconds <= 60) {
      timerEl.className = 'timer-value danger';
    }

    if (S.test.remainSeconds <= 0) {
      clearInterval(S.test.timerHandle);
      submitTest('timeout');
    }
  }, 1000);
}

/* ── Heartbeat ────────────────────────────────────────────────────────────── */
function startHeartbeat() {
  clearInterval(S.test.heartbeatHandle);
  S.test.heartbeatHandle = setInterval(() => {
    fetch(S.cfg.serverUrl + '/test/heartbeat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${S.token}` },
    }).catch(() => {});
  }, 10_000);
}

/* ── Keypress tracking ────────────────────────────────────────────────────── */
function onTestKeyDown() {
  wsSend({ type: 'keypress' });
}

/* ── Cleanup ──────────────────────────────────────────────────────────────── */
function clearTest() {
  clearInterval(S.test.timerHandle);
  clearInterval(S.test.heartbeatHandle);
  document.removeEventListener('keydown', onTestKeyDown);
}

/* ── Submit ───────────────────────────────────────────────────────────────── */
function trySubmitTest() {
  const answered  = Object.keys(S.test.answers).length;
  const total     = S.test.questions.length;
  const remaining = total - answered;

  if (remaining > 0) {
    $('confirm-modal-body').textContent =
      `${remaining} ta savolga javob berilmadi. Shunga qaramasdan topshirmoqchimisiz?`;
    $('confirm-modal').classList.remove('hidden');
  } else {
    submitTest('manual');
  }
}

async function submitTest(reason = 'manual') {
  clearTest();

  const answers = Object.entries(S.test.answers).map(([qIdx, optIdx]) => ({
    questionIndex: parseInt(qIdx),
    selectedOption: optIdx,
  }));

  try {
    const data = await POST('/test/submit',
      { sessionId: S.test.sessionId, answers }, S.token);
    showResults(data);
  } catch(e) {
    toast(e.message || 'Topshirishda xato.', 'error');
    // Still show results with whatever we know
    showResults({ score: 0, correctAnswers: 0, wrongAnswers: S.test.questions.length,
                  timeUsed: S.test.totalSeconds - S.test.remainSeconds });
  }
}

/* ── Nav buttons ──────────────────────────────────────────────────────────── */
function initTestNav() {
  $('btn-prev').addEventListener('click', () => {
    if (S.test.currentIndex > 0) renderQuestion(S.test.currentIndex - 1);
  });
  $('btn-next').addEventListener('click', () => {
    const total = S.test.questions.length;
    if (S.test.currentIndex < total - 1) renderQuestion(S.test.currentIndex + 1);
  });
  $('btn-submit-test').addEventListener('click', trySubmitTest);

  // Confirm modal
  $('btn-confirm-cancel').addEventListener('click', () =>
    $('confirm-modal').classList.add('hidden'));
  $('btn-confirm-ok').addEventListener('click', () => {
    $('confirm-modal').classList.add('hidden');
    submitTest('manual');
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   RESULTS SCREEN
══════════════════════════════════════════════════════════════════════════ */
function showResults(data) {
  showScreen('results');

  const score   = data.score         || 0;
  const correct = data.correctAnswers || 0;
  const wrong   = data.wrongAnswers   || 0;
  const timeSec = data.timeUsed       || 0;

  $('score-pct').textContent    = `${score}%`;
  $('stat-correct').textContent = correct;
  $('stat-wrong').textContent   = wrong;
  $('stat-time').textContent    = Math.round(timeSec / 60);

  // Use threshold from server response (or fall back to test session threshold)
  const thr    = data.passingThreshold || S.test?.passingThreshold || { thresholdType: 'percent', thresholdValue: 60 };
  const passed = data.passed !== undefined
    ? data.passed
    : (thr.thresholdType === 'count'
        ? correct >= thr.thresholdValue
        : score   >= thr.thresholdValue);

  // Threshold label shown under result
  const thrLabel = thr.thresholdType === 'count'
    ? `O'tish uchun: ${thr.thresholdValue} ta to'g'ri javob`
    : `O'tish uchun: ${thr.thresholdValue}% dan yuqori ball`;

  $('results-title').textContent = passed ? 'Muvaffaqiyatli! 🎉' : 'O\'tilmadi';
  $('results-sub').textContent   = passed
    ? `${score}% ball to'pladingiz — zo'r natija!`
    : `${score}% — ${thrLabel}.`;

  // Animate ring
  const circumference = 326.73;
  const fill = $('ring-fill');
  fill.style.strokeDashoffset = circumference; // reset
  fill.style.stroke = passed ? '#10B981' : '#EF4444';

  requestAnimationFrame(() => {
    setTimeout(() => {
      fill.style.strokeDashoffset = circumference * (1 - score / 100);
    }, 100);
  });
}

function initResults() {
  $('btn-next-subject').addEventListener('click', goToSubjects);
}

function initFinishExam() {
  const btn = $('btn-finish-exam');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Logout student — clear state, go to login
    if (S.ws) { try { S.ws.close(); } catch(_) {} S.ws = null; }
    S.token = null;
    S.user  = null;
    S.subjects = [];
    showScreen('login');
    // Clear inputs
    const u = $('inp-username'); if (u) u.value = '';
    const p = $('inp-password'); if (p) p.value = '';
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   THEME (kun/tun rejimi)
══════════════════════════════════════════════════════════════════════════ */
function initTheme() {
  const saved  = localStorage.getItem('examTheme') || 'dark';
  if (saved === 'light') document.body.classList.add('light-mode');

  const btn = $('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light-mode');
      localStorage.setItem('examTheme', isLight ? 'light' : 'dark');
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BOOT
══════════════════════════════════════════════════════════════════════════ */
async function boot() {
  // Load config from Electron (or defaults)
  if (window.electronAPI) {
    try {
      const cfg = await window.electronAPI.getConfig();
      if (cfg) Object.assign(S.cfg, cfg);
    } catch(_) {}
  }

  // Init theme toggle
  initTheme();

  // Init all screens
  initLogin();
  initProfile();
  initTestNav();
  initResults();
  initFinishExam();

  // Show login
  showScreen('login');
}

document.addEventListener('DOMContentLoaded', boot);
