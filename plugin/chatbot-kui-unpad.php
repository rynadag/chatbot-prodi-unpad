<?php
/**
 * Plugin Name:       KUI UNPAD Chatbot
 * Plugin URI:        https://github.com/kui-unpad/chatbot
 * Description:       Chatbot AI Akademik Kantor Urusan Internasional Universitas Padjadjaran. Pasang dengan shortcode [kui_chatbot] atau [kui_chatbot mode="floating"].
 * Version:           1.1.0
 * Requires at least: 5.6
 * Requires PHP:      7.4
 * Author:            KUI UNPAD Dev Team
 * License:           MIT
 * Text Domain:       chatbot-kui-unpad
 */

defined( 'ABSPATH' ) || exit;

define( 'KUI_CHATBOT_VERSION',    '1.1.0' );
define( 'KUI_CHATBOT_DIR',        plugin_dir_path( __FILE__ ) );
define( 'KUI_CHATBOT_URL',        plugin_dir_url( __FILE__ ) );
define( 'KUI_CHATBOT_ASSETS_URL', KUI_CHATBOT_URL . 'assets/' );

require_once KUI_CHATBOT_DIR . 'includes/class-chatbot-admin.php';
require_once KUI_CHATBOT_DIR . 'includes/class-chatbot-widget.php';

add_action( 'plugins_loaded', function () {
    new KUI_Chatbot_Admin();
    new KUI_Chatbot_Widget();
} );

register_activation_hook( __FILE__, function () {
    $defaults = [
        'kui_chatbot_api_url'       => 'http://localhost:5000',
        'kui_chatbot_ws_url'        => 'ws://localhost:8080/ws',
        'kui_chatbot_bot_name'      => 'KUI UNPAD Assistant',
        'kui_chatbot_bot_subtitle'  => 'Universitas Padjadjaran',
        'kui_chatbot_logo_url'      => '',
        'kui_chatbot_default_lang'  => 'id',
        'kui_chatbot_default_mode'  => 'embedded',
        'kui_chatbot_chat_height'   => '650px',
    ];
    foreach ( $defaults as $k => $v ) add_option( $k, $v );
} );
