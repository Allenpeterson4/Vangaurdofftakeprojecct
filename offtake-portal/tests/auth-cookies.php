<?php
declare(strict_types=1);

require_once __DIR__ . '/../api/bootstrap.php';

function expect_auth_cookie(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$_SERVER['HTTPS'] = 'on';
$_COOKIE = [];

$initialCsrfToken = csrf_token();
expect_auth_cookie(strlen($initialCsrfToken) === 64, 'CSRF token must be 32 random bytes in hex.');
expect_auth_cookie($_COOKIE['VVDPortalCSRF'] === $initialCsrfToken, 'CSRF token must be sent in its cookie.');
expect_auth_cookie(portal_csrf_token_matches($initialCsrfToken), 'Matching CSRF cookie/header values must be accepted.');
expect_auth_cookie(!portal_csrf_token_matches(str_repeat('0', 64)), 'Mismatched CSRF values must be rejected.');

$workspaceId = 'c0a80123-4567-489a-8abc-0123456789ab';
portal_set_cookie('VVDPortalWorkspace', $workspaceId);
expect_auth_cookie(portal_active_supplier_id() === $workspaceId, 'Valid workspace cookies must be recognized.');

supabase_store_session([
    'access_token' => 'test-access-token',
    'refresh_token' => 'test-refresh-token',
    'expires_in' => 3600,
], true);

expect_auth_cookie(session_status() === PHP_SESSION_NONE, 'Auth storage must not require a PHP session.');
expect_auth_cookie(supabase_access_token() === 'test-access-token', 'Access tokens must survive through API cookies.');
expect_auth_cookie($_COOKIE['VVDPortalRefreshToken'] === 'test-refresh-token', 'Refresh tokens must be retained for renewal.');
expect_auth_cookie(portal_active_supplier_id() === null, 'A fresh login must clear the previous workspace selection.');
expect_auth_cookie(csrf_token() !== $initialCsrfToken, 'A fresh login must rotate the CSRF token.');

$options = portal_cookie_options(time() + 60);
expect_auth_cookie($options['path'] === '/api/' && $options['secure'] && $options['httponly'], 'Auth cookies must be secure, HttpOnly, and API-scoped.');
expect_auth_cookie($options['samesite'] === 'Lax', 'Auth cookies must use SameSite=Lax.');

destroy_app_session();
foreach (['VVDPortalAccessToken', 'VVDPortalRefreshToken', 'VVDPortalAccessExpiresAt', 'VVDPortalCSRF', 'VVDPortalWorkspace'] as $name) {
    expect_auth_cookie(!isset($_COOKIE[$name]), 'Logout must clear ' . $name . '.');
}
expect_auth_cookie(session_status() === PHP_SESSION_NONE, 'Auth storage and logout must not require a PHP session.');

echo "Auth cookie tests passed.\n";
