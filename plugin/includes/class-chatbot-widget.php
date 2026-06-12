<?php
defined( 'ABSPATH' ) || exit;

class KUI_Chatbot_Widget {

    public function __construct() {
        add_shortcode( 'kui_chatbot', [ $this, 'render_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'register_assets' ] );
    }

    public function register_assets() {
        wp_register_style(
            'kui-chatbot-frontend',
            KUI_CHATBOT_ASSETS_URL . 'css/chatbot-frontend.css',
            [], KUI_CHATBOT_VERSION
        );
        wp_register_script(
            'kui-chatbot-frontend',
            KUI_CHATBOT_ASSETS_URL . 'js/chatbot-frontend.js',
            [], KUI_CHATBOT_VERSION, true
        );

        $logo = get_option( 'kui_chatbot_logo_url', '' );
        if ( empty( $logo ) ) {
            $logo = KUI_CHATBOT_ASSETS_URL . 'images/kui-logo-default.svg';
        }

        wp_localize_script( 'kui-chatbot-frontend', 'kuiChatbotConfig', [
            'apiUrl'      => esc_url_raw( get_option( 'kui_chatbot_api_url',      'http://localhost:5000' ) ),
            'wsUrl'       => sanitize_text_field( get_option( 'kui_chatbot_ws_url', 'ws://localhost:8080/ws' ) ),
            'botName'     => sanitize_text_field( get_option( 'kui_chatbot_bot_name',     'KUI UNPAD Assistant' ) ),
            'botSubtitle' => sanitize_text_field( get_option( 'kui_chatbot_bot_subtitle', 'Universitas Padjadjaran' ) ),
            'logoUrl'     => esc_url( $logo ),
            'defaultLang' => sanitize_text_field( get_option( 'kui_chatbot_default_lang', 'id' ) ),
            'chatHeight'  => sanitize_text_field( get_option( 'kui_chatbot_chat_height',  '650px' ) ),
        ] );
    }

    public function render_shortcode( $atts ) {
        $atts = shortcode_atts( [
            'mode'   => get_option( 'kui_chatbot_default_mode', 'embedded' ),
            'lang'   => '',
            'height' => '',
        ], $atts, 'kui_chatbot' );

        $mode   = in_array( $atts['mode'], [ 'embedded', 'floating' ], true ) ? $atts['mode'] : 'embedded';
        $lang   = in_array( $atts['lang'], [ 'id', 'en' ], true ) ? $atts['lang'] : '';
        $height = ! empty( $atts['height'] ) ? sanitize_text_field( $atts['height'] ) : '';

        wp_enqueue_style( 'kui-chatbot-frontend' );
        wp_enqueue_script( 'kui-chatbot-frontend' );

        static $n = 0; $n++;
        $uid = 'kui-chatbot-' . $n . '-' . substr( md5( uniqid() ), 0, 6 );

        $data  = 'data-mode="' . esc_attr( $mode ) . '"';
        if ( $lang )   $data .= ' data-lang="'   . esc_attr( $lang )   . '"';
        if ( $height ) $data .= ' data-height="' . esc_attr( $height ) . '"';

        return '<div id="' . esc_attr( $uid ) . '" class="kui-chatbot-root" ' . $data . '></div>';
    }
}
