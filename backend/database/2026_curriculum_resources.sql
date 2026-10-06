-- Additive migration. Run before enabling curriculum uploads and video reactions.
CREATE TABLE IF NOT EXISTS curriculum_resources (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 campus_id INT UNSIGNED NOT NULL,
 class_id INT UNSIGNED NOT NULL,
 week_date DATE NULL,
 resource_type ENUM('LESSON','VIDEO','GAME') NOT NULL,
 title VARCHAR(180) NOT NULL,
 topic VARCHAR(180) NULL,
 description TEXT NULL,
 video_url VARCHAR(1000) NULL,
 duration_minutes SMALLINT UNSIGNED NULL,
 setting VARCHAR(180) NULL,
 materials TEXT NULL,
 instructions TEXT NULL,
 stored_name VARCHAR(100) NULL,
 original_name VARCHAR(255) NULL,
 mime_type VARCHAR(180) NULL,
 byte_size INT UNSIGNED NULL,
 created_by_staff_user_id INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX curriculum_scope(campus_id,class_id,week_date),
 FOREIGN KEY (campus_id) REFERENCES campuses(id),
 FOREIGN KEY (class_id) REFERENCES classes(id),
 FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS class_curriculum_profiles (
 class_id INT UNSIGNED PRIMARY KEY,
 description TEXT NULL,
 FOREIGN KEY(class_id) REFERENCES classes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assembly_activity_reactions (
 activity_id BIGINT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL,
 reaction ENUM('LIKE','APPLAUSE','HEART') NOT NULL,
 PRIMARY KEY(activity_id,staff_user_id),
 FOREIGN KEY(activity_id) REFERENCES assembly_activities(id) ON DELETE CASCADE,
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
