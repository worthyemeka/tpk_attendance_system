# Weekly first-timers and leadership follow-up assignments

Reports → First-timers shows every Sunday in the selected month, including empty and upcoming weeks. Filter to a Sunday or use all Sundays, and download the visible selection as CSV or a printable PDF. The monthly summary uses the same count.

A first-timer here means the child's earliest recorded Sunday attendance in the current campus, with CHECKED_IN, PICKUP_REQUESTED or PICKED_UP status. Multiple services and later visits do not count the child again. Registration alone, absent attendance, other campuses and event attendance do not qualify. Attendance predating the system's records cannot be inferred; this limitation is stated in the report.

GET /api/v1/reports/first-timers?year=2026&month=11 uses existing Super Admin report authorization and campus scoping. It returns month, total and weekly groups containing names, class and first service. It does not return contact information.

Family follow-up assignment now accepts active, verified Super Admins alongside teachers and Follow-Up Leads in the same campus. Super Admins are labelled Leader; Follow-Up Leads retain their own badge. Existing Follow-Up Lead and Super Admin assignment permissions remain. Assigning a follow-up changes the case/task owner, records the assignment and creates its existing notification. It never changes account access roles.

## Verification

- Production Next.js build and TypeScript checks passed.
- PHP lint passed for both changed backend files.
- scripts/tests/first-timers-followup.php uses a disposable MySQL database and synthetic fixtures; it validates week boundaries, empty weeks, deduplication, previous attendance, campus isolation, assignment persistence, badges and authorization. Requires local root socket access and creates/drops only tpk_firsttimer_test_20261125. No production records or notification deliveries are used.
- Browser checks with synthetic API fixtures cover filtering, CSV/PDF contents, desktop/mobile, event appearance, assignee badges and runtime errors.

## Deployment

No database migration is needed. Deploy backend/public/first-timers.php before the updated backend/public/v1.php. The production backend contains independent operational changes, so its v1.php was patched from the current live copy rather than replaced wholesale from the repository. The production update uses a file-hash guard and backup before installation and PHP-FPM reload. Push the frontend change to main for the tribepetra-kids Vercel deployment.

## Missing registration investigation

Read-only searches for Gracious (including partial grace/grac spelling) found no matching regular child, event child, audit entry or registration receipt. No child record was invented or restored without identifying information. A surname and approximate registration Sunday are still needed to continue tracing that report.
