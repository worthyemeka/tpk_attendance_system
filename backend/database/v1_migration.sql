-- TribePetra Kids API v1 migration
-- Run after schema.sql and the existing 2026_*.sql migrations, once, on MySQL.
-- This preserves the existing family/check-in tables and adds the v1 model.
USE tpk_attendance_system;

ALTER TABLE staff_users
  ADD COLUMN access_level ENUM('TPK_SUPER_ADMIN','TPK_ADMIN') NOT NULL DEFAULT 'TPK_ADMIN' AFTER role;

ALTER TABLE classes
  ADD COLUMN display_order SMALLINT UNSIGNED NOT NULL DEFAULT 999 AFTER max_age;

ALTER TABLE children
  ADD COLUMN school_grade VARCHAR(100) NULL AFTER gender,
  ADD COLUMN class_assignment_required BOOLEAN NOT NULL DEFAULT FALSE AFTER is_first_visit,
  ADD COLUMN source_system VARCHAR(100) NULL AFTER class_assignment_required,
  ADD COLUMN source_record_key VARCHAR(191) NULL AFTER source_system;

ALTER TABLE child_guardians
  ADD COLUMN relationship VARCHAR(100) NULL AFTER guardian_id,
  ADD COLUMN authorised_pickup BOOLEAN NOT NULL DEFAULT TRUE AFTER is_primary,
  ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE service_sessions
  ADD COLUMN service_type ENUM('FIRST_SERVICE','SECOND_SERVICE') NULL AFTER service_order,
  ADD COLUMN check_in_opened_at DATETIME NULL AFTER service_type,
  ADD COLUMN closed_at DATETIME NULL AFTER check_in_opened_at;

CREATE TABLE child_care_profiles (
  child_id INT UNSIGNED NOT NULL PRIMARY KEY,
  allergies_or_medical_conditions TEXT NULL,
  neurodevelopmental_conditions TEXT NULL,
  additional_needs_description TEXT NULL,
  severity VARCHAR(80) NULL,
  special_equipment TEXT NULL,
  feeding_permission BOOLEAN NULL,
  feeding_requirements TEXT NULL,
  restroom_communication TEXT NULL,
  other_communication_methods TEXT NULL,
  behaviours_to_know TEXT NULL,
  behaviour_management TEXT NULL,
  behaviour_triggers TEXT NULL,
  other_relevant_care_information TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_care_profile_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE TABLE child_emergency_profiles (
  child_id INT UNSIGNED NOT NULL PRIMARY KEY,
  emergency_contact_name VARCHAR(191) NULL,
  emergency_contact_phone VARCHAR(40) NULL,
  medical_emergency_plan TEXT NULL,
  medical_treatment_consent BOOLEAN NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_emergency_profile_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE TABLE child_ministry_profiles (
  child_id INT UNSIGNED NOT NULL PRIMARY KEY,
  favourite_colour VARCHAR(100) NULL,
  hobbies_and_interests TEXT NULL,
  favourite_snack_or_drink VARCHAR(191) NULL,
  prayer_request TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ministry_profile_child FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE TABLE duty_types (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(80) NOT NULL UNIQUE,
  category ENUM('FIRST_SERVICE','SECOND_SERVICE','NON_TEACHING') NOT NULL,
  requires_class BOOLEAN NOT NULL DEFAULT FALSE,
  description VARCHAR(500) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE roster_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  assignment_date DATE NOT NULL,
  service_session_id INT UNSIGNED NULL,
  duty_type_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NULL,
  assigned_by INT UNSIGNED NOT NULL,
  status ENUM('ASSIGNED','PRESENT','ABSENT','REPLACED','CANCELLED') NOT NULL DEFAULT 'ASSIGNED',
  confirmed_at DATETIME NULL,
  replacement_for_assignment_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX roster_date (assignment_date),
  INDEX roster_user_date (user_id, assignment_date),
  CONSTRAINT fk_roster_user FOREIGN KEY (user_id) REFERENCES staff_users(id),
  CONSTRAINT fk_roster_session FOREIGN KEY (service_session_id) REFERENCES service_sessions(id),
  CONSTRAINT fk_roster_duty FOREIGN KEY (duty_type_id) REFERENCES duty_types(id),
  CONSTRAINT fk_roster_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  CONSTRAINT fk_roster_assigner FOREIGN KEY (assigned_by) REFERENCES staff_users(id),
  CONSTRAINT fk_roster_replacement FOREIGN KEY (replacement_for_assignment_id) REFERENCES roster_assignments(id) ON DELETE SET NULL
);

CREATE TABLE staff_access_audits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL,
  previous_access_level ENUM('TPK_SUPER_ADMIN','TPK_ADMIN') NOT NULL,
  next_access_level ENUM('TPK_SUPER_ADMIN','TPK_ADMIN') NOT NULL,
  changed_by_staff_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_access_audit_user FOREIGN KEY (staff_user_id) REFERENCES staff_users(id),
  CONSTRAINT fk_access_audit_actor FOREIGN KEY (changed_by_staff_user_id) REFERENCES staff_users(id)
);

CREATE TABLE import_runs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  source_name VARCHAR(191) NOT NULL,
  source_hash VARCHAR(128) NULL,
  imported_by INT UNSIGNED NULL,
  records_seen INT UNSIGNED NOT NULL DEFAULT 0,
  records_imported INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_import_run_actor FOREIGN KEY (imported_by) REFERENCES staff_users(id) ON DELETE SET NULL
);

CREATE TABLE import_issues (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  import_run_id INT UNSIGNED NOT NULL,
  source_row INT UNSIGNED NOT NULL,
  issue_code VARCHAR(100) NOT NULL,
  message VARCHAR(1000) NOT NULL,
  raw_value TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX import_issue_run (import_run_id),
  CONSTRAINT fk_import_issue_run FOREIGN KEY (import_run_id) REFERENCES import_runs(id) ON DELETE CASCADE
);

INSERT INTO duty_types (name, code, category, requires_class, description) VALUES
  ('First Service Team', 'FIRST_SERVICE_TEAM', 'FIRST_SERVICE', FALSE, 'Serve on the first-service general team.'),
  ('Class Teacher', 'CLASS_TEACHER', 'SECOND_SERVICE', TRUE, 'Teach or support a configured class.'),
  ('Teacher at Door', 'TEACHER_AT_DOOR', 'SECOND_SERVICE', FALSE, 'Welcome children and support entry into the classroom.'),
  ('Assembly', 'ASSEMBLY', 'SECOND_SERVICE', FALSE, 'Lead or support the children’s assembly.'),
  ('Attendance', 'ATTENDANCE', 'SECOND_SERVICE', FALSE, 'Monitor child check-ins and attendance records.'),
  ('Head of Service', 'HEAD_OF_SERVICE', 'SECOND_SERVICE', FALSE, 'Coordinate the service flow and offering.'),
  ('Prayers', 'PRAYERS', 'NON_TEACHING', FALSE, 'Lead the assigned team prayer session.'),
  ('Lesson Plan Review', 'LESSON_PLAN_REVIEW', 'NON_TEACHING', FALSE, 'Review lesson plans for the assigned period.');

-- Assign the initial Super Admins by verified staff IDs, never by display-name checks.
-- UPDATE staff_users SET access_level = 'TPK_SUPER_ADMIN' WHERE id IN (<Courage ID>, <Mafo ID>, <Muyiwa ID>);
