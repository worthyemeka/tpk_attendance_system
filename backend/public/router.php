<?php
// Use this as router arg: php -S localhost:8000 backend/public/router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) return false;

if (str_starts_with($path, '/api/v1/public/registrations') || $path === '/api/v1/public/service-session/current') {
    require __DIR__ . '/public-registration.php';
    return;
}
if ($path === '/api/v1/public/check-ins') {
    require __DIR__ . '/public-check-in.php';
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
