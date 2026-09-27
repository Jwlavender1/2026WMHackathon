# Editing, cancelling, and deleting events

Organization owners manage their own events from **Event hub**. Each upcoming event has **Edit event**, **Manage**, and **Delete event** controls. Manage opens attendance, the editor, cancellation, and deletion controls.

- **Edit:** update a future published occurrence's title, description, location/venue, date and duration, categories, resources, and task capacities. Existing registrations stay attached. Capacity cannot fall below current reservations; published task identities, names, descriptions, and the recurring schedule stay fixed. Changes affect only the selected occurrence.
- **Cancel:** close an upcoming or ongoing event while keeping it and its signups visible as cancelled. Its conversation becomes read-only. Use this when participants need a visible cancellation record.
- **Delete:** permanently remove an event that has not started, including its tasks, signups, and conversation. A dialog shows the event/date, the number of active reservations, and the recurring-occurrence scope. Keep event or Escape makes no changes. Events that have started or have any verified attendance (including zero minutes) cannot be deleted, preserving service history. Future cancelled events can be deleted.

Deleting one recurring occurrence leaves all other occurrences and their signups unchanged. The series row is removed only after its final occurrence is deleted. Deletion does not send emails or external notifications; edits appear when participants refresh.

Both demo and live paths enforce these rules. Live deletion uses the authenticated server actor, verifies organization ownership, and locks the event in one database transaction. Direct table deletion remains denied to the runtime role. A failed deletion rolls back all associated removals; concurrent signups, edits, and cancellation use the same event lock.

## Deployment

Apply **005_event_deletion.sql** before deploying this version. From the project directory with the existing migration credentials and CA configured in the ignored `.env.local`:

```powershell
npm.cmd run db:migrate
```

This applies pending migrations in order, including 004 if needed. The migration adds the deletion function and does not delete any events itself. The updated health check requires it. No seed/reset is needed. Local demo mode requires no database migration.
