-- Additive release: preserve existing event volunteers and attendance.
ALTER TABLE teacher_service_attendance ADD COLUMN attendance_mode VARCHAR(12) NULL;
CREATE TABLE IF NOT EXISTS event_volunteer_assignments (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id INT UNSIGNED NOT NULL,
 staff_user_id INT UNSIGNED NOT NULL,
 session_id INT UNSIGNED NULL,
 group_id INT UNSIGNED NULL,
 responsibility VARCHAR(120) NOT NULL,
 INDEX event_roster(event_id,session_id),
 FOREIGN KEY(event_id) REFERENCES ministry_events(id),
 FOREIGN KEY(staff_user_id) REFERENCES staff_users(id),
 FOREIGN KEY(session_id) REFERENCES event_sessions(id),
 FOREIGN KEY(group_id) REFERENCES event_groups(id)
);
INSERT INTO event_volunteer_assignments(event_id,staff_user_id,responsibility)
SELECT volunteer.event_id,volunteer.staff_user_id,
 CASE volunteer.duty WHEN 'LEAD' THEN 'Head of Service' WHEN 'CHECK_IN' THEN 'Attendance'
 WHEN 'PICKUP' THEN 'Pickup' ELSE 'Class Teacher' END
FROM event_volunteers volunteer
WHERE NOT EXISTS (SELECT 1 FROM event_volunteer_assignments assignment
 WHERE assignment.event_id=volunteer.event_id AND assignment.staff_user_id=volunteer.staff_user_id);
