'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ArrowUpRight, LogOut, Search, Sparkle, X } from 'lucide-react';
import { useApp } from './provider';
import { CardNav } from './card-nav';
import { initials } from '@/lib/domain';
import type { DemoState } from '@/lib/types';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, demo, notice, setNotice, switchUser, logout } = useApp();
  const path = usePathname(),
    router = useRouter();
  const org = data.profile?.role === 'organization';
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <CardNav
          key={`${path}:${data.profile?.role}`}
          organization={org}
          signedIn={!!data.profile}
        />
      </header>
      <div className="workspace">
        <div className="workspace-toolbar">
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
              placeholder="Find your next way to show up"
            />
            <button className="search-submit" type="submit" aria-label="Search">
              <ArrowUpRight size={19} />
            </button>
          </form>
          <div className="account-tools">
            {data.profile ? (
              <>
                <Link href="/profile" className="account-link" aria-label="Your profile">
                  <span className="avatar">
                    {data.profile.avatar_path ? (
                      <img src={data.profile.avatar_path} alt="" />
                    ) : (
                      initials(data.profile.display_name)
                    )}
                  </span>
                  <span className="account-copy">
                    <strong>{data.profile.display_name}</strong>
                    <small>{org ? 'Organization' : 'Volunteer'}</small>
                  </span>
                </Link>
                <button
                  className="icon-button sign-out"
                  aria-label="Sign out"
                  onClick={() => void logout()}
                >
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link className="text-link" href="/sign-in">
                Sign in <ArrowUpRight size={17} />
              </Link>
            )}
          </div>
        </div>
        {demo && (
          <div className="demo-banner">
            <span>
              <span className="live-dot" />
              Demo workspace{' '}
              <span className="demo-detail">· Fictional events. Changes stay in this browser.</span>
            </span>
            <label className="demo-switch">
              Try a role
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
          </div>
        )}
        <main id="main" className="main-content" tabIndex={-1}>
          {children}
        </main>
        <footer className="footer">
          <span>Small acts. Real change.</span>
          <span>
            Made for our community <Sparkle size={15} />
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
