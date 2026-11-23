<?php
declare(strict_types=1);

require dirname(__DIR__) . '/config.php';
require dirname(__DIR__) . '/public/notification-delivery.php';

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$deliver = in_array('--deliver', $argv ?? [], true);
$limit = 25;
foreach ($argv ?? [] as $arg) if (preg_match('/^--limit=(\d{1,3})$/', $arg, $m)) $limit = max(1, min(100, (int)$m[1]));
if (!$deliver) {
    $db = db();
    $count = (int)$db->query("SELECT COUNT(*) FROM notification_deliveries WHERE channel IN ('WHATSAPP','EMAIL','PUSH') AND status='PENDING'")->fetchColumn();
    fwrite(STDOUT, "Dry run only; {$count} queued deliveries. Use --deliver to process after provider setup.\n");
    exit(0);
}
$result = tpk_notification_process_batch(db(), $limit);
fwrite(STDOUT, json_encode($result, JSON_UNESCAPED_SLASHES) . "\n");
