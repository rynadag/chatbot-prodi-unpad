<?php
/**
 * Plugin Name:  Chatbot Prodi Unpad
 * Description:  Widget chatbot MIM FEB Unpad — didukung Groq API, streaming real-time, dan WordPress REST API.
 * Version:      3.0.0
 * Author:       MIM FEB Unpad
 * Text Domain:  chatbot-unpad
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'CUNPAD_VER',  '3.0.0' );
define( 'CUNPAD_PATH', plugin_dir_path( __FILE__ ) );
define( 'CUNPAD_URL',  plugin_dir_url( __FILE__ ) );

require_once CUNPAD_PATH . 'includes/settings.php';

// ══════════════════════════════════════════════════════════════
// 1. ASSETS
// ══════════════════════════════════════════════════════════════

add_action( 'wp_enqueue_scripts', 'cunpad_register_assets' );
function cunpad_register_assets() {
    wp_register_style(
        'cunpad-style',
        CUNPAD_URL . 'assets/chatbot-widget.css',
        [],
        CUNPAD_VER
    );
    wp_register_script(
        'cunpad-script',
        CUNPAD_URL . 'assets/chatbot-widget.js',
        [],
        CUNPAD_VER,
        true  // load in footer
    );
}

function cunpad_enqueue( string $mode ) {
    wp_enqueue_style( 'cunpad-style' );
    wp_enqueue_script( 'cunpad-script' );
    wp_localize_script( 'cunpad-script', 'cunpadConfig', [
        'restUrl'     => esc_url_raw( rest_url( 'cunpad/v1/' ) ),
        'nonce'       => wp_create_nonce( 'wp_rest' ),       // WP REST nonce
        'ajaxNonce'   => wp_create_nonce( 'cunpad_nonce' ),  // WP AJAX nonce
        'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
        'mode'        => $mode,
        'logoUnpad'   => CUNPAD_URL . 'assets/logo-unpad.png',
        'logoChatbot' => CUNPAD_URL . 'assets/logo-chatbot.png',
    ] );
}

// ══════════════════════════════════════════════════════════════
// 2. WP REST API ENDPOINTS  (faster than admin-ajax.php)
// ══════════════════════════════════════════════════════════════

add_action( 'rest_api_init', 'cunpad_register_rest_routes' );
function cunpad_register_rest_routes() {

    // ── /wp-json/cunpad/v1/health ───────────────────────────
    register_rest_route( 'cunpad/v1', '/health', [
        'methods'             => 'GET',
        'callback'            => 'cunpad_rest_health',
        'permission_callback' => '__return_true',
    ] );

    // ── /wp-json/cunpad/v1/public-chat ──────────────────────
    register_rest_route( 'cunpad/v1', '/public-chat', [
        'methods'             => 'POST',
        'callback'            => 'cunpad_rest_public_chat',
        'permission_callback' => '__return_true',
        'args'                => [
            'question' => [ 'required' => true, 'type' => 'string' ],
        ],
    ] );

    // ── /wp-json/cunpad/v1/stream  (SSE proxy) ───────────────
    register_rest_route( 'cunpad/v1', '/stream', [
        'methods'             => 'POST',
        'callback'            => 'cunpad_rest_stream',
        'permission_callback' => '__return_true',
    ] );

    // ── /wp-json/cunpad/v1/login ────────────────────────────
    register_rest_route( 'cunpad/v1', '/login', [
        'methods'             => 'POST',
        'callback'            => 'cunpad_rest_login',
        'permission_callback' => '__return_true',
    ] );

    // ── /wp-json/cunpad/v1/register ─────────────────────────
    register_rest_route( 'cunpad/v1', '/register', [
        'methods'             => 'POST',
        'callback'            => 'cunpad_rest_register',
        'permission_callback' => '__return_true',
    ] );

    // ── /wp-json/cunpad/v1/chat  (authenticated) ─────────────
    register_rest_route( 'cunpad/v1', '/chat', [
        'methods'             => 'POST',
        'callback'            => 'cunpad_rest_chat',
        'permission_callback' => '__return_true',
    ] );

    // ── /wp-json/cunpad/v1/submission ───────────────────────
    register_rest_route( 'cunpad/v1', '/submission', [
        'methods'             => 'POST',
        'callback'            => 'cunpad_rest_submission',
        'permission_callback' => '__return_true',
    ] );

    // ── /wp-json/cunpad/v1/my-submissions ───────────────────
    register_rest_route( 'cunpad/v1', '/my-submissions', [
        'methods'             => 'GET',
        'callback'            => 'cunpad_rest_my_submissions',
        'permission_callback' => '__return_true',
    ] );
}

// ══════════════════════════════════════════════════════════════
// 3. REST HANDLER IMPLEMENTATIONS
// ══════════════════════════════════════════════════════════════

/* ── Internal helpers ───────────────────────────────────────── */

