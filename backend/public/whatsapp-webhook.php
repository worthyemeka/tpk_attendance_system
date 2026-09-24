<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = (string)($_GET['hub_mode'] ?? $_GET['hub.mode'] ?? '');
    $verifyToken = (string)($_GET['hub_verify_token'] ?? $_GET['hub.verify_token'] ?? '');
    $challenge = (string)($_GET['hub_challenge'] ?? $_GET['hub.challenge'] ?? '');
    if ($mode === 'subscribe' && $verifyToken !== '' && hash_equals((string)getenv('WHATSAPP_WEBHOOK_VERIFY_TOKEN'), $verifyToken)) {
        http_response_code(200); header('Content-Type: text/plain; charset=utf-8'); echo $challenge; exit;
    }
    http_response_code(403); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['error' => 'Webhook verification failed.']); exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); header('Allow: GET, POST'); exit; }

$raw = file_get_contents('php://input');
$appSecret = (string)getenv('META_APP_SECRET');
$signature = (string)($_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '');
if ($appSecret === '' || $signature === '' || !hash_equals('sha256=' . hash_hmac('sha256', $raw, $appSecret), $signature)) {
    http_response_code(403); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['error' => 'Invalid webhook signature.']); exit;
}
$payload = json_decode($raw, true);
if (!is_array($payload)) { http_response_code(400); exit; }
$db = db();
foreach (($payload['entry'] ?? []) as $entry) foreach (($entry['changes'] ?? []) as $change) foreach (($change['value']['messages'] ?? []) as $message) {
    $from = tpk_normalize_nigerian_phone((string)($message['from'] ?? ''));
    $text = trim((string)($message['text']['body'] ?? ''));
    if (!$from || !preg_match('/^TPK\s+VERIFY\s+([a-f0-9]{64})$/i', $text, $matches)) continue;
    $find = $db->prepare('SELECT v.id,v.staff_user_id,su.campus_id,p.whatsapp_number_normalized FROM staff_whatsapp_verifications v JOIN teacher_profiles p ON p.staff_user_id=v.staff_user_id JOIN staff_users su ON su.id=v.staff_user_id WHERE v.token_hash=? AND v.used_at IS NULL AND v.expires_at>NOW() AND p.whatsapp_number_normalized=? LIMIT 1');
    $find->execute([hash('sha256', strtolower($matches[1])), $from]);
    if (!$verification = $find->fetch()) continue;
    $upgrade = $db->prepare('SELECT access_level FROM staff_bootstrap_access WHERE whatsapp_number_normalized=? LIMIT 1');
    $upgrade->execute([$verification['whatsapp_number_normalized']]); $access = $upgrade->fetchColumn();
    $db->beginTransaction();
    try {
        $db->prepare('UPDATE staff_whatsapp_verifications SET used_at=NOW() WHERE id=? AND used_at IS NULL')->execute([(int)$verification['id']]);
        if ($access) $db->prepare("UPDATE staff_users SET account_status='VERIFIED',is_active=1,access_level=? WHERE id=?")->execute([$access, (int)$verification['staff_user_id']]);
        else $db->prepare("UPDATE staff_users SET account_status='VERIFIED',is_active=1 WHERE id=?")->execute([(int)$verification['staff_user_id']]);
        $db->prepare('UPDATE teacher_profiles SET whatsapp_verified_at=NOW() WHERE staff_user_id=?')->execute([(int)$verification['staff_user_id']]);
        audit($db, (int)$verification['campus_id'], 'TEACHER_WHATSAPP_VERIFIED', 'StaffUser', (int)$verification['staff_user_id'], ['method' => 'WHATSAPP_CLICK_TO_CHAT']);
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); error_log('[TPK WhatsApp webhook] ' . $e->getMessage()); }
}
http_response_code(200); header('Content-Type: application/json; charset=utf-8'); echo json_encode(['status' => 'ok']);
