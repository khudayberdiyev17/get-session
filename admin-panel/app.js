// ── Config ───────────────────────────────────────────────
const _host = window.location.hostname || 'localhost';
const API_BASE_URL = (_host === 'localhost' || _host === '127.0.0.1' || _host === '')
    ? 'http://localhost:3000/api'
    : `http://${_host}:3000/api`;

let authToken = localStorage.getItem('adminToken');
let currentUser = null;
let allUsers = [];
let allBlocked = [];
let allResults = [];
let adminWs = null;

// ── Init ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    authToken ? validateToken() : showLogin();
});

// ── Toast notifications ──────────────────────────────────
function showToast(message, type = 'info') {
    const colors = {
        success: 'bg-emerald-600',
        error:   'bg-red-600',
        warning: 'bg-amber-500',
        info:    'bg-blue-600',
    };
    const icons = {
        success: 'fa-circle-check',
        error:   'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info:    'fa-circle-info',
    };

    const toast = document.createElement('div');
    toast.className = `toast pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info} text-base"></i><span>${message}</span>`;

    const container = document.getElementById('toastContainer');
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Confirm dialog ───────────────────────────────────────
function showConfirm(message, onConfirm) {
    const overlay = document.getElementById('confirmOverlay');
    document.getElementById('confirmMessage').textContent = message;
    overlay.classList.remove('hidden');

    const yesBtn = document.getElementById('confirmYes');
    const noBtn  = document.getElementById('confirmNo');
    const close  = () => overlay.classList.add('hidden');

    const yesHandler = () => { close(); onConfirm(); cleanup(); };
    const noHandler  = () => { close(); cleanup(); };
    const cleanup    = () => {
        yesBtn.removeEventListener('click', yesHandler);
        noBtn.removeEventListener('click', noHandler);
    };

    yesBtn.addEventListener('click', yesHandler);
    noBtn.addEventListener('click', noHandler);
}

// ── Auth ─────────────────────────────────────────────────
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn      = document.getElementById('loginBtn');
    const errEl    = document.getElementById('loginError');
    const errText  = document.getElementById('loginErrorText');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Kirish...</span>';

    try {
        const res = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.message || 'Login muvaffaqiyatsiz');

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('adminToken', authToken);
        showDashboard();
    } catch (err) {
        errText.textContent = err.message;
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Kirish</span><i class="fas fa-arrow-right"></i>';
    }
});

async function validateToken() {
    try {
        const res = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
            showDashboard();
        } else {
            throw new Error('Token yaroqsiz');
        }
    } catch {
        localStorage.removeItem('adminToken');
        authToken = null;
        showLogin();
    }
}

function showLogin() {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('dashboardPage').classList.remove('hidden');
    if (currentUser) {
        const name = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'Admin';
        document.getElementById('adminName').textContent = name;
        document.getElementById('sidebarAdminName').textContent = name;
    }
    loadDashboardData();
    connectAdminWS();
}

// ── Admin WebSocket (real-time test results) ─────────────
function connectAdminWS() {
    if (adminWs && adminWs.readyState === WebSocket.OPEN) return;

    const wsHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.location.hostname)
        ? 'localhost'
        : window.location.hostname;
    const wsUrl  = `ws://${wsHost}:3000`;

    try {
        adminWs = new WebSocket(wsUrl);

        adminWs.onopen = () => {
            adminWs.send(JSON.stringify({ type: 'auth', role: 'admin', token: authToken }));
        };

        adminWs.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'test_completed') {
                    handleRealtimeResult(msg);
                }
            } catch {}
        };

        adminWs.onclose = () => {
            // Reconnect after 5s
            setTimeout(() => { if (authToken) connectAdminWS(); }, 5000);
        };

        adminWs.onerror = () => {};
    } catch {}
}

function handleRealtimeResult(msg) {
    const student = msg.student || {};
    const name    = [student.firstName, student.lastName].filter(Boolean).join(' ') || student.username || '?';
    const passed  = msg.passed;
    const score   = msg.score ?? '?';

    showToast(
        `${name}: ${score}% — ${passed ? "O'tdi ✓" : "O'tmadi ✗"}`,
        passed ? 'success' : 'warning'
    );

    // Update results badge
    const badge = document.getElementById('resultsBadge');
    if (badge) {
        const cur = parseInt(badge.textContent) || 0;
        badge.textContent = cur + 1;
        badge.classList.remove('hidden');
    }

    // If results section is open, prepend row
    const section = document.getElementById('section-results');
    if (section && !section.classList.contains('hidden')) {
        loadExamResults();
    }

    // Update dashboard testsCompleted counter
    const el = document.getElementById('testsCompleted');
    if (el && el.textContent !== '—') {
        el.textContent = (parseInt(el.textContent) || 0) + 1;
    }
}

// ── Admin profil / parol o'zgartirish ───────────────────────────────────
function openProfileModal() {
    document.getElementById('profileForm').reset();
    document.getElementById('profileFormError').classList.add('hidden');
    document.getElementById('profileSubmitBtn').disabled = false;
    document.getElementById('profileSubmitBtn').textContent = 'Saqlash';
    document.getElementById('profileModal').classList.remove('hidden');
}

function closeProfileModal() {
    document.getElementById('profileModal').classList.add('hidden');
}

function togglePwd(inputId) {
    const inp = document.getElementById(inputId);
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function submitProfileForm(e) {
    e.preventDefault();
    const errEl     = document.getElementById('profileFormError');
    const submitBtn = document.getElementById('profileSubmitBtn');
    errEl.classList.add('hidden');

    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword     = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 6) {
        errEl.textContent = 'Yangi parol kamida 6 ta belgidan iborat bo\'lsin';
        errEl.classList.remove('hidden'); return;
    }
    if (newPassword !== confirmPassword) {
        errEl.textContent = 'Yangi parollar mos kelmaydi';
        errEl.classList.remove('hidden'); return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Saqlanmoqda...';

    try {
        const res = await apiFetch('/admin/profile', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.error || 'Xato yuz berdi';
            errEl.classList.remove('hidden');
            return;
        }
        closeProfileModal();
        showToast('Parol muvaffaqiyatli o\'zgartirildi', 'success');
    } catch (err) {
        errEl.textContent = err.message || 'Xato yuz berdi';
        errEl.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Saqlash';
    }
}

function logout() {
    showConfirm('Tizimdan chiqmoqchimisiz?', () => {
        if (adminWs) { try { adminWs.close(); } catch(_) {} adminWs = null; }
        localStorage.removeItem('adminToken');
        authToken = null;
        currentUser = null;
        showLogin();
    });
}

// ── API helper ───────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const res = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });
    if (res.status === 401) {
        showToast('Sessiya tugadi. Qayta kiring.', 'warning');
        logout();
        throw new Error('Unauthorized');
    }
    return res;
}

// ── Navigation ───────────────────────────────────────────
function showSection(section) {
    ['dashboard', 'subjects', 'users', 'blocked', 'results', 'reports'].forEach(s => {
        document.getElementById(`section-${s}`)?.classList.add('hidden');
        document.getElementById(`nav-${s}`)?.classList.remove('active');
    });
    document.getElementById(`section-${section}`)?.classList.remove('hidden');
    document.getElementById(`nav-${section}`)?.classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        subjects:  'Fanlar',
        users:     'Foydalanuvchilar',
        blocked:   'Bloklangan foydalanuvchilar',
        results:   'Imtihon natijalari',
        reports:   'Hisobotlar'
    };
    document.getElementById('pageTitle').textContent = titles[section] || section;

    closeSidebar();

    switch (section) {
        case 'dashboard': loadDashboardData(); break;
        case 'subjects':  loadSubjects(); break;
        case 'users':     loadUsers(); break;
        case 'blocked':   loadBlockedUsers(); break;
        case 'results':   loadExamResults(); break;
        case 'reports':   loadReports(); break;
    }
}

