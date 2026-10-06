# TribePetra Kids backend setup

## Classes, curriculum and assembly video reactions

Apply `database/2026_curriculum_resources.sql` after the existing classroom/assembly migrations. It adds curriculum resources, class descriptions and activity reactions without changing attendance records. Until applied, class browsing still works and the UI disables uploads/reactions that need the new tables.

Curriculum uploads are Super Admin-only. Downloads and discussions require an active verified staff session at the same campus; roster membership is not required for browsing or discussion replies. Publishing a classroom review and creating assembly notes/activities still require the existing service permissions.

Allow the PHP service to create/write `backend/storage/curriculum` (private, not web-served). For 20 MB attachments, set `upload_max_filesize` to at least `20M` and `post_max_size` to at least `24M`. Serve documents through the authenticated `/api/v1/curriculum/resources/{id}/file` endpoint only. Back up this private directory alongside the database. PDF is preferred; DOCX/PPTX validation needs PHP ZipArchive.

Isolated verification (no live database): `php scripts/test_curriculum.php`, `php scripts/test_shared_classroom_access.php`, and `php scripts/test_assembly_history_reactions.php`, run from this backend directory. Frontend calendar/automatic-placement checks: `node scripts/test-curriculum.cjs` from the repository root.

The existing application uses PHP with PDO and MySQL. API v1 extends that setup; it does not introduce a second ORM or replace the parent check-in API.

## Apply the migration

Run the existing database files first, then apply `database/v1_migration.sql` once.

Before assigning the first Super Admins, identify their verified `staff_users.id` values. Set the access level with those IDs, not with name comparisons:

```sql
UPDATE staff_users
SET access_level = 'TPK_SUPER_ADMIN'
WHERE id IN (<Courage ID>, <Mafo ID>, <Muyiwa ID>);
```

New teachers are created as `TPK_ADMIN` and inactive. A Super Admin activates them after approval. The teacher-login response includes the staff-user ID used by the protected v1 API.

### Staff and Super Admin foundation

After the prior teacher and v1 migrations, apply `database/2026_staff_admin_foundation.sql` once. It adds the shared teacher registration fields, normalised WhatsApp identifiers, verification/session records, profile-photo reference, team status, and audited access/status controls.

Apply `database/2026_meeting_decisions_alignment.sql` after that migration. It safely changes the teacher-facing title from the old `Aunty` spelling to the agreed `Auntie` label while preserving existing profiles.

It also seeds the three approved bootstrap Super Admin WhatsApp identifiers. Those values are only read by the verification backend; they are never sent to the frontend or used as credentials.

For WhatsApp OTP verification, create an approved Meta template named `teacher_verification_code` with language `en_US` and this body:

```text
Hi {{1}}, your TribePetra Kids verification code is {{2}}. It expires in 10 minutes. Do not share this code.
```

Set `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFICATION_TEMPLATE`, and `WHATSAPP_VERIFICATION_LANGUAGE` in `.env`. The original `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_ACCESS_TOKEN`, and `META_WHATSAPP_GRAPH_API_VERSION` names are also accepted for compatibility. The access token is server-only; never use a `NEXT_PUBLIC_*` variable or commit it. Registration sends the OTP through `POST /api/teachers/register`, and the teacher verifies it through `POST /api/teachers/verify` with `{ "email": "...", "code": "123456" }`.

Protected v1 endpoints now require `Authorization: Bearer <staff session token>` rather than a caller-supplied staff ID.

## Service pickup codes and tickets

Apply `database/2026_service_pickup_codes.sql` after `2026_parent_flow.sql`. Every family receives one fresh code for each service session: First Service uses `TPK-A-001` upward and Second Service uses `TPK-B-001` upward. The counter is scoped to that service, so it starts again for the next Sunday.

Each approved parent check-in creates the family pickup code and a printable QR ticket. The ticket is the primary parent hand-off: it opens on the parent’s device and can be saved as a PDF or shared with the pickup adult. No SMS or WhatsApp account is required for a family to collect a child.

The staff Pick-Up desk accepts the code or QR first. If neither is available, an authenticated teacher can use the child’s first name, last name, and date of birth for an assisted lookup. This is separately audited as `ASSISTED_BIRTH_DATE`; it does not introduce a new pickup state and the teacher still reviews the checked-in children before completing the release.

