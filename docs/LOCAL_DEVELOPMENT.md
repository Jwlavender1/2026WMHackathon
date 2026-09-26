# Run Commonly locally

**Current state:** the app works immediately in browser-local demo mode. Auth0 and DigitalOcean are the selected next providers, but their integration is not implemented yet. See [the handoff](AUTH0_DIGITALOCEAN_HANDOFF.md). No cloud account or database is needed for this guide.

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

- Leave `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` unset/empty, including any shell environment values. A fresh clone does not need `.env.local`.
- Look for the **Demo workspace** banner. The sidebar selector switches between volunteers and the two organization coordinators; on mobile, open the navigation menu first.
- As a volunteer: discover an event, reserve a task, post a message, and edit your profile.
- As an organizer: use **My group** and **Event hub**, create an event or recurring series, then use **Previous events** to verify sample attendance.
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

| Symptom                               | Fix                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cannot find `package.json`            | Change into the cloned repository folder.                                                                                                                                |
| `npm ci` fails after pulling          | Check Node version and registry access. If the committed manifest/lockfile disagree, have the dependency-change author fix and commit both; do not discard the lockfile. |
| Port 3000 is busy                     | Stop your other app instance, or use `npm run dev -- --port 3001` and visit that port. Browser tests still require port 3000.                                            |
| No demo banner / Supabase error       | Remove or empty both Supabase public variables in local files and the shell, then restart.                                                                               |
| Old demo data                         | Reset the single localStorage entry as described above.                                                                                                                  |
| New environment values have no effect | Restart the development server. Auth0/DO variables will not take effect until their integration lands.                                                                   |

When live integration is ready, copy the updated `.env.example` to your own `.env.local` and obtain development credentials from the team owner. `.env.local` stays untracked. Do not run the current Supabase seed or migration against DigitalOcean; they depend on Supabase-specific services.
