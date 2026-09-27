'use server';
import { z } from 'zod';
import {
  eventSchema,
  groupSchema,
  occurrences,
  profileSchema,
  onboardingSchema,
  deleteAccountSchema,
  deleteEventSchema,
} from '@/lib/domain';
import { verifyLocation } from '@/lib/geocoding';
import { locationSchema } from '@/lib/location';
import { withDatabaseUser } from '@/lib/db/server';
import { validateAvatar } from '@/lib/avatar';
import { emptySnapshot, type Result, type Snapshot } from '@/lib/types';
import { auth0 } from '@/lib/auth0';

const uuid = z.uuid();
const commandSchemas = {
  delete_account: deleteAccountSchema,
  delete_event: deleteEventSchema,
  onboard: onboardingSchema,
  profile: profileSchema,
  group: groupSchema,
  join: z.object({ event_id: uuid, task_id: uuid }),
  withdraw: z.object({ event_id: uuid }),
  cancel: z.object({ event_id: uuid }),
  verify: z.object({ signup_id: uuid, minutes: z.coerce.number().int().min(0).max(720) }),
  comment: z.object({ event_id: uuid, body: z.string().trim().min(1).max(2000) }),
  hide_comment: z.object({ comment_id: uuid }),
};
export async function readSnapshot(): Promise<Snapshot> {
  // The landing page must not fetch or serialize app records for signed-out visitors.
  if (!(await auth0().getSession())?.user.sub) return emptySnapshot();
  return withDatabaseUser(async (client, actor, displayName, identity) => {
    // A still-valid Auth0 cookie must not expose app data or recreate a deleted account.
    if (!actor) return emptySnapshot();
    const { rows } = await client.query<{ snapshot: Snapshot }>(
      'SELECT public.app_snapshot() AS snapshot',
    );
    const snapshot = rows[0].snapshot;
    if (actor && !snapshot.profile)
      snapshot.onboarding = { display_name: displayName, email: identity.email };
    return snapshot;
  });
}
export async function runCommand(kind: string, input: unknown): Promise<Result<{ id: string }>> {
  try {
    let payload: Record<string, unknown>;
    if (kind === 'create_event' || kind === 'update_event') {
      const value = eventSchema.parse(input);
      const dates = occurrences(value);
      payload = {
        ...value,
        resources_to_bring: value.resources
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      };
      if (kind === 'update_event') {
        const edit = z.object({ event_id: uuid, task_ids: z.array(uuid) }).parse(input);
        payload = {
          ...payload,
          event_id: edit.event_id,
          starts_at: dates[0].starts_at,
          tasks: value.tasks.map((t, i) => ({ ...t, id: edit.task_ids[i] })),
        };
      }
    } else {
      if (!(kind in commandSchemas)) throw new Error('Unknown operation.');
      payload = commandSchemas[kind as keyof typeof commandSchemas].parse(input);
    }
    const data = await withDatabaseUser(async (client, actor, _name, identity) => {
      if (kind === 'delete_account') {
        const { rows } = await client.query<{ data: { id: string } }>(
          'SELECT public.app_delete_account($1) AS data',
          [payload.confirmation],
        );
        return rows[0].data;
      }
      if (kind === 'delete_event') {
        const { rows } = await client.query<{ data: { id: string } }>(
          'SELECT public.app_delete_event($1::uuid,$2::boolean) AS data',
          [payload.event_id, payload.confirmed],
        );
        return rows[0].data;
      }
      if (['onboard', 'profile', 'group', 'create_event', 'update_event'].includes(kind)) {
        let location;
        if (payload.location_token) {
          location = verifyLocation(
            String(payload.location_token),
            String(payload.location_id),
            identity.subject!,
            process.env.AUTH0_SECRET!,
          );
        } else if (kind !== 'onboard') {
          // An unchanged persisted location needs no fresh provider request. Never trust browser fields.
          const { rows } = await client.query<{ snapshot: Snapshot }>(
            'SELECT public.app_snapshot() AS snapshot',
          );
          const snapshot = rows[0].snapshot;
          const group = snapshot.groups.find((g) => g.owner_id === actor);
          location =
            kind === 'profile'
              ? snapshot.profile?.location
              : kind === 'update_event'
                ? snapshot.events.find((e) => e.id === payload.event_id && e.group_id === group?.id)
                    ?.location
                : group?.location;
          if (location?.id !== payload.location_id) location = undefined;
        }
        if (!location) throw new Error('Select a city from the suggestions.');
        location = locationSchema.parse(location);
        payload = { ...payload, location, city: location.city };
        delete payload.location_token;
        delete payload.location_id;
      }
      const result = await client.query<{ data: { id: string } }>(
        'SELECT public.app_command($1,$2::jsonb) AS data',
        [kind, JSON.stringify(payload)],
      );
      return result.rows[0].data;
    }, true);
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : 'The action could not be completed.',
    };
  }
}
export async function uploadAvatar(form: FormData): Promise<Result<string>> {
  try {
    const file = form.get('avatar');
    if (
      !(file instanceof File) ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error('Choose a JPEG, PNG, or WebP image under 2 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    validateAvatar(file.type, bytes);
    const path = await withDatabaseUser(async (client) => {
      const { rows } = await client.query<{ path: string }>(
        'SELECT public.app_save_avatar($1,$2) AS path',
        [file.type, bytes],
      );
      return rows[0].path;
    }, true);
    return { ok: true, data: path };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Upload failed.' };
  }
}
