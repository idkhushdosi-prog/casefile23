'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Play, ShieldCheck, Users } from 'lucide-react';
import { Stamp } from '@/components/ui/Stamp';
import { TypewriterText } from '@/components/ui/TypewriterText';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { fetchWitnessCounts, type WitnessCounts } from '@/lib/supabase/client';
import { useAppStore } from '@/store/useAppStore';
import { playSound } from '@/lib/audio';
import { getRosterById } from '@/data/roster';

export default function LandingPage() {
  const router = useRouter();
  const [counts, setCounts] = useState<WitnessCounts>({
    submitted_count: 0,
    started_count: 0,
    total_roster: 23,
    subject_filed_counts: {},
    most_filed_subject_id: null,
  });
  const [hydrated, setHydrated] = useState(false);
  const [honeypot, setHoneypot] = useState('');

  const contributor = useAppStore((s) => s.contributor);
  const caseMeta = useAppStore((s) => s.caseMeta);
  const uploads = useAppStore((s) => s.uploads);

  useEffect(() => {
    setHydrated(true);
    void fetchWitnessCounts().then(setCounts);
  }, []);

  const handleBegin = () => {
    if (honeypot.trim().length > 0) return; // Honeypot guard
    void playSound('stamp');
    router.push('/details');
  };

  const handleContinue = () => {
    if (honeypot.trim().length > 0) return;
    void playSound('rustle');
    if (!contributor) {
      router.push('/details');
    } else if (!uploads.some((u) => u.kind === 'portrait')) {
      router.push('/mugshot');
    } else if (contributor.status === 'submitted') {
      router.push('/done');
    } else {
      router.push('/desk');
    }
  };

  const savedRoster = contributor ? getRosterById(contributor.rosterId) : null;
  const completedCount = Object.values(caseMeta).filter(
    (c) => c.status === 'filed' || c.status === 'skipped'
  ).length;

  return (
    <main className="mx-auto max-w-3xl px-3 py-4 sm:px-6 sm:py-10">
      {/* Manila Dossier Header Card */}
      <section className="game-panel relative rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-4 sm:p-8 shadow-[6px_8px_0_var(--shadow-paper)]">
        {/* Top dossier classification strip */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-[var(--border-ink)]/40 pb-3 sm:mb-5 sm:pb-4">
          <EvidenceTag label="PRESS START // BUREAU MISSION" tone="blue" />
          <Stamp text="CLASSIFIED // BATCH 23" color="red" size="sm" animateSlam rotate={-4} />
        </div>

        {/* Big Animated Title */}
        <div className="relative">
          <p className="font-mono-doc text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--ink-muted)] sm:text-xs sm:tracking-[0.2em]">
            OFFICIAL INVESTIGATION BRIEFING • PLAYER 1 READY
          </p>
          <h1 className="font-typewriter fluid-hero-title mt-1 font-bold tracking-tight">
            CASE FILE: CLASS OF 23
          </h1>
          <div className="mt-2.5 sm:mt-3">
            <Stamp text="TOP PRIORITY" color="red" size="md" animateSlam rotate={-3} />
          </div>
        </div>

        {/* Narrator Briefing */}
        <NotebookCard ruled className="mt-6">
          <p className="font-typewriter text-base leading-relaxed sm:text-lg">
            <TypewriterText
              speedMs={14}
              text="You have been selected as a witness. 22 classmates. 22 case files. Speak the truth. Exaggerate slightly. Our batch has no prom and no yearbook—so we are forging four keepsakes from your testimony: a Character Stat Deck, an NCERT Parody Textbook, a CID Dossier, and a Chaotic School-Day Manga."
            />
          </p>

          <div className="mt-5 rounded border-2 border-[var(--stamp-red)] bg-[var(--paper)] p-3.5">
            <p className="font-mono-doc text-xs font-bold uppercase tracking-wider text-[var(--stamp-red)]">
              THE ONE GOLDEN RULE
            </p>
            <p className="font-typewriter mt-1 text-base font-bold sm:text-lg">
              &ldquo;Nobody writes about themselves. The class does it for you.&rdquo;
            </p>
          </div>

          <p className="mt-4 flex items-center gap-2 text-xs text-[var(--ink-muted)] sm:text-sm">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--blueprint-ink)]" />
            <span>
              An editor reviews everything before print. Write in English, Hindi (हिन्दी), or Hinglish.
            </span>
          </p>
        </NotebookCard>

        {/* Live Witness Counter */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--border-ink)] bg-[var(--highlighter)] text-[#1B1B1B]">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="font-mono-doc text-xs uppercase tracking-wider text-[var(--ink-muted)]">
                Live Bureau Tally
              </p>
              <p className="font-typewriter text-base font-bold sm:text-lg">
                <span className="highlighter-mark text-[#1B1B1B]">
                  {counts.submitted_count} of {counts.total_roster}
                </span>{' '}
                witnesses have testified
              </p>
            </div>
          </div>
          <span className="font-mono-doc text-[11px] text-[var(--ink-muted)]">
            {counts.started_count > 0
              ? `${counts.started_count} files opened`
              : 'Vault standing by'}
          </span>
        </div>

        {/* Honeypot hidden field */}
        <div className="sr-only" aria-hidden="true">
          <label htmlFor="entry-badge-code">Leave blank if human</label>
          <input
            id="entry-badge-code"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        {/* Primary CTAs */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {hydrated && contributor ? (
            <>
              <button
                type="button"
                onClick={handleContinue}
                className="tactile-btn btn-sheen flex flex-1 items-center justify-center gap-2 rounded-md bg-[var(--blueprint)] px-4 py-3.5 text-sm font-bold text-white sm:px-5 sm:text-base"
              >
                <Play className="h-5 w-5 shrink-0" />
                <span>
                  Continue where you left off
                  {savedRoster ? ` (${savedRoster.label} • ${completedCount}/22)` : ''}
                </span>
              </button>
              <Link
                href="/details"
                className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--paper)] px-5 py-3.5 text-sm font-bold text-[var(--ink)]"
              >
                Edit My Details
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={handleBegin}
              className="tactile-btn btn-sheen flex w-full items-center justify-center gap-2 rounded-md bg-[var(--stamp-red)] px-6 py-4 font-typewriter text-base font-bold text-white sm:text-lg"
            >
              Begin Investigation
              <ArrowRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Four Keepsake Formats Preview Strip */}
        <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[
            { code: '01', icon: '🃏', title: 'Stat Deck', sub: '23 Trump Cards' },
            { code: '02', icon: '📘', title: 'NCERT Parody', sub: '23 Bio Chapters' },
            { code: '03', icon: '🕵️', title: 'CID Dossier', sub: 'Suspect Sheets' },
            { code: '04', icon: '💥', title: 'Photo-Manga', sub: '1 Chaotic Day' },
          ].map((item) => (
            <div
              key={item.title}
              className="game-panel spatial-card rounded border-2 border-[var(--border-ink)]/75 bg-[var(--paper-card)] p-2.5 text-center"
            >
              <span className="font-mono-doc block text-left text-[9px] font-bold text-[var(--ink-muted)]">
                #{item.code}
              </span>
              <div className="text-xl">{item.icon}</div>
              <p className="font-typewriter mt-1 text-xs font-bold">{item.title}</p>
              <p className="font-mono-doc text-[10px] text-[var(--ink-muted)]">{item.sub}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
