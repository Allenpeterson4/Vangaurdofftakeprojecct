<?php
declare(strict_types=1);

$projectRoot = realpath($argv[1] ?? '');
$outputPath = $argv[2] ?? '';
$configOutputPath = $argv[3] ?? '';
if (!is_string($projectRoot) || $outputPath === '' || $configOutputPath === '') {
    fwrite(STDERR, "A project directory and both sanitized configuration output paths are required.\n");
    exit(1);
}

require_once $projectRoot . '/api/bootstrap.php';
$config = portal_config();
$url = trim((string) ($config['supabase_url'] ?? ''));
$key = trim((string) ($config['supabase_anon_key'] ?? ''));
$urlParts = parse_url($url);
if (!filter_var($url, FILTER_VALIDATE_URL)
    || !is_array($urlParts)
    || ($urlParts['scheme'] ?? '') !== 'https'
    || !is_string($urlParts['host'] ?? null)
    || isset($urlParts['user'])
    || isset($urlParts['pass'])
    || isset($urlParts['query'])
    || isset($urlParts['fragment'])
    || preg_match('/[\r\n]/', $url) === 1) {
    fwrite(STDERR, "A valid HTTPS Supabase project URL is required to build the deployment package.\n");
    exit(1);
}

$isPublishableKey = preg_match('/^sb_publishable_[A-Za-z0-9_-]{20,}$/', $key) === 1;
if (!$isPublishableKey && preg_match('/^[A-Za-z0-9._-]+$/', $key) === 1) {
    $segments = explode('.', $key);
    if (count($segments) === 3) {
        $payload = strtr($segments[1], '-_', '+/');
        $payload .= str_repeat('=', (4 - strlen($payload) % 4) % 4);
        $decoded = base64_decode($payload, true);
        $claims = is_string($decoded) ? json_decode($decoded, true) : null;
        $isPublishableKey = is_array($claims) && ($claims['role'] ?? null) === 'anon';
    }
}
if (!$isPublishableKey) {
    fwrite(STDERR, "A Supabase publishable or anon key is required; secret keys are never included in the deployment ZIP.\n");
    exit(1);
}

$content = "NEXT_PUBLIC_SUPABASE_URL={$url}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY={$key}\n";
if (file_put_contents($outputPath, $content, LOCK_EX) !== strlen($content)) {
    fwrite(STDERR, "Unable to write the sanitized Supabase environment file.\n");
    exit(1);
}
$phpContent = "<?php\ndeclare(strict_types=1);\n\nreturn [\n"
    . "    'supabase_url' => " . var_export($url, true) . ",\n"
    . "    'supabase_anon_key' => " . var_export($key, true) . ",\n"
    . "];\n";
if (file_put_contents($configOutputPath, $phpContent, LOCK_EX) !== strlen($phpContent)) {
    unlink($outputPath);
    fwrite(STDERR, "Unable to write the sanitized PHP Supabase configuration.\n");
    exit(1);
}
if (!chmod($outputPath, 0600) || !chmod($configOutputPath, 0600)) {
    unlink($outputPath);
    unlink($configOutputPath);
    fwrite(STDERR, "Unable to restrict permissions on the sanitized Supabase configuration files.\n");
    exit(1);
}
