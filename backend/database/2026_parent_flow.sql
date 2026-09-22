USE tpk_attendance_system;

ALTER TABLE classes
  ADD COLUMN min_age TINYINT UNSIGNED NULL,
  ADD COLUMN max_age TINYINT UNSIGNED NULL;
UPDATE classes SET min_age=13, max_age=17 WHERE name='TribePetra Teens';
UPDATE classes SET min_age=9, max_age=12 WHERE name='Tribe A';
UPDATE classes SET min_age=5, max_age=8 WHERE name='Tribe B';
UPDATE classes SET min_age=3, max_age=4 WHERE name='Tribe C';

ALTER TABLE children ADD COLUMN is_first_visit BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE service_sessions
  ADD COLUMN service_date DATE NULL,
  ADD COLUMN service_order TINYINT UNSIGNED NOT NULL DEFAULT 1;
UPDATE service_sessions SET service_date=DATE(starts_at) WHERE service_date IS NULL;

CREATE TABLE pickup_passes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_session_id INT UNSIGNED NOT NULL,
  family_id INT UNSIGNED NOT NULL,
  display_code VARCHAR(12) NOT NULL UNIQUE,
  opaque_token VARCHAR(120) NOT NULL UNIQUE,
  status ENUM('ACTIVE','COMPLETED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
  issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NULL,
  FOREIGN KEY(service_session_id) REFERENCES service_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(family_id) REFERENCES families(id) ON DELETE CASCADE,
  UNIQUE KEY one_active_pass_per_family_service(service_session_id,family_id)
);

CREATE TABLE pickup_notifications (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  attendance_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  status ENUM('PENDING','ACKNOWLEDGED','READY') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
  FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);
