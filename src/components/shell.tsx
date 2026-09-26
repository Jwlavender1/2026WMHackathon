'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, LogOut, Sparkle, X } from 'lucide-react';
import { useApp } from './provider';
import { CardNav } from './card-nav';
import { PublicHeader, PublicFooter } from './landing';
import { initials } from '@/lib/domain';
import { authenticationState, type DemoState } from '@/lib/types';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, demo, ready, notice, setNotice, switchUser, logout } = useApp();
  const path = usePathname();
  const org = data.profile?.role === 'organization';
  const state = authenticationState(data);
  const notification = notice && (
    <div role="status" className="toast">
      <span>{notice}</span>
      <button className="quiet" aria-label="Dismiss notification" onClick={() => setNotice('')}>
        <X size={18} />
      </button>
    </div>
  );
  if (!ready || state === 'signed_out')
    return (
      <>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <PublicHeader />
        <main id="main" tabIndex={-1}>
          {path === '/sign-in' || path === '/sign-up' ? (
            <div className="workspace">{children}</div>
          ) : (
            children
          )}
        </main>
        <PublicFooter />
        {notification}
      </>
    );
  if (state === 'onboarding' || path === '/onboarding')
    return (
      <div className="onboarding-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="onboarding-header">
          <Link href="/" className="brand" aria-label="Turnout">
            <span className="brand-icon">
              <Sparkle size={25} />
            </span>
            <span>
              turnout<span className="brand-period">.</span>
            </span>
          </Link>
          <button className="text-button" onClick={() => void logout()}>
            Sign out <LogOut size={17} />
          </button>
        </header>
        <main id="main" className="onboarding-content" tabIndex={-1}>
          {children}
        </main>
        {notification}
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <CardNav
          key={`${path}:${data.profile?.role}`}
          organization={org}
          signedIn
          accountControls={
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
          }
        />
      </header>
      <div className="workspace">
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
          <span>Small acts for big change.</span>
          <span>
            Made for our community <Sparkle size={15} />
          </span>
        </footer>
      </div>
      {notification}
    </>
  );
}
