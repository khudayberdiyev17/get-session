// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:3000/api' 
    : `http://${window.location.hostname}:3000/api`;

let authToken = localStorage.getItem('adminToken');
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        validateToken();
    } else {
        showLogin();
    }
});

// Login functionality
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        authToken = data.token;
        currentUser = data.user;
        localStorage.setItem('adminToken', authToken);
        
        showDashboard();
    } catch (error) {
        document.getElementById('loginError').textContent = error.message;
        document.getElementById('loginError').classList.remove('hidden');
    }
});

async function validateToken() {
    try {
        // Try to get user info to validate token
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (response.ok) {
            showDashboard();
        } else {
            throw new Error('Invalid token');
        }
    } catch (error) {
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
        document.getElementById('adminName').textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    }
    
    loadDashboardData();
}

function logout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    currentUser = null;
    showLogin();
}

function showSection(section) {
    // Hide all sections
    ['dashboard', 'subjects', 'users', 'blocked', 'reports'].forEach(s => {
        document.getElementById(`section-${s}`).classList.add('hidden');
        document.getElementById(`nav-${s}`).classList.remove('sidebar-active');
    });

    // Show selected section
    document.getElementById(`section-${section}`).classList.remove('hidden');
    document.getElementById(`nav-${section}`).classList.add('sidebar-active');
    
    // Update page title
    const titles = {
        dashboard: 'Dashboard',
        subjects: 'Subjects Management',
        users: 'User Management',
        blocked: 'Blocked Users',
        reports: 'Test Reports'
    };
    document.getElementById('pageTitle').textContent = titles[section];

    // Load section data
    switch(section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'subjects':
            loadSubjects();
            break;
        case 'users':
            loadUsers();
            break;
        case 'blocked':
            loadBlockedUsers();
            break;
        case 'reports':
            loadReports();
            break;
    }
}

// Dashboard functions
async function loadDashboardData() {
    try {
        const [usersRes, subjectsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/users`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
            fetch(`${API_BASE_URL}/subjects/admin`, { headers: { 'Authorization': `Bearer ${authToken}` } })
        ]);

        const users = await usersRes.json();
        const subjects = await subjectsRes.json();

        document.getElementById('totalStudents').textContent = users.length;
        document.getElementById('totalSubjects').textContent = subjects.length;
        
        const blocked = users.filter(u => u.status === 'blocked');
        document.getElementById('blockedCount').textContent = blocked.length;

        // Calculate total tests completed (would need additional endpoint for accurate count)
        document.getElementById('testsCompleted').textContent = '0';

        // Recent activity (placeholder)
        const recentActivity = document.getElementById('recentActivity');
        if (blocked.length > 0) {
            recentActivity.innerHTML = blocked.slice(0, 5).map(user => `
                <div class="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                        <p class="font-semibold">${user.firstName} ${user.lastName}</p>
                        <p class="text-sm text-gray-600">Blocked: ${user.blockReason}</p>
                    </div>
                    <span class="text-xs text-gray-500">${new Date(user.blockedAt).toLocaleDateString()}</span>
                </div>
            `).join('');
        } else {
            recentActivity.innerHTML = '<p class="text-gray-500">No recent activity</p>';
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Subjects functions
async function loadSubjects() {
    try {
        const response = await fetch(`${API_BASE_URL}/subjects/admin`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const subjects = await response.json();

        const container = document.getElementById('subjectsList');
        container.innerHTML = subjects.map(subject => `
            <div class="bg-white p-6 rounded-lg shadow">
                <h3 class="text-xl font-bold text-gray-800 mb-2">${subject.name}</h3>
                <p class="text-gray-600 text-sm mb-4">${subject.description || 'No description'}</p>
                <div class="flex justify-between items-center text-sm text-gray-500 mb-4">
                    <span><i class="fas fa-clock mr-1"></i> ${subject.totalTimeLimit} min</span>
                    <span><i class="fas fa-question-circle mr-1"></i> ${subject.questions?.length || 0} questions</span>
                </div>
                <div class="flex space-x-2">
                    <button onclick="editSubject('${subject._id}')" class="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                        <i class="fas fa-edit mr-1"></i> Edit
                    </button>
                    <button onclick="deleteSubject('${subject._id}')" class="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700">
                        <i class="fas fa-trash mr-1"></i> Delete
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load subjects:', error);
    }
}

function openSubjectModal() {
    document.getElementById('subjectForm').reset();
    document.getElementById('subjectId').value = '';
    document.getElementById('subjectModalTitle').textContent = 'Add Subject';
    document.getElementById('questionsContainer').innerHTML = '';
    document.getElementById('subjectModal').classList.remove('hidden');
}

function closeSubjectModal() {
    document.getElementById('subjectModal').classList.add('hidden');
}

function addQuestionField() {
    const container = document.getElementById('questionsContainer');
    const index = container.children.length;
    
    const questionDiv = document.createElement('div');
    questionDiv.className = 'p-4 border rounded-lg bg-gray-50';
    questionDiv.innerHTML = `
        <div class="mb-3">
            <label class="block text-sm font-semibold mb-1">Question Text *</label>
            <input type="text" name="questionText[]" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label class="block text-sm font-semibold mb-1">Option A *</label>
                <input type="text" name="optionA[]" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-semibold mb-1">Option B *</label>
                <input type="text" name="optionB[]" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-semibold mb-1">Option C *</label>
                <input type="text" name="optionC[]" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
            </div>
            <div>
                <label class="block text-sm font-semibold mb-1">Option D *</label>
                <input type="text" name="optionD[]" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
            </div>
        </div>
        <div class="mb-3">
            <label class="block text-sm font-semibold mb-1">Correct Answer *</label>
            <select name="correctIndex[]" required class="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
                <option value="0">Option A</option>
                <option value="1">Option B</option>
                <option value="2">Option C</option>
                <option value="3">Option D</option>
            </select>
        </div>
        <button type="button" onclick="this.parentElement.remove()" class="text-red-600 hover:text-red-800 text-sm">
            <i class="fas fa-trash mr-1"></i> Remove Question
        </button>
    `;
    
    container.appendChild(questionDiv);
}

document.getElementById('subjectForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const subjectId = document.getElementById('subjectId').value;
    const name = document.getElementById('subjectName').value;
    const description = document.getElementById('subjectDescription').value;
    const totalTimeLimit = parseInt(document.getElementById('subjectTimeLimit').value);
    
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
            timeLimit: 60
        });
    }
    
    try {
        const url = subjectId 
            ? `${API_BASE_URL}/subjects/${subjectId}`
            : `${API_BASE_URL}/subjects`;
        
        const method = subjectId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name, description, totalTimeLimit, questions })
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save subject');
        }
        
        closeSubjectModal();
        loadSubjects();
    } catch (error) {
        alert(error.message);
    }
});

