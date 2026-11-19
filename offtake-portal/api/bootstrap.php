<?php
declare(strict_types=1);

final class SupabaseApiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status,
        public readonly ?string $apiCode = null
    ) {
        parent::__construct($message);
    }
}

function portal_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $config = [
        'supabase_url' => '',
        'supabase_anon_key' => '',
        'app_origin' => '',
        'admin_alert_email' => '',
        'alert_from_email' => '',
        'telegram_bot_token' => '',
        'telegram_chat_id' => '',
    ];
    $configPath = __DIR__ . '/config.php';
    if (is_file($configPath)) {
        $local = require $configPath;
        if (is_array($local)) {
            $config = array_merge($config, $local);
        }
    }

    $envPath = dirname(__DIR__) . '/.env.local';
    if (is_file($envPath) && is_readable($envPath)) {
        foreach (file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$name, $value] = explode('=', $line, 2);
            $name = trim($name);
            $value = trim(trim($value), "\"'");
            $envMap = [
                'NEXT_PUBLIC_SUPABASE_URL' => 'supabase_url',
                'SUPABASE_URL' => 'supabase_url',
                'NEXT_PUBLIC_SUPABASE_ANON_KEY' => 'supabase_anon_key',
                'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY' => 'supabase_anon_key',
                'SUPABASE_ANON_KEY' => 'supabase_anon_key',
                'APP_ORIGIN' => 'app_origin',
                'ADMIN_ALERT_EMAIL' => 'admin_alert_email',
                'ALERT_FROM_EMAIL' => 'alert_from_email',
                'TELEGRAM_BOT_TOKEN' => 'telegram_bot_token',
                'TELEGRAM_CHAT_ID' => 'telegram_chat_id',
            ];
            if (isset($envMap[$name])) {
                $config[$envMap[$name]] = $value;
            }
        }
    }

    $processEnvMap = [
        'supabase_url' => ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
        'supabase_anon_key' => ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
        'app_origin' => ['APP_ORIGIN'],
        'admin_alert_email' => ['ADMIN_ALERT_EMAIL'],
        'alert_from_email' => ['ALERT_FROM_EMAIL'],
        'telegram_bot_token' => ['TELEGRAM_BOT_TOKEN'],
        'telegram_chat_id' => ['TELEGRAM_CHAT_ID'],
    ];
    foreach ($processEnvMap as $key => $names) {
        foreach ($names as $name) {
            $value = getenv($name);
            if ($value !== false && $value !== '') {
                $config[$key] = $value;
                break;
            }
        }
    }

    return $config;
}

function supabase_config(): array
{
    $config = portal_config();
    $url = rtrim(trim((string) ($config['supabase_url'] ?? '')), '/');
    $key = trim((string) ($config['supabase_anon_key'] ?? ''));
    if ($url === '' || $key === '') {
        throw new RuntimeException('Supabase URL and publishable/anon key are required.');
    }
    if (!filter_var($url, FILTER_VALIDATE_URL) || !str_starts_with($url, 'https://')) {
        throw new RuntimeException('Supabase URL must be a valid HTTPS URL.');
    }
    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is required for Supabase requests.');
    }
    return ['url' => $url, 'key' => $key];
}

function supabase_request(
    string $path,
    string $method = 'GET',
    ?array $payload = null,
    ?string $accessToken = null,
    ?string $prefer = null
): array {
    $config = supabase_config();
    $url = $config['url'] . '/' . ltrim($path, '/');
    $headers = [
        'apikey: ' . $config['key'],
        'Authorization: Bearer ' . ($accessToken ?: $config['key']),
        'Accept: application/json',
    ];
    if ($payload !== null) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($prefer !== null) {
        $headers[] = 'Prefer: ' . $prefer;
    }

    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_CUSTOMREQUEST => strtoupper($method),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    if ($payload !== null) {
        $encoded = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            curl_close($handle);
            throw new RuntimeException('Could not encode the Supabase request.');
        }
        curl_setopt($handle, CURLOPT_POSTFIELDS, $encoded);
    }

    $body = curl_exec($handle);
    $curlError = curl_error($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    if ($body === false) {
        error_log('Supabase request transport error: ' . $curlError);
        throw new RuntimeException('Could not reach Supabase. Please try again.');
    }

    $decoded = $body === '' ? [] : json_decode($body, true);
    if ($status < 200 || $status >= 300) {
        $message = is_array($decoded)
            ? (string) ($decoded['message'] ?? $decoded['msg'] ?? $decoded['error_description'] ?? $decoded['error'] ?? 'Supabase request failed.')
            : 'Supabase request failed.';
        $apiCode = is_array($decoded) ? (string) ($decoded['code'] ?? '') : '';
        error_log(sprintf('Supabase API error (%d, %s): %s', $status, $apiCode, $message));
        throw new SupabaseApiException($message, $status, $apiCode !== '' ? $apiCode : null);
    }
    if ($body !== '' && !is_array($decoded)) {
        throw new RuntimeException('Supabase returned an invalid response.');
    }
    return is_array($decoded) ? $decoded : [];
}

