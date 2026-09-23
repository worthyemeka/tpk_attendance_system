# TribePetra Kids backend setup

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

Each successful parent registration or returning-parent check-in creates the family pickup code and sends it to the guardian's primary number and, where present, secondary number.

The staff Pick-Up desk accepts the code or QR first. If neither is available, an authenticated teacher can use the child’s first name, last name, and date of birth for an assisted lookup. This is separately audited as `ASSISTED_BIRTH_DATE`; it does not introduce a new pickup state and the teacher still reviews the checked-in children before completing the release.

For direct WhatsApp delivery through the same Meta account as teacher OTPs, create and approve the `tpk_pickup_code` utility template in `en_US` with this body:

```text
TribePetra Kids pickup code: {{1}}. Please show this code at the pickup station after service.
```

Set `WHATSAPP_PICKUP_TEMPLATE=tpk_pickup_code` and `WHATSAPP_PICKUP_LANGUAGE=en_US`. The backend uses `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` already configured for teacher verification; it never exposes them to the browser.

### SMS delivery with Termii

The pickup flow sends one SMS to every valid primary and secondary guardian number after a successful new-parent registration or returning-parent check-in. Numbers are normalised to Nigerian international format before sending.

In Termii, request a **transactional** SMS Sender ID for `TPK` (or the exact 3–11 character Sender ID that Termii approves). Use the Termii dashboard values in the server-only `.env` file:

```env
TERMII_BASE_URL="https://your-account-specific-termii-base-url"
TERMII_API_KEY="your-termii-api-key"
TERMII_SENDER_ID="TPK"
TERMII_SMS_CHANNEL="dnd"
```

Termii requires the `dnd` route to be activated on the account for reliable transactional delivery, including DND numbers. Until the Sender ID and DND route are approved, the application records the delivery failure in `pickup_code_notifications` without interrupting the parent check-in. Never place the Termii key in a `NEXT_PUBLIC_*` variable or commit it to Git.

`SMS_PICKUP_WEBHOOK` remains supported for a different SMS provider; it receives `{ to, message }`. In development, unconfigured sends are written to `backend/storage/pickup-code-notifications.log` instead. The same ticket link opens a printable QR ticket; parents can select **Save as PDF** in the browser print dialog.

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
