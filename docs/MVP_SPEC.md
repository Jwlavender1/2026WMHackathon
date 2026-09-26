# MVP Source of Truth

**Status:** product scope approved September 26, 2026. The application is named **Turnout**. The updated design uses Dongle, purple/yellow, and top navigation as described below; it supersedes the original mockup's serif/green/sidebar styling. The user selected Auth0 and DigitalOcean and confirmed there is no real Supabase data to preserve. The team has deployed on DigitalOcean App Platform and the live health check passes. After updating Auth0's allowed URLs, the application owner confirmed authentication reaches onboarding; onboarding completion and logout remain to be verified. See the handoff for the exact deployed URLs.

Team guides: [Local development](LOCAL_DEVELOPMENT.md) · [Git workflow](TEAM_WORKFLOW.md) · [Auth0/DigitalOcean setup](AUTH0_DIGITALOCEAN_HANDOFF.md) / [Onboarding and location rollout](ONBOARDING.md).

Category selections and migration 003 are documented in [Categories](CATEGORIES.md). Profiles, groups, and events share the approved eleven-category list. Event descriptors are selected by the organizer rather than inferred from the title; existing events remain uncategorized until edited.

## 1. Product contract

An organization publishes opportunities; a volunteer discovers an event, reserves a task, coordinates with participants, and receives organizer-verified service hours.

- Two fixed account roles: volunteer and organization. Auth0 handles login; first-login onboarding sets the application role once. Organization means the group's owner/operator, not an Auth0 Organizations subscription feature.
- Volunteers manage display name, photo, biography, selected city/state/country, skills, cause interests, and see derived service hours.
- Organization onboarding atomically creates the profile and its one group, collecting contact name, organization name/description, and selected location; website, public contact email, and cause categories are optional. Each organization account manages its group details, events, tasks, attendees, and attendance. Multiple staff accounts and group membership are deferred.
- Signed-out visitors see a dedicated landing page with sign-in/account creation. Discover, event/group pages, profiles, and all other app screens require authentication. Direct signed-out visits to these routes redirect to `/`.
- Discover initially matches the profile's confirmed city, state, and country. It does not infer a location or show nationwide results when that city has no events. Users can explicitly change the location filter or clear it to search all locations. This is city matching, not a distance-radius search.
- One active task reservation per volunteer per occurrence. No waitlists, payments, donations, or resource inventory.
- Messages lists authorized event conversations; Community lists groups. Threads are persistent text comments, with five-second polling while visible. No direct messages or attachments.
- No event email ingestion, streaming, digests, reminders, or email-to-thread replies in this MVP. Auth0 handles its configured account emails.

## 2. Stack and modes

| Layer          | Implementation / target                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| Web app        | Next.js App Router, React, TypeScript                                           |
| UI             | Tailwind CSS, shared CSS and accessible native controls, Lucide icons           |
| Authentication | Auth0 Next.js SDK, Universal Login, server-validated cookie sessions            |
| Database       | Portable PostgreSQL, node-postgres pool; target DigitalOcean Managed PostgreSQL |
| City lookup    | Geoapify city autocomplete through an authenticated server route; US-only MVP   |
| Images         | Private PostgreSQL avatar bytes, capped at 2 MB; authenticated image route      |
| Conversations  | Authorized Server Action reads, polling every five seconds while visible        |
| Hosting        | Node 24 standalone Docker image; DigitalOcean App Platform template             |
| Validation     | Zod plus PostgreSQL constraints and authorized functions                        |
| Checks         | TypeScript, ESLint, PGlite database/domain tests, Playwright demo flows         |

APP_MODE=demo is the default and stores fictional fixtures in browser localStorage. Fresh visitors start signed out; demo sign-in selects a sample account. The signed-in workspace has a visible banner and account switcher. APP_MODE=live requires Auth0 and a migrated PostgreSQL database for app data. The anonymous landing page does not query the database. The local demo is not shared authentication or a multiuser database.

Supabase dependencies and the old provider-specific migration have been removed. The team has $200 DigitalOcean credits; a teammate owns provisioning and spending. No cloud resources have been created by this implementation. Avatars stay in PostgreSQL to avoid requiring another service; object storage can replace this when scale warrants it.

## 3. Database schema

UUID primary keys, foreign keys, and creation timestamps on application tables; update timestamps on mutable records. All event instants are UTC timestamptz, retaining an IANA time zone (default America/New_York).

