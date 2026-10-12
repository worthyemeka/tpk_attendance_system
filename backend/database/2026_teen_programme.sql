-- Additive, event-specific self-registration; regular ministry records are unchanged.
CREATE TABLE IF NOT EXISTS event_teen_forms (
 event_id INT UNSIGNED PRIMARY KEY,
 slug VARCHAR(100) NOT NULL UNIQUE,
 min_age TINYINT UNSIGNED NOT NULL DEFAULT 11,
 max_age TINYINT UNSIGNED NOT NULL DEFAULT 19,
 rules TEXT NOT NULL,
 FOREIGN KEY(event_id) REFERENCES ministry_events(id)
);
CREATE TABLE IF NOT EXISTS event_teen_registration_details (
 child_id INT UNSIGNED PRIMARY KEY,
 school VARCHAR(180) NOT NULL,
 school_class VARCHAR(80) NOT NULL,
 whatsapp_number VARCHAR(40) NULL,
 rules_snapshot TEXT NOT NULL,
 rules_version CHAR(64) NOT NULL,
 guardian_permission_declared BOOLEAN NULL,
 accepted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(child_id) REFERENCES event_children(id)
);
