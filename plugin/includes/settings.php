<?php
if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'admin_menu', 'cunpad_add_settings_page' );
function cunpad_add_settings_page() {
    add_options_page(
        'Chatbot Prodi Unpad',
        'Chatbot Unpad',
        'manage_options',
        'chatbot-unpad',
        'cunpad_render_settings'
    );
}

add_action( 'admin_init', 'cunpad_register_settings' );
function cunpad_register_settings() {
    register_setting( 'cunpad_group', 'cunpad_api_url', [
        'sanitize_callback' => 'esc_url_raw',
        'default'           => 'http://localhost:3000',
    ] );
}

function cunpad_render_settings() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $api_url = get_option( 'cunpad_api_url', 'http://localhost:3000' );
    ?>
    <div class="wrap">
        <h1>⚙️ Chatbot Prodi Unpad <span style="font-size:13px;color:#888;font-weight:normal;">v<?= CUNPAD_VER ?></span></h1>

        <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:12px 16px;margin-bottom:20px;border-radius:4px;">
            <strong>v3.0 — Powered by Groq API.</strong>
            Model AI yang sebelumnya membutuhkan 20–60 detik (Ollama lokal) kini merespons dalam <strong>1–3 detik</strong>.
            Respons juga muncul secara <strong>real-time</strong> kata per kata melalui streaming.
        </div>

        <form method="post" action="options.php">
            <?php settings_fields( 'cunpad_group' ); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="cunpad_api_url">URL Backend Node.js</label></th>
                    <td>
                        <input type="url" id="cunpad_api_url" name="cunpad_api_url"
                               value="<?= esc_attr( $api_url ) ?>"
                               class="regular-text" placeholder="http://localhost:3000">
                        <p class="description">
                            Contoh: <code>http://192.168.1.10:3000</code> atau <code>https://chatbot.mim.unpad.ac.id</code>
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button( 'Simpan Pengaturan' ); ?>
        </form>

        <hr>

        <h2>🔌 Tes Koneksi Backend</h2>
        <button id="cunpad-test-btn" class="button button-secondary">Tes Koneksi</button>
        <span id="cunpad-test-result" style="margin-left:14px;font-size:14px;font-weight:600;"></span>
        <div id="cunpad-test-detail" style="margin-top:8px;font-family:monospace;font-size:12px;color:#555;"></div>

        <hr>

        <h2>📋 Shortcode</h2>
        <table class="widefat striped" style="max-width:740px;">
            <thead><tr><th>Shortcode</th><th>Keterangan</th></tr></thead>
            <tbody>
                <tr>
                    <td><code>[chatbot_unpad_public]</code></td>
                    <td>Widget inline, tanpa login, streaming real-time.</td>
                </tr>
                <tr>
                    <td><code>[chatbot_unpad_float]</code></td>
                    <td>Floating bubble di pojok kanan bawah, tanpa login, streaming real-time.</td>
                </tr>
                <tr>
                    <td><code>[chatbot_unpad]</code></td>
                    <td>Dashboard lengkap: login email, chat, kirim dataset, histori.</td>
                </tr>
            </tbody>
        </table>

        <hr>

        <h2>⚡ Cara Membuat Jawaban Lebih Cepat (Tanpa Ollama Lokal)</h2>
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:20px;max-width:740px;">

            <h3 style="margin-top:0;color:#1e40af;">Gunakan Groq API — Gratis &amp; 500+ Token/Detik</h3>
            <ol style="line-height:2;">
                <li>Daftar di <a href="https://console.groq.com" target="_blank"><strong>console.groq.com</strong></a> (gratis)</li>
                <li>Buat API Key baru di menu "API Keys"</li>
                <li>Edit file <code>backend/.env</code>:
                    <pre style="background:#f8fafc;padding:12px;border-radius:6px;margin:8px 0;">LLM_PROVIDER=groq
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant</pre>
                </li>
                <li>Install dependency baru: <code>npm install</code></li>
                <li>Restart backend: <code>npm start</code></li>
            </ol>

            <table class="widefat striped" style="margin-top:12px;">
                <thead><tr><th>Model Groq</th><th>Kecepatan</th><th>Kecerdasan</th><th>Rekomendasi</th></tr></thead>
                <tbody>
                    <tr><td><code>llama-3.1-8b-instant</code></td><td>🚀 ~500 tok/s</td><td>⭐⭐⭐</td><td>✅ Default — terbaik untuk kecepatan</td></tr>
                    <tr><td><code>llama-3.1-70b-versatile</code></td><td>⚡ ~280 tok/s</td><td>⭐⭐⭐⭐⭐</td><td>Lebih cerdas, masih sangat cepat</td></tr>
                    <tr><td><code>mixtral-8x7b-32768</code></td><td>⚡ ~400 tok/s</td><td>⭐⭐⭐⭐</td><td>Bagus untuk Bahasa Indonesia</td></tr>
                </tbody>
            </table>

            <h3 style="color:#7c3aed;">Opsi Alternatif (berbayar, akurasi lebih tinggi)</h3>
            <table class="widefat striped">
                <thead><tr><th>Provider</th><th>Model</th><th>Kecepatan</th><th>Biaya</th></tr></thead>
                <tbody>
                    <tr><td>OpenAI</td><td>gpt-4o-mini</td><td>⚡ Cepat</td><td>~$0.15/1M token input</td></tr>
                    <tr><td>Google</td><td>gemini-1.5-flash</td><td>🚀 Sangat cepat</td><td>Gratis hingga batas tertentu</td></tr>
                    <tr><td>Anthropic</td><td>claude-haiku-3.5</td><td>⚡ Cepat</td><td>~$0.25/1M token input</td></tr>
                </tbody>
            </table>

            <h3 style="color:#0f766e;">Embedding (opsional — untuk akurasi retrieval lebih tinggi)</h3>
            <p>Ollama tetap dapat digunakan untuk embedding. Jika ingin akurasi pencarian lebih baik, gunakan OpenAI:</p>
            <pre style="background:#f8fafc;padding:12px;border-radius:6px;">EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
