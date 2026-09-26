'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Building2, Check, Users } from 'lucide-react';
import { useApp } from './provider';
import { LocationPicker } from './location-picker';
import { CAUSES } from '@/lib/location';
import { onboardingSchema } from '@/lib/domain';
import { authenticationState, type Role } from '@/lib/types';

export function CauseFields({
  name = 'interests',
  initial = [],
  legend = 'Cause interests (optional)',
}: {
  name?: string;
  initial?: string[];
  legend?: string;
}) {
  return (
    <fieldset className="cause-picker">
      <legend>{legend}</legend>
      <div>
        {CAUSES.map((cause) => (
          <label key={cause}>
            <input
              type="checkbox"
              name={name}
              value={cause}
              defaultChecked={initial.includes(cause)}
            />
            {cause}
          </label>
        ))}
      </div>
      <p className="category-help">
        Community support covers other service activities. Campaign includes community awareness,
        donation drives, and political campaigning.
      </p>
    </fieldset>
  );
}
export function OnboardingForm() {
  const { data, busy, act, demo } = useApp(),
    router = useRouter();
  const state = authenticationState(data);
  const beganSetup = useRef(state === 'onboarding');
  const [step, setStep] = useState(1),
    [role, setRole] = useState<Role>('volunteer');
  const [error, setError] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state === 'ready' && !beganSetup.current) router.replace('/browse');
  }, [state, router]);
  if (state === 'signed_out')
    return (
      <section className="panel onboarding-panel">
        <h1>Sign in to set up your account</h1>
        <Link href="/sign-in" className="button">
          Sign in
        </Link>
      </section>
    );
  if (state === 'ready') return <p role="status">Opening Turnout…</p>;
  const organization = role === 'organization';
  const changeStep = (value: number) => {
    setStep(value);
    setError('');
    requestAnimationFrame(() => title.current?.focus());
  };
  return (
    <section className="panel onboarding-panel">
      <ol className="onboarding-progress" aria-label="Setup progress">
        <li aria-current={step === 1 ? 'step' : undefined}>
          <span>{step > 1 ? <Check size={15} /> : '1'}</span>Account type
        </li>
        <li aria-current={step === 2 ? 'step' : undefined}>
          <span>2</span>Your details
        </li>
      </ol>
      <p className="onboarding-step">Step {step} of 2</p>
      <h1 ref={title} tabIndex={-1}>
        {step === 1
          ? 'How will you use Turnout?'
          : organization
            ? 'Set up your organization'
            : 'Set up your volunteer profile'}
      </h1>
      <p className="muted onboarding-description">
        {step === 1
          ? 'Choose the account you need. You can review this choice before completing setup.'
          : organization
            ? 'Your contact name stays on your account. Organization details will appear on your public group page.'
            : 'Your city helps identify relevant events. A street address is not needed.'}
      </p>
      {demo && (
        <p className="inline-alert">Demo setup. Your profile is saved in this browser only.</p>
      )}
      <div hidden={step !== 1}>
        <fieldset className="onboarding-roles">
          <legend className="sr-only">Account type</legend>
          {(['volunteer', 'organization'] as const).map((value) => (
            <label key={value} className={role === value ? 'selected' : ''}>
              <input
                type="radio"
                name="account-role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
              />
              {value === 'volunteer' ? <Users size={25} /> : <Building2 size={25} />}
              <strong>{value === 'volunteer' ? 'Volunteer' : 'Organization'}</strong>
              <span>
                {value === 'volunteer'
                  ? 'Find events, reserve tasks, and track service hours.'
                  : 'Create a group, publish events, and manage attendance.'}
              </span>
            </label>
          ))}
        </fieldset>
        <div className="onboarding-actions">
          <button type="button" className="button" onClick={() => changeStep(2)}>
            Continue <ArrowRight size={17} />
          </button>
        </div>
      </div>
      <form
        hidden={step !== 2}
        className="form-stack onboarding-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setError('');
          const form = new FormData(event.currentTarget);
          const parsed = onboardingSchema.safeParse({
            ...Object.fromEntries(form),
            role,
            interests: form.getAll('interests'),
          });
          if (!parsed.success) {
            setError(parsed.error.issues[0].message);
            return;
          }
          if (await act('onboard', parsed.data))
            router.replace(organization ? '/event-hub' : '/profile');
        }}
      >
        <label>
          {organization ? 'Contact person’s name' : 'Display name'}
          <input
            name="display_name"
            autoComplete="name"
            defaultValue={data.onboarding?.display_name}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        {data.onboarding?.email && (
          <label>
            Account email
            <input type="email" value={data.onboarding.email} readOnly />
            <small className="muted">
              {organization
                ? 'From your sign-in account. This is not your organization’s public contact email.'
                : 'Managed by your sign-in account.'}
            </small>
          </label>
        )}
        {organization && (
          <>
            <label>
              Organization name
              <input
                name="organization_name"
                autoComplete="organization"
                minLength={2}
                maxLength={120}
                required
              />
            </label>
            <label>
              Organization description
              <textarea
                name="organization_description"
                minLength={10}
                maxLength={2000}
                rows={3}
                required
              />
            </label>
          </>
        )}
        <LocationPicker label={organization ? 'Organization city / town' : 'City / town'} />
        <details className="onboarding-optional">
          <summary>Optional profile details</summary>
          <div className="form-stack">
            {!organization && (
              <>
                <label>
                  About me
                  <textarea name="bio" rows={3} maxLength={1000} />
                </label>
                <label>
                  Skills
                  <input
                    name="skills"
                    maxLength={300}
                    placeholder="e.g. tutoring, food preparation"
                  />
                </label>
              </>
            )}
            {organization && (
              <>
                <label>
                  Website
                  <input type="url" name="website_url" placeholder="https://" />
                </label>
                <label>
                  Public contact email
                  <input name="public_contact_email" type="email" maxLength={254} />
                </label>
              </>
            )}
            <CauseFields legend={organization ? 'Cause categories (optional)' : undefined} />
            <p className="muted">You can edit these details and add a profile photo after setup.</p>
          </div>
        </details>
        <p className="onboarding-review">
          Account type: <strong>{organization ? 'Organization' : 'Volunteer'}</strong>. This is set
          when you complete setup.
        </p>
        {error && (
          <p className="inline-alert" role="alert">
            {error}
          </p>
        )}
        <div className="onboarding-actions">
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => changeStep(1)}
          >
            <ArrowLeft size={17} /> Back
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : organization ? 'Create organization' : 'Complete profile'}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </section>
  );
}
