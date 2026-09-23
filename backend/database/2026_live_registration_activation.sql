-- Enables safe public parent registration on top of the existing TPK schema.
-- Existing records are preserved. A child without a configured age-class match
-- is saved with class_assignment_required=1 instead of being guessed into a class.
USE tpk_attendance_system;

ALTER TABLE children
  MODIFY COLUMN class_id INT UNSIGNED NULL;

ALTER TABLE families
  ADD COLUMN home_address TEXT NULL AFTER email;

ALTER TABLE guardians
  ADD COLUMN secondary_phone VARCHAR(40) NULL AFTER phone;
