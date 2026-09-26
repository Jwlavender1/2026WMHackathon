import { DateTime } from 'luxon';
import { z } from 'zod';
import type { Event, Signup } from './types';

export const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1000),
  city: z.string().trim().min(2).max(100),
});
export const groupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  city: z.string().trim().min(2).max(100),
  website_url: z.union([
    z.literal(''),
    z.url().refine((v) => /^https?:\/\//.test(v), 'Use an http or https URL'),
  ]),
});
export const eventSchema = z
  .object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().min(10).max(4000),
    venue: z.string().trim().min(2).max(150),
    address: z.string().trim().min(2).max(200),
    city: z.string().trim().min(2).max(100),
    localStart: z.string().min(16),
    timezone: z.string().default('America/New_York'),
    duration: z.coerce.number().int().min(15).max(720),
    resources: z.string().max(1000),
    interval: z.coerce.number().int().min(0).max(2),
    count: z.coerce.number().int().min(1).max(12),
    tasks: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(100),
          capacity: z.coerce.number().int().min(1).max(500),
          description: z.string().trim().max(500).default(''),
        }),
      )
      .min(1)
      .max(12),
  })
  .refine(
    (v) => new Set(v.tasks.map((t) => t.name.toLowerCase())).size === v.tasks.length,
    'Task names must be unique',
  );
export type EventInput = z.infer<typeof eventSchema>;
export function occurrences(input: EventInput, now = Date.now()) {
  const first = DateTime.fromISO(input.localStart, { zone: input.timezone });
  if (
    !first.isValid ||
    first.toFormat("yyyy-MM-dd'T'HH:mm") !== input.localStart.slice(0, 16) ||
    first.getPossibleOffsets().length !== 1
  )
    throw new Error('Choose an unambiguous local time in a valid time zone.');
  if (first.toMillis() <= now) throw new Error('Choose a future start time.');
  const count = input.interval ? input.count : 1;
  if (input.interval && count < 2)
    throw new Error('Recurring events need at least two occurrences.');
  return Array.from({ length: count }, (_, i) => {
    const start = first.plus({ weeks: i * input.interval });
    if (
      start.hour !== first.hour ||
      start.minute !== first.minute ||
      start.getPossibleOffsets().length !== 1
    )
      throw new Error('An occurrence falls at a daylight saving transition. Choose another time.');
    return {
      starts_at: start.toUTC().toISO()!,
      ends_at: start.plus({ minutes: input.duration }).toUTC().toISO()!,
    };
  });
}
export function eventPhase(event: Event, now = Date.now()) {
  return event.status === 'cancelled'
    ? 'cancelled'
    : Date.parse(event.ends_at) <= now
      ? 'previous'
      : Date.parse(event.starts_at) <= now
        ? 'ongoing'
        : 'upcoming';
}
export function hoursServed(signups: Signup[], userId: string) {
  return (
    signups
      .filter((s) => s.volunteer_id === userId)
      .reduce((n, s) => n + (s.verified_minutes ?? 0), 0) / 60
  );
}
export function formatDate(iso: string, zone = 'America/New_York', format = 'ccc, MMM d') {
  return DateTime.fromISO(iso).setZone(zone).toFormat(format);
}
export function initials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
}
