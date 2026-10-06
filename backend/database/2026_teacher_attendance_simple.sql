-- Additive upgrade. Manual lead records remain for historical reference;
-- access is now determined only by the existing Teachers Welfare subunit.
ALTER TABLE teacher_services ADD COLUMN service_session_id INT UNSIGNED NULL,
 ADD UNIQUE KEY teacher_sunday_session(service_session_id),
 ADD CONSTRAINT teacher_sunday_session_fk FOREIGN KEY(service_session_id) REFERENCES service_sessions(id);
CREATE TABLE IF NOT EXISTS teacher_service_absence_reasons (
 service_id INT UNSIGNED NOT NULL, staff_user_id INT UNSIGNED NOT NULL,
 reason TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(service_id,staff_user_id),
 FOREIGN KEY(service_id) REFERENCES teacher_services(id),
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
