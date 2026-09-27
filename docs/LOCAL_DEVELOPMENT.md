# Run Turnout locally

**Current state:** the app works immediately in browser-local demo mode. Live mode is wired for Auth0 and PostgreSQL; account configuration and a database are required to use it. See [the handoff](AUTH0_DIGITALOCEAN_HANDOFF.md). No cloud account or database is needed for the demo instructions below.

## First setup

Install Git and Node.js 24, and obtain access to the team's GitHub repository. Then run:

```sh
git clone https://github.com/Jwlavender1/2026WMHackathon.git
cd 2026WMHackathon
npm ci
npm run dev
```

Open **http://localhost:3000**. Run commands from the directory containing `package.json`, not its parent `hackathon` directory. If you already have this clone, follow [Team Workflow](TEAM_WORKFLOW.md) to update it instead of cloning again.

**Windows PowerShell:** if `npm.ps1 cannot be loaded`, use `npm.cmd ci` and `npm.cmd run dev` (and `npx.cmd` instead of `npx`). There is no need to change PowerShell's execution policy.

## Try the demo

- Use `APP_MODE=demo` (also the default when unset). A fresh clone does not need `.env.local`. The old Supabase variables are no longer used.
- A fresh browser starts on the landing page. Choose **Sign in**, select Volunteer or Organization, and submit to use a sample account; no password or Auth0 account is needed in demo mode. **Create an account** starts local onboarding. Signed-out visitors cannot browse app pages.
- Once signed in, look for the **Demo workspace** banner. Its **Try a role** selector switches between volunteers and the two organization coordinators. Navigation is in the top bar; open its menu button to see the navigation cards on smaller screens. Sign out to review the landing page again; existing browser sessions remain signed in until you do.
- As a volunteer: discover an event, reserve a task, post a message, and edit your profile.
- Discover starts with your confirmed city and state. To search elsewhere, change its Location field; clearing that field and pressing Filter shows all locations. Older profiles without a confirmed city are prompted to update Profile.
- As an organizer: use **My group** and **Event hub**, create an event or recurring series, then use **Previous events** to verify sample attendance.
- To try onboarding: open `/sign-up`, enter a name, and create a demo account. Choose Volunteer or Organization, continue, then select a city suggestion. Organization setup creates its group in the same submission.
- Demo city lookup is deliberately limited to **Williamsburg, VA**, **Williamsburg, KY**, and **Richmond, VA**, including common misspellings. It needs no API key. Live lookup uses Geoapify; a key alone does not switch demo mode to live mode.
- Fixtures include two organizations, five future occurrences, and one past event. All listings are fictional. Changes persist in this browser only; they are not shared with teammates.
- To reset: browser DevTools → Application/Storage → Local Storage → `http://localhost:3000` → remove **only** `commonly-demo-v1`, then reload. Fresh fixtures use the current date.

## Daily commands

```sh
npm run dev          # Development server with live code updates
npm run typecheck    # TypeScript
npm run lint         # Code checks
npm test             # Domain + embedded database tests; no hosted DB needed
npm run build        # Production build, includes TypeScript verification
```

Stop the running server with **Ctrl+C** before building, reinstalling dependencies, or changing server mode. To preview the production build:

```sh
npm run build
npm run start
```

For browser tests, keep that production server running in demo mode, then run `npm run test:e2e` in a **second terminal**. The tests use installed Chrome on Windows; on macOS/Linux, first run `npx playwright install chromium`. Screenshots are written to `.artifacts/`. The tests can start their own server, but using a separate terminal also avoids Windows server-shutdown hangs. Do not reuse a development server or a live-data server for this suite.

## Common fixes

| Symptom                                     | Fix                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cannot find `package.json`                  | Change into the cloned repository folder.                                                                                                                                |
| `npm ci` fails after pulling                | Check Node version and registry access. If the committed manifest/lockfile disagree, have the dependency-change author fix and commit both; do not discard the lockfile. |
| Port 3000 is busy                           | Stop your other app instance, or use `npm run dev -- --port 3001` and visit that port. Browser tests still require port 3000.                                            |
| No demo banner / missing live configuration | Set `APP_MODE=demo` in your local environment and restart; live mode requires Auth0 and database configuration.                                                          |
| Old demo data                               | Reset the single localStorage entry as described above.                                                                                                                  |
| New environment values have no effect       | Restart the development server. Ensure shell variables are not overriding `.env.local`.                                                                                  |

For live integration, copy `.env.example` to your own `.env.local` if it does not already exist, and follow the handoff for Auth0, TLS, database users, migration, and seed setup. `.env.local` stays untracked. Use `npm run db:migrate`, `npm run db:grant-runtime`, and `npm run seed` with the intended database credentials. These commands do not provision DigitalOcean resources. For a PostgreSQL server running on localhost, use `PGSSL_MODE=disable` only if it has no TLS; remote connections require verification.

Live onboarding also requires **GEOAPIFY_API_KEY** in `.env.local` and migration **002_onboarding_locations.sql**. The key stays server-side; never prefix it with `NEXT_PUBLIC_`. Restart after changing environment variables. See [onboarding and location behavior](ONBOARDING.md) for fields, validation, and the existing-deployment upgrade steps.

The expanded category list and event category selector also require **003_event_categories.sql** in live mode. Run `npm.cmd run db:migrate` before deploying this version; see [Categories](CATEGORIES.md). Local demo mode needs no migration.

Account deletion requires **004_account_deletion.sql** before deploying the updated server. See [Account deletion](ACCOUNT_DELETION.md) for retained history, Auth0 behavior, and upgrade instructions. The migration itself does not delete accounts.

Event deletion also requires **005_event_deletion.sql** before deployment. See [Event management](EVENT_MANAGEMENT.md) for edit, cancellation, and deletion rules.
