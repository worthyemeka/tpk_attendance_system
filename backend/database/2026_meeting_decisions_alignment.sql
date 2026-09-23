-- September 22 meeting alignment. Apply once after 2026_staff_admin_foundation.sql.
-- Keep the teacher registration label consistent with the agreed “Auntie / Uncle”.
ALTER TABLE teacher_profiles
  MODIFY COLUMN title ENUM('Aunty','Auntie','Uncle') NULL;

UPDATE teacher_profiles SET title='Auntie' WHERE title='Aunty';

ALTER TABLE teacher_profiles
  MODIFY COLUMN title ENUM('Auntie','Uncle') NULL;
