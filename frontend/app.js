// File: frontend/app.js (Perbaikan Penuh & Final)

const BACKEND_URL = 'http://localhost:3000/api';

// --- 1. HELPER & VARIABEL GLOBAL ---
let allDatasets = []; // Menyimpan semua data dari server

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

// --- 2. LOGIKA NAVIGASI TAB ---
function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const sections = document.querySelectorAll('.content-area .section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-target');

            sections.forEach(section => {
                section.classList.remove('active');
            });

            document.getElementById(targetId).classList.add('active');

            navLinks.forEach(navLink => navLink.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

// --- 3. EVENT LISTENER UTAMA ---
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();

    document.getElementById('logout-button').addEventListener('click', logout);
    document.getElementById('load-submissions-button').addEventListener('click', loadSubmissions);
    document.getElementById('compile-button-header').addEventListener('click', compileData);

    document.getElementById('admin-send-button').addEventListener('click', adminSendMessage);
    document.getElementById('admin-user-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            adminSendMessage();
        }
    });
    
    // Listener untuk Search Bar
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        // Filter dari data di memori
        const filteredData = allDatasets.filter(item => 
            item.tag.toLowerCase().includes(searchTerm) || 
            item.content_text.toLowerCase().includes(searchTerm)
        );
        renderDataList(filteredData);
    });

    // Muat data awal
    loadData();
});


// --- 4. FUNGSI DATASET (KnowledgeSource) ---

async function loadData() {
    const dataList = document.getElementById('data-list');
    const msg = document.getElementById('load-message');
    dataList.innerHTML = 'Memuat data...';
    msg.textContent = '';
    try {
        const response = await fetch(`${BACKEND_URL}/admin/data`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (handleAuthError(response)) return;
        if (response.ok) {
            const data = await response.json();
            
            allDatasets = data; // Simpan ke variabel global
            renderDataList(allDatasets); // Tampilkan data
            
            msg.textContent = `Berhasil memuat ${data.length} item data.`;
        } else {
            msg.textContent = `Gagal memuat: ${response.statusText}`;
        }
    } catch (error) {
        msg.textContent = `Error Koneksi.`;
        console.error('Error:', error);
    }
}

// Fungsi Render List 
function renderDataList(data) {
    const dataList = document.getElementById('data-list');
    dataList.innerHTML = ''; 

    if (data.length === 0) {
        dataList.innerHTML = '<p style="text-align: center; color: #555;">Tidak ada data yang cocok dengan pencarian.</p>';
        return;
    }

    data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'data-item';     
        li.innerHTML = `
            <div class="data-item-info">
                <div class="data-item-tag"><strong>Tag:</strong> ${item.tag}</div>
                <div class="data-item-content"><strong>Content:</strong> ${item.content_text}</div>
            </div>
            <div class="data-item-actions">
                <button class="btn-edit" onclick="openEditModal('${item._id}')">Edit</button>
                <button class="btn-danger" onclick="deleteData('${item._id}')">Hapus</button>
            </div>
        `;
        dataList.appendChild(li);
    });
}

async function addData() {
    const tag = document.getElementById('tag').value;
    const content = document.getElementById('content').value;
    const msg = document.getElementById('add-message');
    msg.textContent = 'Menyimpan...';
    try {
        const response = await fetch(`${BACKEND_URL}/admin/data`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tag: tag, content_text: content })
        });
        if (response.ok) {
            msg.textContent = '✅ Data Berhasil Disimpan!';
            loadData(); // Muat ulang data
        } else {
            const data = await response.json();
            msg.textContent = `Gagal menyimpan: ${data.error || response.statusText}`;
        }
    } catch (error) {
        msg.textContent = `Error Koneksi.`;
        console.error('Error:', error);
    }
}

