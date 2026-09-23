-- TribePetra Kids staff registration, verified access, profile and Super Admin foundation.
-- Apply once after teacher_auth.sql and v1_migration.sql. This migration preserves existing staff.
USE tpk_attendance_system;

ALTER TABLE staff_users
  ADD COLUMN team_status ENUM('ACTIVE','PROBATION','INACTIVE') NOT NULL DEFAULT 'ACTIVE' AFTER access_level,
  ADD COLUMN account_status ENUM('PENDING_VERIFICATION','VERIFIED') NOT NULL DEFAULT 'VERIFIED' AFTER team_status,
  ADD COLUMN joined_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP AFTER account_status;

ALTER TABLE teacher_profiles
  ADD COLUMN title ENUM('Aunty','Uncle') NULL AFTER staff_user_id,
  ADD COLUMN whatsapp_number VARCHAR(40) NULL AFTER secondary_phone,
  ADD COLUMN whatsapp_number_normalized VARCHAR(20) NULL AFTER whatsapp_number,
  ADD COLUMN mobile_number VARCHAR(40) NULL AFTER whatsapp_number_normalized,
  ADD COLUMN mobile_number_normalized VARCHAR(20) NULL AFTER mobile_number,
  ADD COLUMN profile_image_url VARCHAR(500) NULL AFTER mobile_number_normalized,
  ADD COLUMN whatsapp_verified_at DATETIME NULL AFTER profile_image_url;

UPDATE teacher_profiles
SET whatsapp_number = COALESCE(whatsapp_number, primary_phone),
    whatsapp_number_normalized = COALESCE(whatsapp_number_normalized, CONCAT('+234', RIGHT(REGEXP_REPLACE(primary_phone, '[^0-9]', ''), 10))),
    mobile_number = COALESCE(mobile_number, secondary_phone),
    mobile_number_normalized = COALESCE(mobile_number_normalized, CASE WHEN secondary_phone IS NULL OR secondary_phone = '' THEN NULL ELSE CONCAT('+234', RIGHT(REGEXP_REPLACE(secondary_phone, '[^0-9]', ''), 10)) END),
    whatsapp_verified_at = COALESCE(whatsapp_verified_at, NOW());

CREATE TABLE staff_bootstrap_access (
  whatsapp_number_normalized VARCHAR(20) NOT NULL PRIMARY KEY,
  access_level ENUM('TPK_SUPER_ADMIN','TPK_ADMIN') NOT NULL,
  label VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO staff_bootstrap_access (whatsapp_number_normalized, access_level, label) VALUES
  ('+2348098666128', 'TPK_SUPER_ADMIN', 'Auntie Mafo'),
  ('+2349023232606', 'TPK_SUPER_ADMIN', 'Uncle Courage'),
  ('+2349037239646', 'TPK_SUPER_ADMIN', 'Uncle Muyiwa')
ON DUPLICATE KEY UPDATE access_level = VALUES(access_level), label = VALUES(label);

CREATE TABLE staff_whatsapp_verifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX staff_verification_lookup (staff_user_id, expires_at),
  CONSTRAINT fk_staff_verification_user FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

CREATE TABLE staff_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX staff_session_lookup (staff_user_id, expires_at),
  CONSTRAINT fk_staff_session_user FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

CREATE TABLE staff_team_status_audits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  previous_team_status ENUM('ACTIVE','PROBATION','INACTIVE') NOT NULL,
  next_team_status ENUM('ACTIVE','PROBATION','INACTIVE') NOT NULL,
  changed_by_staff_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_team_status_audit_user FOREIGN KEY (staff_user_id) REFERENCES staff_users(id),
  CONSTRAINT fk_team_status_audit_actor FOREIGN KEY (changed_by_staff_user_id) REFERENCES staff_users(id)
);
