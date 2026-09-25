-- Assistant service leadership, staff inactivity audit details, and the
-- service taught for each probation-week record.
USE tpk_attendance_system;

ALTER TABLE staff_users
  ADD COLUMN inactive_reason VARCHAR(500) NULL AFTER team_status,
  ADD COLUMN inactive_at DATETIME NULL AFTER inactive_reason,
  ADD COLUMN inactive_by_staff_user_id INT UNSIGNED NULL AFTER inactive_at,
  ADD CONSTRAINT fk_staff_inactive_by FOREIGN KEY (inactive_by_staff_user_id)
    REFERENCES staff_users(id) ON DELETE SET NULL;

ALTER TABLE staff_probation_weekly_logs
  ADD COLUMN service_type ENUM('FIRST_SERVICE','SECOND_SERVICE') NULL AFTER service_date;

INSERT INTO duty_types (name, code, category, requires_class, description)
VALUES
  ('Assistant Head of Service 1', 'ASSISTANT_HEAD_OF_SERVICE_1', 'SECOND_SERVICE', FALSE, 'Supports the Head of Service and can operate check-in and pickup.'),
  ('Assistant Head of Service 2', 'ASSISTANT_HEAD_OF_SERVICE_2', 'SECOND_SERVICE', FALSE, 'Supports the Head of Service and can operate check-in and pickup.')
ON DUPLICATE KEY UPDATE
  name = VALUES(name), category = VALUES(category), requires_class = VALUES(requires_class),
  description = VALUES(description), active = TRUE;
