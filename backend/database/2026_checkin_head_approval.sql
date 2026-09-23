-- Parent check-in requests are intentionally separate from attendance.
-- A child is marked CHECKED_IN and receives a pickup code only after the
-- rostered Head of Service approves the request for that service.
USE tpk_attendance_system;

CREATE TABLE check_in_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  service_session_id INT UNSIGNED NOT NULL,
  family_id INT UNSIGNED NOT NULL,
  guardian_id INT UNSIGNED NOT NULL,
  child_ids_json JSON NOT NULL,
  pickup_details_json JSON NULL,
  request_token CHAR(64) NOT NULL,
  status ENUM('PENDING','APPROVED','DECLINED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME NULL,
  approved_by_staff_user_id INT UNSIGNED NULL,
  pickup_code_id BIGINT UNSIGNED NULL,
  decision_note VARCHAR(500) NULL,
  UNIQUE KEY one_checkin_request_token (request_token),
  KEY checkin_request_session_status (service_session_id, status, requested_at),
  KEY checkin_request_family_service (family_id, service_session_id),
  CONSTRAINT fk_checkin_request_campus FOREIGN KEY (campus_id) REFERENCES campuses(id),
  CONSTRAINT fk_checkin_request_session FOREIGN KEY (service_session_id) REFERENCES service_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkin_request_family FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkin_request_guardian FOREIGN KEY (guardian_id) REFERENCES guardians(id) ON DELETE CASCADE,
  CONSTRAINT fk_checkin_request_approver FOREIGN KEY (approved_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_checkin_request_pickup_code FOREIGN KEY (pickup_code_id) REFERENCES service_pickup_codes(id) ON DELETE SET NULL
);

ALTER TABLE attendance
  ADD COLUMN check_in_request_id BIGINT UNSIGNED NULL AFTER service_session_id,
  ADD KEY attendance_checkin_request (check_in_request_id),
  ADD CONSTRAINT fk_attendance_checkin_request FOREIGN KEY (check_in_request_id) REFERENCES check_in_requests(id) ON DELETE SET NULL;
