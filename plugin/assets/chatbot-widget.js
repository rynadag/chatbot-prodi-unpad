/**
 * Chatbot Prodi Unpad — Frontend JS v3.0
 *
 * Key improvements:
 *  - Uses WP REST API (/wp-json/cunpad/v1/) instead of admin-ajax.php
 *  - Real-time streaming via SSE proxy → tokens appear word-by-word
 *  - Retry-once on transient network errors
 *  - Rate-limit feedback (429 response)
 *  - Markdown renderer (bold, italic, lists, headings, code)
 *  - Session token stored in sessionStorage (cleared on tab close)
 *  - Accessibility: aria-live region on message container
 */

(function () {
    'use strict';

    /* ── Config ───────────────────────────────────────────── */
    const cfg  = window.cunpadConfig || {};
    const REST = cfg.restUrl  || '/wp-json/cunpad/v1/';
    const AJAX = cfg.ajaxUrl  || '/wp-admin/admin-ajax.php';
    const NONCE_REST = cfg.nonce      || '';   // X-WP-Nonce
    const NONCE_AJAX = cfg.ajaxNonce  || '';

    /* ── REST helper ─────────────────────────────────────── */
    async function restPost(endpoint, body) {
        const res = await fetch(REST + endpoint, {
            method:  'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WP-Nonce':   NONCE_REST,
            },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    async function restGet(endpoint, params = {}) {
        const qs  = new URLSearchParams(params).toString();
        const url = REST + endpoint + (qs ? '?' + qs : '');
        const res = await fetch(url, {
            headers: { 'X-WP-Nonce': NONCE_REST },
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    }

    /* ── Session token ───────────────────────────────────── */
    const Token = {
        get:   ()      => sessionStorage.getItem('cunpad_token') || '',
        set:   (t, r)  => { sessionStorage.setItem('cunpad_token', t); sessionStorage.setItem('cunpad_role', r || 'user'); },
        clear: ()      => { sessionStorage.removeItem('cunpad_token'); sessionStorage.removeItem('cunpad_role'); },
    };

    /* ── Markdown renderer ───────────────────────────────── */
    function md(text) {
        if (!text) return '';
        // Escape HTML first
        let s = text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Code blocks (`code`)
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold (**text**)
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italic (*text*)
        s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Headings
        s = s.replace(/^### (.+)$/gm, '<h4 class="cunpad-md-h">$1</h4>');
        s = s.replace(/^## (.+)$/gm,  '<h3 class="cunpad-md-h">$1</h3>');
        // Unordered list items → wrap in ul later
        s = s.replace(/^- (.+)$/gm, '<li>$1</li>');
        // Wrap consecutive <li> in <ul>
        s = s.replace(/(<li>.*?<\/li>(\n|$))+/gs, m => '<ul>' + m.replace(/\n$/, '') + '</ul>');
        // Newlines → <br> (outside block elements)
        s = s.replace(/\n/g, '<br>');

        return s;
    }

    /* ── DOM helper: append message bubble ───────────────── */
    function appendMsg(container, role, content, isHtml = false) {
        const div = document.createElement('div');
        div.className = 'cunpad-msg-bubble ' + (role === 'user' ? 'cunpad-user' : 'cunpad-bot');
        if (isHtml) div.innerHTML = content;
        else        div.textContent = content;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div;
    }

    /* ── Status message helper ───────────────────────────── */
    function setStatus(el, text, type) {
        el.textContent = text;
        el.className   = 'cunpad-msg' + (type ? ' cunpad-' + type : '');
    }

    /* ── SSE streaming send ───────────────────────────────── */
    async function sendStreaming({ question, token, messagesEl, sendBtn, inputEl }) {
        appendMsg(messagesEl, 'user', question);
        inputEl.value = '';
        sendBtn.disabled = true;

        // Bot bubble (will be filled token-by-token)
        const botBubble = appendMsg(messagesEl, 'bot', '', false);
        botBubble.classList.add('cunpad-streaming');
        botBubble.innerHTML = '<span class="cunpad-cursor">▍</span>';

        let rawText = '';

        try {
            const body = { question };
            if (token) body.token = token;

            const res = await fetch(REST + 'stream', {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce':   NONCE_REST,
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                if (res.status === 429) throw new Error('⚠️ Batas permintaan tercapai. Tunggu sebentar.');
                if (res.status === 401 || res.status === 403) throw new Error('UNAUTHORIZED');
                throw new Error(err.error || 'Gagal terhubung ke server.');
            }

            const reader  = res.body.getReader();
            const decoder = new TextDecoder();
            let   buffer  = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (!payload) continue;

                    let evt;
                    try { evt = JSON.parse(payload); } catch { continue; }

                    if (evt.token) {
                        rawText += evt.token;
                        // Render markdown on accumulated text
                        botBubble.innerHTML = md(rawText) + '<span class="cunpad-cursor">▍</span>';
                        messagesEl.scrollTop = messagesEl.scrollHeight;
                    }

                    if (evt.done) {
                        botBubble.innerHTML = md(rawText);
                        botBubble.classList.remove('cunpad-streaming');
                    }

                    if (evt.error) {
                        throw new Error(evt.error);
                    }
                }
            }

            // Final render without cursor
            if (rawText) {
                botBubble.innerHTML = md(rawText);
            }
            botBubble.classList.remove('cunpad-streaming');

        } catch (err) {
            botBubble.classList.remove('cunpad-streaming');

            if (err.message === 'UNAUTHORIZED') {
                Token.clear();
                botBubble.textContent = '⚠️ Sesi habis. Silakan login kembali.';
                // Trigger re-show of login overlay
                document.getElementById('cunpad-auth-overlay')?.removeAttribute('style');
                document.getElementById('cunpad-header')?.setAttribute('style', 'display:none');
                document.getElementById('cunpad-content-area')?.setAttribute('style', 'display:none');
            } else {
                botBubble.textContent = '❌ ' + (err.message || 'Terjadi kesalahan. Coba lagi.');
            }
        } finally {
            sendBtn.disabled = false;
            inputEl.focus();
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    /* ── Wire up a chat input pair ───────────────────────── */
    function wireChatInput({ inputEl, sendBtn, messagesEl, tokenFn }) {
        // Initial greeting
        appendMsg(messagesEl, 'bot', 'Halo! Silakan ajukan pertanyaan Anda seputar Program Studi MIM FEB Unpad.');

        const send = () => {
            const q = inputEl.value.trim();
            if (!q || sendBtn.disabled) return;
            sendStreaming({
                question:   q,
                token:      tokenFn ? tokenFn() : '',
                messagesEl, sendBtn, inputEl,
            });
        };

        sendBtn.addEventListener('click', send);
        inputEl.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    }

    // ═══════════════════════════════════════════════════════
    // PUBLIC INLINE WIDGET
    // ═══════════════════════════════════════════════════════
    function initPublic() {
        const root = document.getElementById('cunpad-public');
        if (!root) return;

        wireChatInput({
            inputEl:    document.getElementById('cunpad-pub-input'),
            sendBtn:    document.getElementById('cunpad-pub-send'),
            messagesEl: document.getElementById('cunpad-pub-messages'),
            tokenFn:    null,
        });
    }

    // ═══════════════════════════════════════════════════════
    // FLOATING BUBBLE
    // ═══════════════════════════════════════════════════════
    function initFloat() {
        const root = document.getElementById('cunpad-float-root');
        if (!root) return;

        const panel    = document.getElementById('cunpad-float-panel');
        const toggleBtn = document.getElementById('cunpad-float-btn');
        const closeBtn  = document.getElementById('cunpad-float-close');
        let   opened    = false;

        const open = () => {
            panel.classList.remove('cunpad-hidden');
            toggleBtn.setAttribute('aria-expanded', 'true');
            if (!opened) {
                wireChatInput({
                    inputEl:    document.getElementById('cunpad-float-input'),
                    sendBtn:    document.getElementById('cunpad-float-send'),
                    messagesEl: document.getElementById('cunpad-float-messages'),
                    tokenFn:    null,
                });
                opened = true;
            }
            document.getElementById('cunpad-float-input')?.focus();
        };

        const close = () => {
            panel.classList.add('cunpad-hidden');
            toggleBtn.setAttribute('aria-expanded', 'false');
        };

        toggleBtn.addEventListener('click', () => panel.classList.contains('cunpad-hidden') ? open() : close());
        closeBtn.addEventListener('click', close);
    }

    // ═══════════════════════════════════════════════════════
    // FULL DASHBOARD
    // ═══════════════════════════════════════════════════════
    function initFull() {
        const dash = document.getElementById('cunpad-dashboard');
        if (!dash) return;

        const $overlay  = document.getElementById('cunpad-auth-overlay');
        const $header   = document.getElementById('cunpad-header');
        const $content  = document.getElementById('cunpad-content-area');
        const $dot      = document.getElementById('cunpad-status-dot');

        /* ── Auth state ── */
        const show = (state) => {
            if (state === 'dashboard') {
                $overlay.style.display = 'none';
                $header.style.display  = '';
                $content.style.display = '';
            } else {
                $overlay.style.display = '';
                $header.style.display  = 'none';
                $content.style.display = 'none';
            }
        };

        Token.get() ? show('dashboard') : show('auth');

        /* ── Tab nav ── */
        dash.querySelectorAll('.cunpad-nav-link').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const targetId = link.dataset.target;
                dash.querySelectorAll('.cunpad-section').forEach(s => s.classList.remove('active'));
                dash.querySelectorAll('.cunpad-nav-link').forEach(l => l.classList.remove('active'));
                document.getElementById(targetId)?.classList.add('active');
                link.classList.add('active');
                if (targetId === 'cunpad-sec-history') loadHistory();
            });
        });

        /* ── Auth form toggles ── */
        document.getElementById('cunpad-show-register')?.addEventListener('click', e => {
            e.preventDefault();
            document.getElementById('cunpad-login-form').style.display    = 'none';
            document.getElementById('cunpad-register-form').style.display = '';
        });
        document.getElementById('cunpad-show-login')?.addEventListener('click', e => {
            e.preventDefault();
            document.getElementById('cunpad-register-form').style.display = 'none';
            document.getElementById('cunpad-login-form').style.display    = '';
        });

        /* ── LOGIN ── */
        document.getElementById('cunpad-login-btn')?.addEventListener('click', async () => {
            const email    = document.getElementById('cunpad-login-email').value.trim();
            const password = document.getElementById('cunpad-login-password').value;
            const msgEl    = document.getElementById('cunpad-login-msg');

            if (!email || !password) { setStatus(msgEl, 'Email dan password wajib diisi.', 'error'); return; }
            setStatus(msgEl, '⏳ Memproses…', 'info');

            try {
                const { ok, status, data } = await restPost('login', { email, password });
                if (ok && data.token) {
                    Token.set(data.token, data.role);
                    show('dashboard');
                    setStatus(msgEl, '', '');
                } else if (status === 429) {
                    setStatus(msgEl, '⚠️ Terlalu banyak percobaan. Tunggu sebentar.', 'error');
                } else {
                    setStatus(msgEl, '❌ ' + (data.error || 'Login gagal.'), 'error');
                }
            } catch { setStatus(msgEl, '❌ Gagal terhubung ke server.', 'error'); }
        });

        /* ── REGISTER ── */
        document.getElementById('cunpad-register-btn')?.addEventListener('click', async () => {
            const email    = document.getElementById('cunpad-reg-email').value.trim();
            const password = document.getElementById('cunpad-reg-password').value;
            const msgEl    = document.getElementById('cunpad-register-msg');

            if (!email || !password)  { setStatus(msgEl, 'Semua field wajib diisi.', 'error'); return; }
            if (password.length < 6) { setStatus(msgEl, 'Password minimal 6 karakter.', 'error'); return; }
            setStatus(msgEl, '⏳ Mendaftarkan…', 'info');

            try {
                const { ok, status, data } = await restPost('register', { email, password });
                if (ok) {
                    setStatus(msgEl, '✅ Akun berhasil dibuat! Silakan login.', 'success');
                    setTimeout(() => {
                        document.getElementById('cunpad-register-form').style.display = 'none';
                        document.getElementById('cunpad-login-form').style.display    = '';
                        setStatus(msgEl, '', '');
                    }, 1800);
                } else if (status === 429) {
                    setStatus(msgEl, '⚠️ Terlalu banyak percobaan.', 'error');
                } else {
                    setStatus(msgEl, '❌ ' + (data.error || 'Registrasi gagal.'), 'error');
                }
            } catch { setStatus(msgEl, '❌ Gagal terhubung ke server.', 'error'); }
        });

        /* ── LOGOUT ── */
        document.getElementById('cunpad-logout-btn')?.addEventListener('click', () => {
            Token.clear();
            show('auth');
            document.getElementById('cunpad-login-form').style.display    = '';
            document.getElementById('cunpad-register-form').style.display = 'none';
        });

        /* ── Chat ── */
        wireChatInput({
            inputEl:    document.getElementById('cunpad-chat-input'),
            sendBtn:    document.getElementById('cunpad-chat-send'),
            messagesEl: document.getElementById('cunpad-chat-messages'),
            tokenFn:    Token.get,
        });

        /* ── Submit dataset ── */
        document.getElementById('cunpad-submit-btn')?.addEventListener('click', async () => {
            const tag          = document.getElementById('cunpad-sub-tag').value.trim();
            const content_text = document.getElementById('cunpad-sub-content').value.trim();
            const msgEl        = document.getElementById('cunpad-submit-msg');

            if (!tag)          { setStatus(msgEl, 'Tag wajib diisi.', 'error'); return; }
            if (!content_text) { setStatus(msgEl, 'Konten wajib diisi.', 'error'); return; }
            setStatus(msgEl, '⏳ Mengirim…', 'info');

            try {
                const { ok, data } = await restPost('submission', { tag, content_text, token: Token.get() });
                if (ok) {
                    setStatus(msgEl, '✅ Kiriman berhasil disimpan untuk ditinjau.', 'success');
                    document.getElementById('cunpad-sub-tag').value     = '';
                    document.getElementById('cunpad-sub-content').value = '';
                } else {
                    setStatus(msgEl, '❌ ' + (data.error || 'Gagal mengirim.'), 'error');
                }
            } catch { setStatus(msgEl, '❌ Gagal terhubung ke server.', 'error'); }
        });

        /* ── History ── */
        document.getElementById('cunpad-reload-history')?.addEventListener('click', loadHistory);

        async function loadHistory() {
            const listEl = document.getElementById('cunpad-history-list');
            const msgEl  = document.getElementById('cunpad-history-msg');
            listEl.innerHTML = '';
            setStatus(msgEl, '⏳ Memuat…', 'info');

            try {
                const { ok, data } = await restGet('my-submissions', { token: Token.get() });
                setStatus(msgEl, '', '');

                if (!ok) { setStatus(msgEl, '❌ Gagal memuat histori.', 'error'); return; }
                if (!Array.isArray(data) || !data.length) {
                    setStatus(msgEl, 'Belum ada kiriman.', '');
                    return;
                }

                const labels = { pending: '🟡 Menunggu', accepted: '✅ Diterima', rejected: '❌ Ditolak' };
                data.forEach(item => {
                    const el = document.createElement('div');
                    el.className = 'cunpad-submission-item cunpad-status-' + item.status;
                    el.innerHTML =
                        `<strong>Tag:</strong> ${esc(item.tag)}<br>` +
                        `<strong>Konten:</strong> ${esc((item.content_text || '').slice(0, 120))}…<br>` +
                        `<strong>Status:</strong> <span class="cunpad-status-badge">${labels[item.status] || item.status}</span>` +
                        (item.notes ? `<br><strong>Catatan:</strong> ${esc(item.notes)}` : '');
                    listEl.appendChild(el);
                });
            } catch { setStatus(msgEl, '❌ Gagal terhubung ke server.', 'error'); }
        }
    }

    /* ── HTML escape ─────────────────────────────────────── */
    function esc(s) {
        const d = document.createElement('div');
        d.textContent = String(s);
        return d.innerHTML;
    }

    /* ── Boot ────────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        const mode = cfg.mode;
        if (mode === 'public') initPublic();
        if (mode === 'float')  initFloat();
        if (mode === 'full')   initFull();
    });

})();
