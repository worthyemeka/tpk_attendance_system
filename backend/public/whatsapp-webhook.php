<?php
declare(strict_types=1);
require __DIR__ . '/../config.php';

/* Teacher accounts no longer use WhatsApp verification. This endpoint remains
   a harmless legacy response so an old provider callback cannot activate or
   modify any account. */
http_response_code(410);
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['error' => 'WhatsApp account verification is no longer used.']);
