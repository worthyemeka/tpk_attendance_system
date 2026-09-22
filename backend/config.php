<?php
declare(strict_types=1);

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
