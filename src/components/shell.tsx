'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronRight,
  Compass,
  Home,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Sparkle,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useApp } from './provider';
import { initials } from '@/lib/domain';
import type { DemoState } from '@/lib/types';
export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, demo, notice, setNotice, switchUser, logout } = useApp();
  const path = usePathname(),
    router = useRouter();
  const [open, setOpen] = useState(false);
  const org = data.profile?.role === 'organization';
  const nav = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/browse', label: 'Discover', icon: Compass },
    {
      href: org ? '/event-hub' : '/events',
      label: org ? 'Event hub' : 'My events',
      icon: CalendarDays,
    },
    { href: '/messages', label: 'Messages', icon: MessageSquare },
    { href: '/community', label: 'Community', icon: Users },
    ...(org ? [{ href: '/my-group', label: 'My group', icon: Users }] : []),
  ];
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      {open && (
        <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />
      )}
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <span className="brand-icon">
            <Sparkle size={25} />
          </span>
          <span>
            <strong>Turnout</strong>
            <small>DO GOOD, TOGETHER</small>
          </span>
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <nav aria-label="Main navigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`nav-item ${path === href || (href === '/browse' && path.startsWith('/events/')) ? 'active' : ''}`}
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="invite-card">
            <span className="invite-icon">
              <Sparkle size={20} />
            </span>
            <h3>Make an impact</h3>
            <p>
              {org
                ? 'Create an event and rally your community around a cause.'
                : 'A little of your time can make a world of difference.'}
            </p>
            <Link className="button white" href={org ? '/event-hub/new' : '/browse'}>
              {org ? <Plus size={18} /> : <Compass size={18} />}{' '}
              {org ? 'Create event' : 'Find your next event'}
            </Link>
          </div>
          {demo && (
            <label className="demo-switch">
              DEMO ACCOUNT
              <select
                aria-label="Demo account"
                value={data.profile?.id ?? ''}
                onChange={(e) => switchUser(e.target.value)}
              >
                <option value="">Public visitor</option>
                {(data as DemoState).profiles?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} · {p.role === 'organization' ? 'Organizer' : 'Volunteer'}
                  </option>
                ))}
              </select>
            </label>
          )}
          {data.profile ? (
            <div className="account-row">
              <Link href="/profile" className="account-link">
                <span className="avatar">
                  {data.profile.avatar_path ? (
                    <img src={data.profile.avatar_path} alt="" />
                  ) : (
                    initials(data.profile.display_name)
                  )}
                </span>
                <span>
                  <strong>{data.profile.display_name}</strong>
                  <small>{org ? 'Organization' : 'Volunteer'}</small>
                </span>
                <ChevronRight size={16} />
              </Link>
              <button className="quiet" aria-label="Sign out" onClick={() => void logout()}>
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link className="button" href="/sign-in">
              Join your community <ArrowRight size={16} />
            </Link>
          )}
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <form
            className="global-search"
            action={(form) =>
              router.push(`/browse?q=${encodeURIComponent(String(form.get('q') ?? ''))}`)
            }
          >
            <Search size={19} />
            <input
              aria-label="Search events, causes, or places"
              name="q"
              placeholder="Search events, causes, or places"
            />
            <button className="sr-only" type="submit">
              Search
            </button>
          </form>
          <div className="topbar-actions">
            <Link href="/messages" className="icon-button" aria-label="Event conversations">
              <Bell size={20} />
            </Link>
            <Link
              href={org ? '/event-hub/new' : data.profile ? '/browse' : '/sign-up'}
              className="button top-create"
            >
              <Plus size={19} />
              {org ? 'Create event' : data.profile ? 'Find an event' : 'Get involved'}
            </Link>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span className="live-dot" /> Demo workspace{' '}
            <span className="demo-detail">· Fictional events. Changes stay in this browser.</span>
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="footer">
          <span>Small acts. Real change.</span>
          <span>
            Made for our community <Sparkle size={13} />
          </span>
        </footer>
      </div>
      {notice && (
        <div role="status" className="toast">
          <span>{notice}</span>
          <button className="quiet" aria-label="Dismiss notification" onClick={() => setNotice('')}>
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
