<?php
declare(strict_types=1);

const OFFTAKE_SESSION_LIFETIME = 28800;
date_default_timezone_set('UTC');

function send_json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    echo json_encode($payload, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function mysql_connection(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) return $connection;

    $config = portal_config();
    foreach (['db_host', 'db_port', 'db_name', 'db_user', 'db_password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key]) || trim($config[$key]) === ''
            || str_starts_with($config[$key], 'replace_with_') || str_starts_with($config[$key], 'cpanel_')) {
            throw new RuntimeException('Edit api/config.php with the cPanel database settings before using the API.');
        }
    }
    if (!extension_loaded('pdo_mysql') || !in_array('mysql', PDO::getAvailableDrivers(), true)) {
        throw new RuntimeException('The PHP pdo_mysql extension is not enabled for this cPanel account.');
    }
    if (!ctype_digit($config['db_port']) || (int)$config['db_port'] < 1 || (int)$config['db_port'] > 65535) {
        throw new RuntimeException('The configured database port is invalid.');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['db_host'],
        (int)$config['db_port'],
        $config['db_name'],
    );
    $connection = new PDO($dsn, $config['db_user'], $config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 8,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET time_zone = '+00:00'",
    ]);
    return $connection;
}

function portal_config(): array
{
    $configFile = __DIR__ . '/config.php';
    $isExampleConfig = false;
    if (!is_file($configFile)) {
        $configFile = __DIR__ . '/config.example.php';
        $isExampleConfig = true;
    }
    if (!is_file($configFile)) {
        throw new RuntimeException('Database setup is incomplete: upload api/config.example.php, rename it to api/config.php, and enter the cPanel database settings.');
    }
    $config = require $configFile;
    if (!is_array($config)) throw new RuntimeException('The api/config.php file must return a configuration array.');
    foreach (['db_host', 'db_port', 'db_name', 'db_user', 'db_password'] as $key) {
        if (!isset($config[$key]) || !is_string($config[$key]) || trim($config[$key]) === ''
            || str_starts_with($config[$key], 'replace_with_') || str_starts_with($config[$key], 'cpanel_')) {
            $configPath = $isExampleConfig ? 'api/config.example.php' : 'api/config.php';
            throw new RuntimeException("Database setup is incomplete: enter your cPanel database host, port, name, username, and password in {$configPath}.");
        }
    }
    return $config;
}

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $config = portal_config();
    $lifetime = is_int($config['session_lifetime'] ?? null)
        ? max(1800, min($config['session_lifetime'], 86400))
        : OFFTAKE_SESSION_LIFETIME;
    $isHttps = isset($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off';
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)$lifetime);
    session_name('OFFTAKESESSID');
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path' => '/',
        'secure' => $isHttps,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    if (!session_start()) throw new RuntimeException('Unable to start a secure portal session.');
}

