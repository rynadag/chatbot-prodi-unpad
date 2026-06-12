<?php
defined( 'ABSPATH' ) || exit;

class KUI_Chatbot_Admin {

    public function __construct() {
        add_action( 'admin_menu',            [ $this, 'add_menu' ] );
        add_action( 'admin_init',            [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_admin_assets' ] );
    }

    // ── Menu ─────────────────────────────────────────────────────────────────
    public function add_menu() {
        add_options_page(
            'KUI UNPAD Chatbot Settings',
            'KUI Chatbot',
            'manage_options',
            'kui-chatbot-settings',
            [ $this, 'render_settings_page' ]
        );
    }

    // ── Enqueue admin assets ──────────────────────────────────────────────────
    public function enqueue_admin_assets( $hook ) {
        if ( $hook !== 'settings_page_kui-chatbot-settings' ) return;
        wp_enqueue_media();
        wp_add_inline_script( 'jquery', $this->media_uploader_script() );
    }

    private function media_uploader_script() {
        return <<<'JS'
jQuery(function($){
    $(document).on('click', '.kui-media-upload-btn', function(e) {
        e.preventDefault();
        var target = $(this).data('target');
        var frame = wp.media({ title: 'Select Logo Image', multiple: false });
        frame.on('select', function(){
            var attachment = frame.state().get('selection').first().toJSON();
            $('#' + target).val(attachment.url);
            var preview = $('#' + target + '-preview');
            preview.attr('src', attachment.url).show();
        });
        frame.open();
    });
});
JS;
    }

    // ── Register settings ─────────────────────────────────────────────────────
    public function register_settings() {
        $fields = [
            'kui_chatbot_api_url'      => 'esc_url_raw',
            'kui_chatbot_ws_url'       => 'sanitize_text_field',
            'kui_chatbot_bot_name'     => 'sanitize_text_field',
            'kui_chatbot_bot_subtitle' => 'sanitize_text_field',
            'kui_chatbot_logo_url'     => 'esc_url_raw',
            'kui_chatbot_default_lang' => 'sanitize_text_field',
            'kui_chatbot_default_mode' => 'sanitize_text_field',
            'kui_chatbot_chat_height'  => 'sanitize_text_field',
        ];
        foreach ( $fields as $key => $sanitize ) {
            register_setting( 'kui_chatbot_options', $key, [ 'sanitize_callback' => $sanitize ] );
        }

        // Section: Connection
        add_settings_section( 'kui_connection', '🔌 Connection Settings', '__return_empty_string', 'kui-chatbot-settings' );
        add_settings_field( 'kui_chatbot_api_url', 'Backend API URL', [ $this, 'field_api_url' ], 'kui-chatbot-settings', 'kui_connection' );
        add_settings_field( 'kui_chatbot_ws_url',  'WebSocket URL',   [ $this, 'field_ws_url'  ], 'kui-chatbot-settings', 'kui_connection' );

        // Section: Branding
        add_settings_section( 'kui_branding', '🎨 Branding & Appearance', '__return_empty_string', 'kui-chatbot-settings' );
        add_settings_field( 'kui_chatbot_bot_name',     'Bot Name',     [ $this, 'field_bot_name'     ], 'kui-chatbot-settings', 'kui_branding' );
        add_settings_field( 'kui_chatbot_bot_subtitle', 'Bot Subtitle', [ $this, 'field_bot_subtitle' ], 'kui-chatbot-settings', 'kui_branding' );
        add_settings_field( 'kui_chatbot_logo_url',     'Logo Image',   [ $this, 'field_logo_url'     ], 'kui-chatbot-settings', 'kui_branding' );

        // Section: Display
        add_settings_section( 'kui_display', '🖥 Display Options', '__return_empty_string', 'kui-chatbot-settings' );
        add_settings_field( 'kui_chatbot_default_lang', 'Default Language',     [ $this, 'field_default_lang' ], 'kui-chatbot-settings', 'kui_display' );
        add_settings_field( 'kui_chatbot_default_mode', 'Default Mode',         [ $this, 'field_default_mode' ], 'kui-chatbot-settings', 'kui_display' );
        add_settings_field( 'kui_chatbot_chat_height',  'Chat Height (embedded)', [ $this, 'field_chat_height' ], 'kui-chatbot-settings', 'kui_display' );
    }

    // ── Field Renderers ───────────────────────────────────────────────────────
    public function field_api_url() {
        $v = get_option( 'kui_chatbot_api_url', 'http://localhost:5000' );
        echo '<input type="url" name="kui_chatbot_api_url" value="' . esc_attr( $v ) . '" class="regular-text" placeholder="http://localhost:5000">';
        echo '<p class="description">URL backend Node.js. Contoh: <code>https://api.yourdomain.com</code></p>';
    }
    public function field_ws_url() {
        $v = get_option( 'kui_chatbot_ws_url', 'ws://localhost:8080/ws' );
        echo '<input type="text" name="kui_chatbot_ws_url" value="' . esc_attr( $v ) . '" class="regular-text" placeholder="ws://localhost:8080/ws">';
        echo '<p class="description">URL WebSocket AI server. Gunakan <code>wss://</code> untuk HTTPS.</p>';
    }
    public function field_bot_name() {
        $v = get_option( 'kui_chatbot_bot_name', 'KUI UNPAD Assistant' );
        echo '<input type="text" name="kui_chatbot_bot_name" value="' . esc_attr( $v ) . '" class="regular-text">';
    }
    public function field_bot_subtitle() {
        $v = get_option( 'kui_chatbot_bot_subtitle', 'Universitas Padjadjaran' );
        echo '<input type="text" name="kui_chatbot_bot_subtitle" value="' . esc_attr( $v ) . '" class="regular-text">';
    }
    public function field_logo_url() {
        $v   = get_option( 'kui_chatbot_logo_url', '' );
        $src = esc_attr( $v );
        $dsp = $src ? 'display:inline-block' : 'display:none';
        echo '<div style="display:flex;align-items:center;gap:12px;">';
        echo '<input type="text" id="kui_chatbot_logo_url" name="kui_chatbot_logo_url" value="' . $src . '" class="regular-text" placeholder="https://... atau kosongkan untuk default">';
        echo '<button type="button" class="button kui-media-upload-btn" data-target="kui_chatbot_logo_url">Pilih Gambar</button>';
        echo '</div>';
        echo '<img id="kui_chatbot_logo_url-preview" src="' . $src . '" style="margin-top:8px;max-height:60px;border-radius:8px;' . $dsp . '">';
        echo '<p class="description">Logo di header chatbot. Kosongkan untuk logo default KUI.</p>';
    }
    public function field_default_lang() {
        $v = get_option( 'kui_chatbot_default_lang', 'id' );
        echo '<select name="kui_chatbot_default_lang">';
        echo '<option value="id"' . selected( $v, 'id', false ) . '>🇮🇩 Bahasa Indonesia</option>';
        echo '<option value="en"' . selected( $v, 'en', false ) . '>🇬🇧 English</option>';
        echo '</select>';
    }
    public function field_default_mode() {
        $v = get_option( 'kui_chatbot_default_mode', 'embedded' );
        echo '<select name="kui_chatbot_default_mode">';
        echo '<option value="embedded"' . selected( $v, 'embedded', false ) . '>📄 Embedded (tampil di halaman)</option>';
        echo '<option value="floating"' . selected( $v, 'floating', false ) . '>💬 Floating (tombol mengambang)</option>';
        echo '</select>';
        echo '<p class="description">Override per shortcode: <code>[kui_chatbot mode="floating"]</code></p>';
    }
    public function field_chat_height() {
        $v = get_option( 'kui_chatbot_chat_height', '85vh' );
        echo '<input type="text" name="kui_chatbot_chat_height" value="' . esc_attr( $v ) . '" class="small-text" placeholder="85vh">';
        echo '<p class="description">Contoh: <code>85vh</code>, <code>600px</code></p>';
    }

    // ── Settings Page ─────────────────────────────────────────────────────────
    public function render_settings_page() {
        if ( ! current_user_can( 'manage_options' ) ) return;
        ?>
        <div class="wrap">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#42929d,#389ea9);display:flex;align-items:center;justify-content:center;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z"/><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1"/></svg>
                </div>
                <div>
                    <h1 style="margin:0;font-size:1.6rem;">KUI UNPAD Chatbot</h1>
                    <p style="margin:0;color:#666;font-size:13px;">Konfigurasi chatbot AI untuk Kantor Urusan Internasional</p>
                </div>
            </div>

            <?php settings_errors( 'kui_chatbot_options' ); ?>

            <div style="display:grid;grid-template-columns:1fr 300px;gap:24px;">
                <div>
                    <form method="post" action="options.php">
                        <?php settings_fields( 'kui_chatbot_options' ); do_settings_sections( 'kui-chatbot-settings' ); submit_button( 'Simpan Pengaturan', 'primary large' ); ?>
                    </form>
                </div>
                <div>
                    <div style="background:#fff;border:1px solid #e0e0e0;border-radius:12px;padding:20px;margin-bottom:16px;">
                        <h3 style="margin-top:0;color:#42929d;">📌 Shortcode</h3>
                        <p><strong>Embedded:</strong></p>
                        <code style="display:block;background:#f5f5f5;padding:8px;border-radius:6px;margin-bottom:10px;">[kui_chatbot]</code>
                        <p><strong>Floating:</strong></p>
                        <code style="display:block;background:#f5f5f5;padding:8px;border-radius:6px;margin-bottom:10px;">[kui_chatbot mode="floating"]</code>
                        <p><strong>Override bahasa:</strong></p>
                        <code style="display:block;background:#f5f5f5;padding:8px;border-radius:6px;">[kui_chatbot lang="en"]</code>
                    </div>
                    <div style="background:#fff;border:1px solid #e0e0e0;border-radius:12px;padding:20px;margin-bottom:16px;">
                        <h3 style="margin-top:0;color:#42929d;">⚡ Status</h3>
                        <?php
                        $this->status_row( 'API URL',       ! empty( get_option( 'kui_chatbot_api_url' ) ) );
                        $this->status_row( 'WebSocket URL', ! empty( get_option( 'kui_chatbot_ws_url'  ) ) );
                        ?>
                    </div>
                    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:20px;">
                        <h3 style="margin-top:0;color:#d97706;">📋 Persyaratan Backend</h3>
                        <ul style="font-size:13px;line-height:1.8;padding-left:18px;margin:0;">
                            <li>Node.js backend berjalan (port 5000)</li>
                            <li>WebSocket AI server berjalan (port 8080)</li>
                            <li>Python FastAPI RAG server aktif</li>
                            <li>MongoDB terhubung</li>
                            <li>CORS dikonfigurasi untuk domain WordPress</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        <?php
    }

    private function status_row( $label, $ok ) {
        $icon  = $ok ? '✅' : '❌';
        $color = $ok ? '#166534' : '#991b1b';
        $bg    = $ok ? '#f0fdf4' : '#fef2f2';
        echo "<div style='background:{$bg};border-radius:8px;padding:8px 12px;margin-bottom:8px;color:{$color};font-size:13px;'>{$icon} {$label}</div>";
    }
}
