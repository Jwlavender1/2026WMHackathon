'use client';
// Adapted from the expandable card pattern in React Bits Card Nav.
// See docs/REACT_BITS_LICENSE.md. Uses CSS transitions, Next links, and Lucide icons.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Sparkle } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export function CardNav({
  organization,
  signedIn,
  accountControls,
}: {
  organization: boolean;
  signedIn: boolean;
  accountControls: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    toggle = useRef<HTMLButtonElement>(null);
  const eventLink = {
    href: organization ? '/event-hub' : '/events',
    label: organization ? 'Event hub' : 'My events',
  };
  const links = [
    { href: '/', label: 'About' },
    { href: '/browse', label: 'Discover' },
    eventLink,
    { href: '/messages', label: 'Messages' },
    { href: '/community', label: 'Community' },
    ...(organization ? [{ href: '/my-group', label: 'My group' }] : []),
  ];
  const cards = [
    {
      title: 'Find your people.',
      caption: 'A cause for everyone.',
      className: 'purple',
      links: [links[0], links[1], links[4]],
    },
    {
      title: organization ? 'Make it happen.' : 'Show up. Do good.',
      caption: organization ? 'Bring your community together.' : 'A little time goes a long way.',
      className: 'yellow',
      links: [
        eventLink,
        links[3],
        ...(organization ? [{ href: '/my-group', label: 'My group' }] : []),
      ],
    },
    {
      title: 'Your corner.',
      caption: 'Every contribution counts.',
      className: 'plum',
      links: signedIn
        ? [
            { href: '/profile', label: 'Your profile' },
            {
              href: organization ? '/event-hub/new' : '/browse',
              label: organization ? 'Create event' : 'Find an event',
            },
          ]
        : [
            { href: '/sign-up', label: 'Get involved' },
            { href: '/sign-in', label: 'Sign in' },
          ],
    },
  ];
  const active = (href: string) => path === href || (href !== '/' && path.startsWith(`${href}/`));
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div
      ref={root}
      className={`card-nav ${open ? 'is-open' : ''}`}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <div className="card-nav-top">
        <Link href="/" className="brand" aria-label="About Turnout" onClick={() => setOpen(false)}>
          <span className="brand-icon">
            <Sparkle size={25} />
          </span>
          <span>
            turnout<span className="brand-period">.</span>
          </span>
        </Link>
        <nav className="quick-nav" aria-label="Main navigation" aria-hidden={open} inert={open}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          {accountControls}
          <button
            ref={toggle}
            className="nav-toggle"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
            aria-expanded={open}
            aria-controls="expanded-navigation"
            onClick={() => setOpen(!open)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
      <div id="expanded-navigation" className="card-nav-reveal" inert={!open} aria-hidden={!open}>
        <nav className="card-nav-content" aria-label="Explore Turnout">
          {cards.map((card, i) => (
            <section
              className={`nav-card ${card.className}`}
              key={card.title}
              style={{ '--card-order': i } as CSSProperties}
            >
              <div>
                <span className="nav-card-number">0{i + 1}</span>
                <h2>{card.title}</h2>
                <p>{card.caption}</p>
              </div>
              <div className="nav-card-links">
                {card.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active(link.href) ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <ArrowUpRight size={18} />
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </nav>
      </div>
    </div>
  );
}