// ── Sidebar (mobile) ─────────────────────────────────────
function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    const isHidden = sidebar.classList.contains('-translate-x-full');
    sidebar.classList.toggle('-translate-x-full', !isHidden);
    overlay.classList.toggle('hidden', !isHidden);
}
function closeSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.add('hidden');
}

// ── Password toggle ──────────────────────────────────────
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon  = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

// ── Dashboard ────────────────────────────────────────────
async function loadDashboardData() {
    try {
        const [usersRes, subjectsRes, resultsRes] = await Promise.all([
            apiFetch('/users'),
            apiFetch('/subjects/admin'),
            apiFetch('/users/results')
        ]);
        const users    = await usersRes.json();
        const subjects = await subjectsRes.json();
        const results  = resultsRes.ok ? await resultsRes.json() : [];

        animateCount('totalStudents', users.length);
        animateCount('totalSubjects', subjects.length);

        const blocked = users.filter(u => u.status === 'blocked');
        animateCount('blockedCount', blocked.length);
        animateCount('testsCompleted', results.length);

        const badge = document.getElementById('blockedBadge');
        if (blocked.length > 0) {
            badge.textContent = blocked.length;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }

        const activity = document.getElementById('recentActivity');
        if (blocked.length > 0) {
            activity.innerHTML = blocked.slice(0, 5).map(u => {
                const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
                return `
                <div class="flex items-center justify-between px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 bg-red-200 rounded-full flex items-center justify-center text-red-700 text-xs font-bold flex-shrink-0">
                            ${escHtml(name[0] || '?').toUpperCase()}
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-slate-800">${escHtml(name)}</p>
                            <p class="text-xs text-slate-500 font-mono">${escHtml(u.username)}</p>
                        </div>
                    </div>
                    <span class="text-xs text-slate-400 flex-shrink-0 ml-2">
                        ${u.blockedAt ? new Date(u.blockedAt).toLocaleDateString('uz-UZ') : ''}
                    </span>
                </div>`;
            }).join('');
        } else {
            activity.innerHTML = '<p class="text-slate-400 text-sm text-center py-4">Hozircha bloklangan foydalanuvchilar yo\'q</p>';
        }
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            showToast('Dashboard ma\'lumotlarini yuklashda xato', 'error');
        }
    }
}

function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    let current = 0;
    const step = Math.ceil(target / 20) || 1;
    const interval = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = current;
        if (current >= target) clearInterval(interval);
    }, 40);
}

