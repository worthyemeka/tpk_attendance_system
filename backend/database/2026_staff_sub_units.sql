-- Leadership-managed ministry Sub Units. These are separate from platform access
-- levels: every person remains a TPK Teacher, while Super Admins assign the
-- responsibilities that sit alongside their weekly roster duties.
USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS ministry_sub_units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  campus_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_staff_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ministry_sub_unit (campus_id, name),
  KEY idx_ministry_sub_units_campus (campus_id),
  CONSTRAINT fk_ministry_sub_units_campus FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
  CONSTRAINT fk_ministry_sub_units_created_by FOREIGN KEY (created_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS staff_sub_unit_assignments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  staff_user_id INT UNSIGNED NOT NULL,
  sub_unit_id INT UNSIGNED NOT NULL,
  assigned_by_staff_user_id INT UNSIGNED NULL,
  assigned_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_sub_unit (staff_user_id, sub_unit_id),
  KEY idx_staff_sub_unit_staff (staff_user_id),
  KEY idx_staff_sub_unit_unit (sub_unit_id),
  CONSTRAINT fk_staff_sub_unit_staff FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_sub_unit_unit FOREIGN KEY (sub_unit_id) REFERENCES ministry_sub_units(id) ON DELETE CASCADE,
  CONSTRAINT fk_staff_sub_unit_assigned_by FOREIGN KEY (assigned_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @campus_id := (SELECT id FROM campuses WHERE name = 'Petra Wuse Campus' LIMIT 1);
SET @super_admin_id := (SELECT id FROM staff_users WHERE campus_id = @campus_id AND access_level = 'TPK_SUPER_ADMIN' AND is_active = 1 ORDER BY id LIMIT 1);

INSERT INTO ministry_sub_units (campus_id, name, description, created_by_staff_user_id)
VALUES
  (@campus_id, 'Children & Parent Relations', 'Coordinates communication with children and parents, welfare needs, feedback, escalations, practical support and birthday celebrations.', @super_admin_id),
  (@campus_id, 'Media & Publicity', 'Captures ministry activities and supports photographs, video, social media, publicity, event promotion and timely updates.', @super_admin_id),
  (@campus_id, 'Technical', 'Supports digital learning tools, technical resources, presentations, lessons and ministry events.', @super_admin_id),
  (@campus_id, 'Missions', 'Coordinates mission and outreach activity, discipleship support and participation for children and teachers.', @super_admin_id),
  (@campus_id, 'Teachers Welfare', 'Supports teachers with resources, encouragement, appreciation, birthday celebrations and welfare needs.', @super_admin_id),
  (@campus_id, 'Inventory', 'Manages teaching materials and supplies, maintains usage records and ensures resources remain available.', @super_admin_id),
  (@campus_id, 'Creativity & Decoration', 'Develops creative ideas, crafts and visual materials, and helps create welcoming ministry spaces.', @super_admin_id),
  (@campus_id, 'Program & Events', 'Plans and coordinates ministry programmes and events, including logistics, timelines and delivery.', @super_admin_id),
  (@campus_id, 'Finance', 'Maintains transparent financial records and supports responsible use and disbursement of ministry funds.', @super_admin_id),
  (@campus_id, 'TribePetra Teens', 'Coordinates programmes, events, calendar planning, parent communication and pastoral connection for teens.', @super_admin_id)
ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = TRUE;

-- Assign only teachers already present in the Wuse team directory. Names that
-- are not yet in the database deliberately receive no assignment.
INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'Children & Parent Relations'
  AND s.email IN ('bolaji1504@gmail.com', 'afolabijoyce2@gmail.com', 'lois.adama@tpk.local', 'anayi.dangbai@tpk.local');

INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'Media & Publicity'
  AND s.email IN ('isholafolakemi01@gmail.com', 'emakporpaul8@gmail.com');

INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'Technical' AND s.email = 'worthychukwuemeka@gmail.com';

INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'Missions' AND s.email = 'jamessamuel1200@gmail.com';

INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'Creativity & Decoration' AND s.email = 'heaven.i.courage@gmail.com';

INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'Program & Events' AND s.email = 'preciousadamese@gmail.com';

INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'Finance' AND s.email = 'bolaji1504@gmail.com';

INSERT IGNORE INTO staff_sub_unit_assignments (staff_user_id, sub_unit_id, assigned_by_staff_user_id)
SELECT s.id, u.id, @super_admin_id
FROM staff_users s JOIN ministry_sub_units u ON u.campus_id = s.campus_id
WHERE s.campus_id = @campus_id AND u.name = 'TribePetra Teens' AND s.email = 'wonuola.ajayi@tpk.local';
