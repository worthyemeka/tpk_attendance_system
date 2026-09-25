USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS classroom_weekly_reviews (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NOT NULL,
  worked_well TEXT NULL,
  needs_improvement TEXT NULL,
  created_by_staff_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY classroom_weekly_review_service (class_id, service_session_id, created_by_staff_user_id),
  INDEX classroom_weekly_reviews_scope (campus_id, class_id, service_session_id),
  CONSTRAINT classroom_weekly_reviews_class_fk FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT classroom_weekly_reviews_session_fk FOREIGN KEY (service_session_id) REFERENCES service_sessions(id),
  CONSTRAINT classroom_weekly_reviews_author_fk FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id)
);