async function deleteData(id) {
    if (!confirm("Anda yakin ingin menghapus data ini?")) return;
    const msg = document.getElementById('load-message');
    msg.textContent = 'Menghapus data...';
    try {
        const response = await fetch(`${BACKEND_URL}/admin/data/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (response.ok) {
            msg.textContent = `✅ Data ID ${id} Berhasil Dihapus!`;
            loadData(); // Muat ulang
        } else {
            const data = await response.json();
            msg.textContent = `Gagal menghapus: ${data.error || response.statusText}`;
        }
    } catch (error) {
        msg.textContent = `Error Koneksi.`;
        console.error('Error:', error);
    }
}

async function updateData(id, tag, content) {
    const msg = document.getElementById('load-message'); 
    msg.textContent = 'Memperbarui data...';
    try {
        const response = await fetch(`${BACKEND_URL}/admin/data/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tag: tag, content_text: content })
        });
        if (response.ok) {
            msg.textContent = `Data ID ${id} Berhasil Diperbarui!`;
            loadData(); // Muat ulang
        } else {
            const data = await response.json();
            msg.textContent = `Gagal memperbarui: ${data.error || response.statusText}`;
        }
    } catch (error) {
        msg.textContent = `Error Koneksi.`;
        console.error('Error:', error);
    }
}

// --- 5. FUNGSI KOMPILASI ---
async function compileData() {
    const msg = document.getElementById('compile-message-global');
    msg.textContent = 'Memulai kompilasi... Tunggu sebentar (Ollama bekerja)...';
    msg.className = 'message-global active info'; 
    try {
        const response = await fetch(`${BACKEND_URL}/admin/compile`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (response.ok) {
            msg.textContent = `${data.message}`;
            msg.className = 'message-global active success';
        } else {
            msg.textContent = `Gagal kompilasi: ${data.error || response.statusText}`;
            msg.className = 'message-global active error';
        }
    } catch (error) {
        msg.textContent = `Error Koneksi: Pastikan Backend & Ollama berjalan.`;
        msg.className = 'message-global active error';
        console.error('Error:', error);
    }
    
    setTimeout(() => {
        msg.classList.remove('active');
    }, 5000);
}

// --- 6. FUNGSI SUBMISSION (Kiriman User) ---
async function loadSubmissions() {
    const list = document.getElementById('submission-list');
    const msg = document.getElementById('submission-message');
    list.innerHTML = 'Memuat kiriman...';
    msg.textContent = '';
    try {
        const response = await fetch(`${BACKEND_URL}/submission/all`, {
            method: 'GET',
            headers: getAuthHeaders()
        });
        if (handleAuthError(response)) return;
        if (!response.ok) throw new Error(`Gagal memuat kiriman: ${response.statusText}`);
        
        const submissions = await response.json();
        list.innerHTML = '';
        if (submissions.length === 0) {
            list.innerHTML = '<p>Belum ada kiriman data dari user.</p>';
            return;
        }
        submissions.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `submission-item status-${item.status}`; 
            let actionButtons = '';
            if (item.status === 'pending') {
                actionButtons = `
                    <button class="btn-success" onclick="updateSubmissionStatus('${item._id}', 'accepted')">Terima</button>
                    <button class="btn-danger" onclick="updateSubmissionStatus('${item._id}', 'rejected')">Tolak</button>
                `;
            }
            itemDiv.innerHTML = `
                <div class="submission-content">
                    <strong>Tag:</strong> ${item.tag} <br>
                    <strong>Konten:</strong> ${item.content_text} <br>
                    <small>Dikirim oleh: ${item.submittedBy.email} | Status: <span class="status-badge">${item.status}</span></small>
                </div>
                <div class="submission-actions">
                    ${actionButtons}
                </div>
            `;
            list.appendChild(itemDiv);
        });
    } catch (error) {
        list.innerHTML = '';
        msg.textContent = `Error: ${error.message}`;
    }
}

