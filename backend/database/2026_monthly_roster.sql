-- Monthly roster planning state and the outbound WhatsApp delivery queue.
-- Run once after v1_migration.sql.
USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS roster_month_states (
  campus_id INT UNSIGNED NOT NULL,
  roster_month DATE NOT NULL,
  status ENUM('DRAFT','PUBLISHED') NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME NULL,
  published_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (campus_id, roster_month),
  CONSTRAINT fk_roster_month_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
  CONSTRAINT fk_roster_month_publisher FOREIGN KEY (published_by) REFERENCES staff_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS roster_notification_dispatches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  staff_user_id INT UNSIGNED NOT NULL,
  roster_month DATE NOT NULL,
  status ENUM('PENDING','SENT','FAILED') NOT NULL DEFAULT 'PENDING',
  provider_message VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY roster_notification_once (campus_id, staff_user_id, roster_month),
  CONSTRAINT fk_roster_notification_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
  CONSTRAINT fk_roster_notification_staff FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
);
