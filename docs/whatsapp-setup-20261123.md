# TPK WhatsApp setup — 23 November 2026

## Release status

The notification backend is installed on the existing PHP/MySQL server. The frontend is on https://tribepetra-kids.vercel.app in Worthy's Notepad. WhatsApp delivery remains **disabled**: Meta rejected the attempted payment methods, and production credentials, approved templates and the webhook subscription still need connecting. No live WhatsApp messages were sent during this work.

The connected sender is +2347025108723. Its phone ID is 1379607118561724, WhatsApp business account ID is 1980350105897058 (currently labelled TPK Wuse Campus in Meta), and Meta app ID is 1778733113320787. Do not use the separate empty WhatsApp account. Existing WhatsApp Business phone-app continuity was not changed by this release.

## What runs now

- Notifications remain in the existing MySQL `notifications` table. In-app notices are saved before optional channel decisions; provider failures cannot undo a roster publication or follow-up assignment.
- Roster publication creates one notice per recipient/month. The template contains the month, assignment summary and roster link. Re-publishing the same month does not resend the original notice.
- A changed child/family follow-up owner receives a notice linking directly to the case. A changed teacher welfare assignee receives a notice linking to the welfare tab, case and month. Messages do not include child details or welfare notes.
- On Sundays, the scheduler checks every five minutes from 06:00 to before 12:00 in the campus timezone, while a scheduled service has not ended. Active verified teachers receive at most one sign-in reminder per day. Teachers already checked in are excluded, and attendance is checked again immediately before sending. This follows the existing all-teacher Sunday sign-in policy, rather than roster eligibility.
- Birthdays are processed from 08:00 local time. The birthday teacher receives a greeting; other active verified teachers in that campus receive an announcement. No age or birth year is included. Birthday and Sunday messages expire rather than being sent late on another day.
- No MDWK attendance behavior was changed. Existing unrelated service, event and onboarding workflows were preserved. Additional notification/template types are supported by the shared mapping, but this release adds triggers only for the four use cases above.

## Preferences and consent

Settings → Notifications includes WhatsApp consent, a channel switch and category preferences, including Team birthdays. New users are **not** automatically opted into WhatsApp. The channel and consent must both be enabled; Sunday and birthday categories require their own opt-in. Roster and follow-up categories default on only after channel consent. Essential in-app notices cannot be disabled. Active status, phone format, consent and category preferences are checked both when queuing and before sending. Withdrawing consent skips pending WhatsApp messages. The status clearly says WhatsApp is turned off while setup is pending.

Push and email settings remain present; this release does not activate unconfigured providers. Existing email/verification workflows are not replaced.

## Remaining Meta setup

1. Resolve the rejected payment method in WhatsApp Manager for account 1980350105897058. Meta's displayed error was “Billing card not usable”; it did not identify whether the rejection came from the issuer or Meta. Ask the issuer about international online/recurring charges, or contact Meta billing support with the error and time of the attempt. Keep card details out of chat and application configuration.
2. Submit the five templates below in English (`en`). Use positional body variables and sample values. Meta determines their final category/approval; birthday messages may be treated as marketing. Do not claim approval until it is visible in Meta.
3. Set up an appropriately scoped production system-user token with access to this WhatsApp account and the required WhatsApp messaging/management permissions. Store the token and app secret only in the backend environment, never in browser code or `NEXT_PUBLIC_*` variables.
4. Generate a random webhook verification token, save it in the backend environment, and enter the same value in Meta. Set the callback to `https://tribepetra-kids.vercel.app/api/v1/webhooks/meta/whatsapp`. Subscribe to `messages` for the correct WhatsApp account. Publish the app and complete any Meta requirements shown for production delivery.
5. Enable a controlled test only with an explicitly authorized test recipient: set the flags below, use a consented account/category, and send an approved template. Verify SENT then DELIVERED/READ via the signed webhook. Return the test-send switch to false afterwards.
6. Enable live WhatsApp only after billing, credentials, approvals, consent and the end-to-end test work. Disabled-period deliveries are recorded as SKIPPED and will **not** suddenly send a backlog. New eligible actions will queue normally.

## Environment

Configure on the PHP backend (the frontend forwards `/api/*` to it):

```dotenv
WHATSAPP_ENABLED=false
WHATSAPP_PROVIDER=META
TPK_FRONTEND_URL=https://tribepetra-kids.vercel.app
META_WHATSAPP_ACCESS_TOKEN=
META_WHATSAPP_PHONE_NUMBER_ID=1379607118561724
META_WHATSAPP_BUSINESS_ACCOUNT_ID=1980350105897058
META_WHATSAPP_WEBHOOK_VERIFY_TOKEN=
META_APP_SECRET=
META_WHATSAPP_GRAPH_API_VERSION=v25.0
META_WHATSAPP_TEMPLATE_LANGUAGE=en
WHATSAPP_TEST_MODE=true
WHATSAPP_ALLOW_TEST_SEND=false
WHATSAPP_TEST_RECIPIENT=
```

The sender IDs and frontend URL are configured; the secret fields are not. For a controlled test, both WHATSAPP_ENABLED and WHATSAPP_ALLOW_TEST_SEND must be true; TEST_MODE redirects eligible messages to the configured test recipient. The normal recipient still has to pass consent, active status and category checks. For production, set TEST_MODE=false and leave ALLOW_TEST_SEND=false. Template names can be overridden with `META_WHATSAPP_TEMPLATE_<NOTIFICATION_TYPE>`.

