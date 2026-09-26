# Auth0 + DigitalOcean setup

**Status:** the team has deployed Turnout on DigitalOcean App Platform at [turnout-application-s5j4x.ondigitalocean.app](https://turnout-application-s5j4x.ondigitalocean.app). Its public health check reports `ok` in `live` mode, and both authentication entry points send the production callback URL below. The application owner saved the allowed URLs and confirmed authentication now reaches onboarding. Completing onboarding and verifying logout remain pending. The existing browser demo remains usable. There is no real Supabase data to preserve.

## Confirmed decisions and owners

- Prize categories are “Best Use of…” Auth0 and DigitalOcean, as supplied by the user. Demonstrate real service usage in the submission; no further judging criteria have been supplied.
- DigitalOcean credits: **$200**. A teammate owns account setup, resource selection, spending, and deployment. Credits are not an automatic spending cap; the owner should check current app/database pricing and set usage alerts.
- Auth0 tenant: **dev-o0ar4rp3e14z4odp.us.auth0.com**.
- Auth0 Client ID: **g3NM42mxEDRAB2wDbAdaxzJih3qw490F**. This and the domain are public identifiers, not secrets.
- The user will supply the client secret locally when notified. The ignored local environment file has been prepared on the development machine, including a generated cookie secret. Other teammates create their own local file.

## Auth0 application owner

1. In this tenant, confirm the supplied app is a **Regular Web Application** and enable the desired login connection (email/password is sufficient).
2. Open **Applications → Applications → the application matching the Client ID above → Settings**. Add the URLs below to the corresponding fields, preserving existing entries, then click **Save Changes**.
3. Put **AUTH0_CLIENT_SECRET** in ignored `.env.local`. Do not paste it into chat or Git. Keep the generated **AUTH0_SECRET** private; it encrypts session cookies. On another machine, generate a fresh 32-byte hex value into its local file using a cryptographic generator.
4. Keep **APP_MODE=demo** until the PostgreSQL configuration below is ready. For live use set **APP_MODE=live** and **APP_BASE_URL=http://localhost:3000**, then restart.

The SDK mounts `/auth/login`, `/auth/callback`, and `/auth/logout` through `src/proxy.ts`. First login opens in-app profile/role onboarding; later login preserves the existing role. [Auth0 Next.js SDK reference](https://auth0.github.io/nextjs-auth0/).

| Environment             | Allowed Callback URLs                                                | Allowed Logout URLs                                    |
| ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| Local development       | `http://localhost:3000/auth/callback`                                | `http://localhost:3000`                                |
| DigitalOcean production | `https://turnout-application-s5j4x.ondigitalocean.app/auth/callback` | `https://turnout-application-s5j4x.ondigitalocean.app` |

In DigitalOcean's web component, `APP_BASE_URL` must resolve to `https://turnout-application-s5j4x.ondigitalocean.app` (the template uses `${APP_URL}`). Local `.env.local` remains configured for localhost; editing it does not change the deployed app.

### Callback URL mismatch

Auth0 validates the `redirect_uri` sent by `/auth/login` against the selected application's Allowed Callback URLs. Check the scheme, hostname, port, and `/auth/callback` path. Both Sign in and Create account use the same callback; sign-up adds `screen_hint=signup`. This application uses `/auth/callback`, not `/api/auth/callback`.

- If the redirect already contains the production URL above, update and save the Auth0 settings. No application redeployment is needed for that allowlist change.
- If the redirect contains localhost or a different hostname, correct the web component's `APP_BASE_URL` in DigitalOcean and apply/redeploy that environment change. Do not allow an unintended callback just to suppress the error.
- Start again from Turnout's Sign in/Create account button after saving; do not reload an old Auth0 error URL. Verify both hosted forms load, then complete a real login, onboarding, and logout in the same browser.
- The production health check verifies configuration and database reachability, not successful Auth0 authentication. Do not mark the entire flow verified until the callback and session work.

See [Auth0 redirect URL validation](https://auth0.com/docs/authenticate/login/redirect-users-after-login).

## DigitalOcean owner

1. Choose **App Platform web service + Managed PostgreSQL** in the same available region. Use the existing $200 credits and review the total app/database cost before provisioning. No Droplet, Kubernetes, Spaces bucket, or additional messaging service is required for this MVP.
2. Create an application database and separate database logins for migration ownership and restricted runtime access. Supply **MIGRATION_DATABASE_URL** to the migration operator and **DATABASE_URL** to the running app; never run the web app as the migration owner/admin. Set **DATABASE_APP_USER** to the existing restricted login name.
3. Supply TLS trust information. Set **PGSSL_MODE=verify-full** for DigitalOcean. Use **PGSSL_CA_FILE** locally or **PGSSL_CA** with the cluster's CA PEM in deployment settings where required. If the cluster uses a publicly trusted certificate, Node's trust store can be used. Remote certificate verification cannot be disabled by this adapter. Add the app and approved developer IPs as trusted database sources. [Database security](https://docs.digitalocean.com/products/databases/postgresql/how-to/secure/).
4. From a trusted development machine, install dependencies, set the migration variables, then run:

```sh
npm run db:migrate
npm run db:grant-runtime
```

The first creates portable tables, RLS, and authorized functions; the second grants the existing restricted login membership in **commonly_runtime**. The migration operator needs permission to create/grant this non-login role. The grant script rejects an admin/schema-owner login or one with existing user-table write privileges. Do not rewrite a successfully applied migration; add a new SQL file.

5. Connect GitHub repository **Jwlavender1/2026WMHackathon**, branch **main**, source directory **/**. Use the root Dockerfile and the template [../.do/app.yaml](../.do/app.yaml). Choose the paid instance size in the dashboard; the template deliberately omits resource purchase choices and database creation.
6. Complete the template's empty encrypted runtime values: **AUTH0_CLIENT_SECRET**, **AUTH0_SECRET**, **DATABASE_URL**, **GEOAPIFY_API_KEY**, and **PGSSL_CA** if needed. The public tenant/client values are prefilled. **APP_BASE_URL** binds to the app URL, **APP_MODE=live**, port **8080**, health path **/api/health**. Keep migration credentials out of the web service. Docker builds need no live credentials; runtime uses them. Database bindings are supported, but make sure a binding uses the restricted application login rather than the admin. [App environment variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/).
7. Add the actual HTTPS URL to Auth0's allowed URLs, deploy, and run the checks below. Automatic deployment from main is disabled in the template; enable it only after the team agrees on release/migration ownership.

**Onboarding upgrade:** the owner reports Geoapify configured locally and in DigitalOcean, and the local key successfully returns city suggestions. Migration **002_onboarding_locations.sql** is now applied to the team's DigitalOcean database using the `doadmin` owner connection and verified TLS. Both migration checksums match this checkout; user/group/event counts were unchanged and the deployed health endpoint passed afterward. The migration supports the current city-only forms during rollout. Commit/push and deploy the matching application code to expose the new onboarding using [the upgrade instructions](ONBOARDING.md#upgrade-an-existing-deployment).

**Health behavior:** live health checks validate Auth0 configuration and reach PostgreSQL to check that the snapshot and migration-002 command functions exist. Migration 002 is now present, and the currently deployed endpoint passes its check. Health does not verify successful login, Geoapify availability, database permissions for every operation, or persistence across redeploys.

## Optional connected demo seed

Set **ALLOW_DEMO_SEED=true** and **SEED_DATABASE_HOST** to the exact hostname from the intended demo database URL, then run `npm run seed`. It creates two groups, five future occurrences, one past event, sample reservations/hours/messages. Dates are relative to the first run; reruns preserve existing fixtures. It never creates passwords or Auth0 users.

By default, fixture users have non-login `demo:` identities. To manage a sample group using a real Auth0 account, **before the first seed**, set **SEED_MERCY_AUTH0_SUB** and/or **SEED_LIBRARY_AUTH0_SUB** to the exact verified Auth0 subject (User ID) from the tenant. Use an Auth0 account that has not yet entered Turnout: seeding assigns the organization role and sample group before first login. An account that already completed organization onboarding owns its own group and cannot also own a sample group. A rerun will not reassign ownership, overwrite a role, or replace another group. For normal testing, leave mappings unset and create real groups/events through onboarding.

## Architecture and validation

- Auth0 sessions establish identity; internal UUIDs remain the foreign keys. `auth0_sub` is unique and stays server-side. Roles/ownership stay in the application database.
- Every DB operation uses one pooled connection, one transaction, and a transaction-local actor derived from the verified session. SQL functions validate ownership/capacity; the runtime role cannot directly mutate tables. This server role is never exposed to browsers.
- Images are private PostgreSQL bytes, capped at 2 MB with MIME/signature validation and an authenticated no-cache avatar endpoint. This avoids extra service setup during the hackathon; object storage can replace it later if volume grows.
- Event conversations poll authorized server reads every five seconds while visible. They are not WebSocket streams.
- Unit/database checks cover portable SQL, role isolation, onboarding, attendance, avatars, TLS configuration, and identity cleanup after commit/rollback. Browser tests cover the local demo. Before the prize demo, verify actual login/callback/logout, both roles, two-user messaging, concurrent last-slot reservations across independent DB connections, image persistence after redeploy, recurrence, and recorded hours.

Capture the real Auth0 login flow and the DigitalOcean app/database deployment for the prize submission. The demo deadline is still unspecified.
