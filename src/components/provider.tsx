'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { readSnapshot, runCommand, uploadAvatar } from '@/app/actions';
import { demoCommand } from '@/lib/demo';
import { makeFixtures } from '@/lib/fixtures';
import { emptySnapshot, type DemoState, type Snapshot, type Result } from '@/lib/types';

type Store = {
  data: Snapshot;
  demo: boolean;
  ready: boolean;
  busy: boolean;
  notice: string;
  setNotice: (s: string) => void;
  act: (kind: string, input: Record<string, unknown>) => Promise<boolean>;
  refresh: () => Promise<boolean>;
  switchUser: (id: string) => void;
  login: (mode: 'sign-in' | 'sign-up', input: Record<string, string>) => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<Result>;
  avatar: (file: File) => Promise<void>;
};
const Context = createContext<Store | null>(null);
const KEY = 'commonly-demo-v1';
const freshDemo = (): DemoState => ({ ...makeFixtures(), profile: null });
export function AppProvider({
  children,
  initial,
  demo,
}: {
  children: ReactNode;
  initial: Snapshot;
  demo: boolean;
}) {
  const [data, setData] = useState<Snapshot>(initial),
    [ready, setReady] = useState(!demo),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (!demo) return;
    let state: DemoState;
    try {
      const saved = localStorage.getItem(KEY);
      state = saved ? JSON.parse(saved) : freshDemo();
      if (!Array.isArray(state.profiles) || !Array.isArray(state.events)) state = freshDemo();
    } catch {
      state = freshDemo();
    }
    // Browser-only fixture persistence is hydrated after the server-rendered shell.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(state);
    setReady(true);
    const sync = (event: StorageEvent) => {
      if (event.key === KEY && event.newValue) {
        try {
          setData(JSON.parse(event.newValue));
        } catch {}
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [demo]);
  const save = useCallback((next: DemoState) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setData(next);
  }, []);
  const refresh = useCallback(async () => {
    if (!demo) {
      try {
        setData(await readSnapshot());
        return true;
      } catch (e) {
        setNotice(e instanceof Error ? e.message : 'Unable to refresh.');
        return false;
      }
    }
    return true;
  }, [demo]);
  const act = async (kind: string, input: Record<string, unknown>) => {
    if (busy) return false;
    setBusy(true);
    setNotice('');
    try {
      if (demo) save(demoCommand(data as DemoState, kind, input));
      else {
        const result = await runCommand(kind, input);
        if (!result.ok) throw new Error(result.error);
        if (!(await refresh())) return false;
      }
      setNotice(
        (
          {
            join: 'You’re on the list. Thank you for showing up!',
            withdraw: 'Your reservation has been released.',
            comment: 'Message sent.',
            verify: 'Attendance saved. Service hours are updated.',
            cancel: 'Event cancelled.',
            create_event: 'Your event is published.',
            update_event: 'Event updated.',
            delete_event: 'Event deleted.',
            profile: 'Profile saved.',
            group: 'Group saved.',
            hide_comment: 'Message removed.',
            onboard: 'Welcome to your community. Your profile is ready.',
          } as Record<string, string>
        )[kind] ?? 'Saved.',
      );
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Something went wrong.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const switchUser = (id: string) => {
    const next = structuredClone(data as DemoState);
    next.profile = next.profiles.find((p) => p.id === id) ?? null;
    delete next.onboarding;
    delete next.pendingUserId;
    save(next);
    setNotice('Demo account changed.');
  };
  const login = async (mode: 'sign-in' | 'sign-up', input: Record<string, string>) => {
    setBusy(true);
    setNotice('');
    try {
      if (demo) {
        const next = structuredClone(data as DemoState);
        if (mode === 'sign-up') {
          next.profile = null;
          next.pendingUserId = crypto.randomUUID();
          next.onboarding = { display_name: input.display_name };
        } else {
          next.profile = next.profiles.find((p) => p.role === input.role) ?? next.profiles[0];
          delete next.onboarding;
          delete next.pendingUserId;
        }
        save(next);
        return true;
      }
      // Auth0 endpoints require a full navigation through the server middleware.
      window.location.assign(
        new URL(
          mode === 'sign-up' ? '/auth/login?screen_hint=signup' : '/auth/login',
          window.location.origin,
        ).href,
      );
      return false;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to sign in.');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    if (demo) {
      const next = structuredClone(data as DemoState);
      next.profile = null;
      delete next.onboarding;
      delete next.pendingUserId;
      save(next);
    } else {
      window.location.assign(new URL('/auth/logout', window.location.origin).href);
      return;
    }
    setNotice('Signed out.');
  };
  const deleteAccount = async (): Promise<Result> => {
    if (busy) return { ok: false, error: 'Wait for the current action to finish.' };
    setBusy(true);
    setNotice('');
    try {
      if (demo) {
        save(demoCommand(data as DemoState, 'delete_account', { confirmation: 'DELETE' }));
        setNotice('Your Turnout account has been deleted.');
      } else {
        const result = await runCommand('delete_account', { confirmation: 'DELETE' });
        if (!result.ok) return result;
        // Do not refresh: the account is gone. Clear local app data and end the Auth0 session.
        setData(emptySnapshot());
        window.location.assign(new URL('/auth/logout', window.location.origin).href);
      }
      return { ok: true, data: null };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unable to delete account.',
      };
    } finally {
      setBusy(false);
    }
  };
  const avatar = async (file: File) => {
    setBusy(true);
    try {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2097152)
        throw new Error('Choose a JPEG, PNG, or WebP image under 2 MB.');
      if (demo) {
        const path = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        const next = structuredClone(data as DemoState);
        if (!next.profile) throw new Error('Sign in first.');
        next.profile.avatar_path = path;
        next.profiles.find((p) => p.id === next.profile!.id)!.avatar_path = path;
        save(next);
      } else {
        const form = new FormData();
        form.set('avatar', file);
        const r = await uploadAvatar(form);
        if (!r.ok) throw new Error(r.error);
        await refresh();
      }
      setNotice('Profile picture updated.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Unable to save image.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Context.Provider
      value={{
        data,
        demo,
        ready,
        busy,
        notice,
        setNotice,
        act,
        refresh,
        switchUser,
        login,
        logout,
        deleteAccount,
        avatar,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const store = useContext(Context);
  if (!store) throw new Error('AppProvider is missing');
  return store;
}