### Optional future provider delivery

TPK currently uses PDF/QR tickets only. SMS and WhatsApp delivery are disabled by default, so an unapproved provider cannot create failed delivery records or affect check-in. To enable either option later, set this server-only variable only after the ministry has an approved provider sender or template:

```env
TPK_PICKUP_NOTIFICATIONS_ENABLED=true
```

For optional direct WhatsApp delivery through the same Meta account as teacher OTPs, create and approve the `tpk_pickup_code` utility template in `en_US` with this body:

```text
TribePetra Kids pickup code: {{1}}. Please show this code at the pickup station after service.
```

Set `WHATSAPP_PICKUP_TEMPLATE=tpk_pickup_code` and `WHATSAPP_PICKUP_LANGUAGE=en_US`. The backend uses `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` already configured for teacher verification; it never exposes them to the browser.

### Optional SMS delivery with Termii

When provider delivery is explicitly enabled, the pickup flow sends one SMS to every valid primary and secondary guardian number after the Head of Service approves check-in. Numbers are normalised to Nigerian international format before sending.

In Termii, request a **transactional** SMS Sender ID for `TPK` (or the exact 3–11 character Sender ID that Termii approves). Use the Termii dashboard values in the server-only `.env` file:

```env
TERMII_BASE_URL="https://your-account-specific-termii-base-url"
TERMII_API_KEY="your-termii-api-key"
TERMII_SENDER_ID="TPK"
TERMII_SMS_CHANNEL="dnd"
```

Termii requires the `dnd` route to be activated on the account for reliable transactional delivery, including DND numbers. Keep `TPK_PICKUP_NOTIFICATIONS_ENABLED=false` until the Sender ID and DND route are approved. Never place the Termii key in a `NEXT_PUBLIC_*` variable or commit it to Git.

`SMS_PICKUP_WEBHOOK` remains supported for a different SMS provider; it receives `{ to, message }`. The same ticket link opens a printable QR ticket; parents can select **Save as PDF** in the browser print dialog.

## Import the General Info responses

Use a dry run first:

```sh
php backend/scripts/import_general_info.php "/path/to/Tribe Petra Kids General Info Form (Responses) - Form Responses.csv" --dry-run
```

Run again without `--dry-run` only after reviewing `import_issues`.

The supplied form has 113 response rows. Its historical Tribe values are `Tribe C (6-8)`, `Tribe B (8-12)`, `Tribe D (3-5)`, `Teenager`, and `Invalid Age`. They are intentionally not automatically mapped to the current classes because the ranges conflict with the present configuration. They import with `class_assignment_required = true` until leadership approves a mapping.

The workbook also contains historical monthly and teens-attendance sheets. They are preserved as source material; the General Info import handles the child/guardian/care data first, rather than treating old attendance labels as a current class configuration.

## Main v1 routes

All protected calls use `Authorization: Bearer <staff-session-token>`. Responses use `{ "success": true, "data": ... }` and failures use `{ "success": false, "error": { "code", "message" } }`.

- `GET /api/v1/dashboard/overview`
- `GET /api/v1/children?search=&classId=&gender=&active=&classAssignmentRequired=&sort=&order=&page=&limit=`
- `GET|PATCH /api/v1/children/:childId`
- `GET /api/v1/classes`, `GET|PATCH /api/v1/classes/:classId`, `POST /api/v1/classes`
- `GET /api/v1/guardians`, `GET|PATCH /api/v1/guardians/:guardianId`
- `GET /api/v1/children/:childId/guardians`
- `GET|PATCH /api/v1/children/:childId/{care-profile|emergency-profile|ministry-profile}`
- `POST /api/v1/public/check-in/lookup`
- `GET /api/v1/service-sessions/current`, `GET /api/v1/service-sessions`, `GET|PATCH /api/v1/service-sessions/:id`
- `GET /api/v1/roster`, `GET /api/v1/me/roster`, `GET /api/v1/me/assignments/{today|upcoming}`
- `POST /api/v1/roster/assignments/:assignmentId/confirm-presence`
- `GET /api/v1/pickup-codes?code=TPK-A-001-or-QR-token`
- `POST /api/v1/pickup-codes/assisted-lookup` with `{ firstName, lastName, dateOfBirth }`
- `POST /api/v1/pickup-codes/:pickupCodeId/complete` with an audited verification method
- `PATCH /api/v1/staff/:staffUserId/access-level`

