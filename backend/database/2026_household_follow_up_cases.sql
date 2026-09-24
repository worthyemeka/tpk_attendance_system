USE tpk_attendance_system;

-- A household-aware case sits above the existing child-level follow_up_tasks.
-- It prevents sibling triggers from creating duplicate calls while preserving
-- exactly which children and missed services require attention.
CREATE TABLE follow_up_cases (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  family_id INT UNSIGNED NOT NULL,
  owner_staff_user_id INT UNSIGNED NULL,
  status ENUM('NEEDS_FOLLOW_UP','CONTACTED','COULDNT_REACH','RESOLVED') NOT NULL DEFAULT 'NEEDS_FOLLOW_UP',
  leadership_status ENUM('NOT_SENT','SENT','LEADERSHIP_ATTENTION_REQUIRED') NOT NULL DEFAULT 'NOT_SENT',
  reason VARCHAR(120) NULL,
  notes TEXT NULL,
  expected_back DATE NULL,
  last_contacted_at DATETIME NULL,
  resolved_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX case_directory (campus_id,status,leadership_status,updated_at),
  INDEX case_family (family_id,status),
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

CREATE TABLE follow_up_case_children (
  follow_up_case_id INT UNSIGNED NOT NULL,
  child_id INT UNSIGNED NOT NULL,
  source_task_id INT UNSIGNED NULL,
  PRIMARY KEY (follow_up_case_id,child_id),
  UNIQUE KEY one_case_per_source_task (source_task_id),
  FOREIGN KEY (follow_up_case_id) REFERENCES follow_up_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE,
  FOREIGN KEY (source_task_id) REFERENCES follow_up_tasks(id) ON DELETE SET NULL
);

CREATE TABLE follow_up_case_events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  follow_up_case_id INT UNSIGNED NOT NULL,
  staff_user_id INT UNSIGNED NULL,
  event_type ENUM('CASE_CREATED','CONTACTED','NO_ANSWER','NUMBER_UNAVAILABLE','TRY_AGAIN','RESOLVED','ESCALATED','RETURNED') NOT NULL,
  reason VARCHAR(120) NULL,
  notes TEXT NULL,
  expected_back DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (follow_up_case_id) REFERENCES follow_up_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

CREATE TABLE follow_up_case_escalations (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  follow_up_case_id INT UNSIGNED NOT NULL,
  recipient_staff_user_id INT UNSIGNED NOT NULL,
  note TEXT NULL,
  channel ENUM('WHATSAPP') NOT NULL DEFAULT 'WHATSAPP',
  status ENUM('QUEUED','SENT','FAILED') NOT NULL DEFAULT 'QUEUED',
  sent_by_staff_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  UNIQUE KEY case_recipient (follow_up_case_id,recipient_staff_user_id),
  FOREIGN KEY (follow_up_case_id) REFERENCES follow_up_cases(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  FOREIGN KEY (sent_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);
