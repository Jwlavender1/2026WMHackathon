# Phase 1 — MVP Source of Truth

[Certain] Status: approved by the user on September 26, 2026. Phase 2 implements the foundation described below, using the supplied Commonly mockup as the visual reference. Implementation and verification notes appear at the end.

## 1. Product contract and boundaries

Deliver one complete journey: an organization publishes volunteer opportunities; a volunteer discovers an event, reserves a task, coordinates with attendees, and receives organizer-verified service hours.

- Accounts use email/password and choose one fixed role: volunteer or organization. An organization account represents its owner/operator; the group is the public organization identity.
- Volunteers edit their display name, picture, bio, and city. Their hours are computed from verified attendance.
- Each organization account owns one group in this MVP. It manages group details, event occurrences, task capacities, attendees, and attendance. Multiple staff accounts and group membership are deferred.
- Public visitors browse groups and upcoming events and share event URLs. Signing up or participating in a thread requires authentication.
- Sign-ups reserve one task per volunteer per event occurrence. No waitlist, donations, payments, or resource inventory tracking.
- Community sharing means public event/group pages and a copy-link button. Day-of messaging means a persistent event comment thread with live updates; no direct messages or attachments.
- Proposed scope boundary: email/password account emails are included; event email subscriptions, digests, reminders, inbound email ingestion, and email-to-thread replies are deferred. “Email event streaming” needs a separate product definition if required for this hackathon.

## 2. Stack

| Layer             | Recommendation                                                   | Purpose                                                 |
| ----------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| Web application   | Next.js App Router, React, TypeScript                            | One application for pages, reads, and server mutations  |
| UI                | Tailwind CSS and a small set of accessible shadcn/ui components  | Responsive forms, cards, dialogs, tabs                  |
| Data and identity | Supabase PostgreSQL, Auth, Storage                               | Relational data, email/password sessions, avatar images |
| Live thread       | Supabase Realtime Postgres Changes                               | Subscribe to authorized event comments                  |
| Validation        | Zod and PostgreSQL constraints                                   | Validate inputs and preserve data integrity             |
| Hosting           | Vercel plus a Supabase project                                   | Straightforward deployment                              |
| Verification      | TypeScript/ESLint, focused database tests, Playwright smoke flow | Verify permissions and the core journey                 |

Use the Supabase JavaScript client, generated database types, SQL migrations, and `@supabase/ssr` cookie sessions. Pin compatible stable package versions and commit the lockfile during Phase 2. A separate API service, ORM, queue, and global client state library are unnecessary for this scope.

