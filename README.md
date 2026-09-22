# TPK Attendance System

Next.js + TypeScript powers the interface; the active backend is **PHP + MySQL**.

## Child-centred attendance and follow-up

The system registers **children**. A family and guardian are created only as part of a child’s secure safeguarding record.

Attendance is tracked as `Year → Month → Week 1–4 → Day → Child`. When an admin closes First or Second Service, the system queues a private absent-child report for the relevant class team and creates follow-up tasks. Children missing two consecutive Sundays become high-priority call tasks.

Guardian phone numbers remain in guardian records. They are available only in a staff call-list view for teachers assigned to that class—not in dashboard alerts or exported task data.

The initial report delivery channel is the in-app queue. Email, SMS, or WhatsApp sending can be connected after the church chooses and configures its provider.

## Local setup

```bash
/Applications/XAMPP/xamppfiles/bin/mysql -u root < backend/database/schema.sql
/Applications/XAMPP/xamppfiles/bin/mysql -u root tpk_attendance_system < backend/database/seed.sql
/Applications/XAMPP/xamppfiles/bin/mysql -u root tpk_attendance_system < backend/database/2026_parent_flow.sql
/Applications/XAMPP/xamppfiles/bin/mysql -u root tpk_attendance_system < backend/database/2026_follow_up_reports.sql
```

Copy `.env.example` to `.env`, then run:

```bash
/Applications/XAMPP/xamppfiles/bin/php -S 127.0.0.1:8000 -t backend/public backend/public/router.php
npm install
npm run dev
```

Open `http://localhost:3000`.

## PHP routes

- `GET /api/classes`
- `GET, POST /api/families`
- `POST /api/attendance/check-in`
- `POST /api/attendance/tick`
- `POST /api/services/close` with optional `serviceSessionId` — queues the private absence report and closes the service
- `GET /api/calendar?year=2026&month=9`
- `GET /dashboard.php`
