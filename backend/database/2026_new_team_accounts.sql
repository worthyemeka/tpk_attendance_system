-- New TPK teacher accounts supplied on 25 September 2026.
-- This migration is intentionally idempotent: existing accounts and profiles are left untouched.
USE tpk_attendance_system;

SET @campus_id := (SELECT id FROM campuses WHERE name = 'Petra Wuse Campus' LIMIT 1);

INSERT INTO staff_users (campus_id, name, email, role, access_level, team_status, account_status, is_active)
SELECT @campus_id, 'Folakemi Ishola', 'isholafolakemi01@gmail.com', 'CLASS_LEADER', 'TPK_ADMIN', 'ACTIVE', 'VERIFIED', 1
WHERE NOT EXISTS (SELECT 1 FROM staff_users WHERE email = 'isholafolakemi01@gmail.com');

INSERT INTO staff_users (campus_id, name, email, role, access_level, team_status, account_status, is_active)
SELECT @campus_id, 'Emakpor Paul', 'emakporpaul8@gmail.com', 'CLASS_LEADER', 'TPK_ADMIN', 'ACTIVE', 'VERIFIED', 1
WHERE NOT EXISTS (SELECT 1 FROM staff_users WHERE email = 'emakporpaul8@gmail.com');

INSERT INTO staff_users (campus_id, name, email, role, access_level, team_status, account_status, is_active)
SELECT @campus_id, 'James Ahmadu', 'jamessamuel1200@gmail.com', 'CLASS_LEADER', 'TPK_ADMIN', 'ACTIVE', 'VERIFIED', 1
WHERE NOT EXISTS (SELECT 1 FROM staff_users WHERE email = 'jamessamuel1200@gmail.com');

SET @folakemi_id := (SELECT id FROM staff_users WHERE email = 'isholafolakemi01@gmail.com' LIMIT 1);
SET @emakpor_id := (SELECT id FROM staff_users WHERE email = 'emakporpaul8@gmail.com' LIMIT 1);
SET @james_id := (SELECT id FROM staff_users WHERE email = 'jamessamuel1200@gmail.com' LIMIT 1);

INSERT INTO teacher_profiles (
  staff_user_id, title, first_name, last_name, birth_date, gender, marital_status,
  primary_phone, residential_address, emergency_contact, emergency_relationship_phone,
  password_hash, profile_image_url
)
SELECT @folakemi_id, 'Auntie', 'Folakemi', 'Ishola', '2002-01-30', 'FEMALE', 'Not recorded',
  'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded',
  '$2y$12$Jf.DlOV1.St2qUnJZrg6q.6vPAG6NSoobICfayQs7ZKkq9YhZPZCa',
  '/uploads/profiles/folakemi-ishola.jpeg'
WHERE NOT EXISTS (SELECT 1 FROM teacher_profiles WHERE staff_user_id = @folakemi_id);

INSERT INTO teacher_profiles (
  staff_user_id, title, first_name, last_name, birth_date, gender, marital_status,
  primary_phone, residential_address, emergency_contact, emergency_relationship_phone,
  password_hash, profile_image_url
)
SELECT @emakpor_id, 'Uncle', 'Emakpor', 'Paul', '1994-08-26', 'MALE', 'Not recorded',
  'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded',
  '$2y$12$wIJy5c1VqgJHVMqxRC7ACeYXpKFXv30eDjGRSAtQhSsGqaLGhnl/.',
  '/uploads/profiles/emakpor-paul.jpeg'
WHERE NOT EXISTS (SELECT 1 FROM teacher_profiles WHERE staff_user_id = @emakpor_id);

INSERT INTO teacher_profiles (
  staff_user_id, title, first_name, last_name, birth_date, gender, marital_status,
  primary_phone, residential_address, emergency_contact, emergency_relationship_phone,
  password_hash, profile_image_url
)
SELECT @james_id, 'Uncle', 'James', 'Ahmadu', '2002-09-05', 'MALE', 'Not recorded',
  'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded',
  '$2y$12$Lm1esuctY5EFyix8WrkFseyADzOqziNQEWNehEV2Nv20ac2FkRlDK',
  '/uploads/profiles/james-ahmadu.jpg'
WHERE NOT EXISTS (SELECT 1 FROM teacher_profiles WHERE staff_user_id = @james_id);

INSERT IGNORE INTO staff_onboarding_profiles (staff_user_id, onboarding_status, probation_target_weeks, onboarded_at)
VALUES
  (@folakemi_id, 'ONBOARDED', 4, NOW()),
  (@emakpor_id, 'ONBOARDED', 4, NOW()),
  (@james_id, 'ONBOARDED', 4, NOW());
