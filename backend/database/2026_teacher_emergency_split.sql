-- Keeps the existing legacy field for compatibility while storing each value separately.
USE tpk_attendance_system;
ALTER TABLE teacher_profiles
  ADD COLUMN emergency_relationship VARCHAR(100) NULL AFTER emergency_contact,
  ADD COLUMN emergency_phone VARCHAR(40) NULL AFTER emergency_relationship;