async function updateSubmissionStatus(id, newStatus) {
    const msg = document.getElementById('submission-message');
    if (!confirm(`Anda yakin ingin mengubah status data ini menjadi "${newStatus}"?`)) return;
    msg.textContent = 'Memperbarui status...';
    try {
        const response = await fetch(`${BACKEND_URL}/submission/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        if (!response.ok) throw new Error('Gagal memperbarui status.');
        msg.textContent = `Status berhasil diubah menjadi ${newStatus}!`;
        loadSubmissions(); // Muat ulang list
        if (newStatus === 'accepted') {
            loadData(); // Muat ulang dataset utama jika di-accept
        }
    } catch (error) {
        msg.textContent = `Error: ${error.message}`;
    }
}

// --- 7. FUNGSI CHATBOT ADMIN ---
const adminChatMessages = document.getElementById('admin-chat-messages');
const adminUserInput = document.getElementById('admin-user-input');


function adminAddMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
    
    const formattedText = text.replace(/\n/g, '<br>');
    messageDiv.innerHTML = formattedText;

    adminChatMessages.appendChild(messageDiv);
    adminChatMessages.scrollTop = adminChatMessages.scrollHeight;
}

async function adminSendMessage() {
    const question = adminUserInput.value.trim();
    if (!question) return;

    adminAddMessage('user', question);
    adminUserInput.value = '';
    
    const loadingMessage = document.createElement('div');
    loadingMessage.classList.add('message', 'bot-message', 'loading');
    loadingMessage.textContent = 'Mengetik...';
    adminChatMessages.appendChild(loadingMessage);
    adminChatMessages.scrollTop = adminChatMessages.scrollHeight;

    try {
        const response = await fetch('http://localhost:3000/api/chat', {
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
        adminAddMessage('bot', data.answer);

    } catch (error) {
        loadingMessage.remove();
        console.error('Error saat mengirim pesan (admin):', error);
        adminAddMessage('bot', `❌ Error: Gagal mendapatkan jawaban. Detail: ${error.message}`);
    }
}

// --- 8. FUNGSI MODAL EDIT  ---
function openEditModal(id) {
    // 1. Cari data yang cocok di memori 
    const item = allDatasets.find(d => String(d._id) === String(id));

    if (!item) {
        console.error("GAGAL: Data tidak ditemukan di allDatasets!", id);
        alert("Data tidak ditemukan di memori browser. Coba refresh halaman.");
        return;
    }

    // 2. Isi form modal dengan data asli
    document.getElementById('edit-id').value = item._id;
    document.getElementById('edit-tag').value = item.tag;
    document.getElementById('edit-content').value = item.content_text;

    // 3. Tampilkan modal
    document.getElementById('edit-modal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

async function saveEdit() {
    const id = document.getElementById('edit-id').value;
    const tag = document.getElementById('edit-tag').value;
    const content = document.getElementById('edit-content').value;
    
    await updateData(id, tag, content); 
    
    closeEditModal();
}

// --- 9. FUNGSI BARU UNTUK MODAL IMPORT ---
function openImportModal() {
    document.getElementById('import-modal').style.display = 'block';
     document.getElementById('import-message').textContent = '';
    document.getElementById('import-file-input').value = null; // Kosongkan input file
}

function closeImportModal() {
    document.getElementById('import-modal').style.display = 'none';
}

async function uploadFile() {
    const fileInput = document.getElementById('import-file-input');
    const msg = document.getElementById('import-message');
    
    if (fileInput.files.length === 0) {
        msg.textContent = 'Silakan pilih file terlebih dahulu.';
        msg.className = 'message error';
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('importFile', file); 

    msg.textContent = 'Mengupload dan memproses file...';
    msg.className = 'message info';

    try {
        const headers = new Headers();
        headers.append('Authorization', `Bearer ${getToken()}`);

        const response = await fetch(`${BACKEND_URL}/admin/import`, {
            method: 'POST',
            headers: headers, 
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Gagal mengupload file.');
        }

        msg.textContent = `${data.message}`;
        msg.className = 'message success';
        
        loadData(); 
        
            setTimeout(() => {
            closeImportModal();
        }, 3000);

    } catch (error) {
        msg.textContent = `Error: ${error.message}`;
        msg.className = 'message error';
        console.error('Error uploadFile:', error);
    }
}