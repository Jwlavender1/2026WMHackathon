# Categories

The same list is used for volunteer interests, organization focus areas, and organizer-selected event categories:

Food access, Education, Environment, Health, Housing, Gift-making, Clothing, Letter writing, Religious, Campaign, Community support.

- **Education** is reused, not duplicated.
- **Environment** includes clean-up activities; there is no separate Clean-up label.
- **Community support** is the catch-all for other service activities.
- **Campaign** includes community awareness, donation drives, and political campaigning.
- Organizers explicitly select event categories. The app no longer guesses a descriptor from an event title or organization name. Religious and Campaign are never inferred.
- Event tiles stay free of category badges. Selected categories appear as plain text on event details.
- Recurring events copy the selected categories to each occurrence. Editing categories changes only the selected occurrence.

## Database update before deployment

This change needs **003_event_categories.sql**, included in the repository. It has not been applied to the hosted database by this change.

With the existing migration connection and certificate configured in your ignored `.env.local`, run from the project folder:

```powershell
npm.cmd run db:migrate
```

The command applies missing migrations; it does not rerun the seed or delete existing records. Existing profile/group selections are kept. Existing events start with no saved categories; their organizers can select categories when editing. Older app versions that omit event categories preserve any saved selections. The new live health check requires migration 003.

Deploy the updated app after the migration succeeds. Demo mode uses browser storage and needs no database update. Fresh fixtures have explicit sample categories; existing demo events without categories can be updated through the event editor.