function cunpad_base_url(): string {
    return rtrim( get_option( 'cunpad_api_url', 'http://localhost:3000' ), '/' );
}

function cunpad_http_post( string $path, array $body, string $token = '', int $timeout = 60 ): array {
    $headers = [ 'Content-Type' => 'application/json' ];
    if ( $token ) $headers['Authorization'] = 'Bearer ' . $token;

    $res  = wp_remote_post( cunpad_base_url() . $path, [
        'headers' => $headers,
        'body'    => wp_json_encode( $body ),
        'timeout' => $timeout,
    ] );

    if ( is_wp_error( $res ) ) {
        return [ 'error' => $res->get_error_message(), 'code' => 0 ];
    }

    return [
        'body' => json_decode( wp_remote_retrieve_body( $res ), true ) ?? [],
        'code' => wp_remote_retrieve_response_code( $res ),
    ];
}

function cunpad_http_get( string $path, string $token = '', int $timeout = 30 ): array {
    $headers = [ 'Content-Type' => 'application/json' ];
    if ( $token ) $headers['Authorization'] = 'Bearer ' . $token;

    $res = wp_remote_get( cunpad_base_url() . $path, [
        'headers' => $headers,
        'timeout' => $timeout,
    ] );

    if ( is_wp_error( $res ) ) {
        return [ 'error' => $res->get_error_message(), 'code' => 0 ];
    }

    return [
        'body' => json_decode( wp_remote_retrieve_body( $res ), true ) ?? [],
        'code' => wp_remote_retrieve_response_code( $res ),
    ];
}

/* ── Health ─────────────────────────────────────────────────── */
function cunpad_rest_health(): WP_REST_Response {
    $r = cunpad_http_get( '/health', '', 10 );

    if ( isset( $r['error'] ) ) {
        return new WP_REST_Response( [ 'error' => $r['error'] ], 503 );
    }

    return new WP_REST_Response( $r['body'], $r['code'] );
}

/* ── Public chat ────────────────────────────────────────────── */
function cunpad_rest_public_chat( WP_REST_Request $req ): WP_REST_Response {
    $question = sanitize_text_field( $req->get_param( 'question' ) ?? '' );
    if ( ! $question ) return new WP_REST_Response( [ 'error' => 'Pertanyaan kosong.' ], 400 );

    $r = cunpad_http_post( '/api/public-chat', [ 'question' => $question ] );

    if ( isset( $r['error'] ) ) return new WP_REST_Response( [ 'error' => 'Tidak dapat terhubung ke backend.' ], 503 );
    return new WP_REST_Response( $r['body'], $r['code'] );
}

/* ── Streaming SSE proxy ────────────────────────────────────── */
function cunpad_rest_stream( WP_REST_Request $req ) {
    $question = sanitize_text_field( $req->get_param( 'question' ) ?? '' );
    $token    = sanitize_text_field( $req->get_param( 'token' )    ?? '' );

    if ( ! $question ) {
        http_response_code( 400 );
        echo "data: " . wp_json_encode( [ 'error' => 'Pertanyaan kosong.' ] ) . "\n\n";
        exit;
    }

    // Clear ALL output buffers so chunks flow immediately
    while ( ob_get_level() > 0 ) ob_end_clean();

    header( 'Content-Type: text/event-stream; charset=utf-8' );
    header( 'Cache-Control: no-cache, no-store, must-revalidate' );
    header( 'X-Accel-Buffering: no' );   // nginx: disable proxy buffering
    header( 'Connection: keep-alive' );

    $endpoint = $token ? '/api/chat/stream' : '/api/public-chat/stream';
    $url      = cunpad_base_url() . $endpoint;

    $headers = [ 'Content-Type: application/json' ];
    if ( $token ) $headers[] = 'Authorization: Bearer ' . $token;

    $ch = curl_init( $url );
    curl_setopt_array( $ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => wp_json_encode( [ 'question' => $question ] ),
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 90,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_WRITEFUNCTION  => static function ( $ch, $data ): int {
            echo $data;
            if ( ob_get_level() ) ob_flush();
            flush();
            return strlen( $data );
        },
    ] );

    $ok  = curl_exec( $ch );
    $err = curl_error( $ch );
    curl_close( $ch );

    if ( ! $ok && $err ) {
        echo "data: " . wp_json_encode( [ 'error' => 'Koneksi ke backend gagal: ' . $err ] ) . "\n\n";
        flush();
    }

    exit;
}

