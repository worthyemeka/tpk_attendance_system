USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS classroom_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NULL,
  date_given DATE NOT NULL,
  due_date DATE NULL,
  title VARCHAR(180) NOT NULL,
  instructions TEXT NULL,
  resource_url VARCHAR(500) NULL,
  created_by_staff_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX classroom_assignments_scope (campus_id, class_id, service_session_id, date_given),
  CONSTRAINT classroom_assignments_class_fk FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT classroom_assignments_session_fk FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE SET NULL,
  CONSTRAINT classroom_assignments_creator_fk FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS classroom_assignment_submissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT UNSIGNED NOT NULL,
  child_id INT UNSIGNED NOT NULL,
  status ENUM('SUBMITTED','NOT_SUBMITTED','EXCUSED') NOT NULL DEFAULT 'NOT_SUBMITTED',
  updated_by_staff_user_id INT UNSIGNED NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY classroom_assignment_child (assignment_id, child_id),
  CONSTRAINT classroom_assignment_submissions_assignment_fk FOREIGN KEY (assignment_id) REFERENCES classroom_assignments(id) ON DELETE CASCADE,
  CONSTRAINT classroom_assignment_submissions_child_fk FOREIGN KEY (child_id) REFERENCES children(id),
  CONSTRAINT classroom_assignment_submissions_updater_fk FOREIGN KEY (updated_by_staff_user_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS classroom_notes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NULL,
  note TEXT NOT NULL,
  created_by_staff_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX classroom_notes_scope (campus_id, class_id, service_session_id, created_at),
  CONSTRAINT classroom_notes_class_fk FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT classroom_notes_session_fk FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE SET NULL,
  CONSTRAINT classroom_notes_creator_fk FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
);
