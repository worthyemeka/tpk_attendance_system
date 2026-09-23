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

## Import the General Info responses

Use a dry run first:

```sh
php backend/scripts/import_general_info.php "/path/to/Tribe Petra Kids General Info Form (Responses) - Form Responses.csv" --dry-run
```

Run again without `--dry-run` only after reviewing `import_issues`.

The supplied form has 113 response rows. Its historical Tribe values are `Tribe C (6-8)`, `Tribe B (8-12)`, `Tribe D (3-5)`, `Teenager`, and `Invalid Age`. They are intentionally not automatically mapped to the current classes because the ranges conflict with the present configuration. They import with `class_assignment_required = true` until leadership approves a mapping.

The workbook also contains historical monthly and teens-attendance sheets. They are preserved as source material; the General Info import handles the child/guardian/care data first, rather than treating old attendance labels as a current class configuration.

## Main v1 routes

All protected calls use `X-TPK-User-Id` until the browser token/session layer is introduced. Responses use `{ "success": true, "data": ... }` and failures use `{ "success": false, "error": { "code", "message" } }`.

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
- `PATCH /api/v1/staff/:staffUserId/access-level`

The public lookup returns only a guardian first name and the minimal child check-in state. Care, emergency and prayer data is not included in child-list or public responses.