| Table             | Fields / relationships                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| users             | id UUID, unique auth0_sub text, role volunteer/organization (null only before onboarding); no passwords                                                                                     |
| profiles          | user_id PK/FK, display_name, bio, city, location JSONB, interests[], skills, avatar_path                                                                                                    |
| profile_images    | user_id PK/FK, mime_type, content bytea, updated_at; one private image per user, 1–2,097,152 bytes                                                                                          |
| groups            | id, unique owner_id, name, unique slug, description, city, location JSONB, website_url, public_contact_email, causes[]                                                                      |
| event_series      | id, group_id, weekly frequency, interval_weeks 1/2, occurrence_count 2–12, timezone, first_local_start, duration_minutes                                                                    |
| events            | id, group_id, optional series_id/occurrence_index, title, description, venue, address, city, location JSONB, starts_at, ends_at, timezone, resources_to_bring[], published/cancelled status |
| event_tasks       | id, event_id, name, description, capacity 1–500; unique event/task name and composite id/event_id                                                                                           |
| signups           | id, event_id, task_id, volunteer_id, active/withdrawn status, optional verified_minutes/verified_by/verified_at                                                                             |
| event_comments    | id, event_id, author_id, body, hidden_at; trimmed messages 1–2,000 characters                                                                                                               |
| schema_migrations | migration filename, checksum, applied_at; migration-operator only                                                                                                                           |

Relationships: Auth0 subject → internal user → profile; owner → group → series/occurrences → tasks → signups; volunteer → signups; event → comments ← author. Unique signup per event/volunteer; composite task/event FK prevents cross-event reservations. Series/group FK keeps occurrences with the correct group. Verification fields are all absent or all present.

Structured location stores provider/place ID, city, state code, country code, and approximate city latitude/longitude. The new application requires a selection validated by the server. Migration 002 also supports the old deployed server's city-only requests during rollout; if an old form changes a city, its stale structured location is cleared. Existing city strings remain readable with a null location until confirmed on edit; no state is inferred.

Migration 002 has been applied to the team's DigitalOcean database, with matching migration checksums, unchanged existing record counts, and a passing live health check. The updated onboarding interface still requires publishing and deploying this application version.

Indexes cover event status/start/id, group/start, normalized city, signup task/status and volunteer, and event comment timestamp/id. Initial discovery uses exact city/state/country matching; explicit search filters use small-data substring matching. Legacy records without a confirmed location are excluded from the initial local results but remain findable through explicit searches.

## 4. Integrity and access rules

- **Reservations:** an authorized database function locks the event and target task before checking remaining capacity. Repeat joins for the same active task are idempotent; changing tasks requires withdrawal. No join/withdraw after the start or cancellation. The event lock coordinates reservations with capacity changes and cancellation.
- **Hours:** the owning organization records integer minutes after a noncancelled event ends, between zero and its duration. Revisions replace the existing record. Hours Served is the sum of verified minutes divided by 60, displayed to one decimal. Zero records a no-show; signup alone earns nothing.
- **Recurrence:** weekly or biweekly, 2–12 occurrences created atomically, each with copied tasks and independent reservations. Preserve the local wall-clock time across daylight saving changes; reject ambiguous/nonexistent local starts. Register, edit, or cancel each occurrence separately. No indefinite series or bulk edits.
- **Lifecycle:** upcoming means published and not started; ongoing means started but not ended; previous means ended. Cancelled has its own dashboard tab. Cancellation keeps history but closes reservations/messages and disallows attendance verification. Completed event times/tasks are immutable.
- **Editor:** before the start, edit title, description, venue/address/city, resources, time/duration, and capacities. Task identities/names remain stable after creation. Capacity cannot fall below active reservations. Automated change notifications are deferred.
- **Threads:** only the event owner and active registered volunteers may read, including after completion/cancellation. Posting closes at cancellation or 24 hours after the end. Authors can hide their own messages; owners can hide messages in their events. Hidden body content is removed from subsequent reads.
- **App data:** signed-out HTTP requests receive an empty snapshot; live page routes and snapshot reads check the Auth0 session on the server. Signed-in users can browse group/event/task details and aggregate availability. Only the separately entered organization contact email is shared. Auth0 account email, subject identifiers, unrelated profiles, attendee identities, and other group owner IDs stay private. Attendee reads are scoped to self/owning organization. The existing SQL projection remains internal behind server-held credentials; this access change needs no new migration.
- **Authorization:** no database credentials in the browser. The server verifies Auth0 sessions, resolves the subject to an internal UUID, and sets that UUID with transaction-local set_config on the same pooled connection used for the request. Every transaction clears context first and commits or rolls back before release. A separate commonly_runtime role has read policies and authorized function execution, with no direct table mutation rights. The application login must not own the schema or bypass RLS.
- **Images:** server validates byte signatures/MIME and size. SQL limits storage and restricts reads to the owner. GET /api/avatar uses authenticated private, no-store responses; the client cannot request another user's avatar by supplying an ID.