The public lookup returns only a guardian first name and the minimal child check-in state. Care, emergency and prayer data is not included in child-list or public responses.

## Teacher service attendance and welfare

Apply `backend/database/2026_teacher_attendance.sql`, then `2026_teacher_attendance_simple.sql`, before releasing the matching frontend and backend. The upgrade links Sunday attendance to the existing Sunday schedule and adds private Wednesday absence reasons. Preserve a database backup and existing attendance/history when linking legacy services. Manual lead records are retained as history but no longer grant access.

Sunday services are synchronised from Sunday Schedule, including each configured service’s name and times. Each Sunday service has separate attendance, as requested. Wednesday MDWK is automatic: teachers confirm their own attendance from Overview before **21:00 Africa/Lagos**, with no QR or security question. After the deadline, an unsigned teacher is absent and can submit a private absence reason. Only that teacher, Super Admins and active Teachers Welfare subunit members can read it; ordinary follow-up assignees and public registers never receive it.

Every verified ACTIVE or PROBATION teacher is expected, irrespective of roster assignments. Newly active teachers are included while a session remains open. Past services are not invented or backfilled. Run `backend/scripts/finalize_teacher_attendance.php` once a minute from the server scheduler to prepare today’s register and queue absentee follow-ups after closing, even when no dashboard is open. Attendance reads also queue cases idempotently.

Only Super Admins or active **Teachers Welfare** subunit members can display/refresh the Sunday QR or assign follow-up calls. There is no separate lead appointment step. A regular teacher can see the register and update only their assigned follow-ups. Super Admins set Sunday questions; accepted answers are entered as visible removable badges, while answers and QR tokens remain hashed in storage. QR links expire after five minutes (or service close), and accounts are limited to five wrong answers per fifteen minutes. Changing the question invalidates the existing QR. QR plus a shared question discourages remote sign-in but cannot prove physical presence: attendees can still share both with someone off-site.

Children's Check-In is readable by all campus teachers. Parent-request approval, desk tools and pickup-ticket bearer links remain restricted to authorised operators; widening register visibility does not widen approval rights.

The curriculum frontend falls back to the existing class directory only when the server returns `ROUTE_NOT_FOUND`. This notice is not a replacement for deploying the curriculum backend and its required database changes; uploads remain unavailable until that release is complete.

Run isolated checks without database credentials or production writes:

```sh
php backend/scripts/test_teacher_attendance.php
php backend/scripts/test_checkin_visibility.php
```

For a real-MySQL smoke check after deploying the tables, run `TPK_MYSQL_SMOKE=1 php backend/scripts/test_teacher_attendance_mysql.php`. It reads curriculum/classes and verifies configured Sunday linking, MDWK’s 9pm cutoff, private reasons, repeated attendance, absence and subunit-based follow-up permissions using connection-local temporary attendance, schedule and assignment tables. It does not create staff sessions or persistent attendance/welfare records; it is not a substitute for HTTP authentication tests. The test skips unless explicitly enabled.

### Events & Conferences and current age groups

Apply `2026_events.sql` before releasing the events router. Event guests, session selections, groups, volunteers, arrivals and pickups are separate records and never create permanent host-campus child profiles or Sunday attendance. Only a Super Admin creates, publishes or duplicates events. Public registration links expose programme details, not existing family records. Returning-family lookup is staff-assisted; assigned leads/check-in/pickup operators can access event care/contact records, while ordinary teachers see the programme and counts.

`TPK_MYSQL_SMOKE=1 php backend/scripts/test_events_mysql.php` uses temporary tables to check event registration, age groups, duplicate protection, operator permissions, safe pickup, duplication and the real assembly-history service schema. It makes no persistent diagnostic event or attendance records.

Apply `2026_class_age_ranges.sql` with a private backup. Current ranges are Tribe C 3–5, Tribe B 6–8, Tribe A 9–11 and TribePetra Teens 12–19. Current active child placement should be recalculated from birthdays in Africa/Lagos, not historical attendance.class_id. Preserve a placement snapshot for rollback and leave missing/invalid/out-of-range birthdays for manual review.
