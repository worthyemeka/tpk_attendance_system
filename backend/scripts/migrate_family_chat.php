<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || !in_array('--confirm', $argv, true)) exit("Use CLI --confirm after a backup.\n");
require dirname(__DIR__).'/config.php';
$db=db();
$db->exec("CREATE TABLE IF NOT EXISTS family_chat_messages (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 family_id INT UNSIGNED NOT NULL,
 sender_staff_id INT UNSIGNED NULL,
 recipient_staff_id INT UNSIGNED NULL,
 sender_name VARCHAR(180) NOT NULL,
 recipient_name VARCHAR(180) NOT NULL,
 body TEXT NOT NULL,
 client_key CHAR(36) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY family_chat_retry (sender_staff_id,client_key),
 KEY family_chat_history (family_id,id),
 KEY family_chat_sender_time (sender_staff_id,created_at),
 FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
 FOREIGN KEY (sender_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL,
 FOREIGN KEY (recipient_staff_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$db->exec("CREATE TABLE IF NOT EXISTS family_chat_reads (
 family_id INT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL,
 last_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (family_id,staff_user_id),
 FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
 FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
echo "Family chat tables ready. Existing family and review records unchanged.\n";
