# Team Git workflow

**Foundation phase:** small, coordinated commits directly to `main` are allowed, as agreed. Tell teammates which files you are editing before starting. For overlapping or larger work, use a feature branch and pull request (below). Checks are currently manual; this repository has no CI pipeline yet.

## 1. Start a task / get the latest code

Run from the repository folder. Stop your local server before reinstalling dependencies.

```sh
git status
git switch main
git pull --ff-only origin main
npm ci
npm run dev
```

Start this sequence with a clean working tree. If you have unfinished edits, first use the preservation steps below. `--ff-only` stops when local and remote history diverge; use the rejected-push procedure if the extra local commits are your unpublished work.

**Pulling** downloads and integrates code. **Committing** saves it locally. **Pushing** publishes commits to GitHub. Teammates cannot pull a commit that has not been pushed. Use `git fetch origin` followed by `git log --oneline origin/main..main` to see local main commits not yet on the remote; the maintainer must publish them before teammates can retrieve them.

## 2. Check, commit, and push

Before committing, run the applicable checks:

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

For UI or user-flow changes, also run `npm run test:e2e` using the production demo setup in [Local Development](LOCAL_DEVELOPMENT.md). Documentation-only edits need a formatting/link check, not a full application test run.

Review and stage only your intended files. Replace the example path/message with your change:

```sh
git diff
git add src/components/events.tsx
git diff --cached
git commit -m "Improve event reservation feedback"
git pull --rebase origin main
git push origin main
```

Use this sequence on `main` with a clean working tree after committing. The rebase replays **only unpublished local commits** on the latest remote main. If it incorporates new teammate changes, rerun the relevant checks before pushing. After pushing, share the commit hash (`git rev-parse --short HEAD`), a brief description, and any environment/migration changes with the team.

## 3. If a push is rejected

A teammate may have pushed first. Do not force-push shared `main`:

```sh
git pull --rebase origin main
# Resolve any conflicts, then rerun affected checks.
git push origin main
```

For conflicts, run `git status`, open the listed files, keep the intended combined behavior, and remove conflict markers. Stage each resolved file with `git add <path>`, then run `git rebase --continue`. If unsure, run `git rebase --abort` to return to the pre-rebase state and coordinate with the other author. Rejected authentication/permission checks or branch protection need repository access/a pull request, not a force-push.

## 4. Update while you have unfinished edits

Stay on the branch where the edits belong. For unfinished work on `main`:

```sh
git stash push -u -m "WIP before updating main"
git pull --ff-only origin main
git stash pop
```

If the pull fails, resolve that issue before restoring the stash. If `stash pop` conflicts, the stash is retained: resolve files using `git status` and verify your work before discarding the saved stash. Never use `git reset --hard` or `git clean` just to get updates. Stash does not include ignored `.env.local` or `node_modules` files.

## 5. When two people need the same area

From clean, updated `main`:

```sh
git switch -c feat/event-filters
# Edit, check, stage, and commit as above.
git push -u origin feat/event-filters
```

Open a GitHub pull request targeting `main`; include what changed and how you checked it. To update an already-shared feature branch, run `git fetch origin`, then `git merge origin/main` on that branch. Resolve conflicts, retest, and push the branch. After the PR merges, switch to `main` and pull again. No force-push is needed for this workflow.

## Shared-project rules

- Commit both `package.json` and `package-lock.json` for dependency changes; teammates then run `npm ci`.
- Never commit `.env.local`, passwords, tokens, database URLs containing credentials, or service keys. Add **variable names and empty placeholders** to `.env.example` and document changes.
- Coordinate database changes with one migration owner. Add new migrations; do not rewrite a migration already applied to a shared database. Run seeds only against designated demo/development databases.
- Restart after environment changes. A Git pull does not apply database migrations or synchronize local demo data.
- An App Platform deployment is separate from a Git push until configured. If main auto-deploy is enabled later, each push may start a deployment; check its build/runtime status and deployed commit before a demo. Assign one person to release-time migrations.
