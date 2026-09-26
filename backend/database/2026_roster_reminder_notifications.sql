-- A reminder is distinct from the original roster-published notice so a
-- teacher can be prompted again without overwriting their publication record.
USE tpk_attendance_system;

ALTER TABLE notifications
  MODIFY COLUMN type ENUM(
    'SERVICE_REPORT_READY',
    'FOLLOW_UP_REQUIRED',
    'PICKUP_WAITING',
    'CLASS_ASSIGNMENT_REQUIRED',
    'ROSTER_PUBLISHED',
    'ROSTER_REMINDER'
  ) NOT NULL;
