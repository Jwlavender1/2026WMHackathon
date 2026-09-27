'use client';
import { useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import type { Event } from '@/lib/types';
import { eventDeletionReason, formatDate } from '@/lib/domain';
import { useApp } from './provider';
import styles from './event-delete.module.css';

export function DeleteEventButton({
  event,
  returnToHub = false,
}: {
  event: Event;
  returnToHub?: boolean;
}) {
  const { data, act, busy, notice } = useApp();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const group = data.groups.find((item) => item.id === event.group_id);
  if (!data.profile || data.profile.role !== 'organization' || group?.owner_id !== data.profile.id)
    return null;
  const reason = eventDeletionReason(event, data.signups);
  const reservations = data.signups.filter(
    (signup) => signup.event_id === event.id && signup.status === 'active',
  ).length;
  return (
    <>
      <button
        type="button"
        className={`button secondary small ${styles.trigger}`}
        title={reason ?? undefined}
        aria-describedby={reason ? `${id}-reason` : undefined}
        disabled={busy || !!reason}
        onClick={() => {
          setFailed(false);
          dialog.current?.showModal();
          cancel.current?.focus();
        }}
      >
        <Trash2 size={15} aria-hidden="true" /> Delete event
      </button>
      {reason && (
        <span className="sr-only" id={`${id}-reason`}>
          {reason}
        </span>
      )}
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <h2 id={`${id}-title`}>Delete event?</h2>
        <div id={`${id}-description`} className={styles.description}>
          <p>
            <strong>{event.title}</strong>
            <br />
            {formatDate(event.starts_at, event.timezone, 'MMM d, yyyy · h:mm a ZZZZ')}
          </p>
          <p>
            This permanently removes this event, its tasks, signups, and conversation. This cannot
            be undone.
          </p>
          {!!reservations && (
            <p>
              {reservations} volunteer{' '}
              {reservations === 1 ? 'reservation will' : 'reservations will'} be removed. Cancelling
              instead keeps the event visible in their event history.
            </p>
          )}
          {event.series_id && (
            <p>Only this occurrence will be deleted. Other dates in the series will stay.</p>
          )}
        </div>
        {failed && (
          <p className="danger" role="alert">
            {notice || 'Unable to delete the event. Please try again.'}
          </p>
        )}
        <div className={styles.actions}>
          <button
            ref={cancel}
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Keep event
          </button>
          <button
            type="button"
            className={`button ${styles.confirm}`}
            disabled={pending || busy || !!reason}
            onClick={async () => {
              if (pending) return;
              setPending(true);
              setFailed(false);
              try {
                if (await act('delete_event', { event_id: event.id, confirmed: true })) {
                  dialog.current?.close();
                  if (returnToHub) router.replace('/event-hub');
                } else setFailed(true);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? 'Deleting…' : 'Confirm deletion'}
          </button>
        </div>
      </dialog>
    </>
  );
}
