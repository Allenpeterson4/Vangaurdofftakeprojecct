<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/money.php';

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = (string) ($_GET['action'] ?? '');
    $user = require_authenticated_user();
    $accessToken = supabase_access_token();
    if ($accessToken === null) {
        json_response(['error' => 'Your session has expired. Please sign in again.'], 401);
    }

    if ($method === 'GET') {
        if ($action === 'admin_dashboard') {
            if ($user['role'] !== 'admin') {
                json_response([
                    'error' => 'Administrator access is required.',
                    'redirect_to' => '/manager/',
                ], 403);
            }
            json_response(admin_dashboard($user, $accessToken));
        }
        if ($action === 'manager_dashboard') {
            if ($user['role'] !== 'manager') {
                json_response([
                    'error' => 'Manager access is required.',
                    'redirect_to' => '/admin/',
                ], 403);
            }
            json_response(manager_dashboard($user, $accessToken));
        }
        json_response(['error' => 'Unknown dashboard request.'], 400);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        json_response(['error' => 'Method not allowed.'], 405);
    }
    require_same_origin();
    require_csrf_token();
    $payload = portal_json_payload();
    match ($action) {
        'create_supplier' => create_supplier($user, $payload, $accessToken),
        'assign_manager' => assign_manager($user, $payload, $accessToken),
        'switch_workspace' => switch_workspace($user, $payload, $accessToken),
        'create_batch' => create_batch($user, $payload, $accessToken),
        'update_batch' => update_batch($user, $payload, $accessToken),
        'update_status' => update_batch_status($user, $payload, $accessToken),
        'record_weekly_payout' => record_weekly_payout($user, $payload, $accessToken),
        default => json_response(['error' => 'Unknown operations action.'], 400),
    };
} catch (Throwable $error) {
    handle_api_error($error);
}

function portal_json_payload(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || strlen($raw) > 32768) {
        json_response(['error' => 'The submitted request is too large.'], 413);
    }
    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
        json_response(['error' => 'A valid JSON request body is required.'], 400);
    }
    return $payload;
}

function supabase_all_rows(string $query, string $accessToken): array
{
    $allRows = [];
    $pageSize = 1000;
    $maximumRows = 50000;
    for ($offset = 0; $offset < $maximumRows; $offset += $pageSize) {
        $separator = str_contains($query, '?') ? '&' : '?';
        $rows = supabase_rest_request(
            $query . $separator . 'limit=' . $pageSize . '&offset=' . $offset,
            'GET',
            null,
            $accessToken,
        );
        if (count($rows) > $pageSize) {
            throw new RuntimeException('Supabase returned more records than the requested page size.');
        }
        array_push($allRows, ...$rows);
        if (count($rows) < $pageSize) {
            return $allRows;
        }
    }
    throw new RuntimeException('The dashboard record limit was reached; narrow the reporting period before retrying.');
}