/* ── Auth: login ────────────────────────────────────────────── */
function cunpad_rest_login( WP_REST_Request $req ): WP_REST_Response {
    $email    = sanitize_email( $req->get_param( 'email' )    ?? '' );
    $password = sanitize_text_field( $req->get_param( 'password' ) ?? '' );

    if ( ! $email || ! $password ) return new WP_REST_Response( [ 'error' => 'Email dan password wajib diisi.' ], 400 );

    $r = cunpad_http_post( '/api/auth/login', compact( 'email', 'password' ) );
    if ( isset( $r['error'] ) ) return new WP_REST_Response( [ 'error' => 'Gagal terhubung ke server.' ], 503 );
    return new WP_REST_Response( $r['body'], $r['code'] );
}

/* ── Auth: register ─────────────────────────────────────────── */
function cunpad_rest_register( WP_REST_Request $req ): WP_REST_Response {
    $email    = sanitize_email( $req->get_param( 'email' )    ?? '' );
    $password = sanitize_text_field( $req->get_param( 'password' ) ?? '' );

    if ( ! $email || ! $password ) return new WP_REST_Response( [ 'error' => 'Email dan password wajib diisi.' ], 400 );

    $r = cunpad_http_post( '/api/auth/register', compact( 'email', 'password' ) );
    if ( isset( $r['error'] ) ) return new WP_REST_Response( [ 'error' => 'Gagal terhubung ke server.' ], 503 );
    return new WP_REST_Response( $r['body'], $r['code'] );
}

/* ── Authenticated chat ─────────────────────────────────────── */
function cunpad_rest_chat( WP_REST_Request $req ): WP_REST_Response {
    $question = sanitize_text_field( $req->get_param( 'question' ) ?? '' );
    $token    = sanitize_text_field( $req->get_param( 'token' )    ?? '' );

    if ( ! $question || ! $token ) return new WP_REST_Response( [ 'error' => 'Data tidak lengkap.' ], 400 );

    $r = cunpad_http_post( '/api/chat', [ 'question' => $question ], $token );
    if ( isset( $r['error'] ) ) return new WP_REST_Response( [ 'error' => 'Tidak dapat terhubung ke backend.' ], 503 );

    if ( in_array( $r['code'], [ 401, 403 ], true ) ) {
        return new WP_REST_Response( [ 'error' => 'UNAUTHORIZED' ], $r['code'] );
    }

    return new WP_REST_Response( $r['body'], $r['code'] );
}

/* ── Submission ─────────────────────────────────────────────── */
function cunpad_rest_submission( WP_REST_Request $req ): WP_REST_Response {
    $tag          = sanitize_text_field( $req->get_param( 'tag' )          ?? '' );
    $content_text = sanitize_textarea_field( $req->get_param( 'content_text' ) ?? '' );
    $token        = sanitize_text_field( $req->get_param( 'token' )        ?? '' );

    if ( ! $tag || ! $content_text || ! $token ) return new WP_REST_Response( [ 'error' => 'Data tidak lengkap.' ], 400 );

    $r = cunpad_http_post( '/api/submission', compact( 'tag', 'content_text' ), $token );
    if ( isset( $r['error'] ) ) return new WP_REST_Response( [ 'error' => 'Gagal terhubungi server.' ], 503 );
    return new WP_REST_Response( $r['body'], $r['code'] );
}

