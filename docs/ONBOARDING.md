# Onboarding and locations

**Deployment status:** migration `002_onboarding_locations.sql` has been applied to the team's DigitalOcean database. Both migration checksums match this checkout; existing user/group/event counts were unchanged, and the deployed `/api/health` returned `ok` in live mode afterward. The updated onboarding application code is still awaiting commit/push and deployment; the current website remains supported by the migration's city-only compatibility path.

## User flow

Onboarding has its own logo, Sign out control, and two-step form. It has no main navigation or site footer. Authenticated accounts without a completed profile see this flow regardless of the route they open.

1. Choose **Volunteer** or **Organization**. The choice remains editable with Back until submission; the saved role is permanent in this MVP.
2. Complete the role-specific details:

| Account      | Required                                                                          | Optional                                        |
| ------------ | --------------------------------------------------------------------------------- | ----------------------------------------------- |
| Volunteer    | Display name, selected city/state/country                                         | About me, skills, cause interests               |
| Organization | Contact person's name, organization name/description, selected city/state/country | Website, public contact email, cause categories |

Auth0 account email is displayed read-only when available; it is not copied into the public organization contact field. Photos can be added on Profile after setup. Organization profile and group creation are one database transaction: a failed group does not leave a completed account without its group. Volunteers continue to Profile; organizations continue to Event hub.

## Location contract

- The MVP supports **US cities/towns**. Users must choose a suggestion showing city, state, and country. No home street address or device location is requested.
- `/api/locations?q=...` uses Geoapify city autocomplete in live mode. It requires an Auth0 session, accepts 3–100 characters, debounces requests in the UI, and limits each identity to 60 searches/minute per running instance. A multi-instance deployment multiplies that limit.
- Geoapify suggestions can recover common typos and distinguish cities with the same name. Results vary with provider coverage; an unrecognized query cannot be saved as a new city.
- Each suggestion carries a signed, identity-bound selection proof valid for one hour. The server checks the proof when saving and derives all location fields from it, ignoring browser-supplied city/coordinates. An expired proof requires selecting the city again. An unchanged location already stored on an authorized record needs no new provider request.
- Profiles, groups, and events store `location` JSON with `provider`, `id`, `city`, `state_code`, `country_code`, `latitude`, and `longitude`. Coordinates represent the city, not the person's address. The original `city` column remains for compatibility and is derived from the selected location on new writes.
- Provider failures show a retry message; live mode never substitutes demo cities. Keyboard selection supports arrow keys, Enter, and Escape. Editing selected text clears the selection.
- Demo mode uses three fixed cities and browser-local storage. Resetting that storage recreates fixtures. Existing records with only a city string remain readable but require a confirmed selection when edited; no state is guessed.
- Migration 002 also accepts the old deployed server's city-only requests during rollout. It retains existing ownership checks and clears a stored structured location if an old form changes its city text. The new application's server validation always requires a selected location; supplying an explicit invalid location to the database is rejected.

Geoapify key configuration and provider storage terms: [autocomplete API](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/), [autocomplete service](https://www.geoapify.com/address-autocomplete/).

## Upgrade an existing deployment

The DigitalOcean owner coordinates releases with the database migration operator. Migration 002 is already applied to the team's database; the steps below document the process for other databases and future release checks. Local embedded-database tests do not apply migrations to a deployed database.

1. Confirm the encrypted web runtime variable **GEOAPIFY_API_KEY** is set. Keep **AUTH0_SECRET** stable; it protects sessions and signs location selections. Neither secret belongs in Git.
2. Confirm the connection targets Turnout's existing database and uses the table owner account (`doadmin` on this deployment). Migration 002 supports the old city-only server as well as the updated application, so the currently deployed forms can remain usable during rollout.
3. From the new checkout on a trusted machine, with the intended **MIGRATION_DATABASE_URL** and TLS settings, run `npm run db:migrate`. This applies pending migrations transactionally and verifies existing checksums. **Do not edit or rerun 001 by hand.** There is no need to reseed or erase existing data.
4. Deploy the matching application code. `/api/health` checks the new database function as well as the existing snapshot function. Existing users keep their role/group and skip onboarding; their missing structured location is confirmed during their next edit.
5. Verify a fresh volunteer and organization through real Auth0 login: search `Williasmbrg`, select the intended state, save, log out/in, and confirm the saved profile/group. Verify event creation inherits the organization's city, edits persist, and no main navigation appears during setup.

An application rollback can leave migration 002 in place: old requests remain supported. Old forms cannot collect or verify the new location fields; the updated app is required for the new onboarding experience. Do not delete migration history or data to roll back the interface.

## Local checks

`npm test` covers selection proof validation, provider parsing/failures, role states, migration upgrades, atomic organization creation, and database authorization. `npm run test:e2e` exercises both onboarding roles, typo suggestions, explicit selection, back navigation, optional details, provider failure, logout, and existing event flows in demo mode. The live Geoapify key has been exercised against normal and misspelled city queries; full production onboarding must be checked after this release.
