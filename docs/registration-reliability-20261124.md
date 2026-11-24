# Parent registration reliability

Registration previously required an open Sunday service, even though parents could fill in the complete form outside the window. The confirmation accepted a generic successful response without validating saved children or the approval receipt. Returning check-in also submitted an alternate pickup person in a shape the backend did not preserve.

The form now explicitly offers registration only when check-in is closed. This saves family, guardian, child and care records without creating attendance, a pickup code or an approval request. Open-Sunday registration continues to request Head of Service approval. Existing-family identity checks remain in place; adding a sibling uses the existing verified sibling flow.

Each unchanged submission carries a random key. The server commits the receipt in the same transaction as the children. A repeat returns the original result; reusing a key with different data is rejected. Receipt keys are opaque and never derived from a phone number. No child details are persisted in browser storage. The UI requires IDs for every submitted child before displaying success. The legacy `/families/new` URL redirects to this form.

## Deploy

1. Back up the live `backend/public/public-registration.php` and `public-check-in.php`. Compare their hashes before replacing them: production contains existing-family protection not present in the old repository copy.
2. Run only `backend/database/public_registration_submissions.sql` against the application database. It creates one receipt table and does not rewrite existing registrations.
3. Install the two PHP files, run PHP lint, restore file ownership/security labels and reload PHP-FPM.
4. Deploy the Next.js frontend to the existing TribePetra Kids project. No environment changes are required.
5. Confirm `/families/new` redirects, closed-window explanatory text appears, and invalid API submissions still return errors.

Rollback: restore backed-up PHP files and the previous frontend deployment. Preserve the receipt table and existing child records. Do not rerun unrelated migrations.

## Verification

TypeScript, PHP lint and production build. Browser tests cover mobile, missing receipt rejection, lost-response retry and registration-only confirmation. Persistence tests run on a disposable schema named `tpk_registration_test_20261124`, containing schema and non-personal campus/class/service configuration only. Synthetic family records are never inserted into production. Browser requests are forwarded to the test PHP server so successful saves are backed by MySQL, not mocked save responses. The test suite also verifies validation rollback, child ownership, pending-request dedupe, alternate pickup fields and no attendance before approval.

The original individual missing registration could not be traced without a name/date. These fixes address verified weaknesses; they do not claim to recover details that never reached the server.
