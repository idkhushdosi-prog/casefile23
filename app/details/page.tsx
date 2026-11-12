'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Lock } from 'lucide-react';
import { ROSTER, getRosterById } from '@/data/roster';
import {
  buildFullNameCaps,
  contributorDetailsSchema,
  normalizeNamePartSave,
  sanitizeNamePartInput,
} from '@/lib/validation';
import { generateSeed } from '@/lib/shuffle';
import { generateUuid } from '@/lib/crypto';
import { ensureAnonymousSession } from '@/lib/supabase/client';
import { flushSyncQueue } from '@/lib/sync';
import { useAppStore } from '@/store/useAppStore';
import { playSound } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { Stamp } from '@/components/ui/Stamp';

export default function ContributorDetailsPage() {
  const router = useRouter();
  const contributor = useAppStore((s) => s.contributor);
  const setContributor = useAppStore((s) => s.setContributor);
  const updateContributorFields = useAppStore((s) => s.updateContributorFields);
  const awardXp = useAppStore((s) => s.awardXp);

  const [rosterId, setRosterId] = useState('');
  const [scholarNumber, setScholarNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [shake, setShake] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (contributor) {
      setRosterId(contributor.rosterId);
      setScholarNumber(contributor.scholarNumber);
      setFirstName(contributor.firstNameCaps);
      setMiddleName(contributor.middleNameCaps);
      setLastName(contributor.lastNameCaps);
    }
  }, [contributor]);

  const liveFullName = buildFullNameCaps(firstName, middleName, lastName);
  const selectedRoster = getRosterById(rosterId);

  const triggerShake = () => {
    setShake(true);
    void playSound('error');
    setTimeout(() => setShake(false), 380);
  };

  const handleReviewSummary = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = contributorDetailsSchema.safeParse({
      rosterId,
      scholarNumber,
      firstNameCaps: firstName,
      middleNameCaps: middleName,
      lastNameCaps: lastName,
      honeypot,
    });

    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] || 'form');
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      triggerShake();
      return;
    }

    setErrors({});
    setFirstName(parsed.data.firstNameCaps);
    setMiddleName(parsed.data.middleNameCaps);
    setLastName(parsed.data.lastNameCaps);
    setScholarNumber(parsed.data.scholarNumber);
    void playSound('stamp');
    setConfirmStep(true);
  };

  const handleConfirmProceed = async () => {
    setSubmitting(true);
    try {
      const f = normalizeNamePartSave(firstName);
      const m = normalizeNamePartSave(middleName);
      const l = normalizeNamePartSave(lastName);
      const full = buildFullNameCaps(f, m, l);
      const uid =
        (await ensureAnonymousSession()) ||
        contributor?.id ||
        generateUuid();

      if (contributor) {
        updateContributorFields({
          id: uid,
          rosterId,
          scholarNumber: scholarNumber.trim(),
          firstNameCaps: f,
          middleNameCaps: m,
          lastNameCaps: l,
          fullNameCaps: full,
        });
      } else {
        setContributor({
          id: uid,
          rosterId,
          scholarNumber: scholarNumber.trim(),
          firstNameCaps: f,
          middleNameCaps: m,
          lastNameCaps: l,
          fullNameCaps: full,
          consentPortrait: true,
          shuffleSeed: generateSeed(),
          xp: 0,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          status: 'in_progress',
        });
        awardXp(25, 'Witness Registered', 'onboarding:details');
      }

      void flushSyncQueue();
      void playSound('chime');
      router.push('/mugshot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl px-3 py-4 sm:px-6 sm:py-10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
        <EvidenceTag label="STEP 1 OF 2 • WITNESS DETAILS" tone="blue" />
        <span className="font-mono-doc text-xs text-[var(--ink-muted)]">
          Autosaved locally
        </span>
      </div>

      <NotebookCard className={shake ? 'animate-shake' : ''}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-typewriter fluid-page-title font-bold">
              Identify Yourself, Witness
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Pick your name from the Class of 23 roster and confirm how your name should be
              printed in the keepsakes.
            </p>
          </div>
          <Stamp text="FORM A-23" color="ink" size="sm" rotate={-5} />
        </div>

        {/* Privacy Notice on Scholar Number */}
        <div className="mb-5 flex items-start gap-2.5 rounded border border-[var(--blueprint-ink)]/50 bg-[var(--paper)] p-3 text-xs text-[var(--ink-muted)]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--blueprint-ink)]" />
          <p>
            <strong>Privacy note:</strong> Your scholar number is collected only as part of your
            keepsake submission so the editor can keep print records organized. No ID card
            photo or external verification is required.
          </p>
        </div>

        {!confirmStep ? (
          <form onSubmit={handleReviewSummary} className="space-y-4" noValidate>
            {/* Honeypot */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="website-hp">Leave empty</label>
              <input
                id="website-hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            {/* Roster Name Dropdown */}
            <div>
              <label
                htmlFor="roster-select"
                className="font-mono-doc block text-xs font-bold uppercase tracking-wider"
              >
                Select your name <span className="text-[var(--stamp-red)]">*</span>
              </label>
              <select
                id="roster-select"
                value={rosterId}
                onChange={(e) => {
                  setRosterId(e.target.value);
                  setErrors((prev) => ({ ...prev, rosterId: '' }));
                }}
                className="mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-base font-medium text-[var(--ink)]"
              >
                <option value="">-- Choose your name from the batch (23 students) --</option>
                {ROSTER.map((entry, idx) => (
                  <option key={entry.id} value={entry.id}>
                    {idx + 1}. {entry.label}
                  </option>
                ))}
              </select>
              {rosterId === 'saksham-r' || rosterId === 'sakshama-t' ? (
                <p className="mt-1 text-xs font-medium text-[var(--blueprint-ink)]">
                  Double-check: <strong>Saksham R.</strong> and <strong>Sakshama T.</strong> are two different classmates.
                </p>
              ) : null}
              {errors.rosterId && (
                <p role="alert" className="mt-1 text-xs font-semibold text-[var(--stamp-red)]">
                  {errors.rosterId}
                </p>
              )}
            </div>

            {rosterId && (
              <>
                {/* Scholar Number */}
                <div>
                  <label
                    htmlFor="scholar-number"
                    className="font-mono-doc block text-xs font-bold uppercase tracking-wider"
                  >
                    Scholar number (3 to 5 digits){' '}
                    <span className="text-[var(--stamp-red)]">*</span>
                  </label>
                  <input
                    id="scholar-number"
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="e.g. 214, 1087, 20431"
                    value={scholarNumber}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setScholarNumber(digitsOnly);
                      setErrors((prev) => ({ ...prev, scholarNumber: '' }));
                    }}
                    className="font-mono-doc mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-base tracking-widest"
                  />
                  {errors.scholarNumber && (
                    <p role="alert" className="mt-1 text-xs font-semibold text-[var(--stamp-red)]">
                      {errors.scholarNumber}
                    </p>
                  )}
                </div>

                {/* First / Middle / Last Name in CAPS */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="first-name-caps"
                      className="font-mono-doc block text-xs font-bold uppercase tracking-wider"
                    >
                      First name <span className="text-[var(--stamp-red)]">*</span>
                    </label>
                    <input
                      id="first-name-caps"
                      type="text"
                      autoCapitalize="characters"
                      placeholder="FIRST NAME"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(sanitizeNamePartInput(e.target.value));
                        setErrors((prev) => ({ ...prev, firstNameCaps: '' }));
                      }}
                      className="font-mono-doc mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-base uppercase"
                    />
                    {errors.firstNameCaps && (
                      <p role="alert" className="mt-1 text-xs font-semibold text-[var(--stamp-red)]">
                        {errors.firstNameCaps}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="middle-name-caps"
                      className="font-mono-doc block text-xs font-bold uppercase tracking-wider"
                    >
                      Middle name <span className="text-[var(--ink-muted)]">(optional)</span>
                    </label>
                    <input
                      id="middle-name-caps"
                      type="text"
                      autoCapitalize="characters"
                      placeholder="OPTIONAL"
                      value={middleName}
                      onChange={(e) => {
                        setMiddleName(sanitizeNamePartInput(e.target.value));
                        setErrors((prev) => ({ ...prev, middleNameCaps: '' }));
                      }}
                      className="font-mono-doc mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-base uppercase"
                    />
                    {errors.middleNameCaps && (
                      <p role="alert" className="mt-1 text-xs font-semibold text-[var(--stamp-red)]">
                        {errors.middleNameCaps}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="last-name-caps"
                    className="font-mono-doc block text-xs font-bold uppercase tracking-wider"
                  >
                    Surname / last name <span className="text-[var(--stamp-red)]">*</span>
                  </label>
                  <input
                    id="last-name-caps"
                    type="text"
                    autoCapitalize="characters"
                    placeholder="SURNAME / LAST NAME"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(sanitizeNamePartInput(e.target.value));
                      setErrors((prev) => ({ ...prev, lastNameCaps: '' }));
                    }}
                    className="font-mono-doc mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-base uppercase"
                  />
                  {errors.lastNameCaps && (
                    <p role="alert" className="mt-1 text-xs font-semibold text-[var(--stamp-red)]">
                      {errors.lastNameCaps}
                    </p>
                  )}
                </div>

                {/* Live Typewriter Printed Full Name Preview */}
                <div className="rounded-md border-2 border-dashed border-[var(--border-ink)] bg-[var(--manila)] p-3.5">
                  <p className="font-mono-doc text-[11px] font-bold uppercase tracking-widest text-[var(--ink-muted)]">
                    Printed Keepsake Nameplate Preview
                  </p>
                  <p className="font-typewriter mt-1 min-h-[28px] text-lg font-bold tracking-wide text-[var(--ink)]">
                    {liveFullName || 'AWAITING NAME INPUT…'}
                  </p>
                </div>
              </>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={!rosterId}
                className="tactile-btn flex w-full items-center justify-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-3.5 text-base font-bold text-white"
              >
                <FileText className="h-5 w-5" />
                Review Details Before Mugshot
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </form>
        ) : (
          /* Confirmation Summary */
          <div className="space-y-5">
            <div className="rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono-doc text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)]">
                  Confirmation Summary
                </span>
                <Stamp text="READY TO STAMP" color="blue" size="sm" rotate={-2} />
              </div>

              <dl className="space-y-2.5 text-sm">
                <div className="flex flex-wrap justify-between gap-2 border-b border-dashed border-[var(--border-ink)]/30 pb-2">
                  <dt className="font-mono-doc text-xs uppercase text-[var(--ink-muted)]">
                    Roster Selection
                  </dt>
                  <dd className="font-typewriter font-bold">{selectedRoster?.label}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-dashed border-[var(--border-ink)]/30 pb-2">
                  <dt className="font-mono-doc text-xs uppercase text-[var(--ink-muted)]">
                    Scholar Number
                  </dt>
                  <dd className="font-mono-doc font-bold tracking-widest">{scholarNumber}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="font-mono-doc text-xs uppercase text-[var(--ink-muted)]">
                    Printed Full Name
                  </dt>
                  <dd className="font-typewriter font-bold">{liveFullName}</dd>
                </div>
              </dl>
            </div>

            <p className="text-xs text-[var(--ink-muted)]">
              Check spelling carefully—this exact nameplate goes to the keepsake editor.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setConfirmStep(false)}
                className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--paper)] px-4 py-3 text-sm font-bold"
              >
                <ArrowLeft className="h-4 w-4" />
                Go Back &amp; Fix Spelling
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirmProceed()}
                className="tactile-btn flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--stamp-red)] px-5 py-3 text-base font-bold text-white"
              >
                <CheckCircle2 className="h-5 w-5" />
                {submitting ? 'Saving File…' : 'Confirm & Proceed to Mugshot Station'}
              </button>
            </div>
          </div>
        )}
      </NotebookCard>
    </main>
  );
}
