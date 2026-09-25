-- Volunteer probation log, based on the TribePetra Kids four-week form.
-- Apply after 2026_team_onboarding.sql.
USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS staff_probation_weekly_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  week_number TINYINT UNSIGNED NOT NULL,
  service_date DATE NULL,
  tribe_age_group VARCHAR(120) NULL,
  lesson_topic_activity VARCHAR(500) NULL,
  time_in TIME NULL,
  staff_signed_by_staff_user_id INT UNSIGNED NULL,
  staff_signed_at DATETIME NULL,
  super_admin_signed_by_staff_user_id INT UNSIGNED NULL,
  super_admin_signed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY staff_probation_week (staff_user_id, week_number),
  CONSTRAINT fk_probation_log_staff FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_probation_log_staff_signer FOREIGN KEY (staff_signed_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_probation_log_super_signer FOREIGN KEY (super_admin_signed_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);
