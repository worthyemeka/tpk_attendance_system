# Family chat and discussion pages — 24 November 2026

## Experience

- Messages → Family chats opens one shared staff conversation per family. Search by family or child; address a message to an active teacher or follow-up lead. The addressed teacher receives an in-app notification with a link to the family conversation.
- All active, verified regular TPK staff in the family's campus can read that history. The interface explicitly discloses this; it is not private direct messaging. Parents and event-only volunteers have no access.
- Family profiles and child follow-up details link to their family conversation.
- Discussions now has separate Classrooms, Assembly, Head of Service, and Door & Attendance sidebar pages. Existing review components, service filters, author controls and stored content are reused. The operational Classrooms page remains available; classroom details link to their discussions.

## API and persistence

Authenticated routes:

- GET /api/v1/family-chats?search=&page=1
- GET /api/v1/family-chats/staff
- GET /api/v1/family-chats/:familyId?before=messageId
- POST /api/v1/family-chats/:familyId/messages — body, recipientId, clientKey (UUID)
- POST /api/v1/family-chats/:familyId/read — lastMessageId

Additive migration: backend/scripts/migrate_family_chat.php --confirm.
Tables: family_chat_messages and family_chat_reads. Existing families, staff and notifications tables are reused. No existing reviews or family records are rewritten.

Messages preserve line breaks, render as text, and are limited to 4,000 characters. History is paged in groups of 50; families in groups of 40. A sender/client UUID prevents duplicate sends and duplicate notifications. A sender lock makes retry detection and the 30 messages/minute limit race-safe. Read cursors only advance and must refer to a message in that family. Campus scope and teacher eligibility are enforced server-side on every endpoint.

This first version supports text, not chat attachments or parent accounts. Conversations refresh every 8 seconds while visible; the family list every 10 seconds. Notifications use the existing in-app channel, without attempting WhatsApp delivery.

## Validation

- PHP syntax checks passed.
- 26 isolated database tests passed on the backend host, using temporary fixtures: access restrictions, campus isolation, recipients, history paging, unread/read behaviour, validation, retry dedupe, notification deep link and rate limit.
- Next production build and TypeScript checks passed. Existing unrelated lint warnings remain.
- Browser checks with sample API fixtures passed: message send, line breaks, teacher selection, family navigation, all four discussion pages, mobile overflow, both themes and no runtime errors. Screenshots visually checked.
- No real teacher messages or notifications were sent during tests.

## Release

Frontend target: worthy-s-notepad / tribepetra-kids, https://tribepetra-kids.vercel.app.
Backend: existing Oracle PHP/MySQL service, /var/www/tpk_attendance_system.

The live backend has other fixes beyond the repository version. Only the family-chat require, five routes and MESSAGE notification kind were patched into a fresh copy of live v1.php. Do not replace the full live backend with this checkout.

Production migration and targeted backend update completed. Private backup: /var/backups/tpk-family-chat-20261124.vZ77Ui (previous live v1.php and notifications dump). No new environment variables required. Existing WhatsApp billing/setup is unchanged.

Rollback: restore the backed-up live v1.php and previous frontend deployment. Leave the additive chat tables intact so any messages already received are preserved. Do not restore the notifications dump over newer notifications.
