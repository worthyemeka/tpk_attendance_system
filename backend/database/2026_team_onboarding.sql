-- Team onboarding is separate from staff account activity and access level.
-- Run once after v1_migration.sql.
USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS staff_onboarding_profiles (
  staff_user_id INT UNSIGNED NOT NULL PRIMARY KEY,
  onboarding_status ENUM('PROBATION','ONBOARDED') NOT NULL DEFAULT 'ONBOARDED',
  probation_started_at DATE NULL,
  probation_target_weeks TINYINT UNSIGNED NOT NULL DEFAULT 4,
  onboarded_at DATETIME NULL,
  extended_reason VARCHAR(500) NULL,
  updated_by_staff_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_staff_onboarding_profile_staff FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_onboarding_profile_updated_by FOREIGN KEY (updated_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS staff_onboarding_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  previous_status VARCHAR(32) NULL,
  next_status VARCHAR(32) NULL,
  note VARCHAR(500) NULL,
  performed_by_staff_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY staff_onboarding_events_staff (staff_user_id, created_at),
  CONSTRAINT fk_staff_onboarding_event_staff FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_onboarding_event_performed_by FOREIGN KEY (performed_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

INSERT INTO staff_onboarding_profiles (staff_user_id, onboarding_status, probation_started_at, onboarded_at)
SELECT s.id,
       CASE WHEN s.team_status = 'PROBATION' THEN 'PROBATION' ELSE 'ONBOARDED' END,
       CASE WHEN s.team_status = 'PROBATION' THEN DATE(s.joined_at) ELSE NULL END,
       CASE WHEN s.team_status = 'PROBATION' THEN NULL ELSE s.joined_at END
FROM staff_users s
ON DUPLICATE KEY UPDATE staff_user_id = VALUES(staff_user_id);
