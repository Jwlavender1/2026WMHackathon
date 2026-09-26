# Auth0 + DigitalOcean setup

**Status:** provider migration implemented locally; real Auth0 login and DigitalOcean deployment still need verification. No cloud resources have been provisioned. The existing browser demo remains usable. There is no real Supabase data to preserve.

## Confirmed decisions and owners

- Prize categories are “Best Use of…” Auth0 and DigitalOcean, as supplied by the user. Demonstrate real service usage in the submission; no further judging criteria have been supplied.
- DigitalOcean credits: **$200**. A teammate owns account setup, resource selection, spending, and deployment. Credits are not an automatic spending cap; the owner should check current app/database pricing and set usage alerts.
- Auth0 tenant: **dev-o0ar4rp3e14z4odp.us.auth0.com**.
- Auth0 Client ID: **g3NM42mxEDRAB2wDbAdaxzJih3qw490F**. This and the domain are public identifiers, not secrets.
- The user will supply the client secret locally when notified. The ignored local environment file has been prepared on the development machine, including a generated cookie secret. Other teammates create their own local file.

## Auth0 application owner

1. In this tenant, confirm the supplied app is a **Regular Web Application** and enable the desired login connection (email/password is sufficient).
2. Add Allowed Callback URL **http://localhost:3000/auth/callback** and Allowed Logout URL **http://localhost:3000**. Add the deployed HTTPS origin with the same callback path and the bare origin for logout once available.
3. Put **AUTH0_CLIENT_SECRET** in ignored `.env.local`. Do not paste it into chat or Git. Keep the generated **AUTH0_SECRET** private; it encrypts session cookies. On another machine, generate a fresh 32-byte hex value into its local file using a cryptographic generator.
4. Keep **APP_MODE=demo** until the PostgreSQL configuration below is ready. For live use set **APP_MODE=live** and **APP_BASE_URL=http://localhost:3000**, then restart.

The SDK mounts `/auth/login`, `/auth/callback`, and `/auth/logout` through `src/proxy.ts`. First login opens in-app profile/role onboarding; later login preserves the existing role. [Auth0 Next.js SDK reference](https://auth0.github.io/nextjs-auth0/).

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
6. Complete the template's empty encrypted runtime values: **AUTH0_CLIENT_SECRET**, **AUTH0_SECRET**, **DATABASE_URL**, and **PGSSL_CA** if needed. The public tenant/client values are prefilled. **APP_BASE_URL** binds to the app URL, **APP_MODE=live**, port **8080**, health path **/api/health**. Keep migration credentials out of the web service. Docker builds need no live credentials; runtime uses them. Database bindings are supported, but make sure a binding uses the restricted application login rather than the admin. [App environment variables](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/).
7. Add the actual HTTPS URL to Auth0's allowed URLs, deploy, and run the checks below. Automatic deployment from main is disabled in the template; enable it only after the team agrees on release/migration ownership.

**Health behavior:** live health checks validate Auth0 configuration and reach PostgreSQL to check that the snapshot function exists. This is not an Auth0 callback test. The Dockerfile, app template, and managed database connection still require verification in DigitalOcean; they have not been deployed from this workspace.

## Optional connected demo seed

Set **ALLOW_DEMO_SEED=true** and **SEED_DATABASE_HOST** to the exact hostname from the intended demo database URL, then run `npm run seed`. It creates two groups, five future occurrences, one past event, sample reservations/hours/messages. Dates are relative to the first run; reruns preserve existing fixtures. It never creates passwords or Auth0 users.

By default, fixture users have non-login `demo:` identities. To manage a sample group using a real Auth0 account, **before the first seed**, set **SEED_MERCY_AUTH0_SUB** and/or **SEED_LIBRARY_AUTH0_SUB** to the exact verified Auth0 subject (User ID) from the tenant. If that user already logged into Commonly, first finish onboarding as an organization. A rerun will not silently reassign ownership or overwrite a role. Otherwise, a real user can simply create their own group/events after onboarding.

## Architecture and validation

- Auth0 sessions establish identity; internal UUIDs remain the foreign keys. `auth0_sub` is unique and stays server-side. Roles/ownership stay in the application database.
- Every DB operation uses one pooled connection, one transaction, and a transaction-local actor derived from the verified session. SQL functions validate ownership/capacity; the runtime role cannot directly mutate tables. This server role is never exposed to browsers.
- Images are private PostgreSQL bytes, capped at 2 MB with MIME/signature validation and an authenticated no-cache avatar endpoint. This avoids extra service setup during the hackathon; object storage can replace it later if volume grows.
- Event conversations poll authorized server reads every five seconds while visible. They are not WebSocket streams.
- Unit/database checks cover portable SQL, role isolation, onboarding, attendance, avatars, TLS configuration, and identity cleanup after commit/rollback. Browser tests cover the local demo. Before the prize demo, verify actual login/callback/logout, both roles, two-user messaging, concurrent last-slot reservations across independent DB connections, image persistence after redeploy, recurrence, and recorded hours.

Capture the real Auth0 login flow and the DigitalOcean app/database deployment for the prize submission. The demo deadline is still unspecified.
