import type { Location } from './location';
export type Role = 'volunteer' | 'organization';
export type Profile = {
  id: string;
  role: Role;
  display_name: string;
  bio: string;
  city: string;
  avatar_path: string | null;
  location?: Location | null;
  interests?: string[];
  skills?: string;
};
export type Group = {
  id: string;
  name: string;
  slug: string;
  description: string;
  city: string;
  website_url: string | null;
  owner_id?: string;
  location?: Location | null;
  causes?: string[];
  public_contact_email?: string | null;
};
export type Event = {
  id: string;
  group_id: string;
  series_id: string | null;
  occurrence_index: number | null;
  title: string;
  description: string;
  venue: string;
  address: string;
  city: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  resources_to_bring: string[];
  status: 'published' | 'cancelled';
  location?: Location | null;
};
export type Task = {
  id: string;
  event_id: string;
  name: string;
  description: string;
  capacity: number;
  reserved: number;
};
export type Signup = {
  id: string;
  event_id: string;
  task_id: string;
  volunteer_id: string;
  status: 'active' | 'withdrawn';
  verified_minutes: number | null;
  verified_by: string | null;
  verified_at: string | null;
  display_name?: string;
};
export type Comment = {
  id: string;
  event_id: string;
  author_id: string;
  body: string;
  created_at: string;
  hidden_at: string | null;
  display_name: string;
};
export type Series = {
  id: string;
  group_id: string;
  frequency: 'weekly';
  interval_weeks: number;
  occurrence_count: number;
  timezone: string;
  first_local_start: string;
  duration_minutes: number;
};
export type Snapshot = {
  onboarding?: { display_name: string; email?: string };
  profile: Profile | null;
  groups: Group[];
  events: Event[];
  tasks: Task[];
  signups: Signup[];
  comments: Comment[];
};
export type DemoState = Snapshot & {
  profiles: Profile[];
  series: Series[];
  pendingUserId?: string;
};
export function authenticationState(data: Snapshot): 'signed_out' | 'onboarding' | 'ready' {
  return data.profile ? 'ready' : data.onboarding ? 'onboarding' : 'signed_out';
}
export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
