-- Additive event history. Run scripts/migrate_event_history.php (resumable DDL).
ALTER TABLE staff_users MODIFY access_level ENUM('TPK_SUPER_ADMIN','TPK_FOLLOW_UP_ADMIN','TPK_ADMIN','EVENT_VOLUNTEER') NOT NULL DEFAULT 'TPK_ADMIN';
ALTER TABLE teacher_profiles MODIFY gender ENUM('FEMALE','MALE') NULL;
ALTER TABLE teacher_profiles MODIFY birth_date DATE NULL;
ALTER TABLE ministry_events ADD COLUMN theme_name VARCHAR(180) NULL;
ALTER TABLE ministry_events ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Lagos';
ALTER TABLE ministry_events ADD COLUMN theme_song_url VARCHAR(1000) NULL;
ALTER TABLE ministry_events ADD COLUMN archived_at DATETIME NULL;
ALTER TABLE event_registrations ADD COLUMN home_campus_id INT UNSIGNED NULL;
ALTER TABLE event_registrations ADD COLUMN guardian_id INT UNSIGNED NULL;
ALTER TABLE event_registrations ADD COLUMN home_address TEXT NULL;
ALTER TABLE event_registrations ADD COLUMN alternate_phone VARCHAR(40) NULL;
ALTER TABLE event_registrations MODIFY guardian_phone VARCHAR(40) NULL;
ALTER TABLE event_registrations MODIFY emergency_phone VARCHAR(40) NULL;
ALTER TABLE event_children MODIFY date_of_birth DATE NULL;
ALTER TABLE event_children ADD COLUMN home_campus_id INT UNSIGNED NULL;
ALTER TABLE event_children ADD COLUMN reported_age TINYINT UNSIGNED NULL;
ALTER TABLE event_children ADD COLUMN age_qualifier VARCHAR(30) NULL;
ALTER TABLE event_children ADD COLUMN gender VARCHAR(20) NULL;
ALTER TABLE event_children ADD COLUMN scholarship BOOLEAN NULL;
ALTER TABLE event_children ADD COLUMN food BOOLEAN NULL;
ALTER TABLE event_children ADD COLUMN source_key VARCHAR(180) NULL;
ALTER TABLE event_volunteers ADD COLUMN home_campus_id INT UNSIGNED NULL;
ALTER TABLE event_volunteers ADD COLUMN membership_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
CREATE TABLE IF NOT EXISTS event_days (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL,
 day_number SMALLINT UNSIGNED NOT NULL, label VARCHAR(120) NOT NULL, calendar_date DATE NOT NULL,
 UNIQUE KEY event_day_number(event_id,day_number), UNIQUE KEY event_day_date(event_id,calendar_date),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id)
);
ALTER TABLE event_sessions ADD COLUMN day_id INT UNSIGNED NULL;
ALTER TABLE event_registrations ADD CONSTRAINT event_registration_campus_fk FOREIGN KEY(home_campus_id) REFERENCES campuses(id);
ALTER TABLE event_registrations ADD CONSTRAINT event_registration_guardian_fk FOREIGN KEY(guardian_id) REFERENCES guardians(id);
ALTER TABLE event_children ADD CONSTRAINT event_child_campus_fk FOREIGN KEY(home_campus_id) REFERENCES campuses(id);
ALTER TABLE event_volunteers ADD CONSTRAINT event_volunteer_campus_fk FOREIGN KEY(home_campus_id) REFERENCES campuses(id);
ALTER TABLE event_sessions ADD CONSTRAINT event_session_day_fk FOREIGN KEY(day_id) REFERENCES event_days(id);
CREATE TABLE IF NOT EXISTS event_registration_contacts (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, registration_id INT UNSIGNED NOT NULL,
 child_id INT UNSIGNED NULL, contact_type VARCHAR(20) NOT NULL,
 name VARCHAR(180) NULL, phone VARCHAR(40) NULL, relationship VARCHAR(120) NULL,
 FOREIGN KEY(registration_id) REFERENCES event_registrations(id), FOREIGN KEY(child_id) REFERENCES event_children(id)
);
CREATE TABLE IF NOT EXISTS event_historical_attendance (
 child_id INT UNSIGNED NOT NULL, day_id INT UNSIGNED NOT NULL,
 present BOOLEAN NULL, picked_up BOOLEAN NULL, food BOOLEAN NULL,
 source_key VARCHAR(180) NOT NULL, recorded_by INT UNSIGNED NOT NULL,
 PRIMARY KEY(child_id,day_id), FOREIGN KEY(child_id) REFERENCES event_children(id),
 FOREIGN KEY(day_id) REFERENCES event_days(id), FOREIGN KEY(recorded_by) REFERENCES staff_users(id)
);
ALTER TABLE event_registration_contacts ADD COLUMN source_text TEXT NULL;
CREATE TABLE IF NOT EXISTS event_registration_cards (
 child_id INT UNSIGNED NOT NULL, day_id INT UNSIGNED NOT NULL, card_number VARCHAR(50) NOT NULL,
 PRIMARY KEY(child_id,day_id), FOREIGN KEY(child_id) REFERENCES event_children(id), FOREIGN KEY(day_id) REFERENCES event_days(id)
);
CREATE TABLE IF NOT EXISTS event_source_files (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL,
 original_name VARCHAR(255) NOT NULL, stored_name VARCHAR(100) NOT NULL, mime_type VARCHAR(100) NOT NULL,
 byte_size INT UNSIGNED NOT NULL, sha256 CHAR(64) NOT NULL, uploaded_by INT UNSIGNED NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY event_source(event_id,sha256),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id), FOREIGN KEY(uploaded_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_curriculum_resources (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL,
 title VARCHAR(180) NOT NULL, resource_type VARCHAR(30) NOT NULL, description TEXT NULL,
 content MEDIUMTEXT NULL, external_url VARCHAR(1000) NULL, source_file_id INT UNSIGNED NULL,
 source_page_start SMALLINT UNSIGNED NULL, source_page_end SMALLINT UNSIGNED NULL,
 min_age TINYINT UNSIGNED NULL, max_age TINYINT UNSIGNED NULL,
 created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 INDEX event_resource_type(event_id,resource_type), FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(source_file_id) REFERENCES event_source_files(id), FOREIGN KEY(created_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_curriculum_targets (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, resource_id INT UNSIGNED NOT NULL,
 day_id INT UNSIGNED NULL, session_id INT UNSIGNED NULL, group_id INT UNSIGNED NULL,
 INDEX resource_target(resource_id,day_id,session_id,group_id),
 FOREIGN KEY(resource_id) REFERENCES event_curriculum_resources(id), FOREIGN KEY(day_id) REFERENCES event_days(id),
 FOREIGN KEY(session_id) REFERENCES event_sessions(id), FOREIGN KEY(group_id) REFERENCES event_groups(id)
);
CREATE TABLE IF NOT EXISTS event_curriculum_blocks (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, resource_id INT UNSIGNED NOT NULL,
 position SMALLINT UNSIGNED NOT NULL, block_type VARCHAR(20) NOT NULL,
 text_content MEDIUMTEXT NULL, image_file_id INT UNSIGNED NULL, caption VARCHAR(1000) NULL,
 UNIQUE KEY resource_block_order(resource_id,position), INDEX note_picture(image_file_id),
 FOREIGN KEY(resource_id) REFERENCES event_curriculum_resources(id),
 FOREIGN KEY(image_file_id) REFERENCES event_source_files(id)
);
CREATE TABLE IF NOT EXISTS event_programme_activities (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL, day_id INT UNSIGNED NOT NULL,
 session_id INT UNSIGNED NULL, group_id INT UNSIGNED NULL, title VARCHAR(180) NOT NULL,
 starts_at TIME NULL, ends_at TIME NULL, notes TEXT NULL, sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 FOREIGN KEY(event_id) REFERENCES ministry_events(id), FOREIGN KEY(day_id) REFERENCES event_days(id),
 FOREIGN KEY(session_id) REFERENCES event_sessions(id), FOREIGN KEY(group_id) REFERENCES event_groups(id)
);
CREATE TABLE IF NOT EXISTS event_import_batches (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL, source_name VARCHAR(255) NOT NULL,
 source_hash CHAR(64) NOT NULL, import_kind VARCHAR(20) NOT NULL, state VARCHAR(20) NOT NULL DEFAULT 'PREVIEW',
 created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, committed_at DATETIME NULL,
 UNIQUE KEY event_import_source(event_id,source_hash,import_kind),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id), FOREIGN KEY(created_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_import_rows (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, batch_id INT UNSIGNED NOT NULL, source_key VARCHAR(180) NOT NULL,
 payload JSON NOT NULL, issues JSON NOT NULL, resolution VARCHAR(20) NOT NULL DEFAULT 'PENDING',
 event_child_id INT UNSIGNED NULL, staff_user_id INT UNSIGNED NULL,
 UNIQUE KEY batch_source_row(batch_id,source_key), FOREIGN KEY(batch_id) REFERENCES event_import_batches(id),
 FOREIGN KEY(event_child_id) REFERENCES event_children(id), FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_volunteer_attendance (
 event_id INT UNSIGNED NOT NULL, staff_user_id INT UNSIGNED NOT NULL, session_id INT UNSIGNED NOT NULL,
 checked_in_at DATETIME NOT NULL, recorded_by INT UNSIGNED NOT NULL,
 PRIMARY KEY(event_id,staff_user_id,session_id), FOREIGN KEY(event_id,staff_user_id) REFERENCES event_volunteers(event_id,staff_user_id),
 FOREIGN KEY(session_id) REFERENCES event_sessions(id), FOREIGN KEY(recorded_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_account_invitations (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, staff_user_id INT UNSIGNED NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL, used_at DATETIME NULL,
 created_by INT UNSIGNED NOT NULL, FOREIGN KEY(staff_user_id) REFERENCES staff_users(id), FOREIGN KEY(created_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS event_appearances (
 event_id INT UNSIGNED PRIMARY KEY, preset VARCHAR(30) NOT NULL DEFAULT 'DEFAULT',
 enabled BOOLEAN NOT NULL DEFAULT FALSE, apply_dashboard BOOLEAN NOT NULL DEFAULT FALSE,
 artwork_url VARCHAR(1000) NULL, updated_by INT UNSIGNED NOT NULL,
 FOREIGN KEY(event_id) REFERENCES ministry_events(id), FOREIGN KEY(updated_by) REFERENCES staff_users(id)
);
CREATE TABLE IF NOT EXISTS staff_appearance_preferences (
 staff_user_id INT UNSIGNED PRIMARY KEY, preference VARCHAR(20) NOT NULL DEFAULT 'DEFAULT',
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
);
ALTER TABLE event_appearances ADD COLUMN preserve_after BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE event_appearances ADD COLUMN palette_json JSON NULL;
ALTER TABLE event_appearances ADD COLUMN artwork_file_id INT UNSIGNED NULL;
ALTER TABLE event_appearances ADD CONSTRAINT fk_event_appearance_artwork FOREIGN KEY(artwork_file_id) REFERENCES event_source_files(id);
ALTER TABLE staff_appearance_preferences ADD COLUMN selected_event_id INT UNSIGNED NULL;
ALTER TABLE staff_appearance_preferences ADD CONSTRAINT fk_staff_preferred_event FOREIGN KEY(selected_event_id) REFERENCES ministry_events(id);
CREATE TABLE IF NOT EXISTS event_reported_statistics (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL,
 day_id INT UNSIGNED NULL, metric VARCHAR(40) NOT NULL, reported_value INT UNSIGNED NOT NULL,
 source_file_id INT UNSIGNED NOT NULL, source_page SMALLINT UNSIGNED NOT NULL,
 FOREIGN KEY(event_id) REFERENCES ministry_events(id), FOREIGN KEY(day_id) REFERENCES event_days(id),
 FOREIGN KEY(source_file_id) REFERENCES event_source_files(id)
);
-- Historical class/rotation labels have no invented age bands or live routing.
CREATE TABLE IF NOT EXISTS event_roster_groups (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL,
 name VARCHAR(120) NOT NULL, kind VARCHAR(20) NOT NULL,
 UNIQUE KEY event_roster_group(event_id,name), FOREIGN KEY(event_id) REFERENCES ministry_events(id)
);
CREATE TABLE IF NOT EXISTS event_roster_group_members (
 rotation_id INT UNSIGNED NOT NULL, class_id INT UNSIGNED NOT NULL,
 PRIMARY KEY(rotation_id,class_id), FOREIGN KEY(rotation_id) REFERENCES event_roster_groups(id),
 FOREIGN KEY(class_id) REFERENCES event_roster_groups(id)
);
CREATE TABLE IF NOT EXISTS event_roster_people (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL,
 source_name VARCHAR(180) NOT NULL, source_key CHAR(64) NOT NULL,
 staff_user_id INT UNSIGNED NULL, review_required BOOLEAN NOT NULL DEFAULT FALSE,
 UNIQUE KEY roster_person(event_id,source_key), FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
);
ALTER TABLE event_programme_activities ADD COLUMN source_key VARCHAR(180) NULL;
ALTER TABLE event_programme_activities ADD COLUMN source_file_id INT UNSIGNED NULL;
ALTER TABLE event_programme_activities ADD COLUMN source_page SMALLINT UNSIGNED NULL;
ALTER TABLE event_programme_activities ADD COLUMN roster_group_id INT UNSIGNED NULL;
ALTER TABLE event_programme_activities ADD COLUMN responsible_raw TEXT NULL;
ALTER TABLE event_programme_activities ADD CONSTRAINT event_programme_source_key UNIQUE(event_id,source_key);
ALTER TABLE event_programme_activities ADD CONSTRAINT event_programme_source_fk FOREIGN KEY(source_file_id) REFERENCES event_source_files(id);
ALTER TABLE event_programme_activities ADD CONSTRAINT event_programme_roster_group_fk FOREIGN KEY(roster_group_id) REFERENCES event_roster_groups(id);
CREATE TABLE IF NOT EXISTS event_roster_assignments (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, event_id INT UNSIGNED NOT NULL,
 person_id INT UNSIGNED NOT NULL, day_id INT UNSIGNED NOT NULL,
 activity_id INT UNSIGNED NULL, roster_group_id INT UNSIGNED NULL,
 responsibility VARCHAR(180) NOT NULL, call_time TIME NULL,
 source_file_id INT UNSIGNED NOT NULL, source_page SMALLINT UNSIGNED NOT NULL,
 INDEX roster_day(event_id,day_id), FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(person_id) REFERENCES event_roster_people(id), FOREIGN KEY(day_id) REFERENCES event_days(id),
 FOREIGN KEY(activity_id) REFERENCES event_programme_activities(id), FOREIGN KEY(roster_group_id) REFERENCES event_roster_groups(id),
 FOREIGN KEY(source_file_id) REFERENCES event_source_files(id)
);
