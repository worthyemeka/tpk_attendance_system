-- Live ministry reports read only from current TPK operational records.
-- Historical uploads live here exclusively and are never joined into attendance,
-- follow-up, pickup, or current reporting calculations.
USE tpk_attendance_system;

CREATE TABLE historical_archive_records (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  record_name VARCHAR(191) NOT NULL,
  record_type ENUM('ATTENDANCE','CHILDREN_RECORDS','REGISTRATION_RECORDS','FOLLOW_UP_RECORDS','TEAM_ROSTER','OTHER') NOT NULL,
  period_type ENUM('SINGLE_MONTH','DATE_RANGE','FULL_YEAR') NOT NULL,
  period_start DATE NULL,
  period_end DATE NULL,
  description TEXT NULL,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size_bytes INT UNSIGNED NOT NULL,
  uploaded_by_staff_user_id INT UNSIGNED NOT NULL,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX archive_campus_created (campus_id, created_at),
  INDEX archive_campus_period (campus_id, period_start),
  CONSTRAINT fk_archive_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
  CONSTRAINT fk_archive_uploader FOREIGN KEY (uploaded_by_staff_user_id) REFERENCES staff_users(id)
);
