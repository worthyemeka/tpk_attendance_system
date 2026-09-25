-- Approved regular-admin demonstration profiles for the TPK team directory.
-- This keeps unknown profile facts empty or explicitly marked as not recorded.
USE tpk_attendance_system;

ALTER TABLE teacher_profiles
  MODIFY birth_date DATE NULL;

SET @campus_id := (SELECT id FROM campuses WHERE code = 'PETRA-WUSE' LIMIT 1);

-- Worthy already has a record. Preserve her existing details while correcting
-- the supplied WhatsApp number, photo, and active regular-admin status.
UPDATE staff_users
SET access_level = 'TPK_ADMIN', team_status = 'ACTIVE', account_status = 'VERIFIED', is_active = 1
WHERE campus_id = @campus_id AND name = 'Worthy Chukwuemeka';

UPDATE teacher_profiles p
JOIN staff_users s ON s.id = p.staff_user_id
SET p.title = 'Auntie',
    p.gender = 'FEMALE',
    p.whatsapp_number = '+2347018143041',
    p.whatsapp_number_normalized = '+2347018143041',
    p.mobile_number = '+2347018143041',
    p.mobile_number_normalized = '+2347018143041',
    p.profile_image_url = '/uploads/profiles/auntie-worthy-chukwuemeka.jpg',
    p.whatsapp_verified_at = NOW()
WHERE s.campus_id = @campus_id AND s.name = 'Worthy Chukwuemeka';

-- Ana'ayi’s login is available through her supplied WhatsApp number. Profile
-- fields not provided by leadership stay explicitly unrecorded for completion.
INSERT INTO staff_users (campus_id, name, email, role, access_level, team_status, account_status, is_active)
VALUES (@campus_id, 'Ana''ayi Dangbai', 'anayi.dangbai@tpk.local', 'VIEWER', 'TPK_ADMIN', 'ACTIVE', 'VERIFIED', 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name), access_level = 'TPK_ADMIN', team_status = 'ACTIVE', account_status = 'VERIFIED', is_active = 1;

SET @anayi_id := (SELECT id FROM staff_users WHERE campus_id = @campus_id AND email = 'anayi.dangbai@tpk.local' LIMIT 1);

INSERT INTO teacher_profiles (
  staff_user_id, title, first_name, last_name, birth_date, gender, marital_status,
  primary_phone, secondary_phone, residential_address, emergency_contact,
  emergency_relationship_phone, password_hash, whatsapp_number,
  whatsapp_number_normalized, mobile_number, mobile_number_normalized,
  profile_image_url, whatsapp_verified_at
) VALUES (
  @anayi_id, 'Auntie', 'Ana''ayi', 'Dangbai', NULL, 'FEMALE', 'Not recorded',
  '+2348132220779', NULL, 'Not recorded', 'Not recorded', 'Not recorded',
  '$2y$12$0GZkxUEotizP23XewVffZOvnJxBSBo.CoBWaq1CNFZeTXQNZHsCA.',
  '+2348132220779', '+2348132220779', '+2348132220779', '+2348132220779',
  '/uploads/profiles/auntie-anayi-dangbai.png', NOW()
) ON DUPLICATE KEY UPDATE
  title = VALUES(title), first_name = VALUES(first_name), last_name = VALUES(last_name),
  gender = VALUES(gender), primary_phone = VALUES(primary_phone),
  whatsapp_number = VALUES(whatsapp_number), whatsapp_number_normalized = VALUES(whatsapp_number_normalized),
  mobile_number = VALUES(mobile_number), mobile_number_normalized = VALUES(mobile_number_normalized),
  profile_image_url = VALUES(profile_image_url), whatsapp_verified_at = VALUES(whatsapp_verified_at);

INSERT INTO staff_onboarding_profiles (staff_user_id, onboarding_status, probation_started_at, probation_target_weeks, onboarded_at)
VALUES (@anayi_id, 'ONBOARDED', NULL, 4, NOW())
ON DUPLICATE KEY UPDATE onboarding_status = 'ONBOARDED', onboarded_at = COALESCE(onboarded_at, NOW());
