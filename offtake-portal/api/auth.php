<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/telegram.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = $_GET['action'] ?? '';
$contentType = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
$isFormSubmission = $method === 'POST' && $contentType === 'application/x-www-form-urlencoded';
$formReturnPath = match ($action) {
    'register' => '/register/',
    'admin_login' => '/admin-login/',
    default => '/login/',
};

try {
    $connection = mysql_connection();
    start_app_session();

    if ($method === 'GET' && $action === 'csrf') {
        send_json_response(['csrfToken' => csrf_token()]);
    }
    if ($method === 'GET' && $action === 'me') {
        $user = current_portal_user($connection);
        if (!is_array($user)) send_json_response(['error' => 'Sign in to continue.'], 401);
        send_json_response(['user' => $user]);
    }
    if ($method !== 'POST') {
        header('Allow: GET, POST');
        send_json_response(['error' => 'Method not allowed.'], 405);
    }

    require_same_origin_request();
    if ($isFormSubmission && in_array($action, ['login', 'admin_login', 'register'], true)) {
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) {
            auth_form_error('The submitted form is too large.', 413, $formReturnPath);
        }
        $payload = $_POST;
    } else {
        require_csrf_token();
        $payload = request_json();
    }

    if ($action === 'register') {
        register_portal_user($connection, $payload, $isFormSubmission);
    }
    if ($action === 'login') {
        login_portal_user($connection, $payload, $isFormSubmission, false);
    }
    if ($action === 'admin_login') {
        login_portal_user($connection, $payload, $isFormSubmission, true);
    }
    if ($action === 'logout') {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'],
                'domain' => $params['domain'],
                'secure' => (bool)$params['secure'],
                'httponly' => (bool)$params['httponly'],
                'samesite' => 'Strict',
            ]);
        }
        session_destroy();
        send_json_response(['signedOut' => true]);
    }

    send_json_response(['error' => 'Unknown authentication action.'], 400);
} catch (Throwable $error) {
    if ($isFormSubmission) {
        error_log('Offtake authentication API failure: ' . $error->getMessage());
        auth_form_error(portal_safe_error_message($error), 500, $formReturnPath);
    }
    handle_api_error($error, 'Offtake authentication API');
}

