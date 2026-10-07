# TribePetra Kids backend setup

## Historical and live events

Apply `database/2026_events.sql` and the existing event-volunteer-assignment migration first. Back up the database and private storage, then run `php backend/scripts/migrate_event_history.php --confirm` from the repository root. The new `database/2026_event_history.sql` migration is additive and resumable; MySQL DDL is not transactional. Deploy the matching PHP routes and frontend together. PHP needs PDO MySQL, mbstring and fileinfo. Set upload limits to at least 25 MB per file and 30 MB per request. Make `backend/storage/event-resources` writable by PHP, mode 0750; files are 0640. It must not be served by nginx or committed to Git. Include it in encrypted/restricted backups.

The migration extends events, registrations, event children, sessions, volunteer membership and the existing staff account/profile model. It creates:

- `event_days`, `event_registration_contacts`, `event_historical_attendance`, `event_registration_cards`
- `event_source_files`, `event_curriculum_resources`, `event_curriculum_targets`, `event_programme_activities`
- `event_import_batches`, `event_import_rows`, `event_reported_statistics`
- `event_volunteer_attendance`, `event_account_invitations`, `event_appearances`, `staff_appearance_preferences`
- `event_roster_people`, `event_roster_assignments`, `event_roster_groups`, `event_roster_group_members` for source-only historical volunteers and class/rotation relationships

Seven Abuja home campuses are seeded by stable campus code, preserving existing campus names. A child's event home campus can be edited independently of their Sunday family record. Events have an IANA timezone. Published lifecycle is derived from inclusive local event dates (upcoming/live/completed); archived/draft/cancelled are explicit states. Past dates never prevent saving or publication. Historical attendance is not live check-in or a pickup queue.

### Routes and permissions

Existing event list/detail/save, registration, groups, sessions, volunteers and reports remain in use. New routes are:

- `POST /api/v1/events/{event}/days`
- `POST /api/v1/events/{event}/curriculum`
- `POST /api/v1/events/{event}/files`; `GET /api/v1/events/{event}/files/{file}`
- `PATCH /api/v1/events/{event}/children/{child}` (home campus)
- `PATCH /api/v1/events/{event}/roster-people/{person}` (explicit archive-only identity link; never grants access)
- `POST /api/v1/events/{event}/volunteer-registration`
- `POST /api/v1/events/{event}/volunteer-attendance`
- `POST /api/v1/public/event-account/setup`
- `POST /api/v1/events/{event}/appearance`; `GET/PATCH /api/v1/me/appearance`
- `POST /api/v1/events/{event}/imports`; `GET /api/v1/events/{event}/imports/{batch}`
- `PATCH /api/v1/events/{event}/imports/{batch}/row`; `POST /api/v1/events/{event}/imports/{batch}/commit`

Event administration, archival imports and original attendance-source downloads require a host-campus Super Admin. Existing staff accounts are reused by ID or email without changing passwords or general access. New people get `EVENT_VOLUNTEER`, never TPK Admin access. They are pending until a hashed, single-use, 48-hour invitation is consumed. The invitation link contains a fragment token (not a URL query); share it privately. Importing volunteers does not import passwords; issue setup invitations from Volunteer Registration afterward.

Event-only accounts use `/account/event-volunteer`, not the Sunday dashboard. Server permissions restrict them to assigned published/completed/archived events, assignment-scoped sessions/groups/resources, appearance settings and their own live-session attendance. They cannot read children/guardians, import data, change events, or perform child desk check-in/pickup. CHECK_IN/PICKUP/LEAD are event responsibilities; child desk operation is still for existing authorised staff, not a general-access grant to a newly registered volunteer. Curriculum downloads require a matching assignment across all constrained target dimensions. Original attendance PDFs are not exposed to volunteers. Existing teacher sign-in and 48-hour inactivity expiry are reused.

### Source-grounded VBS 2026 backfill

The confirmed dates are **24–29 August 2026**, theme **The Great Jungle Journey**. The source-specific adapter `scripts/extract_vbs_2026.py` reads the three supplied PDFs plus `--roster=/private/path/Daily roaster VBS.pdf`. It uses table geometry and vector checkbox marks, not guessed text alignment, and writes a private structured JSON package. Do not commit that package: it contains child/guardian medical and contact data. The source package keeps stable row keys, original hashes, raw values and page references.

Run `php backend/scripts/backfill_vbs_2026.php --package=/private/path/package.json --source-dir=/private/path/pdfs --admin-id=HOST_SUPER_ADMIN_ID` for a dry run. Add `--confirm` to create/reuse the archived event, six dated days, historical groups, thirteen curriculum resources, both proposed programmes, printed statistics, four protected original PDFs and a review batch. Attendance is not imported by default: use Reports → Import ready rows, or add `--import-ready` only with explicit approval to commit clear rows while leaving flagged rows pending. Re-running the same source package reuses the event, resources and batch.

Imports stage raw JSON for provenance but commit to relational child registrations, contacts, daily attendance, cards and assignments. A batch is locked during commit. `confirm:true, readyOnly:true` imports clear rows and leaves a PARTIAL batch for unresolved source ambiguities; retrying does not reimport imported rows. Complete imports are idempotent. Core children/families/guardians and Sunday attendance are never edited by this flow. Core people can be linked explicitly; automatic linking requires an exact child-name plus unique normalised guardian-phone match, never name alone. Uncertain matches remain event-specific guests rather than duplicate core people.

The attendance PDF has 76 source rows and printed daily drop-off totals of 62, 64, 61, 65, 65 and 63. Three rows need review: one unclear age and two conflicting rows for the same child. They remain pending, not silently merged. Birth dates, live pickup codes, arrival times and actual volunteer attendance are not fabricated. Food is a whole-event checkbox unless a source explicitly supplies a daily value. Unknown campus strings and missing contacts remain raw/unknown.

