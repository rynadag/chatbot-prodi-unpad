=== KUI UNPAD Chatbot ===
Contributors: kuiunpad
Tags: chatbot, AI, academic, university, websocket
Requires at least: 5.6
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: MIT

Chatbot AI Akademik untuk Kantor Urusan Internasional Universitas Padjadjaran.

== Description ==

Plugin ini mengintegrasikan chatbot AI KUI UNPAD ke dalam situs WordPress Anda.
Chatbot terhubung ke backend Node.js dan WebSocket server AI yang terpisah.

**Fitur Utama:**
* 💬 Chat real-time via WebSocket dengan streaming respons AI
* 🌙 Dark mode / light mode
* 🇮🇩🇬🇧 Bilingual: Bahasa Indonesia & English
* 🔒 Integrasi Google reCAPTCHA v2 (opsional)
* 📋 Persetujuan privasi & manajemen sesi
* 📚 Daftar topik tersedia dari knowledge base
* 📝 Rendering Markdown lengkap (tabel, kode, bold, italic, dll)
* 📄 Tampilkan sumber referensi (RAG sources)
* 📱 Responsive mobile-friendly
* 🪟 Mode Embedded atau Floating widget

**Shortcodes:**
`[kui_chatbot]` – Embedded (default)
`[kui_chatbot mode="floating"]` – Floating button
`[kui_chatbot lang="en"]` – Override bahasa
`[kui_chatbot height="600px"]` – Override tinggi

== Installation ==

1. Upload folder `chatbot-kui-unpad` ke `/wp-content/plugins/`
2. Aktifkan plugin di menu **Plugins** WordPress
3. Buka **Settings > KUI Chatbot** dan isi konfigurasi:
   - Backend API URL (Node.js, port 5000)
   - WebSocket URL (AI server, port 8080)
   - reCAPTCHA Site Key (opsional)
   - Nama & logo bot
4. Tambahkan shortcode `[kui_chatbot]` ke halaman yang diinginkan

== Backend Requirements ==

Plugin ini membutuhkan backend terpisah yang sudah berjalan:
- Node.js Express API server (port 5000)
- Python FastAPI WebSocket AI server (port 8080)
- MongoDB database
- CORS dikonfigurasi untuk domain WordPress Anda

== Changelog ==

= 1.0.0 =
* Rilis pertama
* Port penuh dari Next.js frontend ke WordPress plugin
* Dukungan WebSocket streaming
* Markdown parser bawaan (tanpa dependensi eksternal)
* reCAPTCHA v2 integration
* Dark/light mode
* Bilingual ID/EN
* Embedded & floating mode
