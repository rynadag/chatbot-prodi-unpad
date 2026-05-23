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
    <div class="wrap cunpad-admin-wrap">
        <style>
            .cunpad-admin-wrap {
                --cunpad-yellow: #ffb300;
                --cunpad-red: #ed1c24;
                --cunpad-black: #141414;
                --cunpad-ink: #24201f;
                --cunpad-muted: #6f6964;
                --cunpad-line: #e7e2da;
                --cunpad-soft: #fbfaf7;
                max-width: 1120px;
                color: var(--cunpad-ink);
            }
            .cunpad-admin-wrap h1,
            .cunpad-admin-wrap h2,
            .cunpad-admin-wrap h3 { color: var(--cunpad-ink); }
            .cunpad-admin-hero {
                background: #fff;
                border: 1px solid var(--cunpad-line);
                border-top: 10px solid var(--cunpad-yellow);
                border-radius: 8px;
                margin: 18px 0;
                padding: 22px 24px;
                position: relative;
                box-shadow: 0 12px 28px rgba(20,20,20,.07);
            }
            .cunpad-admin-hero::after {
                content: '';
                position: absolute;
                top: -10px;
                right: 0;
                width: 28%;
                height: 10px;
                background: var(--cunpad-red);
            }
            .cunpad-admin-kicker {
                display: inline-block;
                margin-bottom: 8px;
                color: var(--cunpad-red);
                font-size: 11px;
                font-weight: 800;
                letter-spacing: .08em;
                text-transform: uppercase;
            }
            .cunpad-admin-hero h1 {
                margin: 0;
                font-size: 28px;
                line-height: 1.2;
            }
            .cunpad-admin-version {
                color: var(--cunpad-muted);
                font-size: 13px;
                font-weight: 500;
            }
            .cunpad-admin-hero p {
                max-width: 760px;
                margin: 8px 0 0;
                color: var(--cunpad-muted);
                font-size: 14px;
            }
            .cunpad-admin-grid {
                display: grid;
                grid-template-columns: minmax(0, 1fr) 360px;
                gap: 16px;
                margin-bottom: 16px;
            }
            .cunpad-admin-card {
                background: #fff;
                border: 1px solid var(--cunpad-line);
                border-radius: 8px;
                padding: 18px;
                box-shadow: 0 8px 20px rgba(20,20,20,.05);
            }
            .cunpad-admin-card h2 {
                margin: 0 0 12px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--cunpad-line);
                font-size: 17px;
                position: relative;
            }
            .cunpad-admin-card h2::after {
                content: '';
                position: absolute;
                left: 0;
                bottom: -1px;
                width: 88px;
                height: 3px;
                background: linear-gradient(90deg, var(--cunpad-yellow) 0 70%, var(--cunpad-red) 70% 100%);
                border-radius: 99px;
            }
            .cunpad-admin-card p {
                color: var(--cunpad-muted);
            }
            .cunpad-admin-card input[type="url"] {
                width: min(100%, 520px);
                border-color: #d8d1c6;
                border-radius: 8px;
                padding: 6px 10px;
            }
            .cunpad-admin-card .form-table th,
            .cunpad-admin-card .form-table td {
                padding-top: 10px;
                padding-bottom: 10px;
            }
            .cunpad-admin-shortcodes {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 10px;
            }
            .cunpad-admin-shortcode {
                background: var(--cunpad-soft);
                border: 1px solid var(--cunpad-line);
                border-radius: 8px;
                padding: 13px;
            }
            .cunpad-admin-shortcode code,
            .cunpad-admin-code {
                background: #fff6cf;
                border: 1px solid #f4d36a;
                border-radius: 6px;
                color: var(--cunpad-ink);
                display: inline-block;
                padding: 3px 6px;
            }
            .cunpad-admin-models {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 10px;
                margin: 12px 0 18px;
            }
            .cunpad-admin-model {
                background: var(--cunpad-soft);
                border: 1px solid var(--cunpad-line);
                border-radius: 8px;
                padding: 13px;
            }
            .cunpad-admin-model strong {
                display: block;
                margin-bottom: 4px;
            }
            .cunpad-admin-pre {
                background: var(--cunpad-black);
                color: #fff6cf;
                border-radius: 8px;
                padding: 14px;
                font-size: 12px;
                line-height: 1.7;
                overflow-x: auto;
            }
            .cunpad-admin-note {
                border-left: 4px solid var(--cunpad-red);
                background: #fff6cf;
                border-radius: 6px;
                padding: 10px 12px;
                font-weight: 600;
            }
            #cunpad-test-result {
                display: block;
                margin-top: 10px;
                font-size: 14px;
                font-weight: 700;
            }
            #cunpad-test-detail {
                margin-top: 8px;
                padding: 10px 12px;
                background: var(--cunpad-soft);
                border: 1px solid var(--cunpad-line);
                border-radius: 8px;
                font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                font-size: 12px;
                color: var(--cunpad-muted);
                min-height: 18px;
            }
            @media (max-width: 960px) {
                .cunpad-admin-grid,
                .cunpad-admin-shortcodes,
                .cunpad-admin-models {
                    grid-template-columns: 1fr;
                }
            }
        </style>

        <section class="cunpad-admin-hero">
            <span class="cunpad-admin-kicker">Plugin WordPress</span>
            <h1>Chatbot Prodi Unpad <span class="cunpad-admin-version">v<?= esc_html( CUNPAD_VER ) ?></span></h1>
            <p>Widget chat untuk informasi MIM FEB Unpad dengan tampilan yang lebih bersih, sumber jawaban yang rapi, dan konfigurasi backend yang mudah dipantau.</p>
        </section>

        <div class="cunpad-admin-grid">
            <section class="cunpad-admin-card">
                <h2>Pengaturan Backend</h2>
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
            </section>

            <section class="cunpad-admin-card">
                <h2>Tes Koneksi</h2>
                <p>Gunakan ini untuk memastikan WordPress dapat menjangkau backend Node.js.</p>
                <button id="cunpad-test-btn" class="button button-secondary">Tes Koneksi</button>
                <span id="cunpad-test-result"></span>
                <div id="cunpad-test-detail"></div>
            </section>
        </div>

        <section class="cunpad-admin-card">
            <h2>Shortcode</h2>
            <div class="cunpad-admin-shortcodes">
                <div class="cunpad-admin-shortcode">
                    <code>[chatbot_unpad_public]</code>
                    <p>Widget inline tanpa login untuk halaman publik.</p>
                </div>
                <div class="cunpad-admin-shortcode">
                    <code>[chatbot_unpad_float]</code>
                    <p>Floating bubble di pojok kanan bawah.</p>
                </div>
                <div class="cunpad-admin-shortcode">
                    <code>[chatbot_unpad]</code>
                    <p>Dashboard lengkap dengan login, chat, kirim dataset, dan histori.</p>
                </div>
            </div>
        </section>

        <section class="cunpad-admin-card">
            <h2>Konfigurasi AI</h2>
            <p>Gunakan Groq untuk respons cepat. Embedding bisa tetap memakai Ollama, atau OpenAI jika ingin kualitas pencarian yang lebih kuat.</p>

            <ol>
                <li>Daftar di <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer"><strong>console.groq.com</strong></a>.</li>
                <li>Buat API Key baru di menu <strong>API Keys</strong>.</li>
                <li>Edit file <code>backend/.env</code>:</li>
            </ol>

            <pre class="cunpad-admin-pre">LLM_PROVIDER=groq
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx
GROQ_MODEL=llama-3.1-8b-instant</pre>

            <div class="cunpad-admin-models">
                <div class="cunpad-admin-model">
                    <strong><code>llama-3.1-8b-instant</code></strong>
                    <span>Cepat dan cocok sebagai default.</span>
                </div>
                <div class="cunpad-admin-model">
                    <strong><code>llama-3.1-70b-versatile</code></strong>
                    <span>Lebih kuat untuk jawaban kompleks.</span>
                </div>
                <div class="cunpad-admin-model">
                    <strong><code>mixtral-8x7b-32768</code></strong>
                    <span>Alternatif yang baik untuk Bahasa Indonesia.</span>
                </div>
            </div>

            <h3>Embedding Opsional</h3>
            <pre class="cunpad-admin-pre">EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
