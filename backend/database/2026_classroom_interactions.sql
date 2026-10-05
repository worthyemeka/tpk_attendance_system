-- Additive only. Reconcile with tools/reconcile_classroom_interactions.php.
CREATE TABLE IF NOT EXISTS classroom_review_replies (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 review_id BIGINT UNSIGNED NOT NULL,
 body TEXT NOT NULL,
 created_by_staff_user_id INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX review_history (review_id,created_at,id),
 FOREIGN KEY (review_id) REFERENCES classroom_weekly_reviews(id),
 FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS classroom_review_reactions (
 review_id BIGINT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL,
 reaction ENUM('LIKE','APPLAUSE','HEART') NOT NULL,
 PRIMARY KEY (review_id,staff_user_id),
 FOREIGN KEY (review_id) REFERENCES classroom_weekly_reviews(id),
 FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS assembly_activity_media (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 activity_id BIGINT UNSIGNED NOT NULL,
 stored_name VARCHAR(100) NOT NULL,
 original_name VARCHAR(255) NOT NULL,
 mime_type VARCHAR(100) NOT NULL,
 byte_size INT UNSIGNED NOT NULL,
 created_by_staff_user_id INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX activity_media (activity_id,id),
 FOREIGN KEY (activity_id) REFERENCES assembly_activities(id),
 FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
