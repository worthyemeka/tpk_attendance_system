-- Additive only; preserves all assembly notes and classroom reactions.
CREATE TABLE IF NOT EXISTS assembly_note_reactions (
 note_id BIGINT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL,
 reaction ENUM('LIKE','APPLAUSE','HEART') NOT NULL,
 PRIMARY KEY (note_id,staff_user_id),
 FOREIGN KEY (note_id) REFERENCES assembly_notes(id) ON DELETE CASCADE,
 FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