EMBEDDING_MODEL=text-embedding-3-small</pre>
            <p class="cunpad-admin-note">Mengganti embedding provider mengharuskan re-sync semua dokumen melalui Admin Compile.</p>
        </section>

        <section class="cunpad-admin-card">
            <h2>Arsitektur Sistem</h2>
            <pre class="cunpad-admin-pre">Browser -> WordPress REST API -> Node.js Backend
          -> Hybrid retrieval: vector + keyword fallback + rerank
          -> MongoDB Atlas Vector Search
          -> LLM provider</pre>
        </section>
    </div>

    <script>
    document.getElementById('cunpad-test-btn').addEventListener('click', function () {
        const btn    = this;
        const result = document.getElementById('cunpad-test-result');
        const detail = document.getElementById('cunpad-test-detail');
        btn.disabled = true;
        result.style.color = '#555';
        result.textContent = 'Menghubungi backend...';
        detail.textContent = '';

        fetch('<?= esc_js( rest_url( 'cunpad/v1/health' ) ) ?>', {
            headers: { 'X-WP-Nonce': '<?= esc_js( wp_create_nonce( 'wp_rest' ) ) ?>' }
        })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'ok') {
                result.style.color = '#059669';
                result.textContent = 'Backend online.';
                detail.textContent =
                    `DB: ${data.db}  |  LLM: ${data.llm}  |  Embedding: ${data.embedding}  |  Uptime: ${data.uptime}`;
            } else {
                result.style.color = '#dc2626';
                result.textContent = 'Backend bermasalah: ' + JSON.stringify(data);
            }
        })
        .catch(() => {
            result.style.color = '#dc2626';
            result.textContent = 'Tidak dapat menjangkau backend dari server WordPress ini.';
        })
        .finally(() => { btn.disabled = false; });
    });
    </script>
    <?php
}
