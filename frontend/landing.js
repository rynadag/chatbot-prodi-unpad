// File: frontend/landing.js

document.addEventListener('DOMContentLoaded', () => {

    // --- Ambil semua elemen ---
    const chatToggleButton = document.getElementById('chat-toggle-button');
    const chatWidget = document.getElementById('chat-widget');
    const closeButton = document.getElementById('chat-close-button');
    const sendButton = document.getElementById('chat-widget-send-button');
    const userInput = document.getElementById('chat-widget-user-input');
    const messagesContainer = document.getElementById('chat-widget-messages');

    // API endpoint publik
    const PUBLIC_CHAT_API = 'http://localhost:3000/api/public-chat';

    // --- Fungsi untuk Tampil/Sembunyi widget ---
    chatToggleButton.addEventListener('click', () => {
        chatWidget.classList.toggle('hidden');
    });

    closeButton.addEventListener('click', () => {
        chatWidget.classList.add('hidden');
    });

    // --- Fungsi untuk Kirim Pesan ---
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    function renderMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
            .replace(/^- (.+)$/gm, "<li>$1</li>")
            .replace(/\n/g, "<br>");
    }

    function addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
        messageDiv.innerHTML = sender === 'bot' ? renderMarkdown(text) : text;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage() {
        const question = userInput.value.trim();
        if (!question) return;

        addMessage('user', question);
        userInput.value = '';
        
        // Tampilkan loading
        const loadingMessage = document.createElement('div');
        loadingMessage.classList.add('bot-message', 'loading');
        loadingMessage.textContent = 'Mengetik...';
        messagesContainer.appendChild(loadingMessage);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await fetch(PUBLIC_CHAT_API, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // TIDAK ADA header 'Authorization'
                body: JSON.stringify({ question: question }),
            });

            loadingMessage.remove(); // Hapus loading

            const data = await response.json();

            if (!response.ok) {
                // Ambil pesan error dari body
                throw new Error(data.answer || 'Gagal terhubung ke AI.');
            }
            
            addMessage('bot', data.answer);

        } catch (error) {
            loadingMessage.remove();
            console.error('Error saat mengirim pesan (publik):', error);
            addMessage('bot', `Error: ${error.message}`);
        }
    }
});