[Certain] Supabase documents a Next.js starter with cookie auth, TypeScript, and Tailwind, and recommends `@supabase/ssr` for cookie-based sessions. Sources: [Next.js quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), [server package selection](https://supabase.com/docs/guides/auth/choosing-a-server-package).

## 3. Database schema

Proposed conventions: UUID primary keys, `created_at timestamptz` on all application tables, `updated_at timestamptz` on mutable records, non-null fields unless marked `?`, and foreign keys on every reference. Store instants in UTC; retain an IANA event time zone, default `America/New_York`.

| Table            | Fields beyond common timestamps                                                                                                                                                                                                                                         | Relationships / constraints                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.users`     | Managed ID, email, credentials                                                                                                                                                                                                                                          | Supabase-managed identity; never expose credentials or copy them into application tables                                                       |
| `users`          | `id`, `role: volunteer\|organization`                                                                                                                                                                                                                                   | ID is PK/FK to `auth.users`; role set during onboarding and immutable through ordinary client updates                                          |
| `profiles`       | `user_id`, `display_name text`, `avatar_path text?`, `bio text`, `city text`                                                                                                                                                                                            | `user_id` is PK/FK to users; one profile per account                                                                                           |
| `groups`         | `id`, `owner_id`, `name text`, `slug text`, `description text`, `city text`, `website_url text?`                                                                                                                                                                        | Unique owner and slug; owner must have organization role                                                                                       |
| `event_series`   | `id`, `group_id`, `frequency: weekly`, `interval_weeks smallint`, `occurrence_count smallint`, `timezone text`, `first_local_start timestamp`, `duration_minutes int`                                                                                                   | Interval 1 or 2; count 2–12; immutable generation recipe                                                                                       |
| `events`         | `id`, `group_id`, `series_id?`, `occurrence_index smallint?`, `title text`, `description text`, `venue text`, `address text`, `city text`, `starts_at timestamptz`, `ends_at timestamptz`, `timezone text`, `resources_to_bring text[]`, `status: published\|cancelled` | End after start; unique `(series_id, occurrence_index)`; series/group must match; series ID/index both present or both absent                  |
| `event_tasks`    | `id`, `event_id`, `name text`, `description text`, `capacity int`                                                                                                                                                                                                       | Capacity > 0; unique task name per occurrence; unique `(id, event_id)` supports composite FK                                                   |
| `signups`        | `id`, `event_id`, `task_id`, `volunteer_id`, `status: active\|withdrawn`, `verified_minutes int?`, `verified_by uuid?`, `verified_at timestamptz?`                                                                                                                      | Unique `(event_id, volunteer_id)`; composite `(task_id, event_id)` FK to task; verifier FK to users; attendance fields all null or all present |
| `event_comments` | `id`, `event_id`, `author_id`, `body text`, `hidden_at timestamptz?`                                                                                                                                                                                                    | Author FK to users; trimmed body 1–2,000 characters; hide preserves thread history                                                             |

Relationships: identity → user → profile; organization user → group → events → tasks → sign-ups; volunteer user → sign-ups; group → series → occurrences; event → comments ← author.

Indexes: events `(status, starts_at, id)`, `(group_id, starts_at)`, and normalized city; tasks `(event_id)`; sign-ups `(task_id, status)` and `(volunteer_id)`; comments `(event_id, created_at, id)`. Small-data substring search is sufficient initially; geospatial/radius and full-text search are deferred.

### Integrity and behavior

- **Sign-ups:** a database transaction locks the target task, verifies volunteer identity, event availability and remaining capacity, then inserts or reactivates the volunteer's unique signup. Repeated active reservations return the existing result. A task change requires withdrawing first. Concurrent requests cannot overbook. No sign-up or withdrawal after the event starts.
- **Capacity:** organization updates use the same task lock; capacity cannot fall below active reservations. Event tasks cannot be removed after receiving sign-ups.
- **Hours:** after an event ends, its owner records an integer number of served minutes per active signup, including zero for a no-show, bounded by the event duration. Revisions update that same record. `Hours Served = SUM(verified_minutes) / 60`, displayed to one decimal; never add hours merely for registering. Only the owner can verify, and only for a noncancelled event. No direct client edits to verification fields.
- **Recurrence:** support weekly and every-two-weeks series, with 2–12 occurrences generated immediately in one transaction. Generate each local calendar date in the selected zone to preserve wall-clock time through daylight saving changes; reject ambiguous or nonexistent local start times. Copy event details and tasks into each occurrence. A volunteer registers for each date individually. Edit or cancel one future occurrence at a time; bulk series edits and indefinite recurrence are deferred.
- **Lifecycle:** creation publishes immediately. Upcoming means published with `starts_at > now`; ongoing means published with `starts_at <= now < ends_at`; previous means `ends_at <= now`. Dashboard tabs show upcoming/ongoing, previous, and cancelled events. Cancel future or ongoing occurrences without deleting sign-ups or comments. Cancelled events accept no sign-ups or new messages and cannot receive verified hours. Past times and task definitions are immutable to protect attendance records.
- **Edits:** future event details can change; signed-up volunteers see current details on their Events page. Automated change notifications are outside the proposed scope.
- **Threads:** owner and active registered volunteers can read a thread, including after the event ends or is cancelled. They can post while the event is published and until 24 hours after its end. Authors can hide their own posts; the owner can hide any post. A safe author projection exposes only display name/avatar to thread participants.

### Authorization

Enable RLS and least-privilege grants on all application tables and Storage. Public access is limited to group public details, event details, task descriptions, and aggregate availability; owner IDs, attendee identities, email addresses, private profiles, and verification data are excluded from public projections. A volunteer reads their own profile, sign-ups, and hours. A group owner reads their group's attendees and scoped display names and manages only their group's records.

Every Server Action validates the authenticated user, input, and ownership. Transactional functions derive identity from the session, restrict execution permissions, and check authorization internally; use a fixed search path if privileged SQL functions are needed. Users cannot bypass signup or verification rules with direct table writes. Use user-scoped server clients for normal requests; reserve server secrets for seed/admin operations. Storage uploads use user-owned paths, JPEG/PNG/WebP only, maximum 2 MB, and authenticated image reads.

[Certain] Next.js requires authorization checks inside Server Functions. Supabase RLS applies database-level access rules, and exposed views also need explicit security consideration. Sources: [Next.js mutations](https://nextjs.org/docs/app/getting-started/mutating-data), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 4. Reads and mutations

Use server-side data access helpers for initial page reads and Server Actions for mutations; avoid a parallel REST API for the same operations. Return consistent action results: success data or a code plus field errors (`UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_ERROR`, `FULL`, `CONFLICT`, `NOT_FOUND`).

| Interface                                                      | Contract                                                                                                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signUp`, `signIn`, `signOut`                                  | Supabase Auth; validated initial role; idempotent onboarding creates user/profile together                                                                                              |
| `GET /auth/confirm`                                            | Validate authentication email token and redirect to onboarding/profile                                                                                                                  |
| `getMyProfile`, `updateProfile`, `uploadAvatar`                | Owner profile; computed hours; validated image upload                                                                                                                                   |
| `getMyGroup`, `createGroup`, `updateGroup`                     | Organization owner only; enforce one group per owner                                                                                                                                    |
| `listEvents({q, city, groupId, task, cursor})`                 | Public published upcoming events; title/description search, case-insensitive city/task substring, exact group; filters combine with AND; 20 events per page sorted by `(starts_at, id)` |
| `getGroup(slug)`, `getEvent(id)`                               | Safe public projections, tasks, remaining slots, recurrence label; personalized reservation fetched separately                                                                          |
| `getMyEvents`, `getEventHub`                                   | Volunteer reservations including cancellations, or owner's events by tab                                                                                                                |
| `createEvent(input)`                                           | Owner only; event/tasks and optional finite series created atomically                                                                                                                   |
| `updateEvent(id, input)`, `cancelEvent(id)`                    | Owner only; lifecycle and capacity checks; occurrence-level operations                                                                                                                  |
| `joinEvent(eventId, taskId)`, `withdrawSignup(eventId)`        | Volunteer only; transactional capacity and identity checks                                                                                                                              |
| `getAttendees(eventId)`, `verifyAttendance(signupId, minutes)` | Owner only; attendance upsert, verifier/time recorded, hours refreshed                                                                                                                  |
| `listComments(eventId, cursor)`, `postComment`, `hideComment`  | Authorized participants; 50 messages per page; thread restrictions applied                                                                                                              |

Realtime subscriptions listen only to the active event's comments under the same read policies. Re-fetch authorized messages on reconnect and offer manual refresh on connection failure. Database rows remain the authoritative history. [Certain] Supabase supports Postgres Changes subscriptions with access controlled by RLS: [Realtime documentation](https://supabase.com/docs/guides/realtime/postgres-changes).

## 5. Routes and UI structure

```text
RootLayout
├─ AppHeader / role-aware navigation
├─ /                         Landing page and upcoming opportunities
├─ /sign-in, /sign-up        AuthForm + RoleSelector
├─ /browse                  SearchFilters + EventCardList + Pagination
├─ /groups/[slug]           GroupHeader + UpcomingEventList
├─ /events/[id]             EventDetails + ResourcesList + RecurrenceBadge
│                           + TaskSignupPanel + EventThread (authorized)
├─ /events                  MyEvents: upcoming, ongoing, previous, cancelled
├─ /profile                 AvatarUpload + ProfileForm + HoursServedCard
├─ /my-group                GroupForm + link to Event Hub (organization)
├─ /event-hub               EventTabs + EventTable + CreateEventButton
├─ /event-hub/new           EventForm + TaskEditor + RecurrenceFields
└─ /event-hub/[id]/manage   EditEventForm + AttendeeList + AttendanceForm
```

Server Components load initial data. Client components handle interactive filters, forms, uploads, reservation controls, and the live thread. Filters live in URL query parameters for shareable searches. Mobile layouts stack cards/forms and replace wide tables with attendee cards. Each route has loading, empty, error, and unauthorized states; controls have labels, keyboard access, and pending/error feedback.

Suggested project layout: `src/app`, `src/components/{auth,profile,groups,events}`, `src/lib/{supabase,data,validation}`, `src/app/actions`, `supabase/migrations`, `supabase/tests`, and `scripts/seed.ts`. Keep this document at `docs/MVP_SPEC.md` and update it when accepted scope changes.

## 6. Seed contract for Phase 2

[Certain] The following are fictional demo opportunities using the organization names requested by the user; they are not verified real listings. Venues and logistics must be labeled as demo data.

The seed script will create two organization owners, three volunteers, both groups, five upcoming event occurrences, task capacities, example reservations, and sample comments. It will also create one completed event with verified attendance so profile hours and Event Hub history are immediately demonstrable. Stable fixture identifiers make reruns idempotent; do not overwrite changed fixtures or reset dates on rerun. Allow seeding only a designated local/demo project. Test credentials remain local.

Use the seed execution date as local day D in `America/New_York`; the example dates below assume D = September 26, 2026. Subsequent fresh seeds calculate dates from their execution date.

| Organization / opportunity                                     | Date and local time      | Demo location                           | Task capacities                           | Bring / recurrence                                     |
| -------------------------------------------------------------- | ------------------------ | --------------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| Williamsburg House of Mercy — Pantry Packing                   | D+3: Sep 29, 9–11 a.m.   | Williamsburg, demo pantry packing room  | Sort donations: 6; pack grocery bags: 6   | Closed-toe shoes, water; weekly occurrence 1 of 2      |
| Williamsburg House of Mercy — Pantry Packing                   | D+10: Oct 6, 9–11 a.m.   | Same demo pantry                        | Sort donations: 6; pack grocery bags: 6   | Closed-toe shoes, water; weekly occurrence 2 of 2      |
| Williamsburg House of Mercy — Community Meal Preparation       | D+4: Sep 30, 3–5 p.m.    | Williamsburg, demo community kitchen    | Food preparation: 4; dining setup: 4      | Closed-toe shoes, hair tie; one-time                   |
| Williamsburg Regional Library — Book Donation Sorting          | D+5: Oct 1, 10 a.m.–noon | Williamsburg, demo library sorting room | Sort books: 6; arrange donation tables: 4 | Comfortable shoes, water; one-time                     |
| Williamsburg Regional Library — Community Reading Kit Assembly | D+7: Oct 3, 1–3 p.m.     | Williamsburg, demo library meeting room | Assemble kits: 8; prepare labels: 2       | Reading glasses if needed; supplies provided; one-time |

Descriptions should explain the listed tasks and meeting point. Completed fixture: D−7 pantry session; two volunteers verified for 120 and 90 minutes, yielding 2.0 and 1.5 profile hours; third volunteer has no verified attendance and 0 hours.

## 7. Phase 2 acceptance checks

- Both roles can register/sign in; refresh preserves the session; volunteers can update their own bio and avatar.
- One organization cannot edit another's group, events, attendance, or comments; visitors cannot read attendee data; volunteers cannot forge hours or change roles.
- Creating a series generates exactly the requested occurrences and independent task capacities; test a recurrence spanning daylight saving time.
- Two concurrent requests for the final task slot produce one reservation; repeat requests do not duplicate signups; withdrawal releases the slot.
- Combined city/group/task filters return matching future events, with stable pagination and an empty state.
- Two authorized browsers see persistent thread updates; unauthorized subscribers cannot read them.
- Completed attendance updates the correct profile total once; revisions replace minutes; cancelled events cannot accrue hours.
- Seeded past/upcoming events populate the dashboard and discovery views; mobile navigation and the core registration-to-attendance journey work.

[Certain] The user approved Phase 1 and authorized the foundation commit on main.

## 8. Foundation implementation notes

- The supplied mockup establishes the Commonly brand, sidebar, search header, dark photo hero, emerald/mint palette, serif headings, impact card, and opportunity cards. Images are bundled locally.
- Messages links to authorized event conversations; Community lists organization groups. The impact card reports verified all-time totals and the next registered event. Monthly goals, unread badges, and direct messaging are not fabricated.
- A visibly labeled local demo uses the same domain rules and realistic fixtures, with browser storage persistence and sample account switching. It is not authentication or a shared database. Live mode uses Supabase cookie sessions, Server Actions, authorized database functions, RLS, Storage, and Realtime.
- The initial scaffold uses a single authorized `app_snapshot()` read and an `app_command(kind, payload)` mutation dispatcher rather than separate transport endpoints per operation. Each mutation still validates its own schema and permissions. Initial records are fetched server-side, then discovery filters and 20-item pages are applied in the browser; conversation history displays 50 messages at a time. This intentionally targets hackathon-sized data. Move reads to filtered database queries and cursor pagination before growing the dataset.
- Accessible native controls and Tailwind plus shared CSS provide the UI; no additional shadcn component dependency is needed yet. Database-shaped TypeScript models are included; generate Supabase database types when linking a hosted project.
- The finite series is generated inside a database transaction. Editing preserves task identities and allows capacities to change; adding/removing/renaming tasks on an existing occurrence is outside this initial editor. Event titles, descriptions, meeting points, resources, and times can be edited before the start.
- Database verification runs the actual migration in PGlite with a small Auth/Storage schema harness. This checks SQL constraints, grants, and RLS, but does not replace hosted Supabase authentication, image upload, Realtime, or independent-connection concurrency verification. Those require a configured Supabase project.