function admin_dashboard(array $user, string $accessToken): array
{
    $suppliers = supabase_all_rows(
        'offtake_v2_suppliers?select=id,name,contact_person,phone,created_at&order=name.asc,id.asc',
        $accessToken,
    );
    $managers = supabase_all_rows(
        'offtake_v2_managers?select=id,email,full_name,supplier_id,is_active&order=email.asc,id.asc',
        $accessToken,
    );
    $memberships = supabase_all_rows(
        'offtake_v2_manager_suppliers?select=manager_id,supplier_id&order=manager_id.asc,supplier_id.asc',
        $accessToken,
    );
    $supplierIdsByManager = [];
    foreach ($memberships as $membership) {
        $supplierIdsByManager[(string) $membership['manager_id']][] = (string) $membership['supplier_id'];
    }
    foreach ($managers as &$manager) {
        $manager['role'] = 'manager';
        $manager['supplier_ids'] = $supplierIdsByManager[(string) $manager['id']] ?? [];
    }
    unset($manager);

    $batches = supabase_rest_request(
        'offtake_v2_batches?select=id,supplier_id,accounting_model,product_name,unit_quantity,unit_cost_price,unit_selling_price,fuel_subsidy_per_unit,total_capital,total_revenue,net_investor_credit,initial_purchase_amount,sales_discount_percent,wholesale_supply_price,manager_allowance_percent,discounted_revenue,gross_profit,manager_allowance_amount,net_company_payout,destination_route,vehicle_reference,driver_name,driver_phone,status,dispatched_at,completed_at,created_at,supplier:offtake_v2_suppliers(name)&order=created_at.desc&limit=200',
        'GET',
        null,
        $accessToken,
    );
    foreach ($batches as &$batch) {
        $batch['supplier_name'] = (string) ($batch['supplier']['name'] ?? '');
        unset($batch['supplier']);
    }
    unset($batch);

    $allBatches = supabase_all_rows(
        'offtake_v2_batches?select=id,supplier_id,status,accounting_model,unit_quantity,total_capital,total_revenue,fuel_subsidy_per_unit,net_investor_credit,initial_purchase_amount,discounted_revenue,gross_profit,manager_allowance_amount,net_company_payout,completed_at,supplier:offtake_v2_suppliers(name)&order=id.asc',
        $accessToken,
    );
    $payouts = supabase_all_rows(
        'offtake_v2_weekly_payouts?select=id,supplier_id,week_start,amount,paid_by_email,transfer_reference,paid_at,supplier:offtake_v2_suppliers(name)&order=id.asc',
        $accessToken,
    );
    usort($payouts, static fn(array $left, array $right): int =>
        ((string) $right['paid_at'] <=> (string) $left['paid_at']) ?: ((int) $right['id'] <=> (int) $left['id'])
    );
    $audit = supabase_rest_request(
        'offtake_v2_status_audit?select=id,batch_id,old_status,new_status,actor_email,occurred_at&order=occurred_at.desc,id.desc&limit=10',
        'GET',
        null,
        $accessToken,
    );

    $weekStart = start_of_utc_week(new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');
    $weekEnd = (new DateTimeImmutable($weekStart, new DateTimeZone('UTC')))->modify('+7 days')->format('Y-m-d');
    $activeCapital = '0.00';
    $activeBatches = 0;
    $weeklyNetYield = '0.00';
    $currentWeekBySupplier = [];
    $settlementGroups = [];

    foreach ($allBatches as $batch) {
        $status = (string) ($batch['status'] ?? '');
        $supplierId = (string) ($batch['supplier_id'] ?? '');
        $financials = batch_financials($batch);
        if (in_array($status, ['pending', 'paid', 'in_transit'], true)) {
            $activeCapital = money_decimal_add($activeCapital, $financials['capital']);
            $activeBatches++;
        }
        if ($status !== 'completed' || !is_string($batch['completed_at'] ?? null)) {
            continue;
        }

        $completedAt = new DateTimeImmutable($batch['completed_at'], new DateTimeZone('UTC'));
        $settlementWeek = start_of_utc_week($completedAt)->format('Y-m-d');
        $netCredit = $financials['payout'];
        if ($batch['completed_at'] >= $weekStart && $batch['completed_at'] < $weekEnd) {
            $weeklyNetYield = money_decimal_add($weeklyNetYield, $financials['net_profit']);
            $currentWeekBySupplier[$supplierId] = money_decimal_add($currentWeekBySupplier[$supplierId] ?? '0.00', $netCredit);
        }

        $key = $settlementWeek . '|' . $supplierId;
        if (!isset($settlementGroups[$key])) {
            $settlementGroups[$key] = [
                'week_start' => $settlementWeek,
                'supplier_id' => $supplierId,
                'supplier_name' => (string) ($batch['supplier']['name'] ?? ''),
                'completed_batches' => 0,
                'deployed_capital' => '0.00',
                'gross_sales_value' => '0.00',
                'fuel_allowance' => '0.00',
                'gross_profit' => '0.00',
                'net_profit' => '0.00',
                'net_investor_credit' => '0.00',
            ];
        }
        $settlementGroups[$key]['completed_batches']++;
        $settlementGroups[$key]['deployed_capital'] = money_decimal_add($settlementGroups[$key]['deployed_capital'], $financials['capital']);
        $settlementGroups[$key]['gross_sales_value'] = money_decimal_add($settlementGroups[$key]['gross_sales_value'], $financials['revenue']);
        $settlementGroups[$key]['gross_profit'] = money_decimal_add($settlementGroups[$key]['gross_profit'], $financials['gross_profit']);
        $settlementGroups[$key]['fuel_allowance'] = money_decimal_add($settlementGroups[$key]['fuel_allowance'], $financials['allowance']);
        $settlementGroups[$key]['net_profit'] = money_decimal_add($settlementGroups[$key]['net_profit'], $financials['net_profit']);
        $settlementGroups[$key]['net_investor_credit'] = money_decimal_add($settlementGroups[$key]['net_investor_credit'], $netCredit);
    }

    $payoutTotals = [];
    $payoutHistory = [];
    foreach ($payouts as $payout) {
        $key = (string) $payout['supplier_id'] . '|' . (string) $payout['week_start'];
        $payoutTotals[$key] = money_decimal_add($payoutTotals[$key] ?? '0.00', (string) $payout['amount']);
        if (count($payoutHistory) < 50) {
            $payout['supplier_name'] = (string) ($payout['supplier']['name'] ?? '');
            unset($payout['supplier']);
            $payoutHistory[] = $payout;
        }
    }
    $pendingWeeklyPayouts = '0.00';
    foreach ($currentWeekBySupplier as $supplierId => $netCredit) {
        $outstanding = money_decimal_subtract($netCredit, $payoutTotals[$supplierId . '|' . $weekStart] ?? '0.00');
        if (money_decimal_is_positive($outstanding)) {
            $pendingWeeklyPayouts = money_decimal_add($pendingWeeklyPayouts, $outstanding);
        }
    }

    $settlements = array_values($settlementGroups);
    usort($settlements, static fn(array $left, array $right): int =>
        ($right['week_start'] <=> $left['week_start']) ?: ($left['supplier_name'] <=> $right['supplier_name'])
    );
    foreach ($settlements as &$settlement) {
        $paidAmount = $payoutTotals[$settlement['supplier_id'] . '|' . $settlement['week_start']] ?? '0.00';
        $settlement['paid_amount'] = $paidAmount;
        $outstanding = money_decimal_subtract($settlement['net_investor_credit'], $paidAmount);
        $settlement['pending_payout'] = money_decimal_is_positive($outstanding) ? $outstanding : '0.00';
    }
    unset($settlement);

    return [
        'user' => $user,
        'suppliers' => $suppliers,
        'managers' => $managers,
        'batches' => $batches,
        'metrics' => [
            'active_capital' => $activeCapital,
            'active_batches' => $activeBatches,
            'weekly_net_yield' => $weeklyNetYield,
            'pending_weekly_payouts' => $pendingWeeklyPayouts,
        ],
        'settlements' => array_slice($settlements, 0, 100),
        'payout_history' => $payoutHistory,
        'audit' => $audit,
    ];
}

function manager_dashboard(array $user, string $accessToken): array
{
    $weekStart = start_of_utc_week(new DateTimeImmutable('now', new DateTimeZone('UTC')));
    $weekEnd = $weekStart->modify('+7 days');
    $memberships = supabase_rest_request(
        'offtake_v2_manager_suppliers?select=supplier_id,supplier:offtake_v2_suppliers(id,name)&manager_id=eq.' . rawurlencode((string) $user['id']) . '&order=supplier_id.asc',
        'GET',
        null,
        $accessToken,
    );
    $workspaces = [];
    foreach ($memberships as $membership) {
        if (is_array($membership['supplier'] ?? null)) {
            $workspaces[] = $membership['supplier'];
        }
    }
    if (!$workspaces && is_string($user['supplier_id'] ?? null) && valid_uuid($user['supplier_id'])) {
        $fallbackRows = supabase_rest_request(
            'offtake_v2_suppliers?select=id,name&id=eq.' . rawurlencode($user['supplier_id']) . '&limit=1',
            'GET',
            null,
            $accessToken,
        );
        if (isset($fallbackRows[0])) {
            $workspaces[] = $fallbackRows[0];
        }
    }

    $workspaceIds = array_column($workspaces, 'id');
    $requestedSupplierId = $user['active_supplier_id'] ?? null;
    $supplierId = is_string($requestedSupplierId) && in_array($requestedSupplierId, $workspaceIds, true)
        ? $requestedSupplierId
        : ($user['supplier_id'] ?? ($workspaceIds[0] ?? null));
    if (!is_string($supplierId) || !valid_uuid($supplierId) || !in_array($supplierId, $workspaceIds, true)) {
        return [
            'user' => $user,
            'supplier' => null,
            'workspaces' => $workspaces,
            'active_workspace_id' => null,
            'batches' => [],
            'summary' => [
                'week_start' => $weekStart->format('Y-m-d'),
                'completed_batches' => 0,
                'total_invested_amount' => '0.00',
                'total_sales_revenue' => '0.00',
                'active_batches' => 0,
                'net_credit_due' => '0.00',
            ],
        ];
    }
    $supplierRows = supabase_rest_request(
        'offtake_v2_suppliers?select=id,name,contact_person,phone,created_at&id=eq.' . rawurlencode($supplierId) . '&limit=1',
        'GET',
        null,
        $accessToken,
    );
    $supplier = $supplierRows[0] ?? null;
    if (!is_array($supplier)) {
        throw new RuntimeException('The assigned purchasing company is unavailable.');
    }
    $batches = supabase_rest_request(
        'offtake_v2_batches?select=id,supplier_id,accounting_model,product_name,unit_quantity,unit_cost_price,unit_selling_price,fuel_subsidy_per_unit,total_capital,total_revenue,net_investor_credit,initial_purchase_amount,sales_discount_percent,wholesale_supply_price,manager_allowance_percent,discounted_revenue,gross_profit,manager_allowance_amount,net_company_payout,destination_route,vehicle_reference,driver_name,driver_phone,status,dispatched_at,completed_at,created_at&supplier_id=eq.' . rawurlencode($supplierId) . '&order=created_at.desc&limit=100',
        'GET',
        null,
        $accessToken,
    );
    $financialBatches = supabase_all_rows(
        'offtake_v2_batches?select=status,accounting_model,unit_quantity,total_capital,total_revenue,fuel_subsidy_per_unit,net_investor_credit,initial_purchase_amount,discounted_revenue,gross_profit,manager_allowance_amount,net_company_payout,completed_at&supplier_id=eq.'
            . rawurlencode($supplierId) . '&order=id.asc',
        $accessToken,
    );
    $invested = '0.00';
    $salesRevenue = '0.00';
    $net = '0.00';
    $activeBatchCount = 0;
    $completedThisWeek = 0;
    foreach ($financialBatches as $batch) {
        $financials = batch_financials($batch);
        $status = (string) ($batch['status'] ?? '');
        $invested = money_decimal_add($invested, $financials['capital']);
        if (in_array($status, ['pending', 'paid', 'in_transit'], true)) {
            $activeBatchCount++;
        }
        if ($status !== 'completed' || !is_string($batch['completed_at'] ?? null)) {
            continue;
        }
        $salesRevenue = money_decimal_add($salesRevenue, $financials['revenue']);
        $completedAt = new DateTimeImmutable($batch['completed_at'], new DateTimeZone('UTC'));
        if ($completedAt >= $weekStart && $completedAt < $weekEnd) {
            $completedThisWeek++;
            $net = money_decimal_add($net, $financials['payout']);
        }
    }
    return [
        'user' => $user,
        'supplier' => $supplier,
        'workspaces' => $workspaces,
        'active_workspace_id' => $supplierId,
        'batches' => $batches,
        'summary' => [
            'week_start' => $weekStart->format('Y-m-d'),
            'completed_batches' => $completedThisWeek,
            'total_invested_amount' => $invested,
            'total_sales_revenue' => $salesRevenue,
            'active_batches' => $activeBatchCount,
            'net_credit_due' => $net,
        ],
    ];
}

function require_admin_action(array $user): void
{
    if (($user['role'] ?? '') !== 'admin') {
        json_response(['error' => 'Administrator access is required.'], 403);
    }
}

function create_supplier(array $user, array $payload, string $accessToken): never
{
    require_admin_action($user);
    $name = required_string($payload, 'name', 160);
    if ((function_exists('mb_strlen') ? mb_strlen($name) : strlen($name)) < 2) {
        json_response(['error' => 'Company name must have at least 2 characters.'], 422);
    }
    supabase_rest_request('offtake_v2_suppliers', 'POST', [
        'id' => uuid_v4(),
        'name' => $name,
        'contact_person' => required_string($payload, 'contact_person', 160, false),
        'phone' => required_string($payload, 'phone', 40, false),
    ], $accessToken, 'return=minimal');
    json_response(['created' => true], 201);
}

function assign_manager(array $user, array $payload, string $accessToken): never
{
    require_admin_action($user);
    $managerId = required_string($payload, 'user_id', 36);
    $supplierIds = $payload['supplier_ids'] ?? null;
    if ($supplierIds === null && isset($payload['supplier_id']) && is_string($payload['supplier_id'])) {
        $supplierIds = $payload['supplier_id'] === '' ? [] : [$payload['supplier_id']];
    }
    if (!valid_uuid($managerId) || !is_array($supplierIds) || count($supplierIds) > 100) {
        json_response(['error' => 'Choose a valid manager account and purchasing companies.'], 422);
    }
    $normalizedIds = [];
    foreach ($supplierIds as $supplierId) {
        if (!is_string($supplierId) || !valid_uuid($supplierId)) {
            json_response(['error' => 'Choose valid purchasing companies.'], 422);
        }
        $normalizedIds[] = strtolower($supplierId);
    }
    $normalizedIds = array_values(array_unique($normalizedIds));
    supabase_rest_request(
        'rpc/offtake_v2_assign_manager_workspaces',
        'POST',
        ['p_manager_id' => $managerId, 'p_supplier_ids' => $normalizedIds],
        $accessToken,
    );
    json_response(['updated' => true, 'workspace_count' => count($normalizedIds)]);
}

function switch_workspace(array $user, array $payload, string $accessToken): never
{
    if (($user['role'] ?? '') !== 'manager') {
        json_response(['error' => 'Only managers can switch company workspaces.'], 403);
    }
    $supplierId = required_string($payload, 'supplier_id', 36);
    if (!valid_uuid($supplierId)) {
        json_response(['error' => 'Choose a valid company workspace.'], 422);
    }
    $memberships = supabase_rest_request(
        'offtake_v2_manager_suppliers?select=supplier_id&manager_id=eq.' . rawurlencode((string) $user['id'])
            . '&supplier_id=eq.' . rawurlencode($supplierId) . '&limit=1',
        'GET',
        null,
        $accessToken,
    );
    if (!$memberships) {
        json_response(['error' => 'You are not assigned to that company workspace.'], 403);
    }
    portal_set_cookie('VVDPortalWorkspace', $supplierId);
    json_response(['switched' => true, 'supplier_id' => $supplierId]);
}

function record_weekly_payout(array $user, array $payload, string $accessToken): never
{
    require_admin_action($user);
    $supplierId = required_string($payload, 'supplier_id', 36);
    $weekStart = required_string($payload, 'week_start', 10);
    $reference = required_string($payload, 'transfer_reference', 120, false);
    if (!valid_uuid($supplierId)) {
        json_response(['error' => 'Choose a valid supplier company.'], 422);
    }
    $weekDate = DateTimeImmutable::createFromFormat('!Y-m-d', $weekStart, new DateTimeZone('UTC'));
    $dateErrors = DateTimeImmutable::getLastErrors();
    $currentWeekStart = start_of_utc_week(new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');
    if (!$weekDate || ($dateErrors !== false && ($dateErrors['warning_count'] || $dateErrors['error_count']))
        || $weekDate->format('Y-m-d') !== $weekStart || $weekDate->format('N') !== '1' || $weekStart > $currentWeekStart) {
        json_response(['error' => 'Choose a valid completed settlement week.'], 422);
    }
    $result = supabase_rest_request('rpc/offtake_v2_record_weekly_payout', 'POST', [
        'p_supplier_id' => $supplierId,
        'p_week_start' => $weekStart,
        'p_transfer_reference' => $reference,
    ], $accessToken);
    $payout = $result[0] ?? $result;
    if (!is_array($payout) || !isset($payout['amount'])) {
        throw new RuntimeException('Supabase did not return the recorded payout.');
    }
    json_response(['paid' => true, 'amount' => (string) $payout['amount']]);
}

function decimal_value(array $payload, string $key, int $maxIntegerDigits = 12): string
{
    $value = $payload[$key] ?? null;
    if (!is_string($value) && !is_int($value) && !is_float($value)) {
        json_response(['error' => 'A financial value is missing or invalid.'], 422);
    }
    $value = trim((string) $value);
    if (!preg_match('/^(?:0|[1-9][0-9]{0,' . ($maxIntegerDigits - 1) . '})(?:\.[0-9]{1,2})?$/', $value)) {
        json_response(['error' => 'Financial values must be non-negative with at most two decimal places.'], 422);
    }
    return $value;
}

function percentage_value(array $payload, string $key, string $default = '0.00'): string
{
    $value = $payload[$key] ?? $default;
    if (!is_string($value) && !is_int($value) && !is_float($value)) {
        json_response(['error' => 'Percentage values must be between 0 and 100.'], 422);
    }
    $normalized = trim((string) $value);
    if (!preg_match('/^(?:0|[1-9][0-9]{0,2})(?:\.[0-9]{1,2})?$/', $normalized)
        || money_decimal_is_positive(money_decimal_subtract($normalized, '100.00'))) {
        json_response(['error' => 'Percentage values must be between 0 and 100.'], 422);
    }
    return $normalized;
}

function inventory_batch_values(array $payload): array
{
    $quantity = filter_var($payload['unit_quantity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 4294967295]]);
    if ($quantity === false) {
        json_response(['error' => 'Unit quantity must be a positive whole number.'], 422);
    }
    $productName = required_string($payload, 'product_name', 160);
    if ((function_exists('mb_strlen') ? mb_strlen($productName) : strlen($productName)) < 2) {
        json_response(['error' => 'Product name must have at least 2 characters.'], 422);
    }
    return [
        'product_name' => $productName,
        'unit_quantity' => $quantity,
        'initial_purchase_amount' => decimal_value($payload, 'initial_purchase_amount', 22),
        'sales_discount_percent' => percentage_value($payload, 'sales_discount_percent'),
        'wholesale_supply_price' => decimal_value($payload, 'wholesale_supply_price'),
        'manager_allowance_percent' => percentage_value($payload, 'manager_allowance_percent', '15'),
        'destination_route' => required_string($payload, 'destination_route', 255, false),
        'vehicle_reference' => required_string($payload, 'vehicle_reference', 80, false),
        'driver_name' => required_string($payload, 'driver_name', 160, false),
        'driver_phone' => required_string($payload, 'driver_phone', 40, false),
    ];
}

function create_batch(array $user, array $payload, string $accessToken): never
{
    $supplierId = required_string($payload, 'supplier_id', 36);
    if (!valid_uuid($supplierId)) {
        json_response(['error' => 'Choose a valid purchasing company.'], 422);
    }

    if (($user['role'] ?? '') === 'manager') {
        $activeSupplierId = $user['active_supplier_id'] ?? $user['supplier_id'] ?? null;
        if (!is_string($activeSupplierId) || !hash_equals($activeSupplierId, $supplierId)) {
            json_response(['error' => 'Switch to an assigned company workspace before adding inventory.'], 403);
        }
        supabase_rest_request('offtake_v2_batches', 'POST', array_merge([
            'id' => uuid_v4(),
            'supplier_id' => $supplierId,
            'accounting_model' => 'inventory',
            'unit_cost_price' => '0.00',
            'unit_selling_price' => '0.00',
            'fuel_subsidy_per_unit' => '0.00',
        ], inventory_batch_values($payload)), $accessToken, 'return=minimal');
        json_response(['created' => true], 201);
    }

    require_admin_action($user);
    $quantity = filter_var($payload['unit_quantity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 4294967295]]);
    if ($quantity === false) {
        json_response(['error' => 'Unit quantity must be a positive whole number.'], 422);
    }
    supabase_rest_request('offtake_v2_batches', 'POST', [
        'id' => uuid_v4(),
        'supplier_id' => $supplierId,
        'unit_quantity' => $quantity,
        'unit_cost_price' => decimal_value($payload, 'unit_cost_price'),
        'unit_selling_price' => decimal_value($payload, 'unit_selling_price'),
        'fuel_subsidy_per_unit' => decimal_value($payload, 'fuel_subsidy_per_unit'),
        'destination_route' => required_string($payload, 'destination_route', 255, false),
        'vehicle_reference' => required_string($payload, 'vehicle_reference', 80, false),
        'driver_name' => required_string($payload, 'driver_name', 160, false),
        'driver_phone' => required_string($payload, 'driver_phone', 40, false),
    ], $accessToken, 'return=minimal');
    json_response(['created' => true], 201);
}

function update_batch(array $user, array $payload, string $accessToken): never
{
    if (($user['role'] ?? '') !== 'manager') {
        json_response(['error' => 'Only managers can update their product inventory.'], 403);
    }
    $batchId = required_string($payload, 'batch_id', 36);
    if (!valid_uuid($batchId)) {
        json_response(['error' => 'Choose a valid product batch.'], 422);
    }
    $current = supabase_rest_request(
        'offtake_v2_batches?select=id,supplier_id,accounting_model,status&id=eq.' . rawurlencode($batchId) . '&limit=1',
        'GET',
        null,
        $accessToken,
    );
    $batch = $current[0] ?? null;
    $activeSupplierId = $user['active_supplier_id'] ?? $user['supplier_id'] ?? null;
    if (!is_array($batch) || ($batch['accounting_model'] ?? '') !== 'inventory'
        || ($batch['status'] ?? '') !== 'pending' || ($batch['supplier_id'] ?? '') !== $activeSupplierId) {
        json_response(['error' => 'Only an unfunded product batch in the active company workspace can be edited.'], 409);
    }
    $updated = supabase_rest_request(
        'offtake_v2_batches?id=eq.' . rawurlencode($batchId) . '&status=eq.pending',
        'PATCH',
        inventory_batch_values($payload),
        $accessToken,
        'return=representation',
    );
    if (!$updated) {
        json_response(['error' => 'The product batch changed while you were editing it. Reload and try again.'], 409);
    }
    json_response(['updated' => true]);
}

function update_batch_status(array $user, array $payload, string $accessToken): never
{
    $batchId = required_string($payload, 'batch_id', 36);
    $nextStatus = required_string($payload, 'status', 20);
    if (!valid_uuid($batchId) || !in_array($nextStatus, ['pending', 'paid', 'in_transit', 'completed', 'disputed'], true)) {
        json_response(['error' => 'Batch or status selection is invalid.'], 422);
    }
    $currentRows = supabase_rest_request(
        'offtake_v2_batches?select=id,supplier_id,accounting_model,product_name,unit_quantity,status,initial_purchase_amount,discounted_revenue,net_company_payout,destination_route,vehicle_reference,driver_name,driver_phone,supplier:offtake_v2_suppliers(name)&id=eq.'
            . rawurlencode($batchId) . '&limit=1',
        'GET',
        null,
        $accessToken,
    );
    $current = $currentRows[0] ?? null;
    if (!is_array($current)) {
        json_response(['error' => 'The batch was not found or is not accessible to this account.'], 404);
    }
    $currentStatus = (string) $current['status'];
    if ($currentStatus === $nextStatus) {
        json_response(['error' => 'The batch is already at that lifecycle step.'], 409);
    }
    if (($user['role'] ?? '') === 'manager') {
        $managerTransitions = ['paid' => 'pending', 'in_transit' => 'paid', 'completed' => 'in_transit'];
        if (($managerTransitions[$nextStatus] ?? null) !== $currentStatus) {
            json_response(['error' => 'Complete each batch lifecycle step in order.'], 409);
        }
    } elseif (($user['role'] ?? '') !== 'admin') {
        json_response(['error' => 'Administrator or manager access is required.'], 403);
    }
    $updated = supabase_rest_request(
        'offtake_v2_batches?id=eq.' . rawurlencode($batchId) . '&status=eq.' . rawurlencode($currentStatus),
        'PATCH',
        ['status' => $nextStatus],
        $accessToken,
        'return=representation',
    );
    if (!$updated) {
        json_response(['error' => 'The batch changed while this action was processing. Reload and try again.'], 409);
    }
    if ($nextStatus === 'in_transit') {
        $delivery = notify_admin_shipment($updated[0] + $current);
        json_response([
            'updated' => true,
            'notification' => $delivery['sent'] ? 'sent' : 'failed',
            'notification_channels' => ['telegram' => $delivery['telegram'], 'email' => $delivery['email']],
        ]);
    }
    json_response(['updated' => true]);
}

function batch_financials(array $batch): array
{
    if (($batch['accounting_model'] ?? 'legacy') === 'inventory') {
        $capital = (string) $batch['initial_purchase_amount'];
        $revenue = (string) $batch['discounted_revenue'];
        $grossProfit = (string) $batch['gross_profit'];
        $allowance = (string) $batch['manager_allowance_amount'];
        return [
            'capital' => $capital,
            'revenue' => $revenue,
            'gross_profit' => $grossProfit,
            'allowance' => $allowance,
            'net_profit' => money_decimal_subtract($grossProfit, $allowance),
            'payout' => (string) $batch['net_company_payout'],
        ];
    }

    $capital = (string) $batch['total_capital'];
    $revenue = (string) $batch['total_revenue'];
    $allowance = money_decimal_multiply_quantity(
        (string) ($batch['fuel_subsidy_per_unit'] ?? '0.00'),
        (int) ($batch['unit_quantity'] ?? 0),
    );
    $netProfit = (string) $batch['net_investor_credit'];
    return [
        'capital' => $capital,
        'revenue' => $revenue,
        'gross_profit' => money_decimal_subtract($revenue, $capital),
        'allowance' => $allowance,
        'net_profit' => $netProfit,
        'payout' => $netProfit,
    ];
}

function notify_admin_shipment(array $batch): array
{
    $config = portal_config();
    $message = implode("\n", [
        'Shipment loaded and in transit',
        'Purchasing company: ' . (string) ($batch['supplier']['name'] ?? 'Unknown'),
        'Product: ' . (string) ($batch['product_name'] ?? 'Legacy allocation'),
        'Quantity: ' . number_format((int) ($batch['unit_quantity'] ?? 0)),
        'Route: ' . ((string) ($batch['destination_route'] ?? '') ?: 'Not provided'),
        'Vehicle: ' . ((string) ($batch['vehicle_reference'] ?? '') ?: 'Not provided'),
        'Driver: ' . ((string) ($batch['driver_name'] ?? '') ?: 'Not provided'),
        'Driver phone: ' . ((string) ($batch['driver_phone'] ?? '') ?: 'Not provided'),
    ]);

    $telegramSent = send_telegram_shipment($config, $message);
    $emailSent = send_email_shipment($config, $batch, $message);
    if (!$telegramSent || !$emailSent) {
        error_log(sprintf(
            'Shipment notification incomplete for batch %s (Telegram: %s, email: %s).',
            (string) ($batch['id'] ?? 'unknown'),
            $telegramSent ? 'sent' : 'failed',
            $emailSent ? 'sent' : 'failed',
        ));
    }
    return ['sent' => $telegramSent && $emailSent, 'telegram' => $telegramSent, 'email' => $emailSent];
}

function send_telegram_shipment(array $config, string $message): bool
{
    $token = trim((string) ($config['telegram_bot_token'] ?? ''));
    $chatId = trim((string) ($config['telegram_chat_id'] ?? ''));
    if ($token === '' || $chatId === '' || !function_exists('curl_init')) {
        return false;
    }
    $handle = curl_init('https://api.telegram.org/bot' . rawurlencode($token) . '/sendMessage');
    if ($handle === false) {
        error_log('Telegram shipment request could not initialize cURL.');
        return false;
    }
    $encodedPayload = json_encode(['chat_id' => $chatId, 'text' => $message], JSON_UNESCAPED_SLASHES);
    if (!is_string($encodedPayload)) {
        curl_close($handle);
        error_log('Telegram shipment request could not encode its message.');
        return false;
    }
    curl_setopt_array($handle, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => $encodedPayload,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    if ($body === false) {
        error_log('Telegram shipment request failed: ' . curl_error($handle));
    }
    curl_close($handle);
    if (!is_string($body) || $status < 200 || $status >= 300) {
        return false;
    }
    $decoded = json_decode($body, true);
    return is_array($decoded) && ($decoded['ok'] ?? false) === true;
}

function send_email_shipment(array $config, array $batch, string $message): bool
{
    $recipient = trim((string) ($config['admin_alert_email'] ?? ''));
    $sender = trim((string) ($config['alert_from_email'] ?? ''));
    if ($sender === '') {
        $sender = $recipient;
    }
    if (!function_exists('mail') || !filter_var($recipient, FILTER_VALIDATE_EMAIL)
        || !filter_var($sender, FILTER_VALIDATE_EMAIL)) {
        return false;
    }
    $productName = (string) ($batch['product_name'] ?? '');
    $productName = preg_replace('/[\x00-\x1F\x7F]+/', ' ', $productName) ?? '';
    $subject = 'Shipment in transit: ' . (trim($productName) ?: 'Product batch');
    $headers = ['From' => $sender, 'Content-Type' => 'text/plain; charset=UTF-8'];
    return mail($recipient, $subject, $message, $headers);
}

function start_of_utc_week(DateTimeImmutable $date): DateTimeImmutable
{
    return $date->setTimezone(new DateTimeZone('UTC'))->setTime(0, 0)->modify('monday this week');
}

function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function valid_uuid(string $value): bool
{
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
}

function required_string(array $payload, string $key, int $maxLength, bool $required = true): string
{
    $value = $payload[$key] ?? '';
    if (!is_string($value) && !is_int($value)) {
        json_response(['error' => 'A required field is invalid.'], 422);
    }
    $value = trim((string) $value);
    if (($required && $value === '') || (function_exists('mb_strlen') ? mb_strlen($value) : strlen($value)) > $maxLength) {
        json_response(['error' => 'A required field is missing or too long.'], 422);
    }
    return $value;
}