async function editSubject(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/subjects/admin`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const subjects = await response.json();
        const subject = subjects.find(s => s._id === id);
        
        if (!subject) return;
        
        document.getElementById('subjectId').value = subject._id;
        document.getElementById('subjectName').value = subject.name;
        document.getElementById('subjectDescription').value = subject.description || '';
        document.getElementById('subjectTimeLimit').value = subject.totalTimeLimit;
        document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
        
        const container = document.getElementById('questionsContainer');
        container.innerHTML = '';
        
        subject.questions?.forEach((q, i) => {
            addQuestionField();
            const questionDiv = container.lastElementChild;
            questionDiv.querySelector('[name="questionText[]"]').value = q.text;
            questionDiv.querySelector('[name="optionA[]"]').value = q.options[0];
            questionDiv.querySelector('[name="optionB[]"]').value = q.options[1];
            questionDiv.querySelector('[name="optionC[]"]').value = q.options[2];
            questionDiv.querySelector('[name="optionD[]"]').value = q.options[3];
            questionDiv.querySelector('[name="correctIndex[]"]').value = q.correctIndex;
        });
        
        document.getElementById('subjectModal').classList.remove('hidden');
    } catch (error) {
        console.error('Failed to load subject:', error);
    }
}

async function deleteSubject(id) {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/subjects/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete subject');
        }
        
        loadSubjects();
    } catch (error) {
        alert(error.message);
    }
}

// Users functions
async function loadUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const users = await response.json();

        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">${user.firstName} ${user.lastName}</td>
                <td class="px-6 py-4 whitespace-nowrap font-mono text-sm">${user.username}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.className}</td>
                <td class="px-6 py-4 whitespace-nowrap">${user.subjectName}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${user.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button onclick="viewUserHistory('${user._id}')" class="text-blue-600 hover:text-blue-800 mr-3">
                        <i class="fas fa-history"></i>
                    </button>
                    <button onclick="editUser('${user._id}')" class="text-green-600 hover:text-green-800 mr-3">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.status === 'active' 
                        ? `<button onclick="blockUser('${user._id}')" class="text-red-600 hover:text-red-800"><i class="fas fa-ban"></i></button>`
                        : `<button onclick="unblockUser('${user._id}')" class="text-green-600 hover:text-green-800"><i class="fas fa-check"></i></button>`
                    }
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function openUserModal() {
    document.getElementById('userForm').reset();
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').textContent = 'Add Student';
    document.getElementById('userModal').classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
}

document.getElementById('userForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('userId').value;
    const userData = {
        firstName: document.getElementById('userFirstName').value,
        lastName: document.getElementById('userLastName').value,
        className: document.getElementById('userClass').value,
        subjectName: document.getElementById('userSubject').value,
        username: document.getElementById('userUsername').value,
        password: document.getElementById('userPassword').value || undefined
    };
    
    try {
        const url = userId 
            ? `${API_BASE_URL}/users/${userId}`
            : `${API_BASE_URL}/users`;
        
        const method = userId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(userData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to save user');
        }
        
        if (!userId && data.generatedPassword) {
            alert(`User created successfully!\n\nUsername: ${userData.username}\nPassword: ${data.generatedPassword}\n\nPlease save these credentials!`);
        } else {
            alert('User saved successfully!');
        }
        
        closeUserModal();
        loadUsers();
    } catch (error) {
        alert(error.message);
    }
});

async function blockUser(id) {
    if (!confirm('Are you sure you want to block this user?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/users/${id}/block`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ reason: 'admin_blocked', description: 'Manually blocked by admin' })
        });
        
        if (!response.ok) {
            throw new Error('Failed to block user');
        }
        
        loadUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function unblockUser(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${id}/unblock`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to unblock user');
        }
        
        loadUsers();
    } catch (error) {
        alert(error.message);
    }
}

async function loadBlockedUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/blocked`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const users = await response.json();

        const tbody = document.getElementById('blockedTableBody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">${user.firstName} ${user.lastName}</td>
                <td class="px-6 py-4 whitespace-nowrap font-mono text-sm">${user.username}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="text-sm text-gray-600">${user.blockReason || 'N/A'}</span>
                    ${user.blockDescription ? `<p class="text-xs text-gray-500">${user.blockDescription}</p>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(user.blockedAt).toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button onclick="unblockUser('${user._id}')" class="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm">
                        <i class="fas fa-check mr-1"></i> Unblock
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Failed to load blocked users:', error);
    }
}

// Reports functions
async function loadReports() {
    // For now, just show a message - would need to implement user selection
    document.getElementById('reportsList').innerHTML = `
        <p class="text-gray-500">Go to Users section and click the history icon to view test reports.</p>
    `;
}

async function viewUserHistory(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/history`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const sessions = await response.json();

        if (sessions.length === 0) {
            alert('No test history for this user.');
            return;
        }

        // Show most recent session
        const latestSession = sessions[0];
        const reportResponse = await fetch(`${API_BASE_URL}/users/reports/${latestSession._id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const report = await reportResponse.json();

        showReport(report);
    } catch (error) {
        console.error('Failed to load user history:', error);
        alert('Failed to load test history');
    }
}

function showReport(report) {
    const content = document.getElementById('reportContent');
    const session = report.session;
    
    content.innerHTML = `
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="text-sm text-gray-600">Student</p>
                    <p class="font-semibold">${session.student.firstName} ${session.student.lastName} (${session.student.username})</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Subject</p>
                    <p class="font-semibold">${session.subject}</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Score</p>
                    <p class="font-semibold text-2xl ${session.score >= 60 ? 'text-green-600' : 'text-red-600'}">${session.score}%</p>
                </div>
                <div>
                    <p class="text-sm text-gray-600">Results</p>
                    <p class="font-semibold"><span class="text-green-600">${session.correctAnswers}</span> correct / <span class="text-red-600">${session.wrongAnswers}</span> wrong</p>
                </div>
            </div>
        </div>
        
        <h3 class="text-lg font-semibold mb-3">Detailed Results</h3>
        <div class="space-y-3">
            ${report.detailedResults.map((result, i) => `
                <div class="p-4 border rounded-lg ${result.isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <p class="font-semibold mb-2">Q${i + 1}: ${result.questionText}</p>
                            <p class="text-sm">
                                Your answer: <span class="${result.isCorrect ? 'text-green-600' : 'text-red-600'} font-semibold">
                                    ${result.selectedOptionText || 'Not answered'}
                                </span>
                            </p>
                            ${!result.isCorrect ? `
                                <p class="text-sm text-green-600">
                                    Correct answer: <span class="font-semibold">${result.correctOptionText}</span>
                                </p>
                            ` : ''}
                        </div>
                        <div class="ml-4">
                            ${result.isCorrect 
                                ? '<span class="text-green-600 text-2xl">✓</span>' 
                                : '<span class="text-red-600 text-2xl">✗</span>'
                            }
                        </div>
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
