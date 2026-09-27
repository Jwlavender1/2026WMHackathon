'use client';
import { useId, useRef, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import type { Result } from '@/lib/types';
import { useApp } from './provider';
import styles from './delete-account.module.css';

export function DeleteAccountPanel({
  organization,
  children,
  onDelete,
}: {
  organization: boolean;
  children: ReactNode;
  onDelete: () => Promise<Result>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [confirmation, setConfirmation] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const title = organization ? 'Delete organization account' : 'Delete account';
  return (
    <section className={`panel ${styles.panel}`} aria-labelledby={`${id}-section`}>
      <div>
        <h2 id={`${id}-section`}>{title}</h2>
        <p>Permanently delete your Turnout account. This cannot be undone.</p>
      </div>
      <button
        type="button"
        className={`button secondary ${styles.trigger}`}
        onClick={() => {
          setConfirmation('');
          setError('');
          dialog.current?.showModal();
          cancelButton.current?.focus();
        }}
      >
        <Trash2 size={17} aria-hidden="true" /> {title}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <form
          className="form-stack"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending || confirmation !== 'DELETE') return;
            setPending(true);
            setError('');
            try {
              const result = await onDelete();
              if (result.ok) dialog.current?.close();
              else setError(result.error);
            } catch {
              setError('Unable to delete your account. Please try again.');
            } finally {
              setPending(false);
            }
          }}
        >
          <h2 id={`${id}-title`}>{title}?</h2>
          <div id={`${id}-description`} className={styles.description}>
            {children}
            <p>This cannot be undone.</p>
          </div>
          <label>
            Type DELETE to confirm
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
          </label>
          {error && (
            <p role="alert" className="danger">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className="button secondary"
              ref={cancelButton}
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`button ${styles.confirm}`}
              disabled={pending || confirmation !== 'DELETE'}
            >
              {pending ? 'Deleting…' : 'Permanently delete account'}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}

export function AccountDeletion() {
  const { data, demo, deleteAccount } = useApp();
  if (!data.profile) return null;
  const organization = data.profile.role === 'organization';
  return (
    <DeleteAccountPanel organization={organization} onDelete={deleteAccount}>
      <p>Your profile, photo, and messages will be removed, and you will be signed out.</p>
      <p>
        {organization
          ? 'Your group will leave the active directory. Upcoming and ongoing events will be cancelled. Its name, event records, and volunteers’ verified hours will remain for service history. Your group’s contact details will be removed.'
          : 'Your reservations and recorded service hours will also be permanently removed.'}
      </p>
      <p>
        {demo
          ? 'This deletes the sample account in this browser only. No Auth0 login is affected.'
          : 'Your Auth0 login identity will remain. Signing in again can create a new Turnout account, but will not restore this account or its deleted data.'}
      </p>
    </DeleteAccountPanel>
  );
}
