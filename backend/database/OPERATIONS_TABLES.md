# TribePetra Kids operational tables

This guide is the short list to use when operating or inspecting the live TPK system. The database is shared by Super Admins and Admins; access rules decide which rows each person can view. There are not separate Admin and Super Admin databases.

## Use these tables for current Sunday operations

| Area | Primary tables | What they hold |
| --- | --- | --- |
| Campus and classes | `campuses`, `classes`, `service_sessions` | The Wuse campus, age groups, and each open service. |
| Families and children | `families`, `guardians`, `children`, `child_guardians`, `authorized_pickups` | Parent/guardian records, child records, household links, and approved collectors. |
| Attendance and pickup | `attendance`, `service_pickup_codes`, `pickup_code_notifications` | Check-ins, `TPK-A-001` / `TPK-B-001` codes, QR tickets, pickup completion, and delivery attempts. |
| Team | `staff_users`, `teacher_profiles`, `staff_sessions`, `staff_bootstrap_access` | Teacher identity, the shared sign-in, profile information, and the three initial Super Admin recognitions. |
| Team management | `staff_class_assignments`, `roster_assignments`, `duty_types`, `staff_access_audits`, `staff_team_status_audits` | Classroom/roster responsibilities and accountable role or status changes. |
| Care and follow-up | `child_care_profiles`, `child_emergency_profiles`, `child_ministry_profiles`, `follow_up_tasks` | Safeguarding care details and ministry follow-up. |
| Accountability | `audit_logs`, `staff_whatsapp_verifications`, `service_report_dispatches` | Important action history, staff verification, and report delivery history. |

## Historical or compatibility tables — keep, do not use for new features

These are retained so that earlier prototypes and migration history are not broken. New application work must use the operational tables above instead.

- `family_passes`, `pickup_passes`, `pickup_notifications`, `pickup_events`
- `daily_attendance`, `calendar_years`, `calendar_months`, `calendar_weeks`
- `teachers`, `teacher_weekly_assignments`, `sunday_volunteer_assignments`
- `notifications`, `import_runs`, `import_issues`

They have not been deleted because deleting historical data or schema can make recovery impossible. After a full backup and a separate data-retention decision, they can be archived in a future maintenance migration.

## How live updates work

Every live page calls the same PHP API and database. A Super Admin receives campus-wide results. An Admin receives only the classes and records permitted by the current roster or class assignment. Parent registration writes a family, guardian, children, attendance and a service pickup code in one transaction, so the parent, Check-In, Pick-Up, Team and Overview screens stay in sync.