/* ── My submissions ─────────────────────────────────────────── */
function cunpad_rest_my_submissions( WP_REST_Request $req ): WP_REST_Response {
    $token = sanitize_text_field( $req->get_param( 'token' ) ?? '' );
    if ( ! $token ) return new WP_REST_Response( [ 'error' => 'Token tidak ada.' ], 401 );

    $r = cunpad_http_get( '/api/submission/mine', $token );
    if ( isset( $r['error'] ) ) return new WP_REST_Response( [ 'error' => 'Gagal terhubungi server.' ], 503 );
    return new WP_REST_Response( $r['body'], $r['code'] );
}

// ══════════════════════════════════════════════════════════════
// 4. SHORTCODES
// ══════════════════════════════════════════════════════════════

add_shortcode( 'chatbot_unpad',        'cunpad_shortcode_full' );
add_shortcode( 'chatbot_unpad_public', 'cunpad_shortcode_public' );
add_shortcode( 'chatbot_unpad_float',  'cunpad_shortcode_float' );

/* ── Full dashboard ─────────────────────────────────────────── */
function cunpad_shortcode_full(): string {
    cunpad_enqueue( 'full' );
    ob_start(); ?>
    <div id="cunpad-dashboard" class="cunpad-wrap">

        <aside class="cunpad-sidebar">
            <div class="cunpad-sidebar-logo">
                <img src="<?= esc_url( CUNPAD_URL . 'assets/logo-unpad.png' ) ?>" alt="Logo Unpad" class="cunpad-logo-img">
                <h3>Chatbot MIM</h3>
                <p>FEB Unpad</p>
            </div>
            <nav class="cunpad-sidebar-nav">
                <a href="#" class="cunpad-nav-link active" data-target="cunpad-sec-chat">💬 Chatbot</a>
                <a href="#" class="cunpad-nav-link" data-target="cunpad-sec-submit">📤 Kirim Data</a>
                <a href="#" class="cunpad-nav-link" data-target="cunpad-sec-history">📋 Histori</a>
            </nav>
        </aside>

        <main class="cunpad-main">

            <!-- Auth overlay -->
            <div id="cunpad-auth-overlay" class="cunpad-auth-overlay">
                <div class="cunpad-auth-box">
                    <img src="<?= esc_url( CUNPAD_URL . 'assets/logo-unpad.png' ) ?>" alt="Logo" class="cunpad-auth-logo">
                    <h2>Chatbot MIM FEB Unpad</h2>

                    <div id="cunpad-login-form">
                        <h3>Masuk ke Akun Anda</h3>
                        <input type="email"    id="cunpad-login-email"    placeholder="Alamat Email" autocomplete="email">
                        <input type="password" id="cunpad-login-password" placeholder="Password" autocomplete="current-password">
                        <button id="cunpad-login-btn" class="cunpad-btn cunpad-btn-primary cunpad-btn-full">Masuk</button>
                        <p class="cunpad-auth-switch">Belum punya akun? <a href="#" id="cunpad-show-register">Daftar di sini</a></p>
                        <div id="cunpad-login-msg" class="cunpad-msg"></div>
                    </div>

                    <div id="cunpad-register-form" style="display:none">
                        <h3>Buat Akun Baru</h3>
                        <input type="email"    id="cunpad-reg-email"    placeholder="Alamat Email" autocomplete="email">
                        <input type="password" id="cunpad-reg-password" placeholder="Password (min. 6 karakter)" autocomplete="new-password">
                        <button id="cunpad-register-btn" class="cunpad-btn cunpad-btn-primary cunpad-btn-full">Daftar</button>
                        <p class="cunpad-auth-switch">Sudah punya akun? <a href="#" id="cunpad-show-login">Login di sini</a></p>
                        <div id="cunpad-register-msg" class="cunpad-msg"></div>
                    </div>
                </div>
            </div>

            <header class="cunpad-main-header" id="cunpad-header" style="display:none">
                <div class="cunpad-header-left">
                    <span class="cunpad-status-dot" id="cunpad-status-dot"></span>
                    <h1>Selamat Datang! 👋</h1>
                </div>
                <button id="cunpad-logout-btn" class="cunpad-btn cunpad-btn-danger">Logout</button>
            </header>

            <div id="cunpad-content-area" style="display:none" class="cunpad-content-area">

                <div id="cunpad-sec-chat" class="cunpad-section active">
                    <h2>💬 Chatbot</h2>
                    <div class="cunpad-chat-window">
                        <div id="cunpad-chat-messages" class="cunpad-messages"></div>
                        <div class="cunpad-input-row">
                            <input type="text" id="cunpad-chat-input" placeholder="Ketik pertanyaan Anda… (Enter untuk kirim)" autocomplete="off">
                            <button id="cunpad-chat-send" class="cunpad-btn cunpad-btn-primary">Kirim</button>
                        </div>
                    </div>
                </div>

                <div id="cunpad-sec-submit" class="cunpad-section">
                    <h2>📤 Bantu Kami Belajar</h2>
                    <p>Kirim informasi yang belum ada di database untuk ditinjau oleh admin.</p>
                    <label for="cunpad-sub-tag">Tag / Topik</label>
                    <input type="text" id="cunpad-sub-tag" placeholder="Contoh: biaya_ukt_2025">
                    <label for="cunpad-sub-content">Konten Lengkap</label>
                    <textarea id="cunpad-sub-content" rows="5" placeholder="Isi informasi lengkap di sini…"></textarea>
                    <button id="cunpad-submit-btn" class="cunpad-btn cunpad-btn-primary">Kirim Saran</button>
                    <div id="cunpad-submit-msg" class="cunpad-msg"></div>
                </div>

                <div id="cunpad-sec-history" class="cunpad-section">
                    <h2>📋 Histori Kiriman Saya</h2>
                    <p>Status data yang pernah Anda kirim.</p>
                    <button id="cunpad-reload-history" class="cunpad-btn cunpad-btn-secondary">🔄 Muat Ulang</button>
                    <div id="cunpad-history-msg" class="cunpad-msg"></div>
                    <div id="cunpad-history-list"></div>
                </div>
            </div>
        </main>
    </div>
    <?php
    return ob_get_clean();
}

