<?php
declare(strict_types=1);

return [
    // Use the database host shown in cPanel; many hosts use "localhost".
    'db_host' => 'localhost',
    'db_port' => '3306',

    // Replace these with the full database name and username shown in cPanel.
    'db_name' => 'cpanel_database_name',
    'db_user' => 'cpanel_database_user',
    'db_password' => 'replace_with_database_password',

    // Create a bot with @BotFather, add it to your channel as an administrator,
    // then enter the bot token and channel username (for example @your_channel)
    // or numeric chat ID. Keep the bot token private.
    'telegram_bot_token' => 'replace_with_telegram_bot_token',
    'telegram_chat_id' => 'replace_with_telegram_channel_or_chat_id',

    // Session lifetime in seconds (8 hours).
    'session_lifetime' => 28800,
];
