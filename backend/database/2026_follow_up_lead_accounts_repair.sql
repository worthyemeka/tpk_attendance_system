-- Completes account setup if a legacy teacher_profiles table still required a birth date.
USE tpk_attendance_system;

ALTER TABLE teacher_profiles MODIFY birth_date DATE NULL;

SET @campus_id := (SELECT id FROM campuses WHERE code = 'PETRA-WUSE' LIMIT 1);
SET @anayi_id := (SELECT id FROM staff_users WHERE campus_id=@campus_id AND email='anayi.dangbai@tpk.local' LIMIT 1);
SET @joyce_id := (SELECT id FROM staff_users WHERE campus_id=@campus_id AND email='joyce.afolabi@tpk.local' LIMIT 1);
SET @lois_id := (SELECT id FROM staff_users WHERE campus_id=@campus_id AND email='lois.adama@tpk.local' LIMIT 1);

UPDATE teacher_profiles SET password_hash='$2y$12$I6k9zwlDLmR2GL5OqZb/xO8Z5Ggn1UgMysgig4UnEUT072Ty2d5Ly' WHERE staff_user_id=@anayi_id;

INSERT INTO teacher_profiles (staff_user_id,title,first_name,last_name,birth_date,gender,marital_status,primary_phone,secondary_phone,residential_address,emergency_contact,emergency_relationship_phone,emergency_relationship,emergency_phone,password_hash,whatsapp_number,whatsapp_number_normalized,mobile_number,mobile_number_normalized,whatsapp_verified_at)
VALUES
  (@joyce_id,'Auntie','Joyce','Afolabi',NULL,'FEMALE','Not recorded','+2349080610769',NULL,'Not recorded','Not recorded','Not recorded',NULL,NULL,'$2y$12$59Qp34vQPkymOLvTtvhoxOFcbqalih2mEmS3QtwOCcoGdZaVRhVNK','+2349080610769','+2349080610769','+2349080610769','+2349080610769',NOW()),
  (@lois_id,'Auntie','Lois','Adama',NULL,'FEMALE','Not recorded','Not recorded',NULL,'Not recorded','Not recorded','Not recorded',NULL,NULL,'$2y$12$bsQ2fQhWxhnrjKr89n90w.Woqf/ib86sgmqO.bDHcYulMKqIBWuhy','Not recorded',NULL,NULL,NULL,NULL)
ON DUPLICATE KEY UPDATE
  title=VALUES(title),first_name=VALUES(first_name),last_name=VALUES(last_name),gender=VALUES(gender),password_hash=VALUES(password_hash),whatsapp_number=VALUES(whatsapp_number),whatsapp_number_normalized=VALUES(whatsapp_number_normalized),mobile_number=VALUES(mobile_number),mobile_number_normalized=VALUES(mobile_number_normalized),whatsapp_verified_at=VALUES(whatsapp_verified_at);

INSERT INTO staff_onboarding_profiles (staff_user_id,onboarding_status,probation_started_at,probation_target_weeks,onboarded_at)
VALUES (@joyce_id,'ONBOARDED',NULL,4,NOW()),(@lois_id,'ONBOARDED',NULL,4,NOW())
ON DUPLICATE KEY UPDATE onboarding_status='ONBOARDED',onboarded_at=COALESCE(onboarded_at,NOW());
