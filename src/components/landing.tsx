'use client';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  MapPin,
  MessageSquare,
  Users,
} from 'lucide-react';
import { useApp } from './provider';
import { BrandMark } from './brand-mark';
import styles from './landing.module.css';

export function PublicHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={`brand ${styles.brand}`} aria-label="Turnout home">
        <BrandMark />
        <span>
          turnout<span className="brand-period">.</span>
        </span>
      </Link>
      <nav className={styles.navigation} aria-label="Welcome navigation">
        <Link className={styles.sectionLink} href="/#how-it-works">
          How it works
        </Link>
        <Link className={styles.sectionLink} href="/#organizations">
          For organizations
        </Link>
        <Link className={styles.signIn} href="/sign-in">
          Sign in <ArrowUpRight size={16} />
        </Link>
      </nav>
    </header>
  );
}

export function PublicFooter() {
  const { demo } = useApp();
  return (
    <footer className={styles.footer}>
      <span>
        Turnout <span aria-hidden="true">/</span> Community service, organized.
      </span>
      <span>
        {demo
          ? 'Local demo · Changes stay in this browser.'
          : 'For volunteers and community organizations.'}
      </span>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.heroCopy}>
          <h1 id="landing-title">
            Community service,
            <br />
            <span>organized.</span>
          </h1>
          <p className={styles.description}>
            Connect with local volunteers and organizations. Discover service opportunities in your
            area, or create an event for your community.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.primary} href="/sign-up">
              Create an account <ArrowRight size={18} />
            </Link>
            <Link className={styles.secondary} href="/sign-in">
              Sign in <ArrowUpRight size={17} />
            </Link>
          </div>
          <p className={styles.locationNote}>
            <MapPin size={17} /> Set your city to discover local opportunities.
          </p>
        </div>
      </section>

      <section id="how-it-works" className={styles.how} aria-labelledby="how-title">
        <div className={styles.sectionHeading}>
          <h2 id="how-title">How Turnout works</h2>
        </div>
        <div className={styles.steps}>
          <article>
            <span className={styles.stepNumber}>01</span>
            <h3>Start with your city</h3>
            <p>
              Create a profile and choose your city and state. Discover starts with events in that
              location.
            </p>
          </article>
          <article>
            <span className={styles.stepNumber}>02</span>
            <h3>Find or create an event</h3>
            <p>
              Volunteers reserve available tasks. Organizations publish events and manage signups.
            </p>
          </article>
          <article>
            <span className={styles.stepNumber}>03</span>
            <h3>Coordinate with your group</h3>
            <p>Message event participants and track service hours confirmed by the organizer.</p>
          </article>
        </div>
      </section>

      <section id="organizations" className={styles.audiences} aria-label="Who Turnout is for">
        <article className={styles.volunteerCard}>
          <span className={styles.audienceIcon}>
            <Users size={23} />
          </span>
          <h2>Discover service opportunities in your area.</h2>
          <p>
            Connect with local organizations, choose a volunteer task, and keep track of your
            upcoming events.
          </p>
          <Link href="/sign-up">
            Join as a volunteer <ArrowRight size={17} />
          </Link>
        </article>
        <article className={styles.organizationCard}>
          <span className={styles.audienceIcon}>
            <MessageSquare size={23} />
          </span>
          <h2>Accelerate turnout for your events.</h2>
          <p>
            Create events and post to your community. List volunteer tasks, manage signups, and
            coordinate with participants.
          </p>
          <Link href="/sign-up">
            Set up your organization <ArrowRight size={17} />
          </Link>
        </article>
      </section>
    </div>
  );
}
