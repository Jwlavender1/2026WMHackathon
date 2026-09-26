# Turnout

**Do good, together.** A community volunteering platform for the Year of Civic Leadership hackathon, following the supplied UI mockup.

## Start here

- [Run locally](docs/LOCAL_DEVELOPMENT.md)
- [Team Git workflow](docs/TEAM_WORKFLOW.md)
- [Auth0 + DigitalOcean setup and deployment](docs/AUTH0_DIGITALOCEAN_HANDOFF.md)
- [MVP source of truth](docs/MVP_SPEC.md)

Requires Node.js 24 and Git:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. Use `npm.cmd` in PowerShell if execution policy blocks `npm.ps1`.

## Two explicit modes

- **Demo (default):** browser-local sample accounts and persistent fixtures. No cloud credentials needed. Set `APP_MODE=demo`. Fictional events use Williamsburg House of Mercy and Williamsburg Regional Library as example groups.
- **Live:** Auth0 Universal Login plus PostgreSQL, ready to connect to DigitalOcean Managed PostgreSQL. Set `APP_MODE=live` only after completing the setup guide. Missing configuration fails rather than silently falling back to demo.

The Supabase integration has been removed. No real Supabase users/data needed preserving. Provider wiring is implemented, but the team's real Auth0 callback and hosted DigitalOcean deployment still require credentials/provisioning and verification. A teammate owns DigitalOcean setup; the team has $200 in credits. No cloud resources were created by this change.

## Features

Profiles and verified service hours; organization groups; event creation, finite weekly/biweekly recurrence, editing and cancellation; task reservations; discovery filters; event conversations; and responsive community/event pages. Live conversations poll every five seconds while visible. Avatars are capped at 2 MB and stored privately in PostgreSQL, so this MVP needs no additional object-storage service.

## Checks and database tools

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start
# In a second terminal, with the production demo running:
npm run test:e2e
```

Database tools read ignored `.env.local` or shell variables:

```sh
npm run db:migrate
npm run db:grant-runtime
npm run seed
```

Use these only after configuring the designated database as described in the handoff. Migration checksums prevent silent edits to applied migrations. Seeds are transactional/idempotent and do not create Auth0 accounts. Unit/database tests run actual portable SQL in PGlite; they do not require a hosted database. Independent-connection concurrency, actual Auth0 login/callback/logout, and cloud deployment need separate live verification.

## Structure

```text
src/app/              Routes, Server Actions, avatar and health endpoints
src/components/       Mockup-based UI and demo/live state adapter
src/lib/auth0.ts      Auth0 SDK client
src/lib/db/           PostgreSQL pool, TLS, transaction-local identity
src/lib/              Domain rules, fixtures, types, explicit mode config
database/migrations/ Portable schema, RLS, authorized functions
scripts/              Migrate, grant restricted runtime role, seed
tests/                Domain, database, integration-boundary, browser checks
.do/app.yaml          DigitalOcean deployment template (not provisioned)
Dockerfile            Node 24 standalone Next.js production image
docs/                 Product contract and team guides
```

Use `npm run format` for formatting. Keep secrets out of Git and the Docker build context. The snapshot read targets hackathon-sized data; move filtering/pagination into database queries as data grows.

Bundled illustrative photography from Unsplash does not depict or imply affiliation with the named organizations: [volunteers](https://images.unsplash.com/photo-1593113598332-cd288d649433), [library](https://images.unsplash.com/photo-1507842217343-583bb7270b66), [learning](https://images.unsplash.com/photo-1503676260728-1c00da094a0b), [kitchen](https://images.unsplash.com/photo-1556911220-bff31c812dba).
