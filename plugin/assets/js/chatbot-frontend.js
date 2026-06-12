/**
 * KUI UNPAD Chatbot – Frontend v1.1.0
 * No-captcha build · Clean card design
 */
(function (win, doc) {
    'use strict';

    /* ── Config ──────────────────────────────────────────────────────────── */
    var C = win.kuiChatbotConfig || {};
    var API_URL     = (C.apiUrl     || 'http://localhost:5000').replace(/\/$/, '');
    var WS_URL      = C.wsUrl       || 'ws://localhost:8080/ws';
    var BOT_NAME    = C.botName     || 'KUI UNPAD Assistant';
    var BOT_SUB     = C.botSubtitle || 'Universitas Padjadjaran';
    var LOGO_URL    = C.logoUrl     || '';
    var DEF_LANG    = (C.defaultLang === 'en') ? 'en' : 'id';

    /* ── Language copy ───────────────────────────────────────────────────── */
    var T = {
        id: {
            initial      : 'Halo! Saya Asisten Akademik dari Kantor Internasional. Ada yang bisa saya bantu terkait informasi kampus, beasiswa, prosedur akademik, atau kebutuhan mahasiswa internasional?',
            langTitle    : 'Ganti bahasa respons',
            disconnected : '⚠️ Koneksi ke server terputus. Silakan refresh halaman.',
            privacyOff   : 'Riwayat sesi ini tidak akan disimpan untuk pelatihan AI.',
            topicsUser   : 'Tampilkan list topik',
            topicsIntro  : 'Berikut adalah daftar topik yang tersedia:\n\n',
            topicsEmpty  : 'Maaf, belum ada topik yang tersedia saat ini.',
            topicsHint   : '\n*Silakan ketik salah satu topik di atas untuk detail.*',
            topicsFail   : '⚠️ Gagal memuat daftar topik. Silakan coba lagi.',
            suggestion   : 'Bingung ingin bertanya apa? Lihat daftar topik yang tersedia.',
            viewTopics   : 'Lihat Topik',
            placeholder  : 'Ketik pertanyaan Anda di sini...',
            disclaimer   : 'AI dapat membuat kesalahan. Verifikasi informasi penting sebelum digunakan.',
            sourceLabel  : 'Sumber',
            copy         : 'Salin', copied : 'Tersalin', regenerate : 'Ulangi',
            consentTitle : 'Persetujuan Privasi',
            consentText  : 'Untuk meningkatkan kualitas jawaban AI, kami membutuhkan izin untuk menyimpan riwayat percakapan ini secara anonim.',
            reject : 'Tolak', allow : 'Izinkan',
        },
        en: {
            initial      : "Hello! I'm an Academic Assistant from the International Office. How can I help you with campus information, scholarships, or academic procedures?",
            langTitle    : 'Change response language',
            disconnected : '⚠️ Connection to the server was lost. Please refresh the page.',
            privacyOff   : 'This session history will not be saved for AI training.',
            topicsUser   : 'Show available topics',
            topicsIntro  : 'Here are the available topics:\n\n',
            topicsEmpty  : 'Sorry, there are no topics available right now.',
            topicsHint   : '\n*Please type one of the topics above for more detail.*',
            topicsFail   : '⚠️ Failed to load topics. Please try again.',
            suggestion   : 'Not sure what to ask? Check out the available topics.',
            viewTopics   : 'View Topics',
            placeholder  : 'Type your question here...',
            disclaimer   : 'AI can make mistakes. Please verify important information before using it.',
            sourceLabel  : 'Sources',
            copy         : 'Copy', copied : 'Copied', regenerate : 'Regenerate',
            consentTitle : 'Privacy Consent',
            consentText  : 'To improve the quality of AI answers, we need permission to store this conversation history anonymously.',
            reject : 'Reject', allow : 'Allow',
        }
    };

    /* ── Icons ───────────────────────────────────────────────────────────── */
    var IC = {
        send    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
        copy    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        check   : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        retry   : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
        sun     : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.07 1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2m-4.34-7.07-1.41 1.41M6.34 17.66l-1.41 1.41"/></svg>',
        moon    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
        book    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
        x       : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
        loader  : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
        file    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
        chat    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>',
        user    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>',
        shield  : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>',
    };

    /* ── Markdown parser ─────────────────────────────────────────────────── */
    function esc(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function inlineMd(t) {
        t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        t = t.replace(/__([^_\n]+)__/g,     '<strong>$1</strong>');
        t = t.replace(/\*([^*\n]+)\*/g,     '<em>$1</em>');
        t = t.replace(/_([^_\n]+)_/g,       '<em>$1</em>');
        t = t.replace(/`([^`]+)`/g,         '<code class="kui-md-inline-code">$1</code>');
        t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="kui-md-link">$1</a>');
        return t;
    }

    function parseMd(raw) {
        if (!raw) return '';
        var lines = raw.split('\n'), out = [], i = 0;
        var inCode = false, codeLang = '', codeLines = [];
        var listType = '', listItems = [];
        var tableRows = [], inTable = false;

        function flushList() {
            if (!listItems.length) return;
            var tag = listType === 'ol' ? 'ol' : 'ul';
            out.push('<' + tag + ' class="kui-md-list">');
            listItems.forEach(function(li) { out.push('<li>' + inlineMd(li) + '</li>'); });
            out.push('</' + tag + '>');
            listItems = []; listType = '';
        }
        function flushTable() {
            if (tableRows.length < 2) { tableRows = []; return; }
            var hdr = tableRows[0], body = tableRows.slice(2);
            out.push('<div class="kui-md-table-wrap"><table class="kui-md-table"><thead><tr>');
            hdr.forEach(function(c) { out.push('<th>' + inlineMd(c.trim()) + '</th>'); });
            out.push('</tr></thead>');
            if (body.length) {
                out.push('<tbody>');
                body.forEach(function(row) {
                    out.push('<tr>');
                    row.forEach(function(c) { out.push('<td>' + inlineMd(c.trim()) + '</td>'); });
                    out.push('</tr>');
                });
                out.push('</tbody>');
            }
            out.push('</table></div>');
            tableRows = [];
        }

        while (i < lines.length) {
            var line = lines[i];

            // Code fence
            if (/^```/.test(line)) {
                if (!inCode) {
                    flushList(); if (inTable) { flushTable(); inTable = false; }
                    inCode = true; codeLang = line.slice(3).trim(); codeLines = [];
                } else {
                    inCode = false;
                    var hdr2 = codeLang
                        ? '<div class="kui-code-header"><span class="kui-code-lang">' + esc(codeLang) + '</span>'
                          + '<button class="kui-copy-code-btn" data-code="' + encodeURIComponent(codeLines.join('\n')) + '">' + IC.copy + '<span>Copy</span></button></div>'
                        : '';
                    out.push('<div class="kui-code-block">' + hdr2 + '<pre><code>' + esc(codeLines.join('\n')) + '</code></pre></div>');
                }
                i++; continue;
            }
            if (inCode) { codeLines.push(line); i++; continue; }

            // Table
            if (line.includes('|')) {
                var parts = line.split('|');
                if (parts[0].trim() === '') parts.shift();
                if (parts.length && parts[parts.length-1].trim() === '') parts.pop();
                if (parts.length >= 2) {
                    if (!inTable) { flushList(); inTable = true; tableRows = []; }
                    tableRows.push(parts); i++; continue;
                }
            }
            if (inTable) { flushTable(); inTable = false; }

            if (!line.trim()) { flushList(); i++; continue; }

            var hm = line.match(/^(#{1,3})\s+(.+)$/);
            if (hm) { flushList(); var lv = hm[1].length; out.push('<h'+lv+' class="kui-md-h'+lv+'">'+inlineMd(hm[2])+'</h'+lv+'>'); i++; continue; }

            if (/^>\s/.test(line)) { flushList(); out.push('<blockquote class="kui-md-blockquote">'+inlineMd(line.slice(2))+'</blockquote>'); i++; continue; }
            if (/^[-*_]{3,}$/.test(line.trim())) { flushList(); out.push('<hr class="kui-md-hr">'); i++; continue; }

            var ulm = line.match(/^[-*+]\s+(.+)$/);
            if (ulm) { if (listType !== 'ul') { flushList(); listType = 'ul'; } listItems.push(ulm[1]); i++; continue; }
            var olm = line.match(/^\d+\.\s+(.+)$/);
            if (olm) { if (listType !== 'ol') { flushList(); listType = 'ol'; } listItems.push(olm[1]); i++; continue; }

            flushList();
            out.push('<p class="kui-md-p">' + inlineMd(line) + '</p>');
            i++;
        }
        flushList(); if (inTable) flushTable();
        return out.join('');
    }

    /* ── Helpers ─────────────────────────────────────────────────────────── */
    function genId() {
        try { if (win.crypto && win.crypto.randomUUID) return win.crypto.randomUUID(); } catch(e) {}
        return 'tab-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    }
    function normSrc(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.reduce(function(a, item) {
            if (!item || typeof item.topic !== 'string' || !item.topic.trim()) return a;
            a.push({ topic: item.topic.trim(), id: item.id || '', category: item.category || '' });
            return a;
        }, []);
    }
    function safeJson(s) { try { return JSON.parse(s); } catch(e) { return null; } }
    function copyText(t) {
        var clean = t.replace(/<[^>]*>/g, '');
        if (navigator.clipboard) return navigator.clipboard.writeText(clean);
        var ta = doc.createElement('textarea');
        ta.value = clean; ta.style.cssText = 'position:fixed;opacity:0';
        doc.body.appendChild(ta); ta.select(); doc.execCommand('copy'); doc.body.removeChild(ta);
        return Promise.resolve();
    }

    /* ── KUIChatbot ──────────────────────────────────────────────────────── */
    function KUIChatbot(root) {
        this.root      = root;
        this.uid       = root.id || ('kui-' + Date.now());
        this.mode      = root.getAttribute('data-mode') || 'embedded';
        this.olang     = root.getAttribute('data-lang') || '';
        this.oheight   = root.getAttribute('data-height') || '';

        this.msgs        = [];
        this.loading     = false;
        this.isDark      = false;
        this.lang        = this.olang || DEF_LANG;
        this.wsStatus    = 'CLOSED';
        this.ws          = null;
        this.consent     = null;
        this.showBanner  = true;
        this.tabId       = genId();
        this.heartbeat   = null;
        this.streamMap   = {};
        this.helloSent   = false;
        this.floatOpen   = false;
        this.unread      = 0;
        this.el          = {};

        this._render();
        this._initTheme();
        this._bindEvents();
        this._addInitial();
        this._connectWS();
    }

    /* ── Build HTML ────────────────────────────────────────────────────── */
    KUIChatbot.prototype._buildCard = function() {
        var l    = T[this.lang];
        var fBtn = (this.mode === 'floating')
            ? '<button class="kui-float-close" title="Tutup">' + IC.x + '</button>' : '';

        return [
            /* Consent */
            '<div class="kui-consent-overlay">',
            '  <div class="kui-consent-card">',
            '    <div class="kui-consent-icon">' + IC.shield + '</div>',
            '    <h3 class="kui-consent-title">' + l.consentTitle + '</h3>',
            '    <p class="kui-consent-text">' + l.consentText + '</p>',
            '    <div class="kui-consent-btns">',
            '      <button class="kui-btn-reject">' + l.reject + '</button>',
            '      <button class="kui-btn-allow">' + l.allow + '</button>',
            '    </div>',
            '  </div>',
            '</div>',

            /* Header */
            '<header class="kui-header">',
            '  <div class="kui-header-info">',
            '    <div class="kui-logo-wrapper">',
            '      <img class="kui-logo-img" src="' + esc(LOGO_URL) + '" alt="bot" onerror="this.style.display=\'none\'">',
            '      <span class="kui-status-dot" title="Disconnected"></span>',
            '    </div>',
            '    <div>',
            '      <h1 class="kui-bot-name">' + esc(BOT_NAME) + '</h1>',
            '      <p class="kui-bot-subtitle">' + esc(BOT_SUB) + '</p>',
            '    </div>',
            '  </div>',
            '  <div class="kui-header-controls">',
            '    <div class="kui-lang-toggle" title="' + esc(l.langTitle) + '">',
            '      <button class="kui-lang-btn' + (this.lang==='id'?' active':'') + '" data-lang="id">ID</button>',
            '      <button class="kui-lang-btn' + (this.lang==='en'?' active':'') + '" data-lang="en">EN</button>',
            '    </div>',
            '    <button class="kui-theme-btn" title="Toggle theme">' + (this.isDark ? IC.sun : IC.moon) + '</button>',
            '    ' + fBtn,
            '  </div>',
            '</header>',

            /* Messages */
            '<div class="kui-messages" role="log" aria-live="polite"></div>',

            /* Footer */
            '<footer class="kui-input-area">',
            '  <div class="kui-topic-banner">',
            '    <div class="kui-topic-text">' + IC.book + '<span>' + esc(l.suggestion) + '</span></div>',
            '    <div class="kui-topic-actions">',
            '      <button class="kui-view-topics-btn">' + esc(l.viewTopics) + '</button>',
            '      <button class="kui-close-banner-btn" aria-label="Dismiss">' + IC.x + '</button>',
            '    </div>',
            '  </div>',
            '  <div class="kui-input-row">',
            '    <input type="text" class="kui-msg-input" placeholder="' + esc(l.placeholder) + '" autocomplete="off" aria-label="Message input">',
            '    <button class="kui-send-btn" aria-label="Send">' + IC.send + '</button>',
            '  </div>',
            '  <p class="kui-disclaimer">' + esc(l.disclaimer) + '</p>',
            '</footer>',
        ].join('');
    };

    KUIChatbot.prototype._render = function() {
        var h = this.oheight || (C.chatHeight || '650px');
        this.root.style.setProperty('--kui-chat-height', h);
        var card = '<div class="kui-chat-card">' + this._buildCard() + '</div>';

        if (this.mode === 'floating') {
            this.root.innerHTML =
                '<button class="kui-float-btn" aria-label="Open chat">' + IC.chat
                + '<span class="kui-float-badge kui-hidden">1</span></button>'
                + '<div class="kui-float-panel kui-hidden">' + card + '</div>';
        } else {
            this.root.innerHTML = card;
        }
        this._cache();
    };

    KUIChatbot.prototype._cache = function() {
        var q = function(sel) { return this.root.querySelector(sel); }.bind(this);
        this.el = {
            overlay      : q('.kui-consent-overlay'),
            cReject      : q('.kui-btn-reject'),
            cAllow       : q('.kui-btn-allow'),
            cTitle       : q('.kui-consent-title'),
            cText        : q('.kui-consent-text'),
            dot          : q('.kui-status-dot'),
            msgs         : q('.kui-messages'),
            banner       : q('.kui-topic-banner'),
            viewTopics   : q('.kui-view-topics-btn'),
            closeBanner  : q('.kui-close-banner-btn'),
            input        : q('.kui-msg-input'),
            sendBtn      : q('.kui-send-btn'),
            disclaimer   : q('.kui-disclaimer'),
            themeBtn     : q('.kui-theme-btn'),
            langBtns     : this.root.querySelectorAll('.kui-lang-btn'),
            topicText    : q('.kui-topic-text span'),
            floatBtn     : q('.kui-float-btn'),
            floatPanel   : q('.kui-float-panel'),
            floatBadge   : q('.kui-float-badge'),
            floatClose   : q('.kui-float-close'),
        };
    };

    /* ── Theme ──────────────────────────────────────────────────────────── */
    KUIChatbot.prototype._initTheme = function() {
        var saved = localStorage.getItem('kui-theme');
        var sys   = win.matchMedia && win.matchMedia('(prefers-color-scheme: dark)').matches;
        this._applyTheme(saved === 'dark' || (!saved && sys));
    };
    KUIChatbot.prototype._applyTheme = function(dark) {
        this.isDark = dark;
        this.root[dark ? 'setAttribute' : 'removeAttribute']('data-theme', 'dark');
        if (this.el.themeBtn) this.el.themeBtn.innerHTML = dark ? IC.sun : IC.moon;
    };
    KUIChatbot.prototype._toggleTheme = function() {
        localStorage.setItem('kui-theme', this.isDark ? 'light' : 'dark');
        this._applyTheme(!this.isDark);
    };

    /* ── Language ───────────────────────────────────────────────────────── */
    KUIChatbot.prototype._setLang = function(lang) {
        if (lang === this.lang) return;
        this.lang = lang;
        localStorage.setItem('kui-chat-lang', lang);
        this._syncLangUI();
        if (this.msgs.length === 1 && this.msgs[0].sender === 'bot') {
            this.msgs = []; this.el.msgs.innerHTML = ''; this._addInitial();
        }
    };
    KUIChatbot.prototype._syncLangUI = function() {
        var l = T[this.lang];
        if (this.el.cTitle)     this.el.cTitle.textContent     = l.consentTitle;
        if (this.el.cText)      this.el.cText.textContent      = l.consentText;
        if (this.el.cReject)    this.el.cReject.textContent    = l.reject;
        if (this.el.cAllow)     this.el.cAllow.textContent     = l.allow;
        if (this.el.disclaimer) this.el.disclaimer.textContent = l.disclaimer;
        if (this.el.viewTopics) this.el.viewTopics.textContent = l.viewTopics;
        if (this.el.topicText)  this.el.topicText.textContent  = l.suggestion;
        if (this.el.input)      this.el.input.placeholder      = l.placeholder;
        this.el.langBtns.forEach(function(b) {
            b.classList.toggle('active', b.getAttribute('data-lang') === this.lang);
        }.bind(this));
    };

    /* ── WebSocket ──────────────────────────────────────────────────────── */
    KUIChatbot.prototype._connectWS = function() {
        var self = this, sock;
        try { sock = new WebSocket(WS_URL); } catch(e) { return; }
        self.wsStatus = 'CONNECTING';

        sock.onopen = function() {
            self.wsStatus = 'OPEN'; self._updateDot();
            if (!self.helloSent) {
                try {
                    sock.send(JSON.stringify({ type:'client_hello', tab_id: self.tabId, user_agent: navigator.userAgent }));
                    self.helloSent = true;
                } catch(e) {}
            }
            if (!self.heartbeat) {
                self.heartbeat = setInterval(function() {
                    try { sock.send(JSON.stringify({ type:'client_heartbeat', tab_id: self.tabId })); } catch(e) {}
                }, 30000);
            }
        };

        sock.onmessage = function(ev) {
            var d = safeJson(ev.data);
            if (!d) return;

            if (d.type === 'stream') {
                if (d.event === 'start') {
                    if (!(d.request_id in self.streamMap)) {
                        self.streamMap[d.request_id] = self._appendBot('');
                    }
                    self._setLoading(true);
                } else if (d.event === 'progress') {
                    var pi = self.streamMap[d.request_id];
                    if (typeof pi === 'number') self._updateMsg(pi, null, true);
                }
                return;
            }
            if (d.type === 'reply') {
                var ri = self.streamMap[d.request_id];
                var src = normSrc(d.sources);
                if (typeof ri === 'number') {
                    self._updateMsg(ri, d.reply || '', false, src);
                    delete self.streamMap[d.request_id];
                } else {
                    self._appendBot(d.reply || '', src);
                }
                self._setLoading(false);
                self._log('bot', d.reply || '');
                if (self.mode === 'floating' && !self.floatOpen) { self.unread++; self._badge(); }
                return;
            }
            if (d.Reply) {
                self._appendBot(d.Reply, normSrc(d.sources));
                self._setLoading(false); self._log('bot', d.Reply);
            }
            if (d.type === 'client_hello_ack' && d.tab_id) self.tabId = d.tab_id;
        };

        sock.onclose = sock.onerror = function() {
            self.wsStatus = 'CLOSED'; self._updateDot(); self._setLoading(false);
            if (self.heartbeat) { clearInterval(self.heartbeat); self.heartbeat = null; }
        };

        self.ws = sock;
        win.addEventListener('beforeunload', function() {
            try { sock.send(JSON.stringify({ type:'client_goodbye', tab_id: self.tabId })); sock.close(); } catch(e) {}
        });
    };

    KUIChatbot.prototype._updateDot = function() {
        var dot = this.el.dot; if (!dot) return;
        dot.classList.toggle('open', this.wsStatus === 'OPEN');
        dot.title = this.wsStatus === 'OPEN' ? 'Connected' : 'Disconnected';
    };

    /* ── Consent ────────────────────────────────────────────────────────── */
    KUIChatbot.prototype._showConsent = function() {
        if (this.el.overlay) this.el.overlay.style.display = 'flex';
    };
    KUIChatbot.prototype._hideConsent = function() {
        if (this.el.overlay) this.el.overlay.style.display = 'none';
    };
    KUIChatbot.prototype._doConsent = function(agreed) {
        this.consent = agreed ? 'true' : 'false';
        this._hideConsent();
        if (!agreed) this._appendBot(T[this.lang].privacyOff);
        // Notify backend (best-effort, no captcha needed)
        fetch(API_URL + '/api/create-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ consent: this.consent })
        }).catch(function() {});
    };

    /* ── Messages ───────────────────────────────────────────────────────── */
    KUIChatbot.prototype._addInitial = function() {
        var saved = localStorage.getItem('kui-chat-lang');
        if ((saved === 'id' || saved === 'en') && !this.olang) this.lang = saved;
        this._appendBot(T[this.lang].initial);
        this._syncLangUI();
    };

    KUIChatbot.prototype._appendBot = function(text, srcs) {
        var idx = this.msgs.length;
        this.msgs.push({ sender:'bot', text: text, srcs: srcs || [] });
        this._renderRow(idx); this._scroll(); return idx;
    };
    KUIChatbot.prototype._appendUser = function(text) {
        var idx = this.msgs.length;
        this.msgs.push({ sender:'user', text: text });
        this._renderRow(idx); this._scroll(); return idx;
    };

    KUIChatbot.prototype._updateMsg = function(idx, text, prog, srcs) {
        var m = this.msgs[idx]; if (!m) return;
        m.text = prog ? m.text.replace(/⏳+$/, '') + ' ⏳' : (text || '');
        if (srcs) m.srcs = srcs;
        var row = this.el.msgs && this.el.msgs.querySelector('[data-idx="'+idx+'"]');
        if (!row) { this._renderRow(idx); this._scroll(); return; }
        var bub = row.querySelector('.kui-bubble');
        if (bub) bub.innerHTML = parseMd(m.text);
        if (srcs && srcs.length) {
            var se = row.querySelector('.kui-sources');
            if (se) se.outerHTML = this._buildSrcs(srcs);
            else { var col = row.querySelector('.kui-bubble-col'); if (col) col.insertAdjacentHTML('beforeend', this._buildSrcs(srcs)); }
        }
        if (!prog) this._ensureActions(row, idx);
        this._scroll();
    };

    KUIChatbot.prototype._renderRow = function(idx) {
        var m  = this.msgs[idx];
        var u  = m.sender === 'user';
        var l  = T[this.lang];

        // Avatar
        var avClass = u ? 'kui-user-av' : 'kui-bot-av';
        var avInner = u
            ? IC.user
            : (LOGO_URL ? '<img src="' + esc(LOGO_URL) + '" alt="bot" onerror="this.style.display=\'none\'">' : IC.chat);
        var av = '<div class="kui-avatar ' + avClass + '" aria-hidden="true">' + avInner + '</div>';

        var bub = '<div class="kui-bubble">' + parseMd(m.text) + '</div>';
        var src = (m.srcs && m.srcs.length) ? this._buildSrcs(m.srcs) : '';
        var act = !u
            ? '<div class="kui-msg-actions">'
              + '<button class="kui-msg-action-btn kui-copy-btn">' + IC.copy + '<span>' + l.copy + '</span></button>'
              + (idx === this.msgs.length - 1 ? '<button class="kui-msg-action-btn retry">' + IC.retry + '<span>' + l.regenerate + '</span></button>' : '')
              + '</div>'
            : '';

        var col = '<div class="kui-bubble-col">' + bub + src + act + '</div>';
        var row = '<div class="kui-msg-row ' + (u ? 'user' : 'bot') + '" data-idx="' + idx + '">'
            + (u ? col + av : av + col) + '</div>';

        if (this.el.msgs) this.el.msgs.insertAdjacentHTML('beforeend', row);
        this._bindRow(idx);
    };

    KUIChatbot.prototype._buildSrcs = function(srcs) {
        var l = T[this.lang];
        var h = '<div class="kui-sources"><span class="kui-sources-label">' + IC.file + esc(l.sourceLabel) + '</span>';
        srcs.slice(0, 4).forEach(function(s) {
            var cat = (s.category && s.category !== 'General')
                ? '<span class="kui-source-category">' + esc(s.category) + '</span>' : '';
            h += '<span class="kui-source-badge" title="' + esc(s.topic) + '">'
               + '<span class="kui-source-topic">' + esc(s.topic) + '</span>' + cat + '</span>';
        });
        return h + '</div>';
    };

    KUIChatbot.prototype._ensureActions = function(row, idx) {
        if (!row) return;
        var acts = row.querySelector('.kui-msg-actions');
        if (!acts) return;
        if (idx === this.msgs.length - 1 && !acts.querySelector('.retry')) {
            var l = T[this.lang];
            acts.insertAdjacentHTML('beforeend',
                '<button class="kui-msg-action-btn retry">' + IC.retry + '<span>' + l.regenerate + '</span></button>');
            this._bindRow(idx);
        }
    };

    KUIChatbot.prototype._bindRow = function(idx) {
        var self = this;
        var row  = this.el.msgs && this.el.msgs.querySelector('[data-idx="' + idx + '"]');
        if (!row) return;

        var copyBtn = row.querySelector('.kui-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = function() {
                var m = self.msgs[idx]; if (!m) return;
                copyText(m.text).then(function() {
                    var l = T[self.lang];
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = IC.check + '<span>' + l.copied + '</span>';
                    setTimeout(function() {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = IC.copy + '<span>' + l.copy + '</span>';
                    }, 2000);
                });
            };
        }

        var retryBtn = row.querySelector('.retry');
        if (retryBtn) retryBtn.onclick = function() { self._retry(); };

        row.querySelectorAll('.kui-copy-code-btn').forEach(function(b) {
            b.onclick = function() {
                var code = decodeURIComponent(b.getAttribute('data-code') || '');
                copyText(code).then(function() {
                    b.innerHTML = IC.check + '<span>Copied!</span>';
                    setTimeout(function() { b.innerHTML = IC.copy + '<span>Copy</span>'; }, 2000);
                });
            };
        });
    };

    /* ── Send / Retry ───────────────────────────────────────────────────── */
    KUIChatbot.prototype._send = function() {
        var text = this.el.input ? this.el.input.value.trim() : '';
        if (!text || this.loading) return;
        if (this.wsStatus !== 'OPEN' || !this.ws) {
            this._appendBot(T[this.lang].disconnected); return;
        }
        if (this.el.topicBanner) this.el.topicBanner.classList.add('kui-hidden');
        this.showBanner = false;
        this.el.input.value = '';
        this._appendUser(text);
        this._setLoading(true);
        this._log('user', text);
        try {
            this.ws.send(JSON.stringify({
                message : text,
                history : this._history(text),
                tab_id  : this.tabId,
                language: this.lang,
            }));
        } catch(e) { this._setLoading(false); }
    };

    KUIChatbot.prototype._retry = function() {
        if (this.loading || this.wsStatus !== 'OPEN' || !this.ws) return;
        var last = null;
        for (var i = this.msgs.length - 1; i >= 0; i--) {
            if (this.msgs[i].sender === 'user') { last = this.msgs[i]; break; }
        }
        if (!last) return;
        if (this.msgs.length && this.msgs[this.msgs.length-1].sender === 'bot') {
            this.msgs.pop();
            var rows = this.el.msgs && this.el.msgs.querySelectorAll('.kui-msg-row');
            if (rows && rows.length) rows[rows.length-1].remove();
        }
        this._setLoading(true);
        try {
            this.ws.send(JSON.stringify({ message: last.text, history: this._history(last.text), tab_id: this.tabId, language: this.lang }));
        } catch(e) { this._setLoading(false); }
    };

    KUIChatbot.prototype._history = function(extra) {
        var h = this.msgs.slice(-8);
        if (extra) h = h.concat([{ sender:'user', text: extra }]);
        return h.map(function(m) { return { role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }; });
    };

    /* ── Topics ─────────────────────────────────────────────────────────── */
    KUIChatbot.prototype._topics = function() {
        if (this.loading) return;
        var self = this, l = T[this.lang];
        if (this.el.banner) this.el.banner.classList.add('kui-hidden');
        this._appendUser(l.topicsUser);
        this._setLoading(true);
        var done = false;

        fetch(API_URL + '/api/knowledge/structure')
            .then(function(r) { if (!r.ok) throw new Error(); return r.json(); })
            .then(function(j) {
                var data = (j && j.data) ? j.data : [];
                var txt;
                if (!data.length) {
                    txt = l.topicsEmpty;
                } else {
                    txt = l.topicsIntro;
                    data.forEach(function(cat) {
                        txt += '### 📂 ' + cat._id + '\n';
                        (cat.topics || []).forEach(function(t) { txt += '- ' + t + '\n'; });
                        txt += '\n';
                    });
                    txt += l.topicsHint;
                }
                self._appendBot(txt);
            })
            .catch(function() { self._appendBot(l.topicsFail); })
            .then(function() { if (!done) { done = true; self._setLoading(false); } });

        setTimeout(function() { if (!done) { done = true; self._setLoading(false); } }, 30000);
    };

    /* ── Loading ────────────────────────────────────────────────────────── */
    KUIChatbot.prototype._setLoading = function(on) {
        this.loading = on;
        var btn = this.el.sendBtn;
        if (btn) {
            btn.innerHTML = on ? '<span class="kui-spin">' + IC.loader + '</span>' : IC.send;
            btn.disabled  = on;
            btn.classList.toggle('active', !on && this._hasInput());
        }
        var loader = this.el.msgs && this.el.msgs.querySelector('.kui-loading-row');
        if (on && !loader) {
            var avInner = LOGO_URL
                ? '<img src="' + esc(LOGO_URL) + '" alt="bot" onerror="this.style.display=\'none\'">'
                : IC.chat;
            this.el.msgs.insertAdjacentHTML('beforeend',
                '<div class="kui-loading-row">'
                + '<div class="kui-avatar kui-bot-av">' + avInner + '</div>'
                + '<div class="kui-loading-bubble"><span class="kui-dot"></span><span class="kui-dot"></span><span class="kui-dot"></span></div>'
                + '</div>');
            this._scroll();
        } else if (!on && loader) {
            loader.remove();
        }
    };

    KUIChatbot.prototype._hasInput = function() {
        return !!(this.el.input && this.el.input.value.trim());
    };

    KUIChatbot.prototype._updateSendBtn = function() {
        var btn = this.el.sendBtn; if (!btn || this.loading) return;
        var can = this._hasInput() && this.wsStatus === 'OPEN';
        btn.classList.toggle('active', can);
        btn.disabled = !can;
    };

    /* ── Logging ────────────────────────────────────────────────────────── */
    KUIChatbot.prototype._log = function(sender, msg) {
        if (this.consent !== 'true') return;
        fetch(API_URL + '/api/send-msg', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sender: sender, msg: msg, isLogOnly: true })
        }).catch(function() {});
    };

    /* ── Floating ───────────────────────────────────────────────────────── */
    KUIChatbot.prototype._toggleFloat = function() {
        this.floatOpen = !this.floatOpen;
        if (this.el.floatPanel) this.el.floatPanel.classList.toggle('kui-hidden', !this.floatOpen);
        if (this.floatOpen) { this.unread = 0; this._badge(); this._scroll(); }
    };
    KUIChatbot.prototype._badge = function() {
        var b = this.el.floatBadge; if (!b) return;
        b.textContent = this.unread;
        b.classList.toggle('kui-hidden', this.unread === 0);
    };

    KUIChatbot.prototype._scroll = function() {
        var m = this.el.msgs; if (m) m.scrollTop = m.scrollHeight;
    };

    /* ── Events ─────────────────────────────────────────────────────────── */
    KUIChatbot.prototype._bindEvents = function() {
        var self = this;
        if (this.el.cReject)    this.el.cReject.onclick    = function() { self._doConsent(false); };
        if (this.el.cAllow)     this.el.cAllow.onclick     = function() { self._doConsent(true);  };
        if (this.el.themeBtn)   this.el.themeBtn.onclick   = function() { self._toggleTheme(); };
        this.el.langBtns.forEach(function(b) {
            b.onclick = function() { self._setLang(b.getAttribute('data-lang')); };
        });
        if (this.el.sendBtn)    this.el.sendBtn.onclick    = function() { self._send(); };
        if (this.el.viewTopics) this.el.viewTopics.onclick = function() { self._topics(); };
        if (this.el.closeBanner) this.el.closeBanner.onclick = function() {
            self.showBanner = false;
            if (self.el.banner) self.el.banner.classList.add('kui-hidden');
        };
        if (this.el.input) {
            this.el.input.oninput   = function() { self._updateSendBtn(); };
            this.el.input.onkeydown = function(e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); self._send(); }
            };
        }
        if (this.el.floatBtn)   this.el.floatBtn.onclick   = function() { self._toggleFloat(); };
        if (this.el.floatClose) this.el.floatClose.onclick = function() { self._toggleFloat(); };
        this._showConsent();
    };

    /* ── Bootstrap ──────────────────────────────────────────────────────── */
    function init() {
        doc.querySelectorAll('.kui-chatbot-root').forEach(function(root) {
            if (!root._kui) root._kui = new KUIChatbot(root);
        });
    }
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();

})(window, document);
