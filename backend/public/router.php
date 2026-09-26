<?php
// Use this as router arg: php -S localhost:8000 backend/public/router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
// The hosted API lives inside /tpk-api/public, while local development lives
// at the domain root. Normalize both to the same route shape for the API.
$basePath = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
if ($basePath !== '' && $basePath !== '/' && str_starts_with($path, $basePath . '/')) {
    $path = substr($path, strlen($basePath));
    $_SERVER['REQUEST_URI'] = $path;
}
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) return false;

// The Tailscale Funnel is an API bridge for the Vercel app, not a second
// staff-facing site. Send anyone opening its root to the actual TPK website.
if ($path === '/' && str_ends_with((string)($_SERVER['HTTP_HOST'] ?? ''), '.ts.net')) {
    header('Location: https://tpk-checkin.vercel.app', true, 302);
    exit;
}

if (str_starts_with($path, '/api/v1/public/registrations') || str_starts_with($path, '/api/v1/public/pickup-tickets/') || str_starts_with($path, '/api/v1/public/check-in-requests/') || $path === '/api/v1/public/service-session/current') {
    require __DIR__ . '/public-registration.php';
    return;
}
if ($path === '/api/v1/public/check-ins') {
    require __DIR__ . '/public-check-in.php';
    return;
}
if ($path === '/api/whatsapp-webhook') {
    require __DIR__ . '/whatsapp-webhook.php';
    return;
}
if ($path === '/api') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'message' => 'TPK Attendance API is running.',
        'endpoints' => ['/api/classes', '/api/families', '/api/v1/'],
    ]);
    return;
}
if (str_starts_with($path, '/api/v1/')) {
    require __DIR__ . '/v1.php';
    return;
}
if (str_starts_with($path, '/api/teachers/')) {
    require __DIR__ . '/teacher-auth.php';
    return;
}
require __DIR__ . '/index.php';
