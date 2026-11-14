<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    send_json_response(['error' => 'Method not allowed.'], 405);
}

try {
    $connection = mysql_connection();
    $connection->query('SELECT 1')->fetchColumn();
    $requiredColumns = [
        'offtake_suppliers' => ['id', 'name', 'contact_person', 'phone', 'created_at'],
        'offtake_users' => ['id', 'email', 'full_name', 'password_hash', 'role', 'supplier_id', 'created_at', 'updated_at'],
        'offtake_batches' => ['id', 'supplier_id', 'unit_quantity', 'unit_cost_price', 'unit_selling_price', 'fuel_subsidy_per_unit', 'total_capital', 'total_revenue', 'net_investor_credit', 'destination_route', 'vehicle_reference', 'driver_name', 'driver_phone', 'status', 'dispatched_at', 'completed_at', 'created_at', 'updated_at'],
        'offtake_status_audit' => ['id', 'batch_id', 'old_status', 'new_status', 'actor_user_id', 'actor_email', 'occurred_at'],
        'offtake_login_attempts' => ['fingerprint', 'window_started', 'attempts', 'blocked_until'],
        'offtake_telegram_notifications' => ['id', 'message_text', 'delivery_status', 'attempts', 'last_error', 'next_attempt_at', 'created_at', 'sent_at'],
    ];
    $tableNames = array_keys($requiredColumns);
    $placeholders = implode(',', array_fill(0, count($tableNames), '?'));
    $columnQuery = $connection->prepare(
        'SELECT `TABLE_NAME`, `COLUMN_NAME`
         FROM `information_schema`.`COLUMNS`
         WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` IN (' . $placeholders . ')'
    );
    $columnQuery->execute($tableNames);
    $foundColumns = [];
    foreach ($columnQuery->fetchAll() as $column) {
        $foundColumns[$column['TABLE_NAME']][$column['COLUMN_NAME']] = true;
    }

    $missing = [];
    foreach ($requiredColumns as $table => $columns) {
        $missingColumns = array_values(array_filter(
            $columns,
            static fn(string $column): bool => !isset($foundColumns[$table][$column]),
        ));
        if ($missingColumns) $missing[$table] = $missingColumns;
    }
    if ($missing) {
        send_json_response([
            'status' => 'setup_required',
            'error' => 'The database is missing tables or columns required by the dashboards. Import the complete database/offtake-portal.sql file in phpMyAdmin.',
            'missing' => $missing,
        ], 503);
    }
    $config = portal_config();
    $telegramConfigured = is_string($config['telegram_bot_token'] ?? null)
        && trim($config['telegram_bot_token']) !== ''
        && !str_starts_with($config['telegram_bot_token'], 'replace_with_')
        && is_string($config['telegram_chat_id'] ?? null)
        && trim($config['telegram_chat_id']) !== ''
        && !str_starts_with($config['telegram_chat_id'], 'replace_with_');
    send_json_response([
        'status' => 'ok',
        'telegram' => [
            'configured' => $telegramConfigured,
        ],
    ]);
} catch (Throwable $error) {
    handle_api_error($error, 'Offtake health check');
}
