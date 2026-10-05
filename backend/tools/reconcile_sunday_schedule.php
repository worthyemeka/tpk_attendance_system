<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/config.php';
if (PHP_SAPI !== 'cli') exit(1);
$db = db();
// Reconcile only this feature's missing schema; safe to run repeatedly.
$type = $db->query("SHOW COLUMNS FROM service_sessions LIKE 'service_type'")->fetch();
if (!$type) throw new RuntimeException('The core service-session schema must exist first.');
if (str_starts_with(strtolower($type['Type']), 'enum(')) {
    $db->exec('ALTER TABLE service_sessions MODIFY service_type VARCHAR(32) NULL');
    echo "Service type now supports additional configured services.\n";
}
$db->exec("CREATE TABLE IF NOT EXISTS sunday_service_plans (
    campus_id INT UNSIGNED NOT NULL,
    service_date DATE NOT NULL,
    theme VARCHAR(150) NULL,
    updated_by INT UNSIGNED NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (campus_id,service_date),
    FOREIGN KEY (campus_id) REFERENCES campuses(id)
)");
echo "Sunday schedule schema reconciled.\n";
