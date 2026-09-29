USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS assembly_activities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NOT NULL,
  activity_name VARCHAR(180) NOT NULL,
  led_by_staff_user_id INT UNSIGNED NULL,
  notes TEXT NULL,
  status ENUM('UPCOMING','COMPLETED','SKIPPED') NOT NULL DEFAULT 'UPCOMING',
  created_by_staff_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX assembly_activity_scope (campus_id, service_session_id, created_at),
  CONSTRAINT assembly_activity_session_fk FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE CASCADE,
  CONSTRAINT assembly_activity_leader_fk FOREIGN KEY (led_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL,
  CONSTRAINT assembly_activity_creator_fk FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS assembly_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NOT NULL,
  note TEXT NOT NULL,
  created_by_staff_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX assembly_note_scope (campus_id, service_session_id, created_at),
  CONSTRAINT assembly_note_session_fk FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE CASCADE,
  CONSTRAINT assembly_note_creator_fk FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
);
