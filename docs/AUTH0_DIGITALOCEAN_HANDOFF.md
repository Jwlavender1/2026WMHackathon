# Auth0 + DigitalOcean handoff

**Decision:** use Auth0 for authentication and DigitalOcean for managed PostgreSQL and hosting. **Status:** selected, not implemented or provisioned. Current code still uses Supabase for live services and browser storage for the local demo. Target this migration next, before adding more Supabase-dependent features.

## What the project owner needs to provide

| Needed                               | Details / where it goes                                                                                                                                                    |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prize requirements and demo deadline | Link or exact rules for both sponsor prizes, plus submission deadline/time zone. We have not verified eligibility; simply adding an SDK may not meet the rules.            |
| Budget and account owner             | DigitalOcean credits/spending limit, including storage, and who can configure Auth0/DO and connect the GitHub repository. A region preference is optional.                 |
| Auth0 application                    | Tenant domain and Client ID from a **Regular Web Application**. Start with hosted Universal Login and email/password; additional social providers can follow.              |
| DigitalOcean resources               | Team/project, existing App Platform app/URL and PostgreSQL cluster details, if already created. Otherwise report that they are not created yet; we can prepare code first. |
| Existing data                        | Whether Supabase contains real users/events/uploads that must be preserved, or only disposable test data. Do not assume that resetting data is acceptable.                 |

Share non-secret identifiers in the project discussion. Put the Auth0 client secret and database credentials in ignored `.env.local` / DigitalOcean encrypted environment settings through the account owner; do not paste them into GitHub, documentation, or chat. We can generate the application's cookie-encryption secret during implementation; you do not need to supply one now.

## Recommended architecture

| Current dependency                       | Target                                                                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth / cookie refresh           | Auth0 Next.js SDK, Universal Login, and server-validated sessions                                                                               |
| `auth.users`, `auth.uid()`, auth trigger | Application-owned UUID users with a unique `auth0_sub` text field; idempotent first-login onboarding                                            |
| Supabase database client/RPC             | Server-only PostgreSQL connection pool to DigitalOcean Managed PostgreSQL; preserve transactional reservations and attendance rules             |
| Supabase-specific RLS context            | Portable policies/authorized functions using a verified, transaction-local application user ID; restricted runtime database role                |
| Supabase Storage avatars                 | Proposed: private DigitalOcean Spaces bucket and authorized uploads/reads, subject to storage budget                                            |
| Supabase Realtime                        | Proposed hackathon default: authorized short polling while the event thread is open, plus manual refresh; near-real-time rather than WebSockets |
| Hosting                                  | DigitalOcean App Platform **web service** for Next.js; retain the current UI                                                                    |

App Platform can deploy from Git repositories and attach an existing managed database. Spaces provides an S3-compatible object API. [App Platform quickstart](https://docs.digitalocean.com/products/app-platform/getting-started/quickstart/), [managed database attachment](https://docs.digitalocean.com/products/app-platform/how-to/manage-databases/), [Spaces compatibility](https://docs.digitalocean.com/products/spaces/reference/s3-compatibility/).

Keep Volunteer/Organization roles and group ownership in our application database. Use the verified Auth0 subject as the identity mapping, not an email address or a client-supplied user ID. Selecting an organization role grants access only to the user's own group; this does not require adopting Auth0's separate Organizations product.

The existing SQL migration **cannot run unchanged on ordinary PostgreSQL**: it refers to Supabase auth tables/functions, storage schemas, roles, and the Realtime publication. Write a portable migration and seed, and port the permission tests along with the adapter. A PostgreSQL connection string alone will not switch the current application.

## Auth0 setup to prepare

For the planned SDK integration, configure:

- Allowed Callback URLs: `http://localhost:3000/auth/callback`, then the deployed HTTPS origin plus `/auth/callback`.
- Allowed Logout URLs: `http://localhost:3000`, then the deployed HTTPS origin.
- Local planned variables: `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_SECRET`, and `APP_BASE_URL=http://localhost:3000`.

The domain is the tenant hostname; secrets remain server-only. These are the current SDK conventions, **not routes/env variables implemented in this repository yet**. [Auth0 Next.js SDK setup](https://auth0.github.io/nextjs-auth0/).

## DigitalOcean setup to prepare

1. Confirm budget/credits before creating billable resources. Prefer one App Platform web service and a managed PostgreSQL cluster in the same available region; no Droplet/Kubernetes setup is necessary for this MVP.
2. Connect `Jwlavender1/2026WMHackathon`, branch `main`, source directory `/` (the repository root). Planned commands: build `npm run build`, run `npm run start`. Match the listening port to App Platform's configured HTTP port. Pin the chosen Node version during deployment work.
3. Supply the database host, port, database name, runtime username, and TLS CA details. Store its password/connection URL as secrets. Use a separate migration credential when broader schema permissions are needed.
4. Restrict database access to the app and approved development sources. Configure TLS certificate verification using the cluster's provided CA/trust configuration. [DigitalOcean PostgreSQL connection security](https://docs.digitalocean.com/products/databases/postgresql/how-to/secure/).
5. Bind server-only `DATABASE_URL` and required TLS configuration; add Auth0 variables and, if approved, Spaces bucket/region/endpoint credentials. App Platform supports database bindings and encrypted environment values. [Environment configuration](https://docs.digitalocean.com/products/app-platform/how-to/use-environment-variables/).
6. Obtain the app's HTTPS URL and add it to Auth0's allowed URLs before testing login. A custom domain is optional. Prefer manual deploys during the migration, then decide whether main should auto-deploy.

## Implementation sequence and completion criteria

1. Build a portable PostgreSQL migration, connection layer, and idempotent seed; preserve internal UUIDs if there is real data to migrate. Keep the local demo usable.
2. Replace authentication with Auth0 and add first-login profile/role onboarding. Implement authorization at every server mutation and verify the identity context cannot leak across pooled connections.
3. Replace avatar storage and event-thread transport, update tests and environment templates, then remove Supabase dependencies after replacements work.
4. Deploy on App Platform, apply migrations once through the designated owner, and seed a demo database if appropriate.
5. Verify local and deployed login/logout, both roles, cross-organization denial, concurrent last-slot reservations, profile images, two-browser conversation updates, recurrence, and verified hours. Confirm persistence after a redeploy. Capture the actual Auth0 login flow and DigitalOcean app/database usage for the prize submission according to its rules.

Code preparation can start without cloud secrets. End-to-end verification and deployment need the configured accounts, credentials, and budget decisions above. Adding Auth0 variables to the current `.env.example` would be misleading until the adapter exists, so that template remains unchanged for now.
