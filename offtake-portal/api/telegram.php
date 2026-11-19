<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

header('Allow: GET');
json_response([
    'error' => 'Telegram delivery is not part of the Supabase Auth + RLS backend.',
], 410);
