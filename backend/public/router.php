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
$rawUploadPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) ?: '';
if (preg_match('#^/uploads/([A-Za-z0-9._/-]+)$#', $rawUploadPath, $uploadMatch)) {
    $uploadsRoot = realpath(__DIR__ . '/uploads');
    $uploadFile = realpath(__DIR__ . '/uploads/' . ltrim($uploadMatch[1], '/'));
    if ($uploadsRoot && $uploadFile && is_file($uploadFile) && str_starts_with($uploadFile, $uploadsRoot . DIRECTORY_SEPARATOR)) {
        $mime = function_exists('mime_content_type') ? (mime_content_type($uploadFile) ?: 'application/octet-stream') : 'application/octet-stream';
        header('Content-Type: '.$mime);
        header('Content-Length: '.(string)filesize($uploadFile));
        header('Cache-Control: public, max-age=86400');
        readfile($uploadFile);
        exit;
    }
}
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) {
    /* The built-in PHP router does not consistently fall back to its static
       handler on every hosted setup. Serve uploaded profile media explicitly so
       the same /uploads URL works locally, on cPanel, and behind the Vercel
       rewrite. */
    if (str_starts_with($path, '/uploads/')) {
        $mime = function_exists('mime_content_type') ? (mime_content_type($file) ?: 'application/octet-stream') : 'application/octet-stream';
        header('Content-Type: '.$mime);
        header('Content-Length: '.(string)filesize($file));
        header('Cache-Control: public, max-age=86400');
        readfile($file);
        exit;
    }
    return false;
}

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
if (preg_match('#^/api/v1/public/profile-images/([A-Za-z0-9._-]+)$#', $path, $imageMatch)) {
    $profilesRoot = realpath(__DIR__ . '/uploads/profiles');
    $imageFile = realpath(__DIR__ . '/uploads/profiles/' . $imageMatch[1]);
    if (!$profilesRoot || !$imageFile || !is_file($imageFile) || !str_starts_with($imageFile, $profilesRoot . DIRECTORY_SEPARATOR)) {
        http_response_code(404);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'Profile image not found.']);
        exit;
    }
    $mime = function_exists('mime_content_type') ? (mime_content_type($imageFile) ?: 'application/octet-stream') : 'application/octet-stream';
    header('Content-Type: '.$mime);
    header('Content-Length: '.(string)filesize($imageFile));
    header('Cache-Control: public, max-age=86400');
    readfile($imageFile);
    exit;
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
