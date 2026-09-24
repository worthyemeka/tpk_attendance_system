# TribePetra Kids operational tables

This guide is the short list to use when operating or inspecting the live TPK system. The database is shared by Super Admins and Admins; access rules decide which rows each person can view. There are not separate Admin and Super Admin databases.

## Use these tables for current Sunday operations

| Area | Primary tables | What they hold |
| --- | --- | --- |
| Campus and classes | `campuses`, `classes`, `service_sessions` | The Wuse campus, age groups, and each open service. |
| Families and children | `families`, `guardians`, `children`, `child_guardians`, `authorized_pickups` | Parent/guardian records, child records, household links, and approved collectors. |
| Check-in approval, attendance and pickup | `check_in_requests`, `attendance`, `service_pickup_codes`, `pickup_code_notifications` | Parent requests awaiting the rostered Head of Service, approved check-ins, `TPK-A-001` / `TPK-B-001` codes, QR tickets, pickup completion, and delivery attempts. |
| Team | `staff_users`, `teacher_profiles`, `staff_sessions`, `staff_bootstrap_access` | One teacher identity uses two linked rows: `staff_users.id` is the secure account/session record and `teacher_profiles.staff_user_id` is the matching teacher profile. They are not two kinds of people. New TPK teachers always receive both rows. |
| Team management | `staff_class_assignments`, `roster_assignments`, `duty_types`, `staff_access_audits`, `staff_team_status_audits` | Classroom/roster responsibilities and accountable role or status changes. |
| Care and follow-up | `child_care_profiles`, `child_emergency_profiles`, `child_ministry_profiles`, `follow_up_tasks` | Safeguarding care details and ministry follow-up. |
| Accountability | `audit_logs`, `staff_whatsapp_verifications`, `service_report_dispatches` | Important action history, staff verification, and report delivery history. |

## Historical or compatibility tables — keep, do not use for new features

These are retained so that earlier prototypes and migration history are not broken. New application work must use the operational tables above instead. Legacy `staff_users` records without a matching `teacher_profiles` row are intentionally excluded from the live Team and roster screens.

- `family_passes`, `pickup_passes`, `pickup_notifications`, `pickup_events`
- `daily_attendance`, `calendar_years`, `calendar_months`, `calendar_weeks`
- `teachers`, `teacher_weekly_assignments`, `sunday_volunteer_assignments`
- `notifications`, `import_runs`, `import_issues`

They have not been deleted because deleting historical data or schema can make recovery impossible. After a full backup and a separate data-retention decision, they can be archived in a future maintenance migration.

## How live updates work

Every live page calls the same PHP API and database. A Super Admin receives campus-wide results. An Admin receives only the classes and records permitted by the current roster or class assignment. Parent registration or returning check-in creates a `check_in_requests` row first. The rostered Head of Service approves it, which then writes attendance and a service pickup code in one transaction. This keeps the parent, Check-In, Pick-Up, Team and Overview screens in sync without giving an unapproved arrival a pickup ticket.
