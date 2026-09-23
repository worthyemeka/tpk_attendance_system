CREATE TABLE IF NOT EXISTS teacher_profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  staff_user_id INT UNSIGNED NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  gender ENUM('FEMALE','MALE') NOT NULL,
  marital_status VARCHAR(40) NOT NULL,
  primary_phone VARCHAR(40) NOT NULL,
  secondary_phone VARCHAR(40) NULL,
  residential_address TEXT NOT NULL,
  emergency_contact VARCHAR(150) NOT NULL,
  emergency_relationship_phone VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id) ON DELETE CASCADE
);
