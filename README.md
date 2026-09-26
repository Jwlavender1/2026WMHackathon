# Commonly

**Do good, together.** A community volunteering platform built for the Year of Civic Leadership hackathon. The approved source of truth is [docs/MVP_SPEC.md](docs/MVP_SPEC.md). The UI follows the supplied Commonly mockup.

## Run immediately

Requires Node.js 22.13+ (verified with Node 24). From this repository:

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. On Windows with PowerShell script execution disabled, use `npm.cmd` in place of `npm`.

Without Supabase environment variables, the app runs in a clearly labeled **local demo**. Changes persist in this browser. The sidebar account selector switches between Maya, Jordan, Alex, and the two organization coordinators. Demo registration creates a local profile; it does not store a password or send email. To reset the fixtures, remove the `commonly-demo-v1` localStorage entry through browser developer tools.

## What works

- Mockup-inspired responsive home, sidebar, search, impact card, and photo event cards.
- Discovery by keyword, city, organization, and volunteer task; shareable filter URLs.
- Event details, resources, task capacities, reservations/withdrawal, and event conversations.
- Volunteer profile, image upload, bio, service history, and verified hours.
- Organization group editor and Event Hub with upcoming, previous, and cancelled events.
- Event creation with weekly/biweekly recurrence, individual occurrence editing, cancellation, and attendance verification.
- Community group pages, share links, and a Messages page linking to event threads.
- Live Supabase integration and a SQL migration that enforces authorization and transactional business rules.

The demo fixtures contain **fictional** opportunities associated with Williamsburg House of Mercy and Williamsburg Regional Library. They are not real event announcements or official organization accounts.

## Connect Supabase

1. Create a dedicated Supabase project and copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_SITE_URL`. The site URL should be `http://localhost:3000` locally, or the actual HTTPS origin when deployed.
3. Run [the migration](supabase/migrations/202609260001_foundation.sql) in the project's SQL editor. It creates the tables, auth trigger, RLS/grants, authorized read/write functions, avatar bucket/policies, and Realtime publication entry. Run it once on a fresh project, or use your team's normal Supabase migration workflow.
4. Under Auth URL configuration, set the Site URL and allow `<site-url>/auth/confirm`. Enable email/password authentication. With token-hash email templates, use `<site-url>/auth/confirm?token_hash={{ .TokenHash }}&type=email`; the callback also supports PKCE `code` exchange. Test real confirmation delivery with your project's configured email provider.
5. Restart the development server. The demo banner/account switcher disappears; new users now authenticate through Supabase. Organization users create their group before creating events.

Server secrets are never sent to the browser. Ordinary reads and writes use the signed-in user's session; `app_command` checks identity/ownership internally. Public projections omit unrelated profiles, attendee identities, emails, and group owner IDs. Only authorized participants can subscribe to comment changes.

### Seed the connected demo project

Set these server-only entries in `.env.local`:

```dotenv
SUPABASE_SERVICE_ROLE_KEY=your-demo-project-service-role-key
ALLOW_DEMO_SEED=true
SEED_PROJECT_REF=your-demo-project-reference
SEED_PASSWORD=choose-a-local-demo-password-at-least-12-characters
```

Then run:

```sh
npm run seed
```

`SEED_PROJECT_REF` must match the target Supabase hostname (localhost is also allowed). The script creates `maya@commonly.example`, `jordan@commonly.example`, `alex@commonly.example`, `mercy@commonly.example`, and `library@commonly.example`, with the password you supplied. The last two are organization owners. These intentionally fictional addresses are preconfirmed by the seed script and do not receive email.

There are two groups, five future event occurrences, one completed event, task capacities, reservations, a sample message, and verified attendance. Future dates are relative to the first seed run in `America/New_York`. Reruns preserve existing fixture records and passwords. The script is resumable if interrupted; use a fresh demo project when you want a completely fresh fixture set.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Browser tests use a production build at localhost:3000 and start a server if needed. Windows uses installed Chrome. On other systems, install the Playwright Chromium browser first with `npx playwright install chromium`. Run the E2E suite without live Supabase credentials; it exercises the persistent local demo. Desktop/mobile screenshots are saved under `.artifacts/` (ignored by Git).

Database tests execute the actual migration in embedded PostgreSQL (PGlite), supplying only the Auth/Storage platform primitives. They verify private data restrictions, organization isolation, reservations and capacity, attendance bounds/revisions, cancellation, and transactional recurrence. The harness serializes requests; a hosted multi-connection race test is still needed to validate deployment-level concurrency. Hosted email confirmation, Storage uploads, and Realtime delivery must also be smoke-tested against the configured project.

Use `npm run format` for consistent source formatting. Dependencies and the lockfile are pinned. `npm run start` serves the production build.

## Structure

```text
src/app/               Next.js routes, layout, global styles, Server Actions
src/components/        Shared shell, feature screens, forms, event thread, state adapter
src/lib/               Domain rules, types, fixtures, demo adapter, Supabase clients
src/proxy.ts           Supabase cookie refresh
supabase/migrations/   Database schema, RLS, transactions, Storage, Realtime
scripts/seed.ts        Idempotent connected demo seed
tests/                 Domain, database, and browser flow checks
public/images/         Bundled photography
docs/MVP_SPEC.md        Approved product and architecture contract
```

## Deliberate foundation limits

One organization owner per group; one task reservation per volunteer per occurrence; finite recurrence; text-only event threads. No email event streaming, reminders, staff invitations, waitlists, monthly goal editing, or direct messaging.

For hackathon-sized datasets the server returns an authorized snapshot, and the client filters/paginates it. Replace this with database filtering and cursor pagination as the dataset grows. Initial reads are server-rendered; mutation refreshes and Realtime update the client snapshot. `src/lib/types.ts` contains schema-aligned types; Supabase-generated database types can replace them when a project is linked.

Attendance verification can only be performed after an event ends, for a noncancelled event, by its owner. The sidebar's demo account switch is intentionally absent in live mode. A volunteer's header action discovers opportunities; organization accounts see **Create event**.

## Photography

Bundled illustrative images from Unsplash; they do not depict the named organizations or imply affiliation:

- Volunteers: [source image](https://images.unsplash.com/photo-1593113598332-cd288d649433)
- Library: [source image](https://images.unsplash.com/photo-1507842217343-583bb7270b66)
- Learning: [source image](https://images.unsplash.com/photo-1503676260728-1c00da094a0b)
- Kitchen: [source image](https://images.unsplash.com/photo-1556911220-bff31c812dba)
