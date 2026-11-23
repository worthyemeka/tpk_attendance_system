-- Additive schema for the staff notification delivery queue.
-- Run through backend/scripts/migrate_whatsapp_notifications.php so existing
-- notification type values and partially-applied migrations are preserved.

ALTER TABLE notifications
  MODIFY COLUMN type VARCHAR(64) NOT NULL,
  ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'SYSTEM' AFTER type,
  ADD COLUMN importance VARCHAR(16) NOT NULL DEFAULT 'OPTIONAL' AFTER category,
  -- Existing metadata_json stores notification payloads; no duplicate JSON column.
  ADD KEY notifications_staff_category_created (staff_user_id, category, created_at);

CREATE TABLE staff_notification_preferences (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE staff_notification_category_preferences (
  staff_user_id INT UNSIGNED NOT NULL,
  category VARCHAR(40) NOT NULL,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (staff_user_id, category),
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notification_deliveries (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notification_webhook_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  event_key CHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
