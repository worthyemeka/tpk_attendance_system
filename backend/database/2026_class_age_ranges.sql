-- Keep historical attendance.class_id unchanged. Current child placement is
-- updated by the checked, backed-up release script using their birth dates.
UPDATE classes SET min_age=3,max_age=5,age_label='Ages 3–5' WHERE name='Tribe C';
UPDATE classes SET min_age=6,max_age=8,age_label='Ages 6–8' WHERE name='Tribe B';
UPDATE classes SET min_age=9,max_age=11,age_label='Ages 9–11' WHERE name='Tribe A';
UPDATE classes SET min_age=12,max_age=19,age_label='Ages 12–19' WHERE name='TribePetra Teens';
