USE tpk_attendance_system;

ALTER TABLE children
  ADD COLUMN gender ENUM('MALE','FEMALE','UNSPECIFIED') NOT NULL DEFAULT 'UNSPECIFIED' AFTER date_of_birth,
  ADD COLUMN joined_at DATE NULL AFTER safeguarding_notes;

CREATE TABLE child_guardians (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  child_id INT UNSIGNED NOT NULL,
  guardian_id INT UNSIGNED NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY one_child_guardian (child_id, guardian_id),
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE
);

ALTER TABLE attendance
  ADD COLUMN source ENUM('PARENT_QR','ASSISTED') NOT NULL DEFAULT 'PARENT_QR' AFTER status,
  ADD COLUMN checked_in_by INT UNSIGNED NULL AFTER source,
  ADD COLUMN is_first_visit BOOLEAN NOT NULL DEFAULT FALSE AFTER checked_in_by,
  ADD CONSTRAINT attendance_checked_in_by_fk FOREIGN KEY (checked_in_by) REFERENCES staff_users(id) ON DELETE SET NULL;

CREATE TABLE sunday_volunteer_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NOT NULL,
  assignment ENUM('CHECK_IN','PICK_UP','TRIBEPETRA_TEENS','TRIBE_A','TRIBE_B','TRIBE_C','TRIBE_D') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_sunday_assignment (staff_user_id, service_session_id, assignment),
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  staff_user_id INT UNSIGNED NULL,
  type ENUM('SERVICE_REPORT_READY','FOLLOW_UP_REQUIRED','PICKUP_WAITING','CLASS_ASSIGNMENT_REQUIRED') NOT NULL,
  title VARCHAR(180) NOT NULL,
  body VARCHAR(500) NOT NULL,
  target_path VARCHAR(255) NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
);