function supabase_auth_request(string $path, string $method = 'POST', ?array $payload = null, ?string $accessToken = null): array
{
    return supabase_request('auth/v1/' . ltrim($path, '/'), $method, $payload, $accessToken);
}

function supabase_rest_request(string $path, string $method = 'GET', ?array $payload = null, ?string $accessToken = null, ?string $prefer = null): array
{
    return supabase_request('rest/v1/' . ltrim($path, '/'), $method, $payload, $accessToken, $prefer);
}

function portal_cookie_options(int $expires, bool $httpOnly = true, string $path = '/api/'): array
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https'
        || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443;
    return [
        'expires' => $expires,
        'path' => $path,
        'secure' => $secure,
        'httponly' => $httpOnly,
        'samesite' => 'Lax',
    ];
}

function portal_set_cookie(string $name, string $value, int $expires = 0, bool $httpOnly = true, string $path = '/api/'): void
{
    if (!setcookie($name, $value, portal_cookie_options($expires, $httpOnly, $path))) {
        throw new RuntimeException('Could not set a secure portal cookie.');
    }
    $_COOKIE[$name] = $value;
}

function portal_clear_cookie(string $name, string $path = '/api/'): void
{
    if (!setcookie($name, '', portal_cookie_options(time() - 3600, true, $path))) {
        throw new RuntimeException('Could not clear a portal cookie.');
    }
    unset($_COOKIE[$name]);
}

function portal_active_supplier_id(): ?string
{
    $supplierId = (string) ($_COOKIE['VVDPortalWorkspace'] ?? '');
    return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $supplierId) === 1
        ? $supplierId
        : null;
}

function destroy_app_session(): void
{
    foreach (['VVDPortalAccessToken', 'VVDPortalRefreshToken', 'VVDPortalAccessExpiresAt', 'VVDPortalCSRF', 'VVDPortalWorkspace'] as $name) {
        portal_clear_cookie($name);
    }
    portal_clear_cookie('VVDPortalSession', '/');
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function supabase_store_session(array $authResponse, bool $resetWorkspace = false): void
{
    $accessToken = (string) ($authResponse['access_token'] ?? '');
    $refreshToken = (string) ($authResponse['refresh_token'] ?? '');
    if ($accessToken === '' || $refreshToken === '') {
        throw new RuntimeException('Supabase did not return a usable login session.');
    }
    $expiresAt = time() + max(60, (int) ($authResponse['expires_in'] ?? 3600));
    portal_set_cookie('VVDPortalAccessToken', $accessToken, $expiresAt);
    portal_set_cookie('VVDPortalRefreshToken', $refreshToken);
    portal_set_cookie('VVDPortalAccessExpiresAt', (string) $expiresAt, $expiresAt);
    if ($resetWorkspace) {
        portal_set_cookie('VVDPortalCSRF', bin2hex(random_bytes(32)));
        portal_clear_cookie('VVDPortalWorkspace');
        portal_clear_cookie('VVDPortalSession', '/');
    }
}

function supabase_access_token(): ?string
{
    $accessToken = (string) ($_COOKIE['VVDPortalAccessToken'] ?? '');
    $refreshToken = (string) ($_COOKIE['VVDPortalRefreshToken'] ?? '');
    $expiresAt = (int) ($_COOKIE['VVDPortalAccessExpiresAt'] ?? 0);

    if ($accessToken !== '' && $expiresAt > time() + 60) {
        return $accessToken;
    }
    if ($refreshToken === '') {
        if ($accessToken !== '') {
            destroy_app_session();
        }
        return null;
    }
    try {
        $refreshed = supabase_auth_request('token?grant_type=refresh_token', 'POST', ['refresh_token' => $refreshToken]);
        supabase_store_session($refreshed);
        return (string) ($_COOKIE['VVDPortalAccessToken'] ?? '');
    } catch (SupabaseApiException $error) {
        if ($error->status === 400 || $error->status === 401) {
            destroy_app_session();
            return null;
        }
        throw $error;
    }
}

function supabase_profile(string $table, string $id, string $accessToken): ?array
{
    $select = $table === 'offtake_v2_managers'
        ? 'id,full_name,email,is_active,supplier_id'
        : 'id,full_name,email,is_active';
    $query = $table . '?select=' . $select . '&id=eq.' . rawurlencode($id) . '&limit=1';
    $rows = supabase_rest_request($query, 'GET', null, $accessToken);
    return isset($rows[0]) && is_array($rows[0]) ? $rows[0] : null;
}

function current_portal_user(): ?array
{
    $accessToken = supabase_access_token();
    if ($accessToken === null) {
        return null;
    }
    try {
        $authUser = supabase_auth_request('user', 'GET', null, $accessToken);
        $id = (string) ($authUser['id'] ?? '');
        if ($id === '') {
            destroy_app_session();
            return null;
        }
        $admin = supabase_profile('offtake_v2_admins', $id, $accessToken);
        if ($admin !== null && ($admin['is_active'] ?? false)) {
            return [
                'id' => $id,
                'email' => (string) ($authUser['email'] ?? $admin['email'] ?? ''),
                'full_name' => (string) ($admin['full_name'] ?? ''),
                'role' => 'admin',
                'supplier_id' => null,
                'is_active' => true,
            ];
        }
        $manager = supabase_profile('offtake_v2_managers', $id, $accessToken);
        if ($manager !== null && ($manager['is_active'] ?? false)) {
            return [
                'id' => $id,
                'email' => (string) ($authUser['email'] ?? $manager['email'] ?? ''),
                'full_name' => (string) ($manager['full_name'] ?? ''),
                'supplier_id' => $manager['supplier_id'] ?? null,
                'active_supplier_id' => portal_active_supplier_id(),
                'role' => 'manager',
                'is_active' => true,
            ];
        }
        destroy_app_session();
        return null;
    } catch (SupabaseApiException $error) {
        if ($error->status === 401 || $error->status === 403) {
            destroy_app_session();
            return null;
        }
        throw $error;
    }
}

function require_authenticated_user(): array
{
    $user = current_portal_user();
    if ($user === null) {
        json_response(['error' => 'Authentication required.'], 401);
    }
    return $user;
}

function require_user_role(array $roles): array
{
    $user = require_authenticated_user();
    if (!in_array($user['role'] ?? '', $roles, true)) {
        json_response(['error' => 'You are not authorized to perform this action.'], 403);
    }
    return $user;
}

function require_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    $config = portal_config();
    $trustedOrigin = trim((string) ($config['app_origin'] ?? ''));
    if ($trustedOrigin !== '') {
        $normalize = static function (string $value): string {
            $parts = parse_url($value);
            if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
                return '';
            }
            $scheme = strtolower((string) $parts['scheme']);
            $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);
            return $scheme . '://' . strtolower((string) $parts['host']) . ':' . $port;
        };
        if ($normalize($origin) === '' || $normalize($origin) !== $normalize($trustedOrigin)) {
            json_response(['error' => 'Cross-origin requests are not allowed.'], 403);
        }
        return;
    }
    $originParts = parse_url($origin);
    $hostHeader = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $expectedParts = parse_url('//' . $hostHeader);
    $expectedScheme = strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO']
        ?? ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http')));
    $originScheme = is_array($originParts) ? strtolower((string) ($originParts['scheme'] ?? '')) : '';
    $originHost = is_array($originParts) ? strtolower((string) ($originParts['host'] ?? '')) : '';
    $expectedHost = is_array($expectedParts) ? strtolower((string) ($expectedParts['host'] ?? '')) : '';
    $originPort = is_array($originParts) ? (int) ($originParts['port'] ?? ($originScheme === 'https' ? 443 : 80)) : 0;
    $expectedPort = is_array($expectedParts) ? (int) ($expectedParts['port'] ?? ($expectedScheme === 'https' ? 443 : 80)) : 0;
    if ($originScheme !== $expectedScheme || $expectedHost === '' || $originHost !== $expectedHost || $originPort !== $expectedPort) {
        json_response(['error' => 'Cross-origin requests are not allowed.'], 403);
    }
}

