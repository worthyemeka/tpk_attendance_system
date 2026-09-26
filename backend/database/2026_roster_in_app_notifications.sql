-- Persistent per-teacher roster notices. These are separate from WhatsApp
-- delivery, so every assigned teammate sees the published roster in-app.
USE tpk_attendance_system;

ALTER TABLE notifications
  MODIFY COLUMN type ENUM('SERVICE_REPORT_READY','FOLLOW_UP_REQUIRED','PICKUP_WAITING','CLASS_ASSIGNMENT_REQUIRED','ROSTER_PUBLISHED') NOT NULL,
  ADD COLUMN dedupe_key VARCHAR(190) NULL AFTER target_path,
  ADD UNIQUE KEY notifications_dedupe_key (dedupe_key),
  ADD KEY notifications_staff_created (staff_user_id, created_at);