function register_portal_user(PDO $connection, array $payload, bool $formSubmission): never
{
    $fullName = required_string($payload, 'full_name', 160);
    $email = strtolower(required_string($payload, 'email', 320));
    $password = $payload['password'] ?? null;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        auth_action_error('Enter a valid email address.', 422, $formSubmission, '/register/');
    }
    if ((function_exists('mb_strlen') ? mb_strlen($fullName) : strlen($fullName)) < 2) {
        auth_action_error('Full name must have at least 2 characters.', 422, $formSubmission, '/register/');
    }
    if (!is_string($password) || strlen($password) < 10 || strlen($password) > 200) {
        auth_action_error('Password must be between 10 and 200 characters.', 422, $formSubmission, '/register/');
    }

    try {
        $statement = $connection->prepare(
            'INSERT INTO `offtake_users` (`id`, `email`, `full_name`, `password_hash`, `role`)
             VALUES (:id, :email, :full_name, :password_hash, \'manager\')'
        );
        $statement->execute([
            'id' => uuid_v4(),
            'email' => $email,
            'full_name' => $fullName,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);
    } catch (PDOException $error) {
        if ((int)($error->errorInfo[1] ?? 0) === 1062) {
            auth_action_error('An account with this email already exists.', 409, $formSubmission, '/register/');
        }
        throw $error;
    }

    $userId = (string)$connection->lastInsertId();
    $lookup = $connection->prepare('SELECT `id`, `email`, `full_name`, `role`, `supplier_id` FROM `offtake_users` WHERE `email` = :email LIMIT 1');
    $lookup->execute(['email' => $email]);
    $user = $lookup->fetch();
    if (!is_array($user)) throw new RuntimeException('The new manager account could not be loaded.');
    $_SESSION['offtake_user_id'] = (string)$user['id'];
    session_regenerate_id(true);
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $notificationId = queue_telegram_notification(
        $connection,
        "New manager registered\nName: " . telegram_text($user['full_name'] ?: 'Not provided')
        . "\nEmail: " . telegram_text($user['email'])
        . "\nCompany assignment: pending\nTime (UTC): " . gmdate('Y-m-d H:i:s'),
    );
    deliver_telegram_notification($connection, $notificationId);
    if ($formSubmission) {
        header('Location: /manager/', true, 303);
        exit;
    }
    send_json_response(['user' => $user, 'csrfToken' => $_SESSION['csrf_token']], 201);
}

function login_portal_user(PDO $connection, array $payload, bool $formSubmission, bool $adminOnly): never
{
    $loginReturnPath = $adminOnly ? '/admin-login/' : '/login/';
    $email = strtolower(required_string($payload, 'email', 320));
    $password = $payload['password'] ?? null;
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !is_string($password) || $password === '' || strlen($password) > 200) {
        auth_action_error('Email or password is incorrect.', 401, $formSubmission, $loginReturnPath);
    }

    $fingerprint = hash('sha256', (string)($_SERVER['REMOTE_ADDR'] ?? '') . "\0" . $email);
    $now = time();
    $connection->beginTransaction();
    try {
        $createAttempt = $connection->prepare(
            'INSERT INTO `offtake_login_attempts` (`fingerprint`, `window_started`, `attempts`, `blocked_until`)
             VALUES (:fingerprint, :window_started, 0, 0)
             ON DUPLICATE KEY UPDATE `fingerprint` = VALUES(`fingerprint`)'
        );
        $createAttempt->execute(['fingerprint' => $fingerprint, 'window_started' => $now]);
        $attemptQuery = $connection->prepare(
            'SELECT `window_started`, `attempts`, `blocked_until`
             FROM `offtake_login_attempts` WHERE `fingerprint` = :fingerprint FOR UPDATE'
        );
        $attemptQuery->execute(['fingerprint' => $fingerprint]);
        $attempt = $attemptQuery->fetch();
        if (!is_array($attempt)) throw new RuntimeException('Unable to validate login rate limit.');
        if ((int)$attempt['blocked_until'] > $now) {
            $connection->commit();
            auth_action_error('Too many sign-in attempts. Try again in 15 minutes.', 429, $formSubmission, $loginReturnPath);
        }
        $windowStarted = (int)$attempt['window_started'];
        $attempts = $now - $windowStarted > 900 ? 0 : (int)$attempt['attempts'];

        $userQuery = $connection->prepare(
            'SELECT `id`, `email`, `full_name`, `password_hash`, `role`, `supplier_id`
             FROM `offtake_users` WHERE `email` = :email LIMIT 1'
        );
        $userQuery->execute(['email' => $email]);
        $user = $userQuery->fetch();
        if (!is_array($user) || !password_verify($password, (string)$user['password_hash'])) {
            $attempts++;
            $blockedUntil = $attempts >= 8 ? $now + 900 : 0;
            $saveAttempt = $connection->prepare(
                'UPDATE `offtake_login_attempts`
                 SET `window_started` = :window_started, `attempts` = :attempts, `blocked_until` = :blocked_until
                 WHERE `fingerprint` = :fingerprint'
            );
            $saveAttempt->execute([
                'window_started' => $now - ($now - $windowStarted > 900 ? 0 : $now - $windowStarted),
                'attempts' => $attempts,
                'blocked_until' => $blockedUntil,
                'fingerprint' => $fingerprint,
            ]);
            $connection->commit();
            auth_action_error(
                $blockedUntil > 0 ? 'Too many sign-in attempts. Try again in 15 minutes.' : 'Email or password is incorrect.',
                $blockedUntil > 0 ? 429 : 401,
                $formSubmission,
                $loginReturnPath,
            );
        }

        if ($adminOnly && $user['role'] !== 'admin') {
            $connection->commit();
            auth_action_error('This account does not have administrator access. Use the manager sign-in page.', 403, $formSubmission, '/admin-login/');
        }

        $deleteAttempt = $connection->prepare('DELETE FROM `offtake_login_attempts` WHERE `fingerprint` = :fingerprint');
        $deleteAttempt->execute(['fingerprint' => $fingerprint]);
        $connection->commit();
        unset($user['password_hash']);
        session_regenerate_id(true);
        $_SESSION['offtake_user_id'] = (string)$user['id'];
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        if ($user['role'] === 'manager') {
            $notificationId = queue_telegram_notification(
                $connection,
                "Manager signed in\nName: " . telegram_text($user['full_name'] ?: 'Not provided')
                . "\nEmail: " . telegram_text($user['email'])
                . "\nTime (UTC): " . gmdate('Y-m-d H:i:s'),
            );
            deliver_telegram_notification($connection, $notificationId);
        }
        if ($formSubmission) {
            header('Location: ' . ($user['role'] === 'admin' ? '/admin/' : '/manager/'), true, 303);
            exit;
        }
        send_json_response(['user' => $user, 'csrfToken' => $_SESSION['csrf_token']]);
    } catch (Throwable $error) {
        if ($connection->inTransaction()) $connection->rollBack();
        throw $error;
    }
}

function auth_action_error(string $message, int $status, bool $formSubmission, string $returnPath): never
{
    if ($formSubmission) auth_form_error($message, $status, $returnPath);
    send_json_response(['error' => $message], $status);
}

function auth_form_error(string $message, int $status, string $returnPath): never
{
    http_response_code($status);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, private, max-age=0');
    $safeMessage = htmlspecialchars($message, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safePath = in_array($returnPath, ['/register/', '/admin-login/'], true) ? $returnPath : '/login/';
    $title = match ($safePath) {
        '/register/' => 'Registration could not be completed',
        '/admin-login/' => 'Administrator sign-in could not be completed',
        default => 'Sign-in could not be completed',
    };
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . $title . '</title><style>'
        . 'body{margin:0;background:#f3f6f4;color:#14251e;font:16px/1.6 system-ui,sans-serif}'
        . 'main{box-sizing:border-box;max-width:520px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #dfe8e3;border-radius:16px}'
        . 'h1{font-size:24px;line-height:1.25}a{display:inline-block;margin-top:12px;color:#116149;font-weight:700}'
        . '</style><main><h1>' . $title . '</h1><p>' . $safeMessage . '</p><a href="' . $safePath . '">Return to the form</a></main></html>';
    exit;
}
