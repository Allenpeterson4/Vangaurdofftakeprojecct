<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = (string) ($_GET['action'] ?? '');
$contentType = strtolower(trim(explode(';', (string) ($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
$isFormSubmission = $method === 'POST' && $contentType === 'application/x-www-form-urlencoded';
$formReturnPath = match ($action) {
    'register' => '/register/',
    'admin_login' => '/admin/',
    'admin_setup' => '/admin/setup/',
    default => '/login/',
};

try {
    if ($method === 'GET' && $action === 'csrf') {
        json_response(['csrfToken' => csrf_token()]);
    }
    if ($method === 'GET' && $action === 'me') {
        $user = current_portal_user();
        if ($user === null) {
            json_response(['error' => 'Sign in to continue.'], 401);
        }
        json_response(['user' => $user]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        json_response(['error' => 'Method not allowed.'], 405);
    }

    require_same_origin();
    if ($action === 'admin_setup') {
        auth_action_error(
            'Administrator accounts must be created in Supabase Auth and explicitly granted the administrator role in the Supabase SQL Editor.',
            410,
            $isFormSubmission,
            '/admin/setup/',
        );
    }
    if (!in_array($action, ['login', 'admin_login', 'register', 'logout', 'change_password'], true)) {
        json_response(['error' => 'Unknown authentication action.'], 400);
    }
    if ($action === 'change_password' && $isFormSubmission) {
        json_response(['error' => 'Password changes require a secure JSON request.'], 415);
    }

    if ($isFormSubmission) {
        if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) {
            auth_form_error('The submitted form is too large.', 413, $formReturnPath);
        }
        $payload = $_POST;
    } else {
        require_csrf_token();
        $raw = file_get_contents('php://input');
        if (!is_string($raw) || strlen($raw) > 32768) {
            json_response(['error' => 'The submitted request is too large.'], 413);
        }
        $payload = json_decode($raw, true);
        if (!is_array($payload)) {
            json_response(['error' => 'A valid JSON request body is required.'], 400);
        }
    }

    if ($action === 'register') {
        register_manager($payload, $isFormSubmission);
    }
    if ($action === 'change_password') {
        change_account_password($payload);
    }
    if ($action === 'login' || $action === 'admin_login') {
        login_account($payload, $isFormSubmission, $action === 'admin_login' ? 'admin' : 'manager');
    }
    if ($action === 'logout') {
        $accessToken = supabase_access_token();
        if ($accessToken !== null) {
            try {
                supabase_auth_request('logout', 'POST', null, $accessToken);
            } catch (SupabaseApiException $error) {
                if ($error->status !== 401) {
                    throw $error;
                }
            }
        }
        destroy_app_session();
        json_response(['signedOut' => true]);
    }
} catch (Throwable $error) {
    if ($isFormSubmission) {
        error_log(sprintf(
            'Offtake authentication API failure (action=%s, type=%s): %s',
            $action,
            get_debug_type($error),
            $error->getMessage(),
        ));
        $status = $error instanceof SupabaseApiException && $error->apiCode === 'PGRST205' ? 503 : 500;
        auth_form_error(auth_safe_error($error), $status, $formReturnPath);
    }
    handle_api_error($error);
}

function register_manager(array $payload, bool $formSubmission): never
{
    $fullName = required_string($payload, 'full_name', 160);
    $companyName = required_string($payload, 'company_name', 160);
    $email = strtolower(required_string($payload, 'email', 320));
    $password = $payload['password'] ?? null;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        auth_action_error('Enter a valid email address.', 422, $formSubmission, '/register/');
    }
    if ((function_exists('mb_strlen') ? mb_strlen($fullName) : strlen($fullName)) < 2) {
        auth_action_error('Full name must have at least 2 characters.', 422, $formSubmission, '/register/');
    }
    if ((function_exists('mb_strlen') ? mb_strlen($companyName) : strlen($companyName)) < 2) {
        auth_action_error('Company name must have at least 2 characters.', 422, $formSubmission, '/register/');
    }
    if (!is_string($password) || strlen($password) < 10 || strlen($password) > 200) {
        auth_action_error('Password must be between 10 and 200 characters.', 422, $formSubmission, '/register/');
    }

    try {
        supabase_rest_request('offtake_v2_managers?select=id&limit=0');
        $authResponse = supabase_auth_request('signup', 'POST', [
            'email' => $email,
            'password' => $password,
            'data' => [
                'full_name' => $fullName,
                'company_name' => $companyName,
            ],
        ]);
    } catch (SupabaseApiException $error) {
        if ($error->status === 429) {
            auth_action_error('Too many registration attempts. Please wait and try again.', 429, $formSubmission, '/register/');
        }
        if (in_array($error->status, [400, 422], true)) {
            auth_action_error('This email may already be registered, or the password does not meet the Supabase Auth policy.', 409, $formSubmission, '/register/');
        }
        throw $error;
    }

    if (empty($authResponse['access_token'])) {
        if ($formSubmission) {
            auth_form_success(
                'Your manager account was created. Check your email to confirm the address, then sign in.',
                '/login/',
            );
        }
        json_response(['registered' => true, 'confirmation_required' => true], 201);
    }

    supabase_store_session($authResponse, true);
    $user = current_portal_user();
    $supplierId = is_array($user) ? ($user['supplier_id'] ?? null) : null;
    if ($user === null || ($user['role'] ?? '') !== 'manager'
        || !is_string($supplierId)
        || preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $supplierId) !== 1) {
        destroy_app_session();
        throw new RuntimeException('Automatic manager company setup is not active. Apply the supplier auto-provision migration in the Supabase SQL Editor.');
    }
    complete_authentication($user, $formSubmission, 201);
}

function change_account_password(array $payload): never
{
    $currentPassword = $payload['current_password'] ?? null;
    $newPassword = $payload['password'] ?? null;
    if (!is_string($currentPassword) || $currentPassword === '' || strlen($currentPassword) > 200) {
        json_response(['error' => 'Enter your current password.'], 422);
    }
    if (!is_string($newPassword) || strlen($newPassword) < 10 || strlen($newPassword) > 200) {
        json_response(['error' => 'New password must be between 10 and 200 characters.'], 422);
    }

    $user = current_portal_user();
    if ($user === null) {
        json_response(['error' => 'Your session has expired. Sign in again before changing your password.'], 401);
    }

    try {
        $reauthenticatedSession = supabase_auth_request('token?grant_type=password', 'POST', [
            'email' => $user['email'],
            'password' => $currentPassword,
        ]);
    } catch (SupabaseApiException $error) {
        if ($error->status === 429) {
            json_response(['error' => 'Too many verification attempts. Wait a few minutes and try again.'], 429);
        }
        if (in_array($error->status, [400, 401], true)) {
            json_response(['error' => 'Current password is incorrect.'], 401);
        }
        throw $error;
    }

    $accessToken = $reauthenticatedSession['access_token'] ?? null;
    if (!is_string($accessToken) || $accessToken === '') {
        throw new RuntimeException('Supabase did not return a usable verification session.');
    }
    try {
        supabase_auth_request('user', 'PUT', ['password' => $newPassword], $accessToken);
    } catch (SupabaseApiException $error) {
        if ($error->status === 401) {
            json_response(['error' => 'Your session has expired. Sign in again before changing your password.'], 401);
        }
        if (in_array($error->status, [400, 422], true)) {
            json_response(['error' => 'The new password does not meet the configured Supabase password requirements.'], 422);
        }
        throw $error;
    }

    supabase_store_session($reauthenticatedSession);
    json_response(['updated' => true]);
}

function login_account(array $payload, bool $formSubmission, string $role): never
{
    $loginPath = $role === 'admin' ? '/admin/' : '/login/';
    $email = strtolower(required_string($payload, 'email', 320));
    $password = $payload['password'] ?? null;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($password) || $password === '' || strlen($password) > 200) {
        auth_action_error('Email or password is incorrect.', 401, $formSubmission, $loginPath);
    }
    try {
        $authResponse = supabase_auth_request('token?grant_type=password', 'POST', [
            'email' => $email,
            'password' => $password,
        ]);
    } catch (SupabaseApiException $error) {
        if ($error->status === 429) {
            auth_action_error('Too many sign-in attempts. Wait a few minutes and try again.', 429, $formSubmission, $loginPath);
        }
        if ($error->apiCode === 'email_not_confirmed') {
            auth_action_error('Confirm your email address before signing in.', 403, $formSubmission, $loginPath);
        }
        if (in_array($error->status, [400, 401], true)) {
            auth_action_error('Email or password is incorrect.', 401, $formSubmission, $loginPath);
        }
        throw $error;
    }
    supabase_store_session($authResponse, true);
    $user = current_portal_user();
    if ($user === null || ($user['role'] ?? '') !== $role) {
        destroy_app_session();
        $message = $role === 'admin'
            ? 'This account does not have administrator access. Use the manager sign-in page if this is a manager account.'
            : 'This account does not have manager access. Use /admin for administrator sign-in.';
        auth_action_error($message, 403, $formSubmission, $loginPath);
    }
    complete_authentication($user, $formSubmission);
}

function complete_authentication(array $user, bool $formSubmission, int $status = 200): never
{
    if ($formSubmission) {
        header('Location: ' . ($user['role'] === 'admin' ? '/admin/' : '/manager/'), true, 303);
        exit;
    }
    json_response(['user' => $user], $status);
}

function auth_action_error(string $message, int $status, bool $formSubmission, string $returnPath): never
{
    if ($formSubmission) {
        auth_form_error($message, $status, $returnPath);
    }
    json_response(['error' => $message], $status);
}

function auth_safe_error(Throwable $error): string
{
    if (str_starts_with($error->getMessage(), 'Automatic manager company setup')) {
        return $error->getMessage();
    }
    if ($error instanceof SupabaseApiException) {
        if ($error->status === 404 && $error->apiCode === 'PGRST205') {
            return 'The Supabase schema is not installed yet. Run the provided PostgreSQL schema in the Supabase SQL Editor.';
        }
        if ($error->status >= 500) {
            return 'Supabase could not complete the sign-in request (HTTP ' . $error->status . '). Try again later.';
        }
        if ($error->status === 403) {
            return 'Supabase rejected the sign-in request. Check the project API key and email/password sign-in settings.';
        }
        if ($error->status === 404) {
            return 'The Supabase Auth endpoint was not found. Check the Supabase project URL in the cPanel deployment.';
        }
        return 'Supabase could not complete the sign-in request (HTTP ' . $error->status . ').';
    }
    return match ($error->getMessage()) {
        'Supabase URL and publishable/anon key are required.',
        'Supabase URL must be a valid HTTPS URL.' =>
            'Supabase is not configured correctly on the server. Re-upload the current cPanel package and its API configuration.',
        'The PHP cURL extension is required for Supabase requests.' =>
            'PHP cURL is disabled on this hosting account. Enable the cURL extension in cPanel PHP settings.',
        'Could not reach Supabase. Please try again.' =>
            'This server could not establish an HTTPS connection to Supabase. Check cPanel outbound HTTPS, DNS, and TLS settings.',
        'PHP sessions are disabled on this server.',
        'Could not start the portal session. Check the PHP session configuration.',
        'Could not securely renew the portal session.',
        'Could not save the authenticated portal session.' =>
            'This server could not save the login session. Enable PHP sessions and check that PHP session storage is writable.',
        'Supabase did not return a usable login session.' =>
            'Supabase did not return a login session. Check the project Auth configuration and try again.',
        default => 'A server-side sign-in error occurred (' . get_debug_type($error) . '). Check the cPanel PHP error log.',
    };
}

function auth_form_error(string $message, int $status, string $returnPath): never
{
    auth_form_page($message, $status, $returnPath, false);
}

function auth_form_success(string $message, string $returnPath): never
{
    auth_form_page($message, 200, $returnPath, true);
}

function auth_form_page(string $message, int $status, string $returnPath, bool $success): never
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, private, max-age=0');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $allowedPaths = ['/register/', '/admin/', '/admin/setup/'];
    $safePath = in_array($returnPath, $allowedPaths, true) ? $returnPath : '/login/';
    $title = $success
        ? 'Registration complete'
        : match ($safePath) {
            '/register/' => 'Registration could not be completed',
            '/admin/' => 'Administrator sign-in could not be completed',
            '/admin/setup/' => 'Administrator setup is managed in Supabase',
            default => 'Sign-in could not be completed',
        };
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . $title . '</title><style>'
        . 'body{margin:0;background:#f3f6f4;color:#14251e;font:16px/1.6 system-ui,sans-serif}'
        . 'main{box-sizing:border-box;max-width:520px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #dfe8e3;border-radius:16px}'
        . 'h1{font-size:24px;line-height:1.25}a{display:inline-block;margin-top:12px;color:#116149;font-weight:700}'
        . '</style><main><h1>' . $title . '</h1><p>' . $safeMessage . '</p><a href="' . $safePath . '">Continue</a></main></html>';
    exit;
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
