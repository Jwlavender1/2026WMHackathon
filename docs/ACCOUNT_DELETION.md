# Account deletion

Volunteers can delete their account from **Your profile**. Organization owners can use **My group** or **Your profile**. Deletion requires a confirmation dialog and typing `DELETE`; Cancel or Escape leaves the account unchanged.

## What happens

- Both roles: remove the Turnout user, profile, uploaded photo, and authored messages, then sign out.
- Volunteers: also delete their signups and service-hour records, releasing their reserved places. Other volunteers and organizations are unaffected.
- Organizations: archive the group and remove it from the active Community directory and Discover organization filter. Cancel upcoming and ongoing events. Keep the group's name, event records, and volunteers' already verified hours for history. Remove the owner's profile and the group's contact details, website, description, location, and cause selections. Archived group links explain the closure. Previously verified hours remain even though the verifier's deleted user ID is cleared.
- **Auth0 login identities are retained.** The live confirmation dialog states this explicitly. A fresh login can create a new, empty Turnout account; it does not recover deleted data or ownership of an archived group. No Auth0 Management API permissions are needed.

The database keeps a private SHA-256 fingerprint of the Auth0 subject and a deletion timestamp solely to reject older login sessions. Raw Auth0 subjects are removed with the user. Identity resolution uses the verified server session's creation time; requests from old sessions cannot recreate the account or access application records, including after a new account has been created. The logout redirect ends the current browser session.

Deletion runs in one database transaction, using the signed-in actor only. Clients cannot submit another account ID. Identity and event locks serialize deletion against other requests and reservations; any failure rolls back the deletion. Signing out does not delete the Auth0 identity.

Demo mode applies the same Turnout data rules to browser storage only. Deleted demo accounts are removed from the role selector; existing fixture data is not automatically restored.

## Deploying this change

Run **004_account_deletion.sql** before deploying this application's updated server. With the existing migration connection and CA configuration in the ignored `.env.local`, run from the project folder:

```powershell
npm.cmd run db:migrate
```

The command applies any pending migrations in order. It adds deletion support; it does **not** delete any accounts on its own. No seed/reset is needed. Health checks require the migration. Older server versions can continue resolving normal accounts during rollout but cannot recreate identities deleted after this migration.

Ensure Auth0's Allowed Logout URLs includes `https://letsturnout.us` so sign-out can return to the current domain. The implementation is tested with isolated local database fixtures and browser demo accounts. No production account deletion or hosted migration is performed as part of those tests. Verify the real Auth0 logout and a fresh empty onboarding with a disposable account after deployment.