// ── Subjects ─────────────────────────────────────────────
async function loadSubjects() {
    const container = document.getElementById('subjectsList');
    container.innerHTML = [1,2,3].map(() =>
        `<div class="skeleton h-40 w-full rounded-2xl"></div>`).join('');

    try {
        const res      = await apiFetch('/subjects/admin');
        const subjects = await res.json();

        document.getElementById('subjectsCount').textContent = `${subjects.length} ta fan`;

        if (subjects.length === 0) {
            container.innerHTML = `<div class="col-span-3 text-center py-12 text-slate-400">
                <i class="fas fa-book text-3xl mb-2"></i><p class="text-sm">Hali fan qo'shilmagan</p>
            </div>`;
            return;
        }

        container.innerHTML = subjects.map(s => `
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition">
                <div class="flex items-start justify-between gap-2">
                    <div>
                        <h3 class="font-bold text-slate-800">${escHtml(s.name)}</h3>
                        <p class="text-slate-500 text-xs mt-0.5 line-clamp-2">${escHtml(s.description || 'Tavsif yo\'q')}</p>
                    </div>
                </div>
                <div class="flex gap-3 text-xs text-slate-500 mt-auto flex-wrap">
                    <span class="flex items-center gap-1">
                        <i class="fas fa-clock text-slate-300"></i>${s.totalTimeLimit} daqiqa
                    </span>
                    <span class="flex items-center gap-1">
                        <i class="fas fa-question-circle text-slate-300"></i>${(s.questions || []).length} savol
                    </span>
                    <span class="flex items-center gap-1 text-emerald-600 font-medium">
                        <i class="fas fa-check-circle text-emerald-300"></i>${
                            s.passingThreshold?.thresholdType === 'count'
                                ? `${s.passingThreshold.thresholdValue} ta to'g'ri`
                                : `${s.passingThreshold?.thresholdValue ?? 60}% dan yuqori`
                        }
                    </span>
                </div>
                <div class="flex gap-2 pt-1 border-t border-slate-100">
                    <button onclick="editSubject('${s._id}')"
                        class="flex-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 py-1.5 rounded-lg transition flex items-center justify-center gap-1">
                        <i class="fas fa-pen-to-square"></i>Tahrirlash
                    </button>
                    <button onclick="deleteSubject('${s._id}', '${escHtml(s.name)}')"
                        class="flex-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 py-1.5 rounded-lg transition flex items-center justify-center gap-1">
                        <i class="fas fa-trash"></i>O'chirish
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Fanlarni yuklashda xato', 'error');
    }
}

function openSubjectModal() {
    document.getElementById('subjectForm').reset();
    document.getElementById('subjectId').value = '';
    document.getElementById('subjectModalTitle').textContent = 'Fan qo\'shish';
    document.getElementById('questionsContainer').innerHTML = '';
    // Reset threshold to defaults
    const typeEl = document.getElementById('subjectThresholdType');
    const valEl  = document.getElementById('subjectThresholdValue');
    if (typeEl) typeEl.value = 'percent';
    if (valEl)  valEl.value  = '60';
    updateThresholdHint();
    // Reset docx input
    const docxInput = document.getElementById('docxImportInput');
    if (docxInput) docxInput.value = '';
    document.getElementById('subjectModal').classList.remove('hidden');
}

function updateThresholdHint() {
    const typeEl = document.getElementById('subjectThresholdType');
    const valEl  = document.getElementById('subjectThresholdValue');
    const hint   = document.getElementById('thresholdHint');
    if (!typeEl || !valEl || !hint) return;

    const type = typeEl.value;
    const val  = parseInt(valEl.value) || 0;
    const qCount = document.getElementById('questionsContainer')?.children.length || 0;

    if (val <= 0) { hint.textContent = ''; return; }

    if (type === 'percent') {
        const needed = qCount > 0 ? Math.ceil(qCount * val / 100) : null;
        hint.textContent = needed !== null
            ? `${val}% → ${qCount} ta savoldan kamida ${needed} ta to'g'ri javob berilsa o'tadi`
            : `${val}% dan yuqori ball to'plasa o'tadi`;
    } else {
        const pct = qCount > 0 ? Math.round(val * 100 / qCount) : null;
        hint.textContent = pct !== null
            ? `${val} ta to'g'ri javob → ${qCount} savoldan (≈${pct}%) to'plasa o'tadi`
            : `${val} ta to'g'ri javob berilsa o'tadi`;
    }
}

function closeSubjectModal() {
    document.getElementById('subjectModal').classList.add('hidden');
}

// ── Question field with image upload ────────────────────
function addQuestionField(q = null) {
    const container = document.getElementById('questionsContainer');
    const idx       = container.children.length;
    const imgData   = q?.imageBase64 || null;

    const div = document.createElement('div');
    div.className = 'border border-slate-200 rounded-xl p-4 bg-slate-50 relative';

    const imgPreview = imgData
        ? `<img src="${imgData}" class="mt-2 max-h-32 rounded-lg object-contain border border-slate-200">`
        : '';

    div.innerHTML = `
        <button type="button" onclick="this.closest('.border').remove()"
            class="absolute top-3 right-3 text-xs text-red-400 hover:text-red-600">
            <i class="fas fa-times"></i>
        </button>
        <p class="text-xs font-bold text-slate-500 uppercase mb-2">Savol ${idx + 1}</p>
        <div class="mb-3">
            <input type="text" name="questionText[]" required placeholder="Savol matni"
                value="${escHtml(q?.text || '')}"
                class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
        </div>
        <!-- Image upload -->
        <div class="mb-3">
            <label class="text-xs font-semibold text-slate-500 mb-1 block">Rasm (ixtiyoriy)</label>
            <div class="flex items-center gap-2">
                <label class="cursor-pointer text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition flex items-center gap-1">
                    <i class="fas fa-image"></i>Rasm tanlash
                    <input type="file" accept="image/*" class="hidden question-image-input" onchange="previewQuestionImage(this)">
                </label>
                <button type="button" onclick="clearQuestionImage(this)" class="text-xs text-slate-400 hover:text-red-500 transition hidden clear-img-btn">
                    <i class="fas fa-times-circle"></i> O'chirish
                </button>
            </div>
            <div class="question-image-preview mt-2">${imgPreview}</div>
            <input type="hidden" name="imageBase64[]" value="${imgData ? escHtml(imgData) : ''}">
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
            ${['A','B','C','D'].map((letter, li) => `
                <div>
                    <label class="text-xs font-semibold text-slate-500 mb-0.5 block">Variant ${letter}</label>
                    <input type="text" name="option${letter}[]" required placeholder="${letter}"
                        value="${escHtml(q?.options?.[li] || '')}"
                        class="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                </div>
            `).join('')}
        </div>
        <div>
            <label class="text-xs font-semibold text-slate-500 mb-0.5 block">To'g'ri javob</label>
            <select name="correctIndex[]"
                class="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                ${['A','B','C','D'].map((l, li) =>
                    `<option value="${li}" ${q?.correctIndex === li ? 'selected' : ''}>${l}</option>`
                ).join('')}
            </select>
        </div>
    `;
    container.appendChild(div);

    // Show clear button if image exists
    if (imgData) {
        div.querySelector('.clear-img-btn').classList.remove('hidden');
    }
}

function previewQuestionImage(input) {
    if (!input.files || !input.files[0]) return;
    const file   = input.files[0];
    const wrapper  = input.closest('.mb-3');
    const preview  = wrapper.querySelector('.question-image-preview');
    const hidden   = wrapper.querySelector('input[name="imageBase64[]"]');
    const clearBtn = wrapper.querySelector('.clear-img-btn');

    // Rasmni o'qib, canvas orqali siqamiz (maks 900px, JPEG 80%)
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const MAX = 900;
            let w = img.width, h = img.height;
            if (w > MAX || h > MAX) {
                if (w >= h) { h = Math.round(h * MAX / w); w = MAX; }
                else        { w = Math.round(w * MAX / h); h = MAX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            const compressed = canvas.toDataURL('image/jpeg', 0.80);

            preview.innerHTML = `<img src="${compressed}" class="mt-2 max-h-32 rounded-lg object-contain border border-slate-200">`;
            hidden.value = compressed;
            clearBtn.classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function clearQuestionImage(btn) {
    const wrapper  = btn.closest('.mb-3');
    const preview  = wrapper.querySelector('.question-image-preview');
    const hidden   = wrapper.querySelector('input[name="imageBase64[]"]');
    const fileInput = wrapper.querySelector('.question-image-input');
    preview.innerHTML = '';
    hidden.value = '';
    if (fileInput) fileInput.value = '';
    btn.classList.add('hidden');
}

// ── DOCX import ──────────────────────────────────────────
async function importFromDocx(input) {
    if (!input.files || !input.files[0]) return;

    const progress = document.getElementById('docxProgress');
    progress.classList.remove('hidden');

    try {
        const arrayBuffer = await input.files[0].arrayBuffer();
        const result      = await mammoth.extractRawText({ arrayBuffer });
        const text        = result.value;

        const { questions, noMarkCount } = parseDocxQuestions(text);
        if (questions.length === 0) {
            showToast('Savollar topilmadi. Format: "1. Savol A) variant B) variant C) to\'g\'ri* D) variant"', 'warning');
            return;
        }

        questions.forEach(q => addQuestionField(q));

        if (noMarkCount > 0) {
            showToast(
                `${questions.length} ta savol import qilindi` +
                ` (${noMarkCount} tasida to\'g\'ri javob * bilan belgilanmagan — 1-variant default qilib qo\'yildi)`,
                'warning'
            );
        } else {
            showToast(`${questions.length} ta savol import qilindi`, 'success');
        }
    } catch (err) {
        showToast('DOCX o\'qishda xato: ' + err.message, 'error');
    } finally {
        progress.classList.add('hidden');
        input.value = '';
    }
}

// ── DOCX / plain-text question parser (lenient mode) ─────────────────────
//
// Qo'llab-quvvatlangan formatlar:
//   Raqam:    1.  1)  1-  1:  1   (istalgan ajratgich yoki bo'sh joy)
//   Variant:  A)  A.  a)  a.  (katta/kichik harf, ) yoki .)
//   To'g'ri:  variant matnidan KEYIN yoki OLDIN *  (1.opA* B) yoki *A) opt)
//   Inline:   1.Savol A)opt B)opt C)opt D)opt  (bo'sh joysiz ham ishlaydi)
//   Ko'p qator: savol bir qatorda, variantlar keyingi qatorlarda
//   Raqamsiz: Savol A) ... D) ...  (raqam yo'q bo'lsa ham import qilinadi)
//   * yo'q:   to'g'ri javob belgilanmagan bo'lsa — 1-variant default

// Inline parser: A) B) C) D) ni pozitsiya bo'yicha topadi
function parseInlineQuestion(raw) {
    const content = raw.replace(/^\*/, '').trim(); // boshi * bo'lsa olib tash
    const positions = [];
    let from = 0;
    for (const l of ['A', 'B', 'C', 'D']) {
        const re = new RegExp(l + '[).]', 'i');   // A) va A. ikkalasini topadi
        const idx = content.slice(from).search(re);
        if (idx < 0) return null;
        positions.push(from + idx);
        from = from + idx + 2;
    }
    const [a, b, c, d] = positions;

    // Savol matni = A) dan oldingi qism, raqam prefiksini olib tashlash
    const qText = content.slice(0, a).replace(/^\d+[\W]+\s*/, '').trim();
    if (!qText) return null;

    const rawOpts = [
        content.slice(a + 2, b).trim(),
        content.slice(b + 2, c).trim(),
        content.slice(c + 2, d).trim(),
        content.slice(d + 2).trim(),
    ];

    let correctIndex = -1;
    const cleanOpts = rawOpts.map((o, i) => {
        let s = o.replace(/\s+/g, ' ').trim();
        if (s.endsWith('*'))    { correctIndex = i; s = s.slice(0, -1).trim(); }
        else if (s.startsWith('*')) { correctIndex = i; s = s.slice(1).trim(); }
        return s;
    });

    if (cleanOpts.some(o => !o)) return null;
    return {
        text: qText,
        options: cleanOpts,
        correctIndex: correctIndex < 0 ? 0 : correctIndex,
        noMark: correctIndex < 0,   // to'g'ri javob belgilanmagan
        imageBase64: null
    };
}

function parseDocxQuestions(text) {
    const questions = [];
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    let current = null;
    let noMarkCount = 0;

    const pushCurrent = () => {
        if (current && current.text && current.options.filter(Boolean).length === 4)
            questions.push(current);
        current = null;
    };

    for (const line of lines) {
        // Raqamli savol: 1. yoki 1) yoki 1- yoki 1: yoki "1 " (bo'sh joy ham)
        const qMatch = line.match(/^(\d+)[.):\-\s]\s*(.+)/);

        if (!qMatch) {
            // Raqamsiz satr: agar A)...D) bo'lsa inline sifatida sinab ko'r
            const inlineParsed = parseInlineQuestion(line);
            if (inlineParsed && !current) {
                if (inlineParsed.noMark) noMarkCount++;
                questions.push(inlineParsed);
                continue;
            }

            // Ko'p qatorli format: variant qatori
            if (current) {
                // *A) yoki A) yoki A. (yulduzcha oldin ham bo'lishi mumkin)
                const m = line.match(/^(\*?)([A-Da-d])[).]\s*(.*)/);
                if (m) {
                    const letter    = m[2].toUpperCase();
                    const starBefore = m[1] === '*';
                    let   value     = m[3].trim();
                    const starAfter = value.endsWith('*');
                    if (starAfter) value = value.slice(0, -1).trim();
                    const idx = 'ABCD'.indexOf(letter);
                    if (idx >= 0) {
                        current.options[idx] = value;
                        if (starBefore || starAfter) current.correctIndex = idx;
                    }
                }
            }
            continue;
        }

        pushCurrent();
        const content = qMatch[2].trim();

        // Avval inline ko'rinishni sinab ko'r
        const inlineParsed = parseInlineQuestion(content);
        if (inlineParsed) {
            if (inlineParsed.noMark) noMarkCount++;
            questions.push(inlineParsed);
            current = null;
            continue;
        }

        // Ko'p qatorli format
        current = { text: content, options: ['', '', '', ''], correctIndex: 0, imageBase64: null };
    }

    pushCurrent();

    const valid = questions.filter(q => q.text && q.options.filter(Boolean).length === 4);
    return { questions: valid, noMarkCount };
}

document.getElementById('subjectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const subjectId      = document.getElementById('subjectId').value;
    const name           = document.getElementById('subjectName').value;
    const description    = document.getElementById('subjectDescription').value;
    const timeLimit      = parseInt(document.getElementById('subjectTimeLimit').value);
    const thresholdType  = document.getElementById('subjectThresholdType')?.value  || 'percent';
    const thresholdValue = parseInt(document.getElementById('subjectThresholdValue')?.value) || 60;

    const questionTexts = document.getElementsByName('questionText[]');
    const questions = [];
    for (let i = 0; i < questionTexts.length; i++) {
        questions.push({
            text: questionTexts[i].value,
            options: [
                document.getElementsByName('optionA[]')[i].value,
                document.getElementsByName('optionB[]')[i].value,
                document.getElementsByName('optionC[]')[i].value,
                document.getElementsByName('optionD[]')[i].value
            ],
            correctIndex: parseInt(document.getElementsByName('correctIndex[]')[i].value),
            timeLimit: 60,
            imageBase64: document.getElementsByName('imageBase64[]')[i]?.value || null
        });
    }

    try {
        const url    = subjectId ? `/subjects/${subjectId}` : '/subjects';
        const method = subjectId ? 'PUT' : 'POST';
        const res    = await apiFetch(url, { method, body: JSON.stringify({
            name, description, totalTimeLimit: timeLimit,
            passingThreshold: { thresholdType, thresholdValue },
            questions
        }) });

        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.error || 'Xato yuz berdi');
        }
        closeSubjectModal();
        loadSubjects();
        showToast(subjectId ? 'Fan yangilandi' : 'Fan qo\'shildi', 'success');
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast(err.message, 'error');
    }
});

