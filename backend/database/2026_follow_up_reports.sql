USE tpk_attendance_system;

-- A child can be registered before a leader has completed their class placement.
ALTER TABLE children MODIFY class_id INT UNSIGNED NULL;

-- Class leaders receive follow-up information only for their assigned classes.
CREATE TABLE staff_class_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE KEY one_staff_class_assignment (staff_user_id, class_id),
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- One private report is queued each time a service closes.
CREATE TABLE service_report_dispatches (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NOT NULL,
  report_type ENUM('ABSENT_CHILDREN','SERVICE_SUMMARY') NOT NULL,
  delivery_channel ENUM('IN_APP','EMAIL','SMS','WHATSAPP') NOT NULL DEFAULT 'IN_APP',
  status ENUM('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
  payload JSON NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
  FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE CASCADE
);

-- Keep contact details in guardian records, not in task rows or public alerts.
CREATE TABLE follow_up_tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  child_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NULL,
  service_session_id INT UNSIGNED NULL,
  task_type ENUM('UNPICKED_UP','NEEDS_CLASS_ASSIGNMENT','MISSED_SERVICE','TWO_WEEK_ABSENCE') NOT NULL,
  status ENUM('OPEN','IN_PROGRESS','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  priority ENUM('NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
  assigned_to_staff_user_id INT UNSIGNED NULL,
  due_at DATETIME NULL,
  notes TEXT NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX open_follow_up (campus_id, status, task_type),
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);
