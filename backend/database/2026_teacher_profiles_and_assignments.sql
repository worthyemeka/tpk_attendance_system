USE tpk_attendance_system;

CREATE TABLE teachers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campus_id INT UNSIGNED NOT NULL,
  staff_user_id INT UNSIGNED NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  gender ENUM('FEMALE','MALE','UNSPECIFIED') NOT NULL DEFAULT 'UNSPECIFIED',
  phone VARCHAR(40) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campus_id) REFERENCES campuses(id) ON DELETE CASCADE,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
);

CREATE TABLE teacher_weekly_assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_id INT UNSIGNED NOT NULL,
  class_id INT UNSIGNED NULL,
  week_start DATE NOT NULL,
  assignment ENUM('CHECK_IN','PICK_UP','TRIBEPETRA_TEENS','TRIBE_A','TRIBE_B','TRIBE_C','TRIBE_D') NOT NULL,
  assigned_by_staff_user_id INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_teacher_assignment_per_week (teacher_id, week_start, assignment),
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by_staff_user_id) REFERENCES staff_users(id) ON DELETE SET NULL
);

INSERT INTO teachers (campus_id, staff_user_id, first_name, last_name, gender)
SELECT s.campus_id, s.id, 'Kemi', 'Adeyemi', 'FEMALE'
FROM staff_users s
WHERE s.email = 'kemi@petrachurch.ng'
  AND NOT EXISTS (SELECT 1 FROM teachers t WHERE t.staff_user_id = s.id);
