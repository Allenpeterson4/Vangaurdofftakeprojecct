<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    json_response(['error' => 'Method not allowed.'], 405);
}

$requiredColumns = [
    'offtake_v2_suppliers' => 'id,name,contact_person,phone,created_at',
    'offtake_v2_managers' => 'id,email,full_name,supplier_id,is_active,created_at,updated_at',
    'offtake_v2_manager_suppliers' => 'manager_id,supplier_id,assigned_at',
    'offtake_v2_admins' => 'id,email,full_name,is_active,created_at,updated_at',
    'offtake_v2_batches' => 'id,supplier_id,accounting_model,product_name,unit_quantity,unit_cost_price,unit_selling_price,fuel_subsidy_per_unit,total_capital,total_revenue,net_investor_credit,initial_purchase_amount,sales_discount_percent,wholesale_supply_price,manager_allowance_percent,discounted_revenue,gross_profit,manager_allowance_amount,net_company_payout,destination_route,vehicle_reference,driver_name,driver_phone,status,dispatched_at,completed_at,created_at,updated_at',
    'offtake_v2_status_audit' => 'id,batch_id,old_status,new_status,actor_role,actor_id,actor_email,occurred_at',
    'offtake_v2_weekly_payouts' => 'id,supplier_id,week_start,amount,paid_by_admin_id,paid_by_email,transfer_reference,paid_at',
];

try {
    foreach ($requiredColumns as $table => $columns) {
        supabase_rest_request($table . '?select=' . $columns . '&limit=0');
    }

    $sessionUser = current_portal_user();
    $config = portal_config();
    json_response([
        'status' => 'ok',
        'backend' => 'supabase_auth_postgrest',
        'session' => [
            'authenticated' => is_array($sessionUser),
            'role' => is_array($sessionUser) ? $sessionUser['role'] : null,
        ],
        'schema' => ['status' => 'ready',         'tables_checked' => count($requiredColumns)],
        'telegram' => [
        'configured' => trim((string) ($config['telegram_bot_token'] ?? '')) !== ''
            && trim((string) ($config['telegram_chat_id'] ?? '')) !== '',
        ],
        'email_alerts' => [
        'configured' => trim((string) ($config['admin_alert_email'] ?? '')) !== '',
        ],
        'project_url_configured' => trim((string) ($config['supabase_url'] ?? '')) !== '',
    ]);
} catch (SupabaseApiException $error) {
    if (in_array($error->apiCode, ['PGRST204', 'PGRST205'], true)) {
        json_response([
            'status' => 'setup_required',
            'backend' => 'supabase_auth_postgrest',
            'error' => 'The Supabase schema is missing or not yet available in the REST schema cache.',
            'setup' => 'Run database/offtake-platform-v2.postgresql.sql and the latest PostgreSQL migration in the Supabase SQL Editor, then reload the schema cache if needed.',
        ], 503);
    }
    handle_api_error($error);
} catch (Throwable $error) {
    handle_api_error($error);
}
