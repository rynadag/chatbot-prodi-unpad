// File: frontend/script.js (GANTI SEMUA ISINYA)

const CHAT_API_URL = 'http://localhost:3000/api/chat';
const SUBMISSION_API_URL = 'http://localhost:3000/api/submission';


function getToken() {
    return localStorage.getItem('userToken');
}
function getAuthHeaders() {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}
function logout() {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    window.location.href = 'login.html';
}
function handleAuthError(response) {
    if (response.status === 401 || response.status === 403) {
        alert('Sesi Anda habis. Silakan login kembali.');
        logout();
        return true;
    }
    return false;
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.content-area .section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            // Sembunyikan semua section
            sections.forEach(section => {
                section.classList.remove('active');
            });

            // Tampilkan target section
            document.getElementById(targetId).classList.add('active');

            // Atur link aktif di sidebar
            navLinks.forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');

            // Jika mengklik tab histori, otomatis muat datanya
            if (targetId === 'section-history') {
                loadMySubmissions();
            }
        });
    });
}

// --- 3. EVENT LISTENER UTAMA ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Navigasi Tab
    setupNavigation();
    
    // 2. Tombol Kirim Chat
    document.getElementById('send-button').addEventListener('click', sendMessage);
    
    // 3. Tombol Kirim Saran
    document.getElementById('submit-data-button').addEventListener('click', submitKnowledge);
    
    // 4. Tombol Muat Histori
    document.getElementById('load-my-submissions-button').addEventListener('click', loadMySubmissions);

    // 5. Tombol Logout
    document.getElementById('logout-button').addEventListener('click', logout);

    // 6. Izinkan kirim chat dengan 'Enter'
    document.getElementById('user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
});


// --- 4. FUNGSI CHAT  ---

const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

function addMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
    messageDiv.textContent = text;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage() {
    const question = userInput.value.trim();
    if (!question) return;

    addMessage('user', question);
    userInput.value = '';
    
    const loadingMessage = document.createElement('div');
    loadingMessage.classList.add('message', 'bot-message', 'loading');
    loadingMessage.textContent = 'Mengetik...';
    chatMessages.appendChild(loadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch(CHAT_API_URL, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ question: question }),
        });

        loadingMessage.remove();
        if (handleAuthError(response)) return;

        if (!response.ok) {
            throw new Error(`Error: ${response.status} - Gagal terhubung ke AI.`);
        }

        const data = await response.json();
        addMessage('bot', data.answer);

    } catch (error) {
        loadingMessage.remove();
        console.error('Error saat mengirim pesan:', error);
        addMessage('bot', `❌ Error: Gagal mendapatkan jawaban. Detail: ${error.message}`);
    }
}


// --- 5. FUNGSI SUBMISSION  ---

async function submitKnowledge() {
    const tag = document.getElementById('sub-tag').value;
    const content_text = document.getElementById('sub-content').value;
    const msgDiv = document.getElementById('submit-message');
    msgDiv.textContent = 'Mengirim...';
    msgDiv.className = 'message info'; // Tambahkan kelas

    try {
        const response = await fetch(SUBMISSION_API_URL, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tag, content_text })
        });

        if (handleAuthError(response)) return;
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Gagal mengirim data.');
        }

        msgDiv.textContent = '✅ Terima kasih! Kiriman Anda berhasil disimpan untuk ditinjau.';
        msgDiv.className = 'message success';
        document.getElementById('sub-tag').value = '';
        document.getElementById('sub-content').value = '';
        
    } catch (error) {
        msgDiv.textContent = `❌ Error: ${error.message}`;
        msgDiv.className = 'message error';
        console.error('Error submitKnowledge:', error);
    }
}

async function loadMySubmissions() {
    const listDiv = document.getElementById('my-submissions-list');
    const msgDiv = document.getElementById('my-submissions-message'); // ID elemen pesan baru
    listDiv.innerHTML = ''; // Kosongkan list
    msgDiv.textContent = 'Memuat histori...';
    msgDiv.className = 'message info';

    try {
        const response = await fetch(`${SUBMISSION_API_URL}/mine`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (handleAuthError(response)) return;

        if (!response.ok) {
            throw new Error('Gagal memuat histori.');
        }

        const submissions = await response.json();
        
        if (submissions.length === 0) {
            msgDiv.textContent = 'Anda belum pernah mengirim data.';
            msgDiv.className = 'message';
            return;
        }

        msgDiv.textContent = ''; // Kosongkan pesan jika sukses
        msgDiv.className = 'message';
        
        submissions.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `submission-item status-${item.status}`;
            itemDiv.innerHTML = `
                <strong>Tag:</strong> ${item.tag} <br>
                <strong>Konten:</strong> ${item.content_text.substring(0, 100)}... <br>
                <strong>Status:</strong> <span class="status-badge">${item.status}</span>
            `;
            listDiv.appendChild(itemDiv);
        });

    } catch (error) {
        listDiv.innerHTML = '';
        msgDiv.textContent = `❌ Error: ${error.message}`;
        msgDiv.className = 'message error';
        console.error('Error loadMySubmissions:', error);
    }
}