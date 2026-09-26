'use server';
import { z } from 'zod';
import { eventSchema, groupSchema, occurrences, profileSchema } from '@/lib/domain';
import { serverClient } from '@/lib/supabase/server';
import type { Result, Snapshot } from '@/lib/types';

const uuid = z.uuid();
const commandSchemas = {
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
  const client = await serverClient();
  const { data, error } = await client.rpc('app_snapshot');
  if (error)
    throw new Error('Unable to load community data. Check the Supabase migration and connection.');
  const snapshot = data as Snapshot;
  if (snapshot.profile?.avatar_path) {
    const { data: signed } = await client.storage
      .from('avatars')
      .createSignedUrl(snapshot.profile.avatar_path, 3600);
    snapshot.profile.avatar_path = signed?.signedUrl ?? null;
  }
  return snapshot;
}
export async function runCommand(kind: string, input: unknown): Promise<Result<{ id: string }>> {
  try {
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('Sign in to continue.');
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
    const { data, error } = await client.rpc('app_command', { kind, payload });
    if (error) throw new Error(error.message);
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
export async function authenticate(
  mode: 'sign-in' | 'sign-up',
  input: unknown,
): Promise<Result<{ message: string }>> {
  try {
    const form = z
      .object({
        email: z.email(),
        password: z.string().min(8).max(128),
        display_name: z.string().min(2).max(80),
        role: z.enum(['volunteer', 'organization']),
      })
      .parse(input);
    const client = await serverClient();
    if (mode === 'sign-up') {
      const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
      const { data, error } = await client.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { role: form.role, display_name: form.display_name },
          emailRedirectTo: `${origin}/auth/confirm`,
        },
      });
      if (error) throw error;
      return {
        ok: true,
        data: {
          message: data.session
            ? 'Account created.'
            : 'Check your email to confirm your account, then sign in.',
        },
      };
    }
    const { error } = await client.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (error) throw error;
    return { ok: true, data: { message: 'Signed in.' } };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof z.ZodError
          ? error.issues[0].message
          : error instanceof Error
            ? error.message
            : 'Authentication failed.',
    };
  }
}
export async function signOut(): Promise<void> {
  const client = await serverClient();
  await client.auth.signOut();
}
export async function uploadAvatar(form: FormData): Promise<Result<string>> {
  try {
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('Sign in to continue.');
    const file = form.get('avatar');
    if (
      !(file instanceof File) ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    )
      throw new Error('Choose a JPEG, PNG, or WebP image under 2 MB.');
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.type]!;
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await client.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type });
    if (error) throw error;
    const { error: saveError } = await client.rpc('app_command', {
      kind: 'avatar',
      payload: { path },
    });
    if (saveError) {
      await client.storage.from('avatars').remove([path]);
      throw saveError;
    }
    return { ok: true, data: path };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Upload failed.' };
  }
}
