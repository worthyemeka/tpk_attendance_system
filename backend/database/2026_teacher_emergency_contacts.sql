USE tpk_attendance_system;

CREATE TABLE IF NOT EXISTS teacher_emergency_contacts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  teacher_profile_id INT UNSIGNED NOT NULL,
  contact_name VARCHAR(150) NOT NULL,
  relationship VARCHAR(80) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY one_emergency_contact_per_teacher (teacher_profile_id),
  FOREIGN KEY (teacher_profile_id) REFERENCES teacher_profiles(id) ON DELETE CASCADE
);
