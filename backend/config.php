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
    $port = getenv('DB_PORT');
    $portClause = $port !== false && ctype_digit((string)$port) ? ';port=' . $port : '';
    $pdo = new PDO("mysql:host=$host{$portClause};dbname=$name;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function json_response(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: ' . tpk_cors_origin());
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function tpk_cors_origin(): string {
    $configured = getenv('FRONTEND_ORIGINS') ?: (getenv('FRONTEND_ORIGIN') ?: 'http://localhost:3000');
    $allowed = array_values(array_filter(array_map('trim', explode(',', $configured))));
    $requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
    return in_array($requestOrigin, $allowed, true) ? $requestOrigin : ($allowed[0] ?? 'http://localhost:3000');
}

function body(): array { return json_decode(file_get_contents('php://input'), true) ?: []; }
function audit(PDO $db, int $campusId, string $action, string $entityType, int $entityId, array $metadata = []): void {
    $db->prepare('INSERT INTO audit_logs (campus_id, action, entity_type, entity_id, metadata) VALUES (?, ?, ?, ?, ?)')
       ->execute([$campusId, $action, $entityType, $entityId, json_encode($metadata)]);
}

function tpk_normalize_nigerian_phone(?string $value): ?string {
    $digits = preg_replace('/\D+/', '', (string)$value);
    if (str_starts_with($digits, '0') && strlen($digits) === 11) return '+234' . substr($digits, 1);
    if (str_starts_with($digits, '234') && strlen($digits) === 13) return '+' . $digits;
    return null;
}

function tpk_app_environment(): string { return strtolower((string)(getenv('APP_ENV') ?: 'production')); }

function tpk_store_profile_photo(array $file, int $staffUserId): string {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return '';
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) throw new RuntimeException('The profile photo could not be uploaded.');
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) throw new RuntimeException('Profile photos must be 5 MB or smaller.');
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    if (!isset($extensions[$mime])) throw new RuntimeException('Use a JPEG, PNG, or WebP profile photo.');
    $directory = __DIR__ . '/public/uploads/profiles';
    if (!is_dir($directory) && !mkdir($directory, 0750, true) && !is_dir($directory)) throw new RuntimeException('Profile-photo storage is unavailable.');
    $filename = 'staff-' . $staffUserId . '-' . bin2hex(random_bytes(8)) . '.' . $extensions[$mime];
    if (!move_uploaded_file($file['tmp_name'], $directory . '/' . $filename)) throw new RuntimeException('The profile photo could not be saved.');
    return '/uploads/profiles/' . $filename;
}

function tpk_send_meta_whatsapp_template(string $number, string $template, string $language, array $bodyParameters): void {
    $token = getenv('WHATSAPP_ACCESS_TOKEN');
    $phoneNumberId = getenv('WHATSAPP_PHONE_NUMBER_ID');
    if (!$token || !$phoneNumberId) throw new RuntimeException('WhatsApp verification is not configured.');
    $url = 'https://graph.facebook.com/' . (getenv('WHATSAPP_GRAPH_API_VERSION') ?: 'v25.0') . '/' . rawurlencode($phoneNumberId) . '/messages';
    $parameters = array_map(static fn (string $value): array => ['type' => 'text', 'text' => $value], $bodyParameters);
    $payload = json_encode(['messaging_product' => 'whatsapp', 'to' => ltrim($number, '+'), 'type' => 'template', 'template' => ['name' => $template, 'language' => ['code' => $language], 'components' => [['type' => 'body', 'parameters' => $parameters]]]], JSON_THROW_ON_ERROR);
    $request = stream_context_create(['http' => ['method' => 'POST', 'header' => "Authorization: Bearer {$token}\r\nContent-Type: application/json\r\n", 'content' => $payload, 'timeout' => 15, 'ignore_errors' => true]]);
    $response = @file_get_contents($url, false, $request);
    $status = (int)preg_replace('/.*\s(\d{3})\s.*/s', '$1', $http_response_header[0] ?? '500');
    if ($response === false || $status < 200 || $status >= 300) {
        $detail = json_decode((string)$response, true)['error']['message'] ?? 'The WhatsApp message could not be sent.';
        throw new RuntimeException($detail);
    }
}

function tpk_whatsapp_is_configured(): bool {
    return (bool)(getenv('WHATSAPP_ACCESS_TOKEN') && getenv('WHATSAPP_PHONE_NUMBER_ID'));
}

function tpk_send_whatsapp_verification(string $number, string $name, string $code): void {
    tpk_send_meta_whatsapp_template($number, getenv('WHATSAPP_VERIFICATION_TEMPLATE') ?: 'teacher_verification_code', getenv('WHATSAPP_VERIFICATION_LANGUAGE') ?: 'en_US', [$name, $code]);
}

/**
 * Sends one transactional SMS through Termii's Messaging API.  The API key is
 * intentionally read only on the PHP server; it is never available to Next.js
 * or the browser.
 */