/* ── Inline public widget ───────────────────────────────────── */
function cunpad_shortcode_public(): string {
    cunpad_enqueue( 'public' );
    ob_start(); ?>
    <div id="cunpad-public" class="cunpad-public-widget">
        <div class="cunpad-public-header">
            <img src="<?= esc_url( CUNPAD_URL . 'assets/logo-chatbot.png' ) ?>" alt="Bot" class="cunpad-pub-logo">
            <span>Chatbot MIM FEB Unpad</span>
        </div>
        <div id="cunpad-pub-messages" class="cunpad-messages cunpad-pub-messages"></div>
        <div class="cunpad-input-row">
            <input type="text" id="cunpad-pub-input" placeholder="Ketik pertanyaan Anda…" autocomplete="off">
            <button id="cunpad-pub-send" class="cunpad-btn cunpad-btn-primary">Kirim</button>
        </div>
    </div>
    <?php
    return ob_get_clean();
}

/* ── Floating bubble ────────────────────────────────────────── */
function cunpad_shortcode_float(): string {
    cunpad_enqueue( 'float' );
    ob_start(); ?>
    <div id="cunpad-float-root">
        <button id="cunpad-float-btn" class="cunpad-float-btn" aria-label="Buka Chatbot">
            <img src="<?= esc_url( CUNPAD_URL . 'assets/logo-chatbot.png' ) ?>" alt="Chat">
            <span id="cunpad-float-badge" class="cunpad-float-badge" style="display:none">!</span>
        </button>
        <div id="cunpad-float-panel" class="cunpad-float-panel cunpad-hidden" role="dialog" aria-label="Chatbot MIM FEB Unpad">
            <div class="cunpad-float-header">
                <img src="<?= esc_url( CUNPAD_URL . 'assets/logo-chatbot.png' ) ?>" alt="Bot" class="cunpad-float-logo">
                <div class="cunpad-float-hdr-text">
                    <span>Chatbot MIM FEB Unpad</span>
                    <small>Tanya apa saja tentang MIM</small>
                </div>
                <button id="cunpad-float-close" class="cunpad-float-close-btn" aria-label="Tutup">✕</button>
            </div>
            <div id="cunpad-float-messages" class="cunpad-messages cunpad-float-messages"></div>
            <div class="cunpad-input-row cunpad-float-input-row">
                <input type="text" id="cunpad-float-input" placeholder="Ketik pertanyaan…" autocomplete="off">
                <button id="cunpad-float-send" class="cunpad-btn cunpad-btn-primary">Kirim</button>
            </div>
        </div>
    </div>
    <?php
    return ob_get_clean();
}
