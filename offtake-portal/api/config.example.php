<?php
declare(strict_types=1);

return [
    // These are public client credentials. RLS, not this key, protects table data.
    'supabase_url' => 'https://your-project.supabase.co',
    'supabase_anon_key' => 'your-supabase-publishable-or-anon-key',
    // Optional exact origin, useful when a reverse proxy changes the PHP Host header.
    'app_origin' => '',
    // Server-side shipment alerts. Configure both Telegram fields and the admin email.
    'admin_alert_email' => '',
    'alert_from_email' => '',
    'telegram_bot_token' => '',
    'telegram_chat_id' => '',
];
