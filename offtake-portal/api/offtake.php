<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/telegram.php';

try {
    $connection = mysql_connection();
    start_app_session();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $action = $_GET['action'] ?? '';

    if ($method === 'GET') {
        if ($action === 'admin_dashboard') {
            $user = require_dashboard_user($connection, ['admin']);
            send_json_response(admin_dashboard($connection, $user));
        }
        if ($action === 'manager_dashboard') {
            $user = require_dashboard_user($connection, ['manager']);
            send_json_response(manager_dashboard($connection, $user));
        }
        require_authenticated_user($connection);
        send_json_response(['error' => 'Unknown dashboard request.'], 400);
    }

    if ($method !== 'POST') {
        header('Allow: GET, POST');
        send_json_response(['error' => 'Method not allowed.'], 405);
    }
    require_same_origin_request();
    require_csrf_token();
    $payload = request_json();
    $user = require_authenticated_user($connection);

    match ($action) {
        'create_supplier' => create_supplier($connection, $user, $payload),
        'assign_manager' => assign_manager($connection, $user, $payload),
        'create_batch' => create_batch($connection, $user, $payload),
        'update_status' => update_batch_status($connection, $user, $payload),
        default => send_json_response(['error' => 'Unknown operations action.'], 400),
    };
} catch (Throwable $error) {
    handle_api_error($error, 'Offtake operations API');
}

function require_dashboard_user(PDO $connection, array $roles): array
{
    $userId = $_SESSION['offtake_user_id'] ?? null;
    if (!is_string($userId)) send_json_response(['error' => 'Sign in to continue.'], 401);
    if (!session_write_close()) throw new RuntimeException('Unable to release the portal session lock.');

    $statement = $connection->prepare(
        'SELECT `id`, `email`, `full_name`, `role`, `supplier_id`
         FROM `offtake_users` WHERE `id` = :id LIMIT 1'
    );
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();
    if (!is_array($user)) send_json_response(['error' => 'Sign in to continue.'], 401);
    if (!in_array($user['role'], $roles, true)) {
        send_json_response(['error' => 'Your account does not have permission for this action.'], 403);
    }
    return $user;
}