The twelve-page volunteer roster supplies 94 planned activity rows, six day leads, 8:00 AM call time, four Bible classes (Teenagers, Tribe A, Tribe B, Tribe C & D), and two rotation groups with relational class memberships. The same day's Bible teachers are also assigned craft, explicitly from page 12. Planned daily sessions use roster times in Africa/Lagos. Source identities are stored separately without accounts because the roster supplies no email, phone, campus or credentials. First-name/alias matches are not guessed; confirmed identities can be linked manually to existing staff without granting membership or authentication. The ambiguous “Jennifer Anyaji” source block remains flagged. Saturday's roster ends at 13:00, while the separate proposed finale outline ends at 14:30: both are preserved, not reconciled by guessing. The historical age-banded groups Tribe D (2–4) and Tribe C (5–8) remain separate from the roster's combined class labels; unknown age bands are never invented.

### Appearance and verification

Super Admins select Default TPK or a Jungle preset, optional supplied HTTPS artwork, an event-local enable flag and a dashboard-period enable flag. Settings offers Default TPK (the default) or Event appearance. The dashboard layer applies only during a published event's local dates, automatically falls back afterward, and never replaces logo artwork or parent check-in styling. The archive may retain its local Jungle appearance without recolouring today's dashboard.

Frontend changes include `events-workspace`, `event-history-panels`, `event-historical-attendance`, `event-historical-roster`, `event-volunteer-dashboard`, `dashboard-appearance` and their scoped styles. Added pages are `/account/event-volunteer` and `/event-volunteer/setup`; Settings, account guards, the app shell and teacher sign-in now respect event-only access and appearance preferences. Existing event pages gain Curriculum, historical Attendance, planned volunteer roster, report/import review and volunteer registration panels. All selects use the existing shared dropdown.

Verification: run `TPK_MYSQL_SMOKE=1 php backend/scripts/test_events_mysql.php` and `TPK_MYSQL_SMOKE=1 php backend/scripts/test_event_accounts_mysql.php` only against the configured development/backend database. They use connection-local temporary event/account tables, not persistent diagnostic people. Run the production Next.js build plus existing session, eligibility, dropdown and simple sign-in regressions. Take a backup before applying schema changes; restoring schema/data from that backup is the rollback strategy, not destructive down-migrations against archive records.

### Approved production rollout — 7 October 2026

The live backend was backed up before deployment, then the resumable migration and matching PHP routes were applied. The protected database/backend snapshot is under `/var/backups/tpk/event-history-20261007-1` (root-only). PHP upload limits are now 25M per file / 30M per request. Existing server changes were preserved; deployment used a checked, scoped patch rather than resetting or pulling the shared server checkout.

VBS 2026 was backfilled as historical event 2, initially Archived. A subsequent event save published it; its date-derived lifecycle correctly remains Completed. All four originals are attached in private storage with matching SHA-256 checksums. Batch 1 contains **73 imported child registration records and 3 pending source rows**, six dated days and six planned daily sessions. The curriculum has 13 resources. The daily roster preserves 94 activities, 153 planned role assignments, 43 source identity labels, four Bible class labels and two rotation groups; the earlier 12 proposed finale activities are separately retained. Source labels are not a verified headcount. No volunteer accounts or actual volunteer attendance were invented.

Three merged doctor/contact source entries are retained in `event_registration_contacts.source_text`, without guessing a phone number from clinic names or record numbers. One merged address cell is likewise not copied into a phone field. The unresolved age and conflicting duplicate attendance rows remain pending. The Saturday end-time discrepancy and ambiguous volunteer aliases remain visible for review.

Persistent core counts were checked against the pre-rollout snapshot: children 53, families 30, guardians 30, staff users 21, Sunday attendance 67 and live event attendance 0 — all unchanged. The previous event was retained. Temporary-table MySQL checks passed (72 event checks and 12 account checks), private source access and event-only permission boundaries were checked, and the historical roster's filters, pagination and contained horizontal scrolling were visually verified with synthetic preview data.

The final production Next.js build and session/registration/shared-dropdown regressions passed. Vercel confirmed deployment success, the production event page serves the historical roster component, and unauthenticated event/PDF requests return 401. Retrying the original approved package imported zero additional rows and zero additional programme activities; counts and source checksums remained unchanged. Verification did not use or impersonate a real staff browser session.

For another production instance: apply the existing event prerequisites, take a restricted backup, run `migrate_event_history.php --confirm`, deploy the matching routes/frontend, set private storage ownership and upload limits, and review a dry-run import before explicitly committing ready rows. No further manual migration is required on the approved live backend. Keep source PDFs/packages out of Git and public storage; include event private storage in ongoing restricted backups. Historical identity review does not activate accounts: collect confirmed email/contact details and issue individual setup invitations when access is actually needed.

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

Sunday attendance now uses a single **I’m here** confirmation (`attended: true`). There is no question or question-setup screen. Authentication, campus scope, service closing times and self-only attendance remain enforced on the server; repeat taps do not create duplicate attendance. Legacy question/QR fields and administrative compatibility endpoints are retained without changing historical records, but are not part of the current sign-in flow. Confirmation is self-reported attendance, not proof of physical location.

Only Super Admins or active **Teachers Welfare** subunit members can assign follow-up calls. There is no separate lead appointment step. A regular teacher can see the register and update only their assigned follow-ups. Missed sign-ins still become welfare cases after the service closes; authorised welfare staff can assign someone to contact the teacher and record the outcome.

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
