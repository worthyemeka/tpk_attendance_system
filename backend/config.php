<?php
declare(strict_types=1);

function load_env_file(): void {
    $path = dirname(__DIR__) . '/.env';
    if (!is_readable($path)) return;
    foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
            $value = substr($value, 1, -1);
        }
        if (getenv($key) === false) putenv("$key=$value");
    }
}

load_env_file();

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $name = getenv('DB_NAME') ?: 'tpk_attendance_system';
    $user = getenv('DB_USER') ?: 'root';
    $pass = getenv('DB_PASSWORD') ?: '';
    $pdo = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function json_response(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . (getenv('FRONTEND_ORIGIN') ?: 'http://localhost:3000'));
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function body(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
function audit(PDO $db, int $campusId, string $action, string $entityType, int $entityId, array $metadata = []): void {
    $db->prepare('INSERT INTO audit_logs (campus_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)')
       ->execute([$campusId, $action, $entityType, $entityId, json_encode($metadata)]);
}
