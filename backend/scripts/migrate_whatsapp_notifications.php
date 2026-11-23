<?php
declare(strict_types=1);

require dirname(__DIR__) . '/config.php';

if (PHP_SAPI !== 'cli' || !in_array('--confirm', $argv ?? [], true)) {
    fwrite(STDERR, "This additive migration requires CLI --confirm after a database backup.\n");
    exit(2);
}

$db = db();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("ALTER TABLE notifications MODIFY COLUMN type VARCHAR(64) NOT NULL");

$columns = [];
foreach ($db->query('SHOW COLUMNS FROM notifications')->fetchAll(PDO::FETCH_ASSOC) as $column) $columns[(string)$column['Field']] = true;
$add = [];
if (!isset($columns['category'])) $add[] = "ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'SYSTEM' AFTER type";
if (!isset($columns['importance'])) $add[] = "ADD COLUMN importance VARCHAR(16) NOT NULL DEFAULT 'OPTIONAL' AFTER category";
if (!isset($columns['metadata_json'])) $add[] = 'ADD COLUMN metadata_json JSON NULL AFTER dedupe_key';
if ($add) $db->exec('ALTER TABLE notifications ' . implode(', ', $add));

// Classify existing source-of-truth notices without changing their content/read state.
$db->exec("UPDATE notifications SET
  category=CASE
    WHEN type='ROSTER_PUBLISHED' OR type='ROSTER_REMINDER' THEN 'ROSTER_UPDATES'
    WHEN type IN ('DUTY_ASSIGNED','DUTY_CHANGED','DUTY_REMOVED') THEN 'DUTY_CHANGES'
    WHEN type IN ('FOLLOW_UP_REQUIRED','WELFARE_FOLLOWUP_ASSIGNED','WELFARE_FOLLOWUP_ESCALATED') THEN 'WELFARE'
    WHEN type IN ('PICKUP_WAITING') THEN 'SYSTEM_URGENT'
    WHEN type IN ('CLASS_ASSIGNMENT_REQUIRED') THEN 'SYSTEM'
    ELSE category END,
  importance=CASE
    WHEN type IN ('ROSTER_PUBLISHED','DUTY_ASSIGNED','DUTY_CHANGED','DUTY_REMOVED','FOLLOW_UP_REQUIRED','WELFARE_FOLLOWUP_ASSIGNED','WELFARE_FOLLOWUP_ESCALATED','PICKUP_WAITING') THEN 'ESSENTIAL'
    ELSE importance END");

$indexNames = array_column($db->query('SHOW INDEX FROM notifications')->fetchAll(PDO::FETCH_ASSOC), 'Key_name');
if (!in_array('notifications_staff_category_created', $indexNames, true)) {
    $db->exec('ALTER TABLE notifications ADD KEY notifications_staff_category_created (staff_user_id, category, created_at)');
}

$db->exec("CREATE TABLE IF NOT EXISTS staff_notification_preferences (
  staff_user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_consent_at DATETIME NULL,
  whatsapp_withdrawn_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$db->exec("CREATE TABLE IF NOT EXISTS staff_notification_category_preferences (
  staff_user_id INT UNSIGNED NOT NULL,
  category VARCHAR(40) NOT NULL,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_user_id, category),
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$db->exec("CREATE TABLE IF NOT EXISTS notification_deliveries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  notification_id BIGINT UNSIGNED NOT NULL,
  staff_user_id INT UNSIGNED NULL,
  channel ENUM('IN_APP','PUSH','EMAIL','WHATSAPP') NOT NULL,
  recipient VARCHAR(255) NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'TPK',
  provider_message_id VARCHAR(190) NULL,
  status ENUM('PENDING','SENT','DELIVERED','READ','FAILED','SKIPPED') NOT NULL DEFAULT 'PENDING',
  attempted_at DATETIME NULL,
  sent_at DATETIME NULL,
  delivered_at DATETIME NULL,
  read_at DATETIME NULL,
  failed_at DATETIME NULL,
  failure_reason VARCHAR(160) NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  locked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY notification_channel (notification_id, channel),
  UNIQUE KEY provider_message (provider_message_id),
  KEY delivery_queue (channel, status, next_attempt_at, locked_at),
  KEY delivery_staff_recent (staff_user_id, created_at),
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$db->exec("CREATE TABLE IF NOT EXISTS notification_webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  event_key CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

fwrite(STDOUT, "WhatsApp notification delivery schema is ready. Existing notification rows were preserved.\n");