function request_json(): array
{
    $contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($contentLength > 32768) send_json_response(['error' => 'Request payload is too large.'], 413);
    $raw = file_get_contents('php://input');
    if (is_string($raw) && strlen($raw) > 32768) send_json_response(['error' => 'Request payload is too large.'], 413);
    try {
        $payload = json_decode(is_string($raw) ? $raw : '', true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        send_json_response(['error' => 'Request payload must be valid JSON.'], 400);
    }
    if (!is_array($payload)) send_json_response(['error' => 'Request payload must be a JSON object.'], 400);
    return $payload;
}

function require_same_origin_request(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $originHost = is_string($origin) ? parse_url($origin, PHP_URL_HOST) : null;
    $originScheme = is_string($origin) ? parse_url($origin, PHP_URL_SCHEME) : null;
    $originPort = is_string($origin) ? parse_url($origin, PHP_URL_PORT) : null;
    $requestHost = $_SERVER['HTTP_HOST'] ?? '';
    $requestHostname = is_string($requestHost) ? parse_url('http://' . $requestHost, PHP_URL_HOST) : null;
    $requestPort = is_string($requestHost) ? parse_url('http://' . $requestHost, PHP_URL_PORT) : null;
    $requestScheme = isset($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off' ? 'https' : 'http';
    $defaultPort = $requestScheme === 'https' ? 443 : 80;
    if (!is_string($originHost) || !is_string($originScheme) || !in_array(strtolower($originScheme), ['http', 'https'], true)
        || strtolower($originScheme) !== $requestScheme
        || !is_string($requestHostname) || $originHost === ''
        || !hash_equals(strtolower($requestHostname), strtolower($originHost))
        || (int)($requestPort ?? $defaultPort) !== (int)($originPort ?? $defaultPort)) {
        send_json_response(['error' => 'This request did not originate from the portal site.'], 403);
    }
}

function csrf_token(): string
{
    start_app_session();
    if (!isset($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function require_csrf_token(): void
{
    $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    $expected = $_SESSION['csrf_token'] ?? '';
    if (!is_string($provided) || !is_string($expected) || $provided === '' || !hash_equals($expected, $provided)) {
        send_json_response(['error' => 'Your secure session expired. Refresh the page and try again.'], 419);
    }
}

function current_portal_user(PDO $connection): ?array
{
    start_app_session();
    $userId = $_SESSION['offtake_user_id'] ?? null;
    if (!is_string($userId)) return null;
    $statement = $connection->prepare(
        'SELECT `id`, `email`, `full_name`, `role`, `supplier_id`
         FROM `offtake_users` WHERE `id` = :id LIMIT 1'
    );
    $statement->execute(['id' => $userId]);
    $user = $statement->fetch();
    return is_array($user) ? $user : null;
}

function require_authenticated_user(PDO $connection): array
{
    $user = current_portal_user($connection);
    if (!is_array($user)) send_json_response(['error' => 'Sign in to continue.'], 401);
    return $user;
}

function require_user_role(PDO $connection, array $roles): array
{
    $user = require_authenticated_user($connection);
    if (!in_array($user['role'], $roles, true)) {
        send_json_response(['error' => 'Your account does not have permission for this action.'], 403);
    }
    return $user;
}

function required_string(array $payload, string $key, int $maxLength, bool $required = true): string
{
    $value = $payload[$key] ?? '';
    if (!is_string($value)) send_json_response(['error' => 'A text field is invalid.'], 422);
    $value = trim($value);
    if (($required && $value === '') || (function_exists('mb_strlen') ? mb_strlen($value) : strlen($value)) > $maxLength) {
        send_json_response(['error' => 'A required text field is missing or too long.'], 422);
    }
    return $value;
}

function valid_uuid(string $value): bool
{
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $value) === 1;
}

function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20));
}

function handle_api_error(Throwable $error, string $endpoint): never
{
    error_log($endpoint . ' failure: ' . $error->getMessage());
    send_json_response(['error' => portal_safe_error_message($error)], 500);
}

function portal_safe_error_message(Throwable $error): string
{
    if ($error instanceof PDOException) {
        $driverCode = isset($error->errorInfo[1]) ? (int)$error->errorInfo[1] : null;
        if ($driverCode === 1146 || $driverCode === 1054) {
            return 'The offtake database is missing required tables or columns. Import the complete database/offtake-portal.sql file in phpMyAdmin.';
        }
        if (in_array($driverCode, [1044, 1045], true)) {
            return 'The database rejected the configured username or password, or the user lacks privileges. Check api/config.php and the database user privileges in cPanel.';
        }
        if ($driverCode === 1049) {
            return 'The configured database name does not exist. Check the exact cPanel database name in api/config.php.';
        }
        if (in_array($driverCode, [2002, 2003, 2005], true)) {
            return 'PHP could not connect to the configured database host. Check the database host and port in api/config.php.';
        }
    }
    if (str_contains($error->getMessage(), 'pdo_mysql')) {
        return 'The PHP pdo_mysql extension is disabled. Enable it in cPanel PHP Selector or ask your hosting provider.';
    }
    if ($error instanceof RuntimeException && str_starts_with($error->getMessage(), 'Database setup is incomplete:')) {
        return $error->getMessage();
    }
    return 'The portal backend is unavailable. Open /api/health.php for a safe setup check, then check the cPanel PHP error log if the database setup is correct.';
}