function tpk_send_termii_sms(string $number, string $message): void {
    $apiKey = getenv('TERMII_API_KEY');
    $baseUrl = rtrim((string)getenv('TERMII_BASE_URL'), '/');
    $senderId = trim((string)getenv('TERMII_SENDER_ID'));
    $channel = strtolower(trim((string)(getenv('TERMII_SMS_CHANNEL') ?: 'dnd')));

    if (!$apiKey || !$baseUrl || !$senderId) {
        throw new RuntimeException('Termii SMS is not fully configured. Add the API key, base URL, and approved sender ID.');
    }
    if (!in_array($channel, ['dnd', 'generic'], true)) {
        throw new RuntimeException('Termii SMS channel must be dnd or generic.');
    }

    $payload = json_encode([
        'api_key' => $apiKey,
        'to' => ltrim($number, '+'),
        'from' => $senderId,
        'sms' => $message,
        'type' => 'plain',
        'channel' => $channel,
    ], JSON_THROW_ON_ERROR);
    $request = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 15,
        'ignore_errors' => true,
    ]]);
    $response = @file_get_contents($baseUrl . '/api/sms/send', false, $request);
    $status = (int)preg_replace('/.*\s(\d{3})\s.*/s', '$1', $http_response_header[0] ?? '500');
    $body = json_decode((string)$response, true);
    if ($response === false || $status < 200 || $status >= 300 || ($body['code'] ?? null) !== 'ok') {
        $detail = is_array($body) ? ($body['message'] ?? $body['error'] ?? null) : null;
        throw new RuntimeException(is_string($detail) ? $detail : 'Termii could not send the pickup-code SMS.');
    }
}

function tpk_pickup_ticket_url(string $token): string {
    $origin = rtrim(getenv('TPK_FRONTEND_URL') ?: (getenv('FRONTEND_ORIGIN') ?: 'http://localhost:3000'), '/');
    return $origin . '/pickup-ticket?token=' . rawurlencode($token);
}

function tpk_issue_pickup_code(PDO $db, int $serviceSessionId, int $familyId, ?int $guardianId): array {
    $existing = $db->prepare('SELECT id,display_code,qr_token FROM service_pickup_codes WHERE service_session_id=? AND family_id=? LIMIT 1');
    $existing->execute([$serviceSessionId, $familyId]);
    if ($row = $existing->fetch()) return ['id' => (int)$row['id'], 'code' => $row['display_code'], 'qrToken' => $row['qr_token'], 'ticketUrl' => tpk_pickup_ticket_url($row['qr_token'])];
    $session = $db->prepare('SELECT service_type,service_order FROM service_sessions WHERE id=? FOR UPDATE'); $session->execute([$serviceSessionId]); $service = $session->fetch();
    if (!$service) throw new RuntimeException('The service session is unavailable for pickup-code generation.');
    $letter = $service['service_type'] === 'FIRST_SERVICE' || (int)$service['service_order'] === 1 ? 'A' : 'B';
    $sequence = $db->prepare('SELECT COALESCE(MAX(sequence_number),0)+1 FROM service_pickup_codes WHERE service_session_id=? FOR UPDATE'); $sequence->execute([$serviceSessionId]); $number = (int)$sequence->fetchColumn();
    $code = sprintf('TPK-%s-%03d', $letter, $number); $token = bin2hex(random_bytes(32));
    $insert = $db->prepare('INSERT INTO service_pickup_codes(service_session_id,family_id,guardian_id,sequence_number,display_code,qr_token) VALUES(?,?,?,?,?,?)');
    $insert->execute([$serviceSessionId, $familyId, $guardianId, $number, $code, $token]);
    return ['id' => (int)$db->lastInsertId(), 'code' => $code, 'qrToken' => $token, 'ticketUrl' => tpk_pickup_ticket_url($token)];
}

function tpk_send_pickup_code(PDO $db, int $pickupCodeId, array $phones, string $code, string $ticketUrl): void {
    $message = "TribePetra Kids pickup code: {$code}. Show this code or ticket QR after service: {$ticketUrl}";
    $numbers = array_unique(array_filter(array_map('tpk_normalize_nigerian_phone', $phones)));
    foreach ($numbers as $phone) foreach (['SMS', 'WHATSAPP'] as $channel) {
        $status = 'FAILED'; $detail = null;
        try {
            if ($channel === 'SMS' && getenv('TERMII_API_KEY')) {
                tpk_send_termii_sms($phone, $message);
                $status = 'SENT';
            } elseif ($channel === 'WHATSAPP' && getenv('WHATSAPP_ACCESS_TOKEN') && getenv('WHATSAPP_PHONE_NUMBER_ID') && getenv('WHATSAPP_PICKUP_TEMPLATE')) {
                tpk_send_meta_whatsapp_template($phone, (string)getenv('WHATSAPP_PICKUP_TEMPLATE'), getenv('WHATSAPP_PICKUP_LANGUAGE') ?: 'en_US', [$code]);
                $status = 'SENT';
            } elseif ($webhook = getenv($channel === 'SMS' ? 'SMS_PICKUP_WEBHOOK' : 'WHATSAPP_PICKUP_WEBHOOK')) {
                $payload=json_encode(['to'=>$phone,'message'=>$message], JSON_THROW_ON_ERROR);$context=stream_context_create(['http'=>['method'=>'POST','header'=>"Content-Type: application/json\r\n",'content'=>$payload,'timeout'=>10]]);if(@file_get_contents($webhook,false,$context)===false)throw new RuntimeException('Provider request failed.');$status='SENT';
            }
            elseif (tpk_app_environment()==='development') { $directory=__DIR__.'/storage';if(!is_dir($directory))mkdir($directory,0700,true);file_put_contents($directory.'/pickup-code-notifications.log',gmdate('c')." {$channel} {$phone} {$message}\n",FILE_APPEND|LOCK_EX);$status='DEVELOPMENT_LOGGED'; }
            else $detail=$channel === 'SMS' ? 'SMS provider is not configured.' : 'WhatsApp pickup template is not configured.';
        } catch (Throwable $e) { $detail=$e->getMessage(); }
        $db->prepare('INSERT INTO pickup_code_notifications(pickup_code_id,phone,channel,status,provider_response) VALUES(?,?,?,?,?)')->execute([$pickupCodeId,$phone,$channel,$status,$detail]);
    }
}
