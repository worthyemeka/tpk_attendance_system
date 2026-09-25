-- Orientation is a separate, leadership-confirmed milestone before supported serving.
USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS staff_orientation_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  orientation_date DATE NOT NULL,
  attendance_status ENUM('ATTENDED','DID_NOT_ATTEND','EXCUSED','RESCHEDULED') NOT NULL,
  notes TEXT NULL,
  confirmed_by_staff_user_id INT UNSIGNED NOT NULL,
  confirmed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY staff_orientation_history (staff_user_id, orientation_date, id),
  CONSTRAINT fk_staff_orientation_staff FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_orientation_confirmer FOREIGN KEY (confirmed_by_staff_user_id) REFERENCES staff_users(id) ON DELETE RESTRICT
);

ALTER TABLE staff_probation_weekly_logs
  ADD COLUMN teacher_reflection TEXT NULL AFTER time_in,
  ADD COLUMN leadership_review_note TEXT NULL AFTER teacher_reflection,
  ADD COLUMN attendance_confirmed_at DATETIME NULL AFTER super_admin_signed_at;
