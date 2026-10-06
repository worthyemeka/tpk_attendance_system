-- Additive; apply after v1 and staff authentication migrations. No existing roles change.
CREATE TABLE IF NOT EXISTS teacher_welfare_leads (
 staff_user_id INT UNSIGNED PRIMARY KEY, campus_id INT UNSIGNED NOT NULL,
 appointed_by INT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id), FOREIGN KEY(campus_id) REFERENCES campuses(id),
 FOREIGN KEY(appointed_by) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS teacher_services (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, campus_id INT UNSIGNED NOT NULL,
 kind ENUM('SUNDAY','MDWK') NOT NULL, name VARCHAR(150) NOT NULL,
 starts_at DATETIME NOT NULL, ends_at DATETIME NOT NULL, question VARCHAR(250) NOT NULL,
 answer_hashes_json JSON NOT NULL, qr_hash CHAR(64) NULL, qr_expires_at DATETIME NULL,
 created_by INT UNSIGNED NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY service_window(campus_id,kind,starts_at), INDEX campus_window(campus_id,ends_at),
 FOREIGN KEY(campus_id) REFERENCES campuses(id), FOREIGN KEY(created_by) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS teacher_service_expected (
 service_id INT UNSIGNED NOT NULL, staff_user_id INT UNSIGNED NOT NULL,
 PRIMARY KEY(service_id,staff_user_id), FOREIGN KEY(service_id) REFERENCES teacher_services(id),
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS teacher_service_attendance (
 service_id INT UNSIGNED NOT NULL, staff_user_id INT UNSIGNED NOT NULL,
 checked_in_at DATETIME NOT NULL,
 attendance_mode VARCHAR(12) NULL, PRIMARY KEY(service_id,staff_user_id),
 FOREIGN KEY(service_id) REFERENCES teacher_services(id), FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS teacher_signin_attempts (
 service_id INT UNSIGNED NOT NULL, staff_user_id INT UNSIGNED NOT NULL,
 attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0, window_started_at DATETIME NOT NULL,
 PRIMARY KEY(service_id,staff_user_id), FOREIGN KEY(service_id) REFERENCES teacher_services(id),
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS teacher_welfare_cases (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, service_id INT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL, assigned_to INT UNSIGNED NULL,
 status ENUM('NEEDS_FOLLOW_UP','ATTEMPTED','CONTACTED') NOT NULL DEFAULT 'NEEDS_FOLLOW_UP',
 note TEXT NULL, updated_by INT UNSIGNED NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY one_absence(service_id,staff_user_id),
 FOREIGN KEY(service_id) REFERENCES teacher_services(id), FOREIGN KEY(staff_user_id) REFERENCES staff_users(id),
 FOREIGN KEY(assigned_to) REFERENCES staff_users(id), FOREIGN KEY(updated_by) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS teacher_welfare_events (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, case_id INT UNSIGNED NOT NULL,
 actor_id INT UNSIGNED NOT NULL, action VARCHAR(40) NOT NULL, note TEXT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(case_id) REFERENCES teacher_welfare_cases(id),
 FOREIGN KEY(actor_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
