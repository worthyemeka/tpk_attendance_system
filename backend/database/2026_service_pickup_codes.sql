-- Apply after 2026_parent_flow.sql. Pickup codes restart for each service session.
USE tpk_attendance_system;

CREATE TABLE service_pickup_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_session_id INT UNSIGNED NOT NULL,
  family_id INT UNSIGNED NOT NULL,
  guardian_id INT UNSIGNED NULL,
  sequence_number INT UNSIGNED NOT NULL,
  display_code VARCHAR(20) NOT NULL,
  qr_token CHAR(64) NOT NULL,
  collected_at DATETIME NULL,
  collected_by_staff_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_code_per_family_service (service_session_id, family_id),
  UNIQUE KEY one_sequence_per_service (service_session_id, sequence_number),
  UNIQUE KEY one_display_code_per_service (service_session_id, display_code),
  UNIQUE KEY one_pickup_qr_token (qr_token),
  CONSTRAINT fk_pickup_code_session FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pickup_code_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  CONSTRAINT fk_pickup_code_guardian FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE SET NULL,
  CONSTRAINT fk_pickup_code_collector FOREIGN KEY (collected_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

CREATE TABLE pickup_code_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pickup_code_id BIGINT UNSIGNED NOT NULL,
  phone VARCHAR(20) NOT NULL,
  channel ENUM('SMS','WHATSAPP') NOT NULL,
  status ENUM('SENT','FAILED','DEVELOPMENT_LOGGED') NOT NULL,
  provider_response TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pickup_notification_code FOREIGN KEY (pickup_code_id) REFERENCES service_pickup_codes(id) ON DELETE CASCADE
);