## Templates to submit

All parameters below are body parameters, in the listed order. Links remain text body variables, so no additional button components are required.

### tpk_sunday_signin

Good morning {{1}}! Please sign in to TPK today and check in when you arrive at church. Open your teacher dashboard: {{2}}. Thank you for serving with TribePetra Kids.

Parameters: teacher name; sign-in URL. Suggested utility category, subject to Meta review.

### tpk_followup_assigned

Hello {{1}}, a {{2}} follow-up has been assigned to you. Please open your TPK dashboard to see the details and record your update: {{3}}. Thank you for caring for our TPK family.

Parameters: teacher name; `teacher` or `child or family`; exact case URL. Suggested utility category.

### tpk_roster_published

Hello {{1}}, your TPK roster for {{2}} is ready. Your assignments: {{3}}. Schedule: {{4}}. Open your roster for full details: {{5}}. Thank you for serving!

Parameters: teacher name; month label; concise dated duties/service summary; `Monthly roster`; roster URL. Suggested utility category.

### tpk_teacher_birthday

Hello {{1}}, it is {{2}}'s birthday today! Join your TribePetra Kids family in celebrating them. Open their team profile to send your wishes: {{3}}. Let's make their day special.

Parameters: recipient name; birthday teacher name; team profile URL. Submit as marketing unless Meta classifies otherwise.

### tpk_birthday_greeting

Happy birthday, {{1}}! Your TribePetra Kids family celebrates you and thanks God for your life. May this new year bring you joy, peace and growth. We are glad you are part of our family!

Parameter: birthday teacher name. Submit as marketing unless Meta classifies otherwise.

## API and delivery operations

- GET/PATCH `/api/v1/me/notification-preferences`: authenticated teacher's own preferences.
- GET `/api/v1/admin/notification-deliveries`: super admin, same campus, masked recipients.
- POST `/api/v1/admin/notification-deliveries/:id/retry`: failed essential WhatsApp notices, same campus; send-time consent checks still apply.
- GET/POST `/api/v1/webhooks/meta/whatsapp`: verification challenge or HMAC-SHA256 signature verification. Filters WhatsApp account/phone IDs, ignores inbound message content and prevents duplicate/out-of-order status regressions. Unknown recent message IDs are retried briefly to handle send/status races; older unrelated messages are ignored.

Statuses: PENDING, SENT, DELIVERED, READ, FAILED, SKIPPED. Meta message ID, attempts and timestamps are stored in `notification_deliveries`. Retryable HTTP failures use capped exponential delays, up to five attempts. Secrets and raw Meta responses are not logged. In-app notifications remain the source of truth.

## Deployment and database

The only migration applied was `backend/scripts/migrate_whatsapp_notifications.php --confirm`. It extends the notification type to VARCHAR, adds category/importance, reuses existing metadata_json, and adds preferences, delivery and webhook-event tables. Existing notification content and read state were preserved; no unrelated migrations were run.

Before deployment, notification data/schema and changed live PHP files were backed up under `/var/backups/tpk-whatsapp-20261123.aAPPDw`. The deployment checked exact hashes of the two live integration files. The PHP service was reloaded after the update.

`/etc/cron.d/tpk-notifications` runs the scheduler every five minutes and delivery worker every minute with separate non-overlapping locks. Logs contain counts/statuses only. CLI scripts default to dry-run unless `--enqueue` or `--deliver` is passed.

For another deployment: back up the existing notifications table and PHP files; run only the migration if missing; install the two helpers and scripts; apply the targeted v1.php/teacher-attendance.php integration changes to the current live versions; keep the provider disabled until configured. The server has earlier production fixes not yet mirrored in Git's backend: **do not overwrite its entire backend directory from this repository**. This release preserved those live fixes.

## Files and verification

Backend: public/notification-delivery.php, public/notification-schedule.php, targeted edits to public/v1.php and public/teacher-attendance.php; scripts/migrate_whatsapp_notifications.php, process_notification_deliveries.php, schedule_teacher_notifications.php, test_notification_database.php, test_notification_delivery.php; database/2026_whatsapp_notifications.sql.

Frontend: src/components/followup-workspace.tsx and src/components/teacher-attendance-workspace.tsx open assigned cases from notification URLs. Existing notification settings UI is reused.

Verification: PHP syntax checks passed; 46 policy/provider tests and 23 MySQL checks passed using isolated temporary fixtures and a fake Meta transport; no production test teachers or messages were created. TypeScript validation and production build passed (existing lint warnings remain). Live homepage/settings return 200, authenticated APIs reject anonymous requests with 401, and the webhook rejects missing verification with 403. Both cron and PHP services are active; delivery logs show zero sends. The new frontend deployment succeeded under Worthy's Notepad; the obsolete Vercel project still reports its unrelated account-blocked check.

Limitations: a real Meta delivery has not been tested. Payment acceptance, template approvals, app publication/credentials and webhook subscription remain external setup requirements. Birthday dates come from saved teacher profiles; no birthday is inferred when missing. Routine staff follow-up authorization and all other ministry permissions remain unchanged.