EMBEDDING_MODEL=text-embedding-3-small</pre>
            <p style="color:#dc2626;font-weight:600;">⚠️ Mengganti embedding provider mengharuskan re-sync semua dokumen (<strong>Admin → Compile</strong>).</p>
        </div>

        <hr>

        <h2>🗂️ Arsitektur Sistem v3</h2>
        <pre style="background:#1e293b;color:#e2e8f0;padding:18px;border-radius:10px;font-size:12px;line-height:1.8;overflow-x:auto;">
 Browser  ──POST──▶  /wp-json/cunpad/v1/stream  ──cURL──▶  Node.js /api/public-chat/stream
                     (WordPress REST API Proxy)              │
                                                              ├─ retrieve(q, k=8)  ◀── MongoDB Atlas Vector Search
                                                              │   (OllamaEmbeddings or OpenAIEmbeddings)
                                                              │
                                                              └─ LLM.stream()  ◀──  Groq API (500+ tok/s)
                                                                                     llama-3.1-8b-instant

 Token-by-token SSE  ◀────────────────────────────────────────────────────────────────
 displayed instantly in browser (typewriter effect)</pre>
    </div>

    <script>
    document.getElementById('cunpad-test-btn').addEventListener('click', function () {
        const btn    = this;
        const result = document.getElementById('cunpad-test-result');
        const detail = document.getElementById('cunpad-test-detail');
        btn.disabled = true;
        result.style.color = '#555';
        result.textContent = '⏳ Menghubungi backend…';
        detail.textContent = '';

        fetch('<?= esc_js( rest_url( 'cunpad/v1/health' ) ) ?>', {
            headers: { 'X-WP-Nonce': '<?= esc_js( wp_create_nonce( 'wp_rest' ) ) ?>' }
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'ok') {
                result.style.color = '#059669';
                result.textContent = '✅ Backend online!';
                detail.textContent =
                    `DB: ${data.db}  |  LLM: ${data.llm}  |  Embedding: ${data.embedding}  |  Uptime: ${data.uptime}`;
            } else {
                result.style.color = '#dc2626';
                result.textContent = '❌ Backend bermasalah: ' + JSON.stringify(data);
            }
        })
        .catch(() => {
            result.style.color = '#dc2626';
            result.textContent = '❌ Tidak dapat menjangkau backend dari server WordPress ini.';
        })
        .finally(() => { btn.disabled = false; });
    });
    </script>
    <?php
}