Database enforcement is in [001_foundation.sql](../database/migrations/001_foundation.sql) and additive [002_onboarding_locations.sql](../database/migrations/002_onboarding_locations.sql); server identity/transaction handling is in src/lib/db. Migration credentials are used only by admin scripts, never by the application.

## 5. Server interfaces

| Interface                                 | Behavior                                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| /auth/login, /auth/callback, /auth/logout | Auth0 SDK routes through proxy.ts; application does not collect live passwords                                                           |
| readSnapshot()                            | Empty snapshot without an Auth0 session; otherwise reads app records and the user's scoped profile/reservations/comments, with first-login onboarding if needed |
| runCommand(kind, input)                   | Validates each command's Zod schema and invokes app_command in an authenticated user transaction                                         |
| onboard                                   | One-time role, name and verified location plus role-specific fields; organization group created atomically                               |
| profile / group                           | Edit own profile; create/update own organization group                                                                                   |
| create_event / update_event / cancel      | Publish tasks and optional series, edit one future occurrence, cancel future/ongoing occurrence                                          |
| join / withdraw                           | Transactional volunteer task reservations                                                                                                |
| verify                                    | Owner-only attendance minutes on completed events                                                                                        |
| comment / hide_comment                    | Participant posting and scoped moderation                                                                                                |
| uploadAvatar() / GET /api/avatar          | Validate/store and privately serve the current user's profile picture                                                                    |
| GET /api/locations?q=...                  | Authenticated live US city suggestions, signed selection proofs; fixed examples in demo mode                                             |
| GET /api/health                           | Mode/configuration check; live mode also checks PostgreSQL reachability and migration function presence                                  |

Authenticated app pages load through Server Components into a shared client snapshot. For hackathon-sized data, discovery combines keyword/location/group/task with AND, orders by start time/id, and displays 20 records per page. Without an explicit location filter it uses the profile's confirmed city and state. Filters are in URL parameters. Threads show 50 messages at a time. Replace snapshot reads with database filtering/cursors when data volume grows.

Mutations return success data or a user-visible error. Database-shaped TypeScript models are hand-maintained alongside migrations. An independent REST service, ORM, queue, and WebSocket server are unnecessary for this scope.

## 6. UI and routes

    RootLayout → AppProvider → AppShell (CardNav top navigation and account controls)
    /                         Signed-out landing page; About carousel for completed accounts
    /sign-in, /sign-up         Centered Auth0 entry panel, or local demo account flow
    /onboarding               Dedicated two-step role/details flow; no CardNav or footer
    /browse                   SearchFilters + paginated EventGrid
    /groups/[slug]            Group details + upcoming events
    /events                   My registered events by lifecycle
    /events/[id]              Details/resources + TaskSignupPanel + EventThread
    /profile                  Avatar + bio/location/name + skills/interests + hours/history
    /my-group                 Organization group editor
    /event-hub                Organization event tabs and attendance links
    /event-hub/new             EventForm + TaskEditor + recurrence
    /event-hub/[id]/manage     Editor + attendees + attendance/cancellation
    /messages                 Authorized event conversation list
    /community                Organization directory

Turnout uses **primary #CE93D8 (purple)** and **secondary #FFF59D (yellow)**, with dark plum text and light backgrounds. **Dongle is reserved for the logo. Poppins is used throughout the application**, including headings, navigation, body copy, forms, and numbers. Both fonts are bundled locally, with a system sans serif fallback. Heading sizes, weights, and line spacing are restrained for a calmer business-oriented interface.

Event listings use simple text tiles without photos, date badges, or category badges. The organizing group is the larger top link, followed by the event title, location, full date, time/time zone, availability, and registration/recurrence status. About carousel slides use subtle purple-to-deeper-purple, yellow-to-orange, and dark-to-lighter-purple gradients; navigation-menu cards retain their existing colors.

The supplied `public/turnout_logo.png` replaces the sparkle brand mark in public, app, and onboarding headers and the app footer, and supplies the browser icon. The Dongle wordmark remains beside it. Event-detail headers use text and explicit category labels, with no stock event photos.