function admin_dashboard(PDO $connection, array $user): array
{
    $suppliers = $connection->query(
        'SELECT `id`, `name`, `contact_person`, `phone`, `created_at`
         FROM `offtake_suppliers` ORDER BY `name`'
    )->fetchAll();
    $managers = $connection->query(
        'SELECT `id`, `email`, `full_name`, `role`, `supplier_id`
         FROM `offtake_users` WHERE `role` = \'manager\' ORDER BY `email`'
    )->fetchAll();
    $batches = $connection->query(
        'SELECT b.`id`, b.`supplier_id`, s.`name` AS `supplier_name`,
                b.`unit_quantity`, b.`unit_cost_price`, b.`unit_selling_price`,
                b.`fuel_subsidy_per_unit`, b.`total_capital`, b.`total_revenue`,
                b.`net_investor_credit`, b.`destination_route`, b.`vehicle_reference`,
                b.`driver_name`, b.`driver_phone`, b.`status`, b.`dispatched_at`,
                b.`completed_at`, b.`created_at`
         FROM `offtake_batches` b JOIN `offtake_suppliers` s ON s.`id` = b.`supplier_id`
         ORDER BY b.`created_at` DESC LIMIT 200'
    )->fetchAll();
    $metrics = $connection->query(
        'SELECT
           COALESCE(SUM(CASE WHEN `status` IN (\'pending\', \'in_transit\') THEN `total_capital` ELSE 0 END), 0) AS `active_capital`,
           COALESCE(SUM(CASE WHEN `status` = \'completed\' THEN `net_investor_credit` ELSE 0 END), 0) AS `accumulated_net_yield`,
           COALESCE(SUM(CASE WHEN `status` IN (\'pending\', \'in_transit\') THEN 1 ELSE 0 END), 0) AS `active_batches`
         FROM `offtake_batches`'
    )->fetch();
    $settlements = $connection->query(
        'SELECT DATE_SUB(DATE(b.`completed_at`), INTERVAL WEEKDAY(b.`completed_at`) DAY) AS `week_start`,
                b.`supplier_id`, s.`name` AS `supplier_name`, COUNT(*) AS `completed_batches`,
                SUM(b.`total_capital`) AS `deployed_capital`,
                SUM(b.`total_revenue`) AS `gross_sales_value`,
                SUM(b.`unit_quantity` * b.`fuel_subsidy_per_unit`) AS `fuel_allowance`,
                SUM(b.`net_investor_credit`) AS `net_investor_credit`
         FROM `offtake_batches` b JOIN `offtake_suppliers` s ON s.`id` = b.`supplier_id`
         WHERE b.`status` = \'completed\'
         GROUP BY `week_start`, b.`supplier_id`, s.`name`
         ORDER BY `week_start` DESC LIMIT 100'
    )->fetchAll();
    $audit = $connection->query(
        'SELECT a.`id`, a.`batch_id`, a.`old_status`, a.`new_status`, a.`actor_email`, a.`occurred_at`
         FROM `offtake_status_audit` a ORDER BY a.`occurred_at` DESC, a.`id` DESC LIMIT 10'
    )->fetchAll();

    return [
        'user' => $user,
        'suppliers' => $suppliers,
        'managers' => $managers,
        'batches' => $batches,
        'metrics' => $metrics ?: ['active_capital' => 0, 'accumulated_net_yield' => 0, 'active_batches' => 0],
        'settlements' => $settlements,
        'audit' => $audit,
    ];
}

function manager_dashboard(PDO $connection, array $user): array
{
    if (!is_string($user['supplier_id']) || !valid_uuid($user['supplier_id'])) {
        return [
            'user' => $user,
            'supplier' => null,
            'batches' => [],
            'summary' => [
                'week_start' => gmdate('Y-m-d', strtotime('monday this week', time())),
                'completed_batches' => 0,
                'gross_sales_value' => 0,
                'net_credit_due' => 0,
            ],
        ];
    }
    $supplierQuery = $connection->prepare(
        'SELECT `id`, `name`, `contact_person`, `phone`, `created_at`
         FROM `offtake_suppliers` WHERE `id` = :id LIMIT 1'
    );
    $supplierQuery->execute(['id' => $user['supplier_id']]);
    $supplier = $supplierQuery->fetch();
    if (!is_array($supplier)) throw new RuntimeException('The assigned supplier company is unavailable.');

    $batchesQuery = $connection->prepare(
        'SELECT `id`, `supplier_id`, `unit_quantity`, `unit_cost_price`, `unit_selling_price`,
                `fuel_subsidy_per_unit`, `total_capital`, `total_revenue`, `net_investor_credit`,
                `destination_route`, `vehicle_reference`, `driver_name`, `driver_phone`,
                `status`, `dispatched_at`, `completed_at`, `created_at`
         FROM `offtake_batches` WHERE `supplier_id` = :supplier_id
         ORDER BY `created_at` DESC LIMIT 100'
    );
    $batchesQuery->execute(['supplier_id' => $user['supplier_id']]);

    $summaryQuery = $connection->prepare(
        'SELECT DATE_SUB(UTC_DATE(), INTERVAL WEEKDAY(UTC_DATE()) DAY) AS `week_start`,
                COUNT(*) AS `completed_batches`,
                COALESCE(SUM(`total_revenue`), 0) AS `gross_sales_value`,
                COALESCE(SUM(`net_investor_credit`), 0) AS `net_credit_due`
         FROM `offtake_batches`
         WHERE `supplier_id` = :supplier_id AND `status` = \'completed\'
           AND `completed_at` >= DATE_SUB(UTC_DATE(), INTERVAL WEEKDAY(UTC_DATE()) DAY)'
    );
    $summaryQuery->execute(['supplier_id' => $user['supplier_id']]);
    return [
        'user' => $user,
        'supplier' => $supplier,
        'batches' => $batchesQuery->fetchAll(),
        'summary' => $summaryQuery->fetch(),
    ];
}

function create_supplier(PDO $connection, array $user, array $payload): never
{
    require_user_role($connection, ['admin']);
    $name = required_string($payload, 'name', 160);
    if ((function_exists('mb_strlen') ? mb_strlen($name) : strlen($name)) < 2) send_json_response(['error' => 'Company name must have at least 2 characters.'], 422);
    $statement = $connection->prepare(
        'INSERT INTO `offtake_suppliers` (`id`, `name`, `contact_person`, `phone`)
         VALUES (:id, :name, :contact_person, :phone)'
    );
    $statement->execute([
        'id' => uuid_v4(),
        'name' => $name,
        'contact_person' => required_string($payload, 'contact_person', 160, false),
        'phone' => required_string($payload, 'phone', 40, false),
    ]);
    send_json_response(['created' => true], 201);
}

function assign_manager(PDO $connection, array $user, array $payload): never
{
    require_user_role($connection, ['admin']);
    $managerId = required_string($payload, 'user_id', 36);
    if (!valid_uuid($managerId)) send_json_response(['error' => 'Choose a valid manager account.'], 422);
    $supplierId = $payload['supplier_id'] ?? '';
    if (!is_string($supplierId)) send_json_response(['error' => 'Company selection is invalid.'], 422);
    $supplierId = trim($supplierId);
    if ($supplierId !== '' && !valid_uuid($supplierId)) send_json_response(['error' => 'Choose a valid supplier company.'], 422);
    if ($supplierId !== '') {
        $supplierCheck = $connection->prepare('SELECT 1 FROM `offtake_suppliers` WHERE `id` = :id');
        $supplierCheck->execute(['id' => $supplierId]);
        if (!$supplierCheck->fetchColumn()) send_json_response(['error' => 'The selected supplier company no longer exists.'], 404);
    }
    $statement = $connection->prepare(
        'UPDATE `offtake_users` SET `supplier_id` = :supplier_id, `updated_at` = UTC_TIMESTAMP(6)
         WHERE `id` = :id AND `role` = \'manager\''
    );
    $statement->execute(['supplier_id' => $supplierId === '' ? null : $supplierId, 'id' => $managerId]);
    if ($statement->rowCount() === 0) {
        $exists = $connection->prepare('SELECT 1 FROM `offtake_users` WHERE `id` = :id AND `role` = \'manager\'');
        $exists->execute(['id' => $managerId]);
        if (!$exists->fetchColumn()) send_json_response(['error' => 'Manager account not found.'], 404);
    }
    send_json_response(['updated' => true]);
}

function decimal_value(array $payload, string $key): string
{
    $value = $payload[$key] ?? null;
    if (!is_string($value) && !is_int($value) && !is_float($value)) {
        send_json_response(['error' => 'A financial value is missing or invalid.'], 422);
    }
    $value = trim((string)$value);
    if (!preg_match('/^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,2})?$/', $value)) {
        send_json_response(['error' => 'Financial values must be non-negative with at most two decimal places.'], 422);
    }
    return $value;
}

function create_batch(PDO $connection, array $user, array $payload): never
{
    require_user_role($connection, ['admin']);
    $supplierId = required_string($payload, 'supplier_id', 36);
    if (!valid_uuid($supplierId)) send_json_response(['error' => 'Choose a valid supplier company.'], 422);
    $quantity = filter_var($payload['unit_quantity'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 4294967295]]);
    if ($quantity === false) send_json_response(['error' => 'Unit quantity must be a positive whole number.'], 422);
    $supplierCheck = $connection->prepare('SELECT 1 FROM `offtake_suppliers` WHERE `id` = :id');
    $supplierCheck->execute(['id' => $supplierId]);
    if (!$supplierCheck->fetchColumn()) send_json_response(['error' => 'The selected supplier company no longer exists.'], 404);
    $costPrice = decimal_value($payload, 'unit_cost_price');
    $sellingPrice = decimal_value($payload, 'unit_selling_price');
    $fuelSubsidy = decimal_value($payload, 'fuel_subsidy_per_unit');
    $destinationRoute = required_string($payload, 'destination_route', 255, false);
    $vehicleReference = required_string($payload, 'vehicle_reference', 80, false);
    $driverName = required_string($payload, 'driver_name', 160, false);
    $driverPhone = required_string($payload, 'driver_phone', 40, false);
    $batchId = uuid_v4();
    $connection->beginTransaction();
    try {
        $statement = $connection->prepare(
            'INSERT INTO `offtake_batches`
              (`id`, `supplier_id`, `unit_quantity`, `unit_cost_price`, `unit_selling_price`,
               `fuel_subsidy_per_unit`, `destination_route`, `vehicle_reference`, `driver_name`, `driver_phone`)
             VALUES
              (:id, :supplier_id, :unit_quantity, :unit_cost_price, :unit_selling_price,
               :fuel_subsidy_per_unit, :destination_route, :vehicle_reference, :driver_name, :driver_phone)'
        );
        $statement->execute([
            'id' => $batchId,
            'supplier_id' => $supplierId,
            'unit_quantity' => $quantity,
            'unit_cost_price' => $costPrice,
            'unit_selling_price' => $sellingPrice,
            'fuel_subsidy_per_unit' => $fuelSubsidy,
            'destination_route' => $destinationRoute,
            'vehicle_reference' => $vehicleReference,
            'driver_name' => $driverName,
            'driver_phone' => $driverPhone,
        ]);
        $audit = $connection->prepare(
            'INSERT INTO `offtake_status_audit`
             (`batch_id`, `old_status`, `new_status`, `actor_user_id`, `actor_email`)
             VALUES (:batch_id, NULL, \'pending\', :actor_user_id, :actor_email)'
        );
        $audit->execute(['batch_id' => $batchId, 'actor_user_id' => $user['id'], 'actor_email' => $user['email']]);
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
    send_json_response(['created' => true], 201);
}

function update_batch_status(PDO $connection, array $user, array $payload): never
{
    $batchId = required_string($payload, 'batch_id', 36);
    $nextStatus = required_string($payload, 'status', 20);
    if (!valid_uuid($batchId) || !in_array($nextStatus, ['pending', 'in_transit', 'completed', 'disputed'], true)) {
        send_json_response(['error' => 'Batch or status selection is invalid.'], 422);
    }

    $connection->beginTransaction();
    try {
        $query = $connection->prepare(
            'SELECT `id`, `supplier_id`, `unit_quantity`, `destination_route`, `status`, `completed_at`
             FROM `offtake_batches` WHERE `id` = :id FOR UPDATE'
        );
        $query->execute(['id' => $batchId]);
        $batch = $query->fetch();
        if (!is_array($batch)) {
            $connection->rollBack();
            send_json_response(['error' => 'Allocation not found.'], 404);
        }
        $isAdmin = $user['role'] === 'admin';
        if (!$isAdmin && ($user['role'] !== 'manager' || $user['supplier_id'] !== $batch['supplier_id'])) {
            $connection->rollBack();
            send_json_response(['error' => 'This allocation does not belong to your company.'], 403);
        }
        $currentStatus = (string)$batch['status'];
        if ($currentStatus === 'completed') {
            $connection->rollBack();
            send_json_response(['error' => 'Completed allocations are locked and cannot be changed.'], 409);
        }
        $allowed = $isAdmin
            ? (($currentStatus === 'pending' && in_array($nextStatus, ['in_transit', 'disputed'], true))
                || ($currentStatus === 'in_transit' && in_array($nextStatus, ['completed', 'disputed'], true))
                || ($currentStatus === 'disputed' && in_array($nextStatus, ['pending', 'in_transit'], true)))
            : (($currentStatus === 'pending' && $nextStatus === 'in_transit')
                || ($currentStatus === 'in_transit' && $nextStatus === 'completed'));
        if (!$allowed) {
            $connection->rollBack();
            send_json_response(['error' => 'This status transition is not allowed. Refresh the dashboard and try again.'], 409);
        }

        $update = $connection->prepare(
            'UPDATE `offtake_batches`
             SET `status` = :status,
                 `dispatched_at` = CASE WHEN :dispatch_status = \'in_transit\' THEN UTC_TIMESTAMP(6)
                                        WHEN :reset_dispatch_status = \'pending\' THEN NULL ELSE `dispatched_at` END,
                 `completed_at` = CASE WHEN :complete_status = \'completed\' THEN UTC_TIMESTAMP(6) ELSE `completed_at` END,
                 `updated_at` = UTC_TIMESTAMP(6)
             WHERE `id` = :id'
        );
        $update->execute([
            'status' => $nextStatus,
            'dispatch_status' => $nextStatus,
            'reset_dispatch_status' => $nextStatus,
            'complete_status' => $nextStatus,
            'id' => $batchId,
        ]);
        $audit = $connection->prepare(
            'INSERT INTO `offtake_status_audit`
             (`batch_id`, `old_status`, `new_status`, `actor_user_id`, `actor_email`)
             VALUES (:batch_id, :old_status, :new_status, :actor_user_id, :actor_email)'
        );
        $audit->execute([
            'batch_id' => $batchId,
            'old_status' => $currentStatus,
            'new_status' => $nextStatus,
            'actor_user_id' => $user['id'],
            'actor_email' => $user['email'],
        ]);
        $notificationId = null;
        if (!$isAdmin) {
            $supplierQuery = $connection->prepare('SELECT `name` FROM `offtake_suppliers` WHERE `id` = :id LIMIT 1');
            $supplierQuery->execute(['id' => $batch['supplier_id']]);
            $supplierName = $supplierQuery->fetchColumn();
            $notificationId = queue_telegram_notification(
                $connection,
                "Manager action: allocation status changed\n"
                . "Manager: " . telegram_text($user['full_name'] ?: $user['email']) . " (" . telegram_text($user['email']) . ")\n"
                . "Company: " . telegram_text(is_string($supplierName) ? $supplierName : 'Unknown') . "\n"
                . "Allocation: " . telegram_text($batchId) . "\n"
                . "Units: " . (int)$batch['unit_quantity'] . "\n"
                . "Status: " . $currentStatus . " → " . $nextStatus . "\n"
                . "Route: " . telegram_text($batch['destination_route'] ?: 'Not set') . "\n"
                . "Time (UTC): " . gmdate('Y-m-d H:i:s'),
            );
        }
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
    $notificationSent = $notificationId !== null
        ? deliver_telegram_notification($connection, $notificationId)
        : null;
    send_json_response([
        'updated' => true,
        'notification' => $notificationId === null ? null : ($notificationSent ? 'sent' : 'failed'),
    ]);
}
