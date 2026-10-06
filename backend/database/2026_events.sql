-- Event guests remain event records; they are not added to a host-campus directory.
CREATE TABLE IF NOT EXISTS ministry_events (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 campus_id INT UNSIGNED NOT NULL,
 name VARCHAR(180) NOT NULL,
 event_type VARCHAR(30) NOT NULL,
 starts_on DATE NOT NULL,
 ends_on DATE NOT NULL,
 registration_opens DATE NOT NULL,
 registration_closes DATE NOT NULL,
 countdown_enabled BOOLEAN NOT NULL DEFAULT TRUE,
 public_registration BOOLEAN NOT NULL DEFAULT FALSE,
 status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
 description TEXT NULL,
 public_key CHAR(48) NOT NULL UNIQUE,
 created_by INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX event_campus_date(campus_id,starts_on),
 FOREIGN KEY(campus_id) REFERENCES campuses(id),
 FOREIGN KEY(created_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_sessions (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id INT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL,
 starts_at DATETIME NOT NULL,
 ends_at DATETIME NOT NULL,
 UNIQUE KEY event_session(event_id,name,starts_at),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id)
);
CREATE TABLE IF NOT EXISTS event_groups (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id INT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL,
 min_age TINYINT UNSIGNED NOT NULL,
 max_age TINYINT UNSIGNED NOT NULL,
 UNIQUE KEY event_group(event_id,name),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id)
);
CREATE TABLE IF NOT EXISTS event_volunteers (
 event_id INT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL,
 duty VARCHAR(30) NOT NULL DEFAULT 'TEACHER',
 PRIMARY KEY(event_id,staff_user_id),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_volunteer_assignments (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id INT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL,
 session_id INT UNSIGNED NULL,
 group_id INT UNSIGNED NULL,
 responsibility VARCHAR(120) NOT NULL,
 INDEX event_roster(event_id,session_id),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id),
 FOREIGN KEY(session_id) REFERENCES event_sessions(id),
 FOREIGN KEY(group_id) REFERENCES event_groups(id)
);
CREATE TABLE IF NOT EXISTS event_registrations (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id INT UNSIGNED NOT NULL,
 reference_code CHAR(16) NOT NULL UNIQUE,
 guardian_name VARCHAR(180) NOT NULL,
 guardian_phone VARCHAR(40) NOT NULL,
 emergency_phone VARCHAR(40) NOT NULL,
 home_campus VARCHAR(120) NOT NULL,
 family_id INT UNSIGNED NULL,
 registered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX event_guardian(event_id,guardian_phone),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(family_id) REFERENCES families(id)
);
CREATE TABLE IF NOT EXISTS event_children (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id INT UNSIGNED NOT NULL,
 identity_key CHAR(64) NOT NULL,
 registration_id INT UNSIGNED NOT NULL,
 child_id INT UNSIGNED NULL,
 name VARCHAR(180) NOT NULL,
 date_of_birth DATE NOT NULL,
 care_notes TEXT NULL,
 group_id INT UNSIGNED NULL,
 UNIQUE KEY registration_child(registration_id,name,date_of_birth),
 UNIQUE KEY event_child_identity(event_id,identity_key),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(registration_id) REFERENCES event_registrations(id),
 FOREIGN KEY(child_id) REFERENCES children(id),
 FOREIGN KEY(group_id) REFERENCES event_groups(id)
);
CREATE TABLE IF NOT EXISTS event_registration_attempts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 ip_hash CHAR(64) NOT NULL,
 attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX event_attempt_window(ip_hash,attempted_at)
);
CREATE TABLE IF NOT EXISTS event_child_sessions (
 child_id INT UNSIGNED NOT NULL,
 session_id INT UNSIGNED NOT NULL,
 PRIMARY KEY(child_id,session_id),
 FOREIGN KEY(child_id) REFERENCES event_children(id),
 FOREIGN KEY(session_id) REFERENCES event_sessions(id)
);
CREATE TABLE IF NOT EXISTS event_attendance (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 child_id INT UNSIGNED NOT NULL,
 session_id INT UNSIGNED NOT NULL,
 pickup_code CHAR(12) NOT NULL UNIQUE,
 checked_in_at DATETIME NOT NULL,
 checked_in_by INT UNSIGNED NOT NULL,
 picked_up_at DATETIME NULL,
 picked_up_by INT UNSIGNED NULL,
 collector_name VARCHAR(180) NULL,
 UNIQUE KEY event_arrival(child_id,session_id),
 FOREIGN KEY(child_id) REFERENCES event_children(id),
 FOREIGN KEY(session_id) REFERENCES event_sessions(id),
 FOREIGN KEY(checked_in_by) REFERENCES staff_users(id),
 FOREIGN KEY(picked_up_by) REFERENCES staff_users(id)
);