The sidebar is replaced by top navigation. Direct desktop links and an expandable three-card menu provide About, Discover, My events/Event hub, Messages, Community, My group for organizers, and profile access. The interaction is adapted from [React Bits Card Nav](https://www.reactbits.dev/components/card-nav), using CSS transitions with reduced-motion support, a semantic disclosure button, inactive hidden links, Escape-to-close, and mobile layouts. The demo role selector lives above the main content.

Authentication has three UI states: signed out, authenticated but awaiting onboarding, and ready. Onboarding shows only the logo, progress, Back, and Sign out, and completed profiles visiting /onboarding are redirected to Discover. Required role-specific fields and optional details are defined in [Onboarding](ONBOARDING.md); profile photos remain a later Profile action.

The top bar contains navigation, account controls, and the card-menu toggle, without a separate Get involved/Create event CTA or global search bar. Discovery filters remain on Discover; event creation remains accessible from Event hub and the expanded menu.

The root route shows a **public landing page** when signed out, led by **Community service, organized.** A minimal header and account links accompany an illustrative event-list preview, three explanatory steps, and volunteer/organization sections. No decorative eyebrow labels or map preview are used. Copy describes local discovery, connections, event posting, and event coordination. The page does not display real event records, private navigation, or infer a visitor's location. `/sign-in` and `/sign-up` share this public shell with one centered form panel and no promotional side column; onboarding keeps its separate setup shell. This landing-page iteration is local for review and has not been deployed.

For completed accounts, the root route remains **About**. A [React Bits Carousel](https://www.reactbits.dev/components/carousel) adaptation presents three cards: what Turnout is, who it serves, and what users can do. The first card reads **Service events in your community**. The carousel fits the available page width, supports drag/swipe, arrows, indicators, and keyboard navigation, honors reduced motion, and does not autoplay. Offscreen cards cannot receive focus. Personal impact and upcoming opportunities are removed from this page; verified hours remain on Profile, and event discovery remains on Discover. The community strip reads **Community service in your area** and links to the organization directory.

Loading/empty/error/access states, labeled controls, keyboard focus, and responsive layouts are included. Font and component attribution is in [Design sources](DESIGN_SOURCES.md).

The AI recommendation is retained separately in [AI feature plan](AI_FEATURE_PLAN.md). Event drafting and pasted-announcement extraction are deferred while the team updates the UI.

The legacy `commonly-demo-v1` storage key, `commonly_runtime` database role, and migration/seed lock identifiers remain stable to preserve saved demo data, migration checksums, and database compatibility. They are internal identifiers, not the product name.

## 7. Fixtures and connected seed

All listings are fictional demo data, not actual announcements by the named organizations. Let D be the first seed date in America/New_York:

| Group                         | Opportunity                              | Date / local time | Tasks                                       |
| ----------------------------- | ---------------------------------------- | ----------------- | ------------------------------------------- |
| Williamsburg House of Mercy   | Pantry Packing                           | D+3, 9–11 a.m.    | Sort donations (6), pack grocery bags (6)   |
| Williamsburg House of Mercy   | Pantry Packing, second weekly occurrence | D+10, 9–11 a.m.   | Same capacities, independent reservations   |
| Williamsburg House of Mercy   | Community Meal Preparation               | D+4, 3–5 p.m.     | Food preparation (4), dining setup (4)      |
| Williamsburg Regional Library | Book Donation Sorting                    | D+5, 10 a.m.–noon | Sort books (6), arrange donation tables (4) |
| Williamsburg Regional Library | Community Reading Kit Assembly           | D+7, 1–3 p.m.     | Assemble kits (8), prepare labels (2)       |

Descriptions include demo meeting points and resources. A D−7 pantry event includes 120 and 90 verified minutes for two volunteers; a third has no verified attendance. Two organization fixtures and three volunteer fixtures support the demo, with reservations and an initial comment.

The connected seed is atomic and uses stable IDs; reruns preserve existing data. It requires the explicit seed flag and matching database hostname, and does not create Auth0 users/passwords. Sample organization owners can be mapped to verified Auth0 subjects before first seeding; otherwise fixture identities cannot sign in. Real accounts can create their own groups. See the handoff for setup.

## 8. Verification and deployment boundary

- Check both roles, once-only onboarding, private-data restrictions, and cross-organization denial.
- Verify last-slot behavior, idempotent joins, withdrawal, cancellation, bounded attendance and revisions.
- Exercise finite recurrence across daylight saving changes, combined discovery filters, persistent messages, image validation, and mobile layouts.
- Test transaction-local identity reset after commit/rollback and TLS validation.
- Run typecheck, lint, unit/database tests, production build, and browser demo flows, including both onboarding roles, typo recovery, mandatory selection, invalid/expired selection proof rejection, provider outages, and upgrade preservation.
- PGlite executes the actual portable migration without Supabase mocks. It serializes requests; independent-connection races must also be verified on PostgreSQL before the live demo.
- The DigitalOcean deployment's public health check and outgoing Auth0 login/sign-up redirects have been checked. The application owner confirmed authentication reaches onboarding after saving the allowed URLs. Onboarding completion, logout, cross-browser polling, and persistence across redeploy remain live-environment checks. Local tests cannot claim these passed.

Deployment artifacts are [Dockerfile](../Dockerfile) and [.do/app.yaml](../.do/app.yaml). Paid resources are selected/provisioned by the teammate responsible for DigitalOcean. The secrets/configuration and completion checklist are in the handoff.