async function editSubject(id) {
    try {
        const res      = await apiFetch('/subjects/admin');
        const subjects = await res.json();
        const s        = subjects.find(x => x._id === id);
        if (!s) return;

        document.getElementById('subjectId').value          = s._id;
        document.getElementById('subjectName').value        = s.name;
        document.getElementById('subjectDescription').value = s.description || '';
        document.getElementById('subjectTimeLimit').value   = s.totalTimeLimit;
        document.getElementById('subjectModalTitle').textContent = 'Fanni tahrirlash';

        // Threshold
        const typeEl = document.getElementById('subjectThresholdType');
        const valEl  = document.getElementById('subjectThresholdValue');
        if (typeEl) typeEl.value = s.passingThreshold?.thresholdType  || 'percent';
        if (valEl)  valEl.value  = s.passingThreshold?.thresholdValue ?? 60;
        updateThresholdHint();

        const container = document.getElementById('questionsContainer');
        container.innerHTML = '';
        (s.questions || []).forEach(q => addQuestionField(q));

        document.getElementById('subjectModal').classList.remove('hidden');
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Fanni yuklashda xato', 'error');
    }
}

async function deleteSubject(id, name) {
    showConfirm(`"${name}" fanini o'chirishni xohlaysizmi?`, async () => {
        try {
            const res = await apiFetch(`/subjects/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('O\'chirishda xato');
            loadSubjects();
            showToast('Fan o\'chirildi', 'success');
        } catch (err) {
            if (err.message !== 'Unauthorized') showToast(err.message, 'error');
        }
    });
}

// ── Users ────────────────────────────────────────────────
async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-8 text-center text-slate-400 text-sm">
        <i class="fas fa-spinner fa-spin mr-2"></i>Yuklanmoqda...</td></tr>`;

    try {
        const res = await apiFetch('/users');
        allUsers  = await res.json();
        renderUsers(allUsers);
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Foydalanuvchilarni yuklashda xato', 'error');
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="px-5 py-8 text-center text-slate-400 text-sm">Foydalanuvchilar topilmadi</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
        const subjects = (u.subjects || []).join(', ') || '—';
        return `
        <tr class="hover:bg-slate-50 transition">
            <td class="px-5 py-3.5">
                ${fullName
                    ? `<p class="text-sm font-medium text-slate-800">${escHtml(fullName)}</p>
                       <p class="text-xs font-mono text-slate-400">${escHtml(u.username)}</p>`
                    : `<p class="text-sm font-mono text-slate-700">${escHtml(u.username)}</p>`
                }
            </td>
            <td class="px-5 py-3.5 text-sm text-slate-600 hidden md:table-cell">${escHtml(subjects)}</td>
            <td class="px-5 py-3.5">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                    ${u.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'}">
                    <i class="fas ${u.status === 'active' ? 'fa-circle-check' : 'fa-ban'} text-[10px]"></i>
                    ${u.status === 'active' ? 'Faol' : 'Bloklangan'}
                </span>
            </td>
            <td class="px-5 py-3.5 text-right">
                <div class="flex items-center justify-end gap-2">
                    <button onclick="viewUserHistory('${u._id}')" title="Tarix"
                        class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center text-xs transition">
                        <i class="fas fa-clock-rotate-left"></i>
                    </button>
                    <button onclick="editUser('${u._id}')" title="Tahrirlash"
                        class="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition">
                        <i class="fas fa-pen"></i>
                    </button>
                    ${u.status === 'active'
                        ? `<button onclick="blockUser('${u._id}', '${escHtml(fullName || u.username)}')" title="Bloklash"
                               class="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center text-xs transition">
                               <i class="fas fa-ban"></i></button>`
                        : `<button onclick="unblockUser('${u._id}', '${escHtml(fullName || u.username)}')" title="Blokdan chiqarish"
                               class="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs transition">
                               <i class="fas fa-check"></i></button>`
                    }
                    <button onclick="deleteUserConfirm('${u._id}', '${escHtml(fullName || u.username)}')" title="O'chirish"
                        class="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center text-xs transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function filterUsers() {
    const q = document.getElementById('userSearch').value.toLowerCase();
    renderUsers(allUsers.filter(u =>
        `${u.firstName || ''} ${u.lastName || ''} ${u.username} ${(u.subjects || []).join(' ')}`
            .toLowerCase().includes(q)
    ));
}

// ── Subjects checkbox list in user modal ─────────────────
async function populateSubjectsCheckboxes(selectedSubjects = []) {
    const container = document.getElementById('subjectsCheckboxList');
    container.innerHTML = '<div class="px-3 py-3 text-sm text-slate-400">Yuklanmoqda...</div>';

    try {
        const res      = await apiFetch('/subjects/admin');
        const subjects = await res.json();

        if (subjects.length === 0) {
            container.innerHTML = '<div class="px-3 py-3 text-sm text-slate-400">Hali fan qo\'shilmagan</div>';
            return;
        }

        container.innerHTML = subjects.map(s => `
            <label class="flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 cursor-pointer transition select-none">
                <input type="checkbox" name="subjectCheckbox" value="${escHtml(s.name)}"
                    ${selectedSubjects.includes(s.name) ? 'checked' : ''}
                    class="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500">
                <span class="text-sm text-slate-700">${escHtml(s.name)}</span>
            </label>
        `).join('');
    } catch {
        container.innerHTML = '<div class="px-3 py-3 text-sm text-red-400">Fanlar yuklanmadi</div>';
    }
}

function getCheckedSubjects() {
    return Array.from(document.querySelectorAll('input[name="subjectCheckbox"]:checked'))
        .map(cb => cb.value);
}

// ── Auto-generate login / password ────────────────────────
function autoGenLogin() {
    const digits = Math.floor(10000000 + Math.random() * 90000000).toString();
    document.getElementById('userUsername').value = `nis@${digits}`;
}

function autoGenPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    document.getElementById('userPassword').value = pwd;
    // Show hint
    const hint = document.getElementById('generatedPasswordHint');
    hint.textContent = `Yaratilgan parol: ${pwd}`;
    hint.classList.remove('hidden');
}

function openUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').textContent = 'Talaba qo\'shish';
    document.getElementById('userFormError').classList.add('hidden');
    document.getElementById('generatedPasswordHint').classList.add('hidden');
    document.getElementById('userModal').classList.remove('hidden');
    populateSubjectsCheckboxes([]);
}

function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
}

async function editUser(id) {
    const u = allUsers.find(x => x._id === id);
    if (!u) return;

    document.getElementById('userId').value       = u._id;
    document.getElementById('userUsername').value = u.username;
    document.getElementById('userPassword').value = '';
    document.getElementById('userModalTitle').textContent = 'Foydalanuvchini tahrirlash';
    document.getElementById('userFormError').classList.add('hidden');
    document.getElementById('generatedPasswordHint').classList.add('hidden');
    document.getElementById('userModal').classList.remove('hidden');
    await populateSubjectsCheckboxes(u.subjects || []);
}

document.getElementById('userForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId  = document.getElementById('userId').value;
    const errEl   = document.getElementById('userFormError');
    const saveBtn = document.getElementById('userSaveBtn');

    errEl.classList.add('hidden');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saqlanmoqda...';

    const username = document.getElementById('userUsername').value.trim();
    const subjects = getCheckedSubjects();
    const pwd      = document.getElementById('userPassword').value;

    const userData = { subjects, username };
    if (pwd) userData.password = pwd;

    try {
        const url    = userId ? `/users/${userId}` : '/users';
        const method = userId ? 'PUT' : 'POST';
        const res    = await apiFetch(url, { method, body: JSON.stringify(userData) });
        const data   = await res.json();

        if (!res.ok) throw new Error(data.error || 'Saqlashda xato');

        if (!userId && data.generatedPassword) {
            showToast(`Yaratildi! Login: ${data.user.username} | Parol: ${data.generatedPassword}`, 'success');
        } else {
            showToast(userId ? 'Foydalanuvchi yangilandi' : 'Foydalanuvchi qo\'shildi', 'success');
        }

        closeUserModal();
        loadUsers();
    } catch (err) {
        if (err.message !== 'Unauthorized') {
            errEl.textContent = err.message;
            errEl.classList.remove('hidden');
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Saqlash';
    }
});

async function blockUser(id, name) {
    showConfirm(`${name}ni bloklashni xohlaysizmi?`, async () => {
        try {
            const res = await apiFetch(`/users/${id}/block`, {
                method: 'PUT',
                body: JSON.stringify({ reason: 'admin_blocked', description: 'Admin tomonidan bloklandi' })
            });
            if (!res.ok) throw new Error('Bloklashda xato');
            showToast('Foydalanuvchi bloklandi', 'warning');
            loadUsers();
        } catch (err) {
            if (err.message !== 'Unauthorized') showToast(err.message, 'error');
        }
    });
}

async function unblockUser(id, name) {
    showConfirm(`${name}ni blokdan chiqarishni xohlaysizmi?`, async () => {
        try {
            const res = await apiFetch(`/users/${id}/unblock`, { method: 'PUT' });
            if (!res.ok) throw new Error('Blokdan chiqarishda xato');
            showToast('Foydalanuvchi blokdan chiqarildi', 'success');
            loadUsers();
            loadBlockedUsers();
        } catch (err) {
            if (err.message !== 'Unauthorized') showToast(err.message, 'error');
        }
    });
}

async function deleteUserConfirm(id, name) {
    showConfirm(
        `"${name}" foydalanuvchisini o'chirishni xohlaysizmi? Barcha test natijalari va blok tarixi ham o'chib ketadi.`,
        async () => {
            try {
                const res  = await apiFetch(`/users/${id}`, { method: 'DELETE' });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'O\'chirishda xato');

                const info = data.deleted
                    ? ` (${data.deleted.sessions} natija, ${data.deleted.logs} log o'chirildi)`
                    : '';
                showToast(`Foydalanuvchi o'chirildi${info}`, 'success');

                loadUsers();

                // Agar natijalar bo'limi ochiq bo'lsa yangilash
                const sec = document.getElementById('section-results');
                if (sec && !sec.classList.contains('hidden')) loadExamResults();
            } catch (err) {
                if (err.message !== 'Unauthorized') showToast(err.message, 'error');
            }
        }
    );
}

// ── Blocked Users ────────────────────────────────────────
async function loadBlockedUsers() {
    const tbody = document.getElementById('blockedTableBody');
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-slate-400 text-sm">
        <i class="fas fa-spinner fa-spin mr-2"></i>Yuklanmoqda...</td></tr>`;

    try {
        const res = await apiFetch('/users/blocked');
        allBlocked = await res.json();
        renderBlocked(allBlocked);
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Bloklangan foydalanuvchilarni yuklashda xato', 'error');
    }
}

const BLOCK_REASON_LABELS = {
    excessive_keys:   'Klaviatura — cheating',
    internet_lost:    'Internet uzildi',
    test_interrupted: 'Test to\'xtatildi',
    admin_blocked:    'Admin blokladi',
    websocket_lost:   'Aloqa uzildi',
    rate_limit_exceeded: 'Ko\'p so\'rov'
};

function renderBlocked(users) {
    const tbody = document.getElementById('blockedTableBody');
    if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-5 py-8 text-center text-slate-400 text-sm">
            Bloklangan foydalanuvchilar yo'q</td></tr>`;
        return;
    }
    tbody.innerHTML = users.map(u => {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ');
        const displayName = fullName || u.username;
        const reasonLabel = BLOCK_REASON_LABELS[u.blockReason] || escHtml(u.blockReason || 'Noma\'lum');
        const subjects = (u.completedSubjects || []);
        const subjectsHtml = subjects.length
            ? subjects.map(s => `<span class="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium">${escHtml(s)}</span>`).join(' ')
            : '<span class="text-slate-400 text-xs">—</span>';

        return `
        <tr class="hover:bg-slate-50 transition">
            <td class="px-5 py-3.5">
                ${fullName
                    ? `<p class="text-sm font-semibold text-slate-800">${escHtml(fullName)}</p>
                       <p class="text-xs font-mono text-slate-400">${escHtml(u.username)}</p>`
                    : `<p class="text-sm font-mono text-slate-700">${escHtml(u.username)}</p>`
                }
            </td>
            <td class="px-5 py-3.5 text-sm text-slate-600 hidden sm:table-cell">
                ${escHtml(u.className || '—')}
            </td>
            <td class="px-5 py-3.5 hidden md:table-cell">
                <div class="flex flex-wrap gap-1">${subjectsHtml}</div>
            </td>
            <td class="px-5 py-3.5">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-semibold whitespace-nowrap">
                    <i class="fas fa-ban text-[9px]"></i>${reasonLabel}
                </span>
                ${u.blockDescription ? `<p class="text-xs text-slate-400 mt-0.5 max-w-[180px] truncate" title="${escHtml(u.blockDescription)}">${escHtml(u.blockDescription)}</p>` : ''}
            </td>
            <td class="px-5 py-3.5 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">
                ${u.blockedAt ? new Date(u.blockedAt).toLocaleString('uz-UZ') : '—'}
            </td>
            <td class="px-5 py-3.5 text-right">
                <button onclick="unblockUser('${u._id}', '${escHtml(displayName)}')"
                    class="text-xs font-semibold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ml-auto whitespace-nowrap">
                    <i class="fas fa-unlock text-[10px]"></i>Blokdan chiqar
                </button>
            </td>
        </tr>`;
    }).join('');
}

function filterBlocked() {
    const q = document.getElementById('blockedSearch').value.toLowerCase();
    renderBlocked(allBlocked.filter(u =>
        `${u.firstName || ''} ${u.lastName || ''} ${u.username} ${u.blockReason || ''} ${u.className || ''} ${(u.completedSubjects || []).join(' ')}`
            .toLowerCase().includes(q)
    ));
}

// ── Reports ──────────────────────────────────────────────
async function loadReports() {
    const container = document.getElementById('reportsList');
    container.innerHTML = `<div class="text-center py-10">
        <i class="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
        <p class="text-slate-400 text-sm mt-2">Yuklanmoqda...</p>
    </div>`;

    try {
        const res  = await apiFetch('/users/results');
        if (!res.ok) throw new Error('Yuklab bo\'lmadi');
        const rows = await res.json();

        if (!rows.length) {
            container.innerHTML = `<div class="text-center py-14 text-slate-400">
                <i class="fas fa-chart-bar text-4xl mb-3 text-slate-300 block"></i>
                <p class="text-sm">Hali hech qanday imtihon topshirilmagan</p>
            </div>`;
            return;
        }

        // ── Aggregate stats ────────────────────────────────────
        const total    = rows.length;
        const passedN  = rows.filter(r => r.passed).length;
        const failedN  = total - passedN;
        const avgScore = Math.round(rows.reduce((a, r) => a + (r.score || 0), 0) / total);

        // ── Per-subject breakdown ──────────────────────────────
        const subjectMap = {};
        rows.forEach(r => {
            const name = r.subject || '—';
            if (!subjectMap[name]) subjectMap[name] = { name, total: 0, passed: 0, scores: [] };
            subjectMap[name].total++;
            if (r.passed) subjectMap[name].passed++;
            subjectMap[name].scores.push(r.score || 0);
        });
        const subjectRows = Object.values(subjectMap)
            .map(s => ({
                ...s,
                failed:   s.total - s.passed,
                avgScore: Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length),
                passRate: Math.round((s.passed / s.total) * 100)
            }))
            .sort((a, b) => b.total - a.total);

        // ── Per-class breakdown ────────────────────────────────
        const classMap = {};
        rows.forEach(r => {
            const cls = r.student?.className || 'Sinfsiz';
            if (!classMap[cls]) classMap[cls] = { cls, total: 0, passed: 0 };
            classMap[cls].total++;
            if (r.passed) classMap[cls].passed++;
        });
        const classRows = Object.values(classMap)
            .map(c => ({ ...c, passRate: Math.round((c.passed / c.total) * 100) }))
            .sort((a, b) => b.total - a.total);

        container.innerHTML = `
        <!-- ── Summary stats ── -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100">
                <p class="text-3xl font-bold text-blue-700">${total}</p>
                <p class="text-xs text-slate-500 mt-1 font-medium">Jami topshirishlar</p>
            </div>
            <div class="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                <p class="text-3xl font-bold text-emerald-700">${passedN}</p>
                <p class="text-xs text-slate-500 mt-1 font-medium">O'tdi ✓</p>
            </div>
            <div class="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
                <p class="text-3xl font-bold text-red-600">${failedN}</p>
                <p class="text-xs text-slate-500 mt-1 font-medium">O'tmadi ✗</p>
            </div>
            <div class="bg-violet-50 rounded-2xl p-4 text-center border border-violet-100">
                <p class="text-3xl font-bold text-violet-700">${avgScore}%</p>
                <p class="text-xs text-slate-500 mt-1 font-medium">O'rtacha ball</p>
            </div>
        </div>

        <!-- ── Subject breakdown ── -->
        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <i class="fas fa-book text-slate-400"></i>Fanlar bo'yicha tahlil
        </h3>
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
            <div class="overflow-x-auto">
                <table class="min-w-full">
                    <thead>
                        <tr class="bg-slate-50 border-b border-slate-100">
                            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fan</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Topshirdi</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">O'tdi</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">O'tmadi</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">O'rtacha</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">O'tish darajasi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${subjectRows.map(s => `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="px-5 py-3 text-sm font-semibold text-slate-800">${escHtml(s.name)}</td>
                            <td class="px-5 py-3 text-center text-sm text-slate-600">${s.total}</td>
                            <td class="px-5 py-3 text-center">
                                <span class="text-sm font-bold text-emerald-600">${s.passed}</span>
                            </td>
                            <td class="px-5 py-3 text-center">
                                <span class="text-sm font-bold text-red-500">${s.failed}</span>
                            </td>
                            <td class="px-5 py-3 text-center text-sm font-bold ${s.avgScore >= 60 ? 'text-emerald-600' : 'text-red-500'}">${s.avgScore}%</td>
                            <td class="px-5 py-3 hidden md:table-cell">
                                <div class="flex items-center gap-2">
                                    <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div class="h-full rounded-full transition-all ${s.passRate >= 60 ? 'bg-emerald-400' : 'bg-amber-400'}"
                                            style="width:${s.passRate}%"></div>
                                    </div>
                                    <span class="text-xs font-semibold text-slate-600 w-9 text-right">${s.passRate}%</span>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- ── Class breakdown ── -->
        ${classRows.length > 1 ? `
        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <i class="fas fa-users text-slate-400"></i>Sinflar bo'yicha
        </h3>
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mb-6">
            <div class="overflow-x-auto">
                <table class="min-w-full">
                    <thead>
                        <tr class="bg-slate-50 border-b border-slate-100">
                            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Sinf</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Topshirdi</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">O'tdi</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">O'tish darajasi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${classRows.map(c => `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="px-5 py-3 text-sm font-semibold text-slate-800">${escHtml(c.cls)}</td>
                            <td class="px-5 py-3 text-center text-sm text-slate-600">${c.total}</td>
                            <td class="px-5 py-3 text-center">
                                <span class="text-sm font-bold ${c.passed === c.total ? 'text-emerald-600' : 'text-amber-600'}">${c.passed}/${c.total}</span>
                            </td>
                            <td class="px-5 py-3 hidden sm:table-cell">
                                <div class="flex items-center gap-2">
                                    <div class="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-[120px]">
                                        <div class="h-full rounded-full ${c.passRate >= 60 ? 'bg-emerald-400' : 'bg-amber-400'}"
                                            style="width:${c.passRate}%"></div>
                                    </div>
                                    <span class="text-xs font-semibold text-slate-600">${c.passRate}%</span>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : ''}

        <!-- ── All sessions grouped by student ── -->
        <h3 class="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <i class="fas fa-list-ul text-slate-400"></i>
            Talabalar bo'yicha
            <span class="text-xs font-normal text-slate-400 ml-1">(${total} ta topshirish)</span>
        </h3>
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="min-w-full">
                    <thead>
                        <tr class="bg-slate-50 border-b border-slate-100">
                            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fan</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Ball</th>
                            <th class="px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Natija</th>
                            <th class="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Sana</th>
                            <th class="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Ko'rish</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100" id="rpt-sessions-body">
                        ${(() => {
                            // Group by student — use 'rpt_' prefix to avoid ID clash with resultsTableBody
                            const grouped = new Map();
                            rows.forEach(r => {
                                const uid = r.student?._id || r.student?.id || '__unknown__';
                                if (!grouped.has(uid)) grouped.set(uid, { student: r.student, sessions: [] });
                                grouped.get(uid).sessions.push(r);
                            });

                            let html = '';
                            grouped.forEach((g, uid) => {
                                const student  = g.student || {};
                                const sessions = g.sessions;
                                const fullName = [student.firstName, student.lastName].filter(Boolean).join(' ') || student.username || '—';
                                const passedN  = sessions.filter(s => s.passed).length;
                                const totalN   = sessions.length;
                                const avgScore = Math.round(sessions.reduce((a, s) => a + (s.score || 0), 0) / totalN);
                                const allPassed = passedN === totalN;
                                const safeUid  = 'rpt' + escHtml(uid).replace(/[^a-zA-Z0-9]/g, '_');

                                html += `
                                <tr class="hover:bg-slate-50 transition cursor-pointer select-none"
                                    onclick="toggleStudentRows('${safeUid}')">
                                    <td class="px-5 py-3.5" colspan="5">
                                        <div class="flex items-center gap-3 flex-wrap">
                                            <i id="chevron-${safeUid}"
                                               class="fas fa-chevron-right text-xs text-slate-400 flex-shrink-0 transition-transform duration-150"></i>
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-semibold text-slate-800">${escHtml(fullName)}</p>
                                                <p class="text-xs font-mono text-slate-400">${escHtml(student.username || '')}</p>
                                            </div>
                                            <span class="text-xs text-slate-500 hidden sm:block">${escHtml(student.className || '—')}</span>
                                            <div class="flex items-center gap-3 ml-auto flex-shrink-0 text-xs">
                                                <span class="text-slate-500">${totalN} ta fan</span>
                                                <span class="font-semibold ${allPassed ? 'text-emerald-600' : 'text-amber-600'}">${passedN}/${totalN} o'tdi</span>
                                                <span class="font-bold ${avgScore >= 60 ? 'text-emerald-600' : 'text-red-500'}">~${avgScore}%</span>
                                            </div>
                                        </div>
                                    </td>
                                </tr>`;

                                sessions.forEach(s => {
                                    const date   = s.completedAt ? new Date(s.completedAt).toLocaleString('uz-UZ') : '—';
                                    const passed = s.passed;
                                    const score  = s.score ?? '?';
                                    const sid    = escHtml(String(s.id || ''));

                                    html += `
                                <tr class="student-detail hidden bg-slate-50/60 border-t border-slate-100"
                                    id="detail-row-${safeUid}">
                                    <td class="pl-14 pr-5 py-2.5">
                                        <span class="text-sm font-medium text-blue-700">${escHtml(s.subject || '—')}</span>
                                    </td>
                                    <td class="px-5 py-2.5 text-center">
                                        <span class="text-sm font-bold ${passed ? 'text-emerald-600' : 'text-red-500'}">${score}%</span>
                                        <span class="text-xs text-slate-400 block">${s.correctAnswers ?? 0}/${s.totalQuestions ?? 0}</span>
                                    </td>
                                    <td class="px-5 py-2.5 text-center">
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
                                            ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}">
                                            <i class="fas ${passed ? 'fa-circle-check' : 'fa-circle-xmark'} text-[9px]"></i>
                                            ${passed ? "O'tdi" : "O'tmadi"}
                                        </span>
                                    </td>
                                    <td class="px-5 py-2.5 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">${escHtml(date)}</td>
                                    <td class="px-5 py-2.5 text-right">
                                        <button data-sid="${sid}"
                                            onclick="viewSessionReport(this.dataset.sid)" title="Batafsil"
                                            class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center text-xs transition ml-auto">
                                            <i class="fas fa-magnifying-glass"></i>
                                        </button>
                                    </td>
                                </tr>`;
                                });
                            });
                            return html;
                        })()}
                    </tbody>
                </table>
            </div>
        </div>`;
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Hisobotlarni yuklashda xato', 'error');
        container.innerHTML = `<div class="text-center py-10 text-red-400 text-sm">
            <i class="fas fa-exclamation-circle text-2xl mb-2 block"></i>
            Hisobotlarni yuklab bo'lmadi
        </div>`;
    }
}

async function viewUserHistory(userId) {
    try {
        const res      = await apiFetch(`/users/${userId}/history`);
        const sessions = await res.json();

        if (!sessions.length) {
            showToast('Bu foydalanuvchida test tarixi yo\'q', 'info');
            return;
        }

        const latest = sessions[0];
        const repRes = await apiFetch(`/users/reports/${latest._id}`);
        const report = await repRes.json();
        showReport(report);
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Test tarixini yuklashda xato', 'error');
    }
}

function showReport(report) {
    const session = report.session;
    const pct     = session.score || 0;
    const passed  = pct >= 60;

    document.getElementById('reportContent').innerHTML = `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div class="bg-slate-50 rounded-xl p-3">
                <p class="text-xs text-slate-500 mb-1">Talaba</p>
                <p class="text-sm font-semibold">${escHtml(session.student?.firstName || '')} ${escHtml(session.student?.lastName || '')}</p>
                <p class="text-xs text-slate-400 font-mono">${escHtml(session.student?.username || '')}</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
                <p class="text-xs text-slate-500 mb-1">Fan</p>
                <p class="text-sm font-semibold">${escHtml(session.subject || '—')}</p>
            </div>
            <div class="bg-${passed ? 'emerald' : 'red'}-50 rounded-xl p-3">
                <p class="text-xs text-slate-500 mb-1">Ball</p>
                <p class="text-2xl font-bold ${passed ? 'text-emerald-600' : 'text-red-600'}">${pct}%</p>
            </div>
            <div class="bg-slate-50 rounded-xl p-3">
                <p class="text-xs text-slate-500 mb-1">Natija</p>
                <p class="text-sm font-semibold text-emerald-600">${session.correctAnswers || 0} to'g'ri</p>
                <p class="text-sm font-semibold text-red-500">${session.wrongAnswers || 0} noto'g'ri</p>
            </div>
        </div>
        <h3 class="font-bold text-slate-800 mb-3">Batafsil natijalar</h3>
        <div class="space-y-2">
            ${(report.detailedResults || []).map((r, i) => `
                <div class="flex items-start gap-3 p-3 rounded-xl border ${r.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
                        ${r.isCorrect ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}">
                        <i class="fas ${r.isCorrect ? 'fa-check' : 'fa-xmark'} text-xs"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-800 mb-1">Q${i+1}: ${escHtml(r.questionText || '')}</p>
                        <p class="text-xs ${r.isCorrect ? 'text-emerald-700' : 'text-red-600'}">
                            Javob: <span class="font-semibold">${escHtml(r.selectedOptionText || 'Javob berilmagan')}</span>
                        </p>
                        ${!r.isCorrect ? `<p class="text-xs text-emerald-700 mt-0.5">To'g'ri: <span class="font-semibold">${escHtml(r.correctOptionText || '')}</span></p>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
    document.getElementById('reportModal').classList.remove('hidden');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
}

// ── Exam Results ─────────────────────────────────────────
async function loadExamResults(className, status) {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-slate-400 text-sm">
        <i class="fas fa-spinner fa-spin mr-2"></i>Yuklanmoqda...</td></tr>`;

    const cls = className ?? document.getElementById('resultsClassFilter')?.value.trim() ?? '';
    const st  = status  ?? document.getElementById('resultsStatusFilter')?.value ?? '';

    const params = new URLSearchParams();
    if (cls) params.set('className', cls);
    if (st)  params.set('status', st);

    try {
        const res  = await apiFetch(`/users/results${params.toString() ? '?' + params : ''}`);
        allResults = await res.json();
        renderResults(allResults);

        // Clear badge once viewed
        const badge = document.getElementById('resultsBadge');
        if (badge) badge.classList.add('hidden');
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast('Natijalarni yuklashda xato', 'error');
    }
}

function applyResultsFilter() {
    const cls = document.getElementById('resultsClassFilter')?.value.trim();
    const st  = document.getElementById('resultsStatusFilter')?.value;

    // Show active filter label
    const labelEl = document.getElementById('resultsFilterLabel');
    if (labelEl) {
        const parts = [];
        if (cls) parts.push(`Sinf: "${cls}"`);
        if (st === 'passed') parts.push("O'tganlar");
        if (st === 'failed') parts.push("O'tmaganlar");
        if (parts.length) {
            labelEl.textContent = 'Filtr: ' + parts.join(', ');
            labelEl.classList.remove('hidden');
        } else {
            labelEl.classList.add('hidden');
        }
    }

    loadExamResults(cls, st);
}

function clearResultsFilter() {
    const clsEl = document.getElementById('resultsClassFilter');
    const stEl  = document.getElementById('resultsStatusFilter');
    const labelEl = document.getElementById('resultsFilterLabel');
    if (clsEl)   clsEl.value = '';
    if (stEl)    stEl.value  = '';
    if (labelEl) labelEl.classList.add('hidden');
    loadExamResults('', '');
}

function renderResults(rows) {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;

    if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-8 text-center text-slate-400 text-sm">
            <i class="fas fa-inbox text-2xl mb-2 block text-slate-300"></i>Natijalar topilmadi</td></tr>`;
        return;
    }

    // ── Group by student ─────────────────────────────────────
    const grouped = new Map();
    rows.forEach(r => {
        const uid = r.student?._id || r.student?.id || '__unknown__';
        if (!grouped.has(uid)) grouped.set(uid, { student: r.student, sessions: [] });
        grouped.get(uid).sessions.push(r);
    });

    let html = '';
    grouped.forEach((g, uid) => {
        const student  = g.student || {};
        const sessions = g.sessions;
        const fullName = [student.firstName, student.lastName].filter(Boolean).join(' ') || student.username || '—';
        const passedN  = sessions.filter(s => s.passed).length;
        const totalN   = sessions.length;
        const avgScore = Math.round(sessions.reduce((a, s) => a + (s.score || 0), 0) / totalN);
        const latestDate = sessions[0]?.completedAt
            ? new Date(sessions[0].completedAt).toLocaleDateString('uz-UZ')
            : '—';
        const allPassed = passedN === totalN;
        const safeUid   = escHtml(uid);

        // ── Summary row ──────────────────────────────────────
        html += `
        <tr class="hover:bg-slate-50 transition cursor-pointer select-none"
            onclick="toggleStudentRows('${safeUid}')">
            <td class="px-5 py-3.5" colspan="5">
                <div class="flex items-center gap-3 flex-wrap">
                    <i id="chevron-${safeUid}"
                       class="fas fa-chevron-right text-xs text-slate-400 flex-shrink-0 transition-transform duration-150"></i>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-800">${escHtml(fullName)}</p>
                        <p class="text-xs font-mono text-slate-400">${escHtml(student.username || '')}</p>
                    </div>
                    <span class="text-xs text-slate-500 hidden sm:block">${escHtml(student.className || '—')}</span>
                    <div class="flex items-center gap-3 ml-auto flex-shrink-0 text-xs">
                        <span class="text-slate-500">${totalN} ta fan</span>
                        <span class="font-semibold ${allPassed ? 'text-emerald-600' : 'text-amber-600'}">${passedN}/${totalN} o'tdi</span>
                        <span class="font-bold ${avgScore>=60 ? 'text-emerald-600' : 'text-red-500'}">~${avgScore}%</span>
                        <span class="text-slate-400 hidden lg:block">${latestDate}</span>
                    </div>
                </div>
            </td>
        </tr>`;

        // ── Per-subject detail rows (hidden by default) ──────
        sessions.forEach(s => {
            const date   = s.completedAt ? new Date(s.completedAt).toLocaleString('uz-UZ') : '—';
            const passed = s.passed;
            const score  = s.score ?? '?';
            const sid    = String(s.id || '');

            html += `
        <tr class="student-detail hidden bg-slate-50/60 border-t border-slate-100"
            id="detail-row-${safeUid}">
            <td class="pl-14 pr-5 py-2.5">
                <span class="text-sm font-medium text-blue-700">${escHtml(s.subject || '—')}</span>
            </td>
            <td class="px-5 py-2.5 text-center">
                <span class="text-sm font-bold ${passed ? 'text-emerald-600' : 'text-red-500'}">${score}%</span>
                <span class="text-xs text-slate-400 block">${s.correctAnswers ?? 0}/${s.totalQuestions ?? 0}</span>
            </td>
            <td class="px-5 py-2.5 text-center">
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
                    ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}">
                    <i class="fas ${passed ? 'fa-circle-check' : 'fa-circle-xmark'} text-[9px]"></i>
                    ${passed ? "O'tdi" : "O'tmadi"}
                </span>
            </td>
            <td class="px-5 py-2.5 text-xs text-slate-400 hidden lg:table-cell whitespace-nowrap">${escHtml(date)}</td>
            <td class="px-5 py-2.5 text-right">
                <div class="flex items-center justify-end gap-1.5">
                    <button data-sid="${sid}"
                        onclick="viewSessionReport(this.dataset.sid)" title="Batafsil"
                        class="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center text-xs transition">
                        <i class="fas fa-magnifying-glass"></i>
                    </button>
                    <button data-sid="${sid}" data-name="${escHtml(fullName)}"
                        onclick="deleteResult(this.dataset.sid, this.dataset.name)" title="O'chirish"
                        class="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center text-xs transition">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
        });
    });

    tbody.innerHTML = html;
}

function toggleStudentRows(uid) {
    const rows    = document.querySelectorAll(`#detail-row-${uid}`);
    const chevron = document.getElementById(`chevron-${uid}`);
    if (!rows.length) return;
    const isHidden = rows[0].classList.contains('hidden');
    rows.forEach(r => r.classList.toggle('hidden', !isHidden));
    if (chevron) chevron.style.transform = isHidden ? 'rotate(90deg)' : '';
}

async function deleteResult(sessionId, studentName) {
    showConfirm(
        `${studentName} natijasini o'chirishni xohlaysizmi? O'chirilgandan so'ng talaba bu fandan qayta imtihon topshira oladi.`,
        async () => {
            try {
                const res = await apiFetch(`/users/results/${sessionId}`, { method: 'DELETE' });
                if (!res.ok) {
                    let msg = "O'chirishda xato";
                    try { const d = await res.json(); msg = d.error || msg; } catch (_) {}
                    throw new Error(msg);
                }
                showToast('Natija o\'chirildi. Talaba qayta topshira oladi.', 'success');
                loadExamResults();
            } catch (err) {
                if (err.message !== 'Unauthorized') showToast(err.message, 'error');
            }
        }
    );
}

async function viewSessionReport(sessionId) {
    try {
        const res    = await apiFetch(`/users/reports/${sessionId}`);
        if (!res.ok) throw new Error('Hisobotni yuklab bo\'lmadi');
        const report = await res.json();
        showReport(report);
    } catch (err) {
        if (err.message !== 'Unauthorized') showToast(err.message || 'Xato', 'error');
    }
}

// ── Helpers ──────────────────────────────────────────────
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