function require_csrf_token(): void
{
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? '');
    if (!portal_csrf_token_matches($provided)) {
        json_response(['error' => 'Your session expired. Refresh the page and try again.'], 419);
    }
}

function portal_csrf_token_matches(string $provided): bool
{
    $expected = (string) ($_COOKIE['VVDPortalCSRF'] ?? '');
    return $provided !== ''
        && preg_match('/^[a-f0-9]{64}$/', $expected) === 1
        && hash_equals($expected, $provided);
}

function csrf_token(): string
{
    $token = (string) ($_COOKIE['VVDPortalCSRF'] ?? '');
    if (preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
        $token = bin2hex(random_bytes(32));
        portal_set_cookie('VVDPortalCSRF', $token);
    }
    return $token;
}

function handle_api_error(Throwable $error): never
{
    if ($error instanceof SupabaseApiException) {
        $status = match (true) {
            in_array($error->apiCode, ['PGRST204', 'PGRST205'], true) => 503,
            $error->status === 401 => 401,
            $error->status === 403 || $error->apiCode === '42501' => 403,
            in_array($error->apiCode, ['P0001', 'P0002', '23503'], true) => 409,
            $error->apiCode === '22023' => 422,
            default => 502,
        };
        $message = in_array($error->apiCode, ['PGRST204', 'PGRST205'], true)
            ? 'The Supabase schema or inventory migration is missing. Run the PostgreSQL schema and latest migration in the Supabase SQL Editor.'
            : match ($status) {
                401 => 'Your session has expired. Please sign in again.',
                403 => 'This account is not permitted to perform that action.',
                409 => 'The requested change conflicts with the current database state.',
                422 => 'The submitted value is not valid.',
                default => 'The Supabase request could not be completed.',
            };
        json_response(['error' => $message], $status);
    }
    error_log('Portal API error: ' . $error->getMessage());
    json_response(['error' => $error->getMessage()], 500);
}
