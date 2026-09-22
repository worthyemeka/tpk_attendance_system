USE tpk_attendance_system;
INSERT INTO campuses(name,code) VALUES ('Petra Wuse Campus','PETRA-WUSE');
SET @campus_id = LAST_INSERT_ID();
INSERT INTO classes(campus_id,name,age_label,color) VALUES
(@campus_id,'TribePetra Teens','Ages 13–17','#D6602B'),(@campus_id,'Tribe A','Ages 9–12','#F4A340'),(@campus_id,'Tribe B','Ages 5–8','#F9C74F'),(@campus_id,'Tribe C','Ages 3–4','#EB8E6C');
INSERT INTO staff_users(campus_id,name,email,role) VALUES (@campus_id,'Kemi Adeyemi','kemi@petrachurch.ng','ADMIN');
INSERT INTO service_sessions(campus_id,name,starts_at,is_open) VALUES (@campus_id,'Sunday Celebration',CONCAT(CURDATE(),' 09:00:00'),TRUE);
