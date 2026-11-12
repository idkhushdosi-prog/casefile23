'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  Award,
  Camera,
  CheckSquare,
  FolderOpen,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { ROSTER, getRosterById } from '@/data/roster';
import { BADGES } from '@/data/questions';
import { AWARDS } from '@/data/awards';
import { getShuffledClassmates } from '@/lib/shuffle';
import { computeUnlockedBadges, getRankForXp } from '@/lib/xp';
import { fetchWitnessCounts, type WitnessCounts } from '@/lib/supabase/client';
import { useAppStore } from '@/store/useAppStore';
import { playSound, triggerConfetti } from '@/lib/audio';
import { CaseFolder, type FolderStatus } from '@/components/ui/CaseFolder';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { Stamp } from '@/components/ui/Stamp';

export default function CaseDeskPage() {
  const router = useRouter();
  const contributor = useAppStore((s) => s.contributor);
  const caseMeta = useAppStore((s) => s.caseMeta);
  const responses = useAppStore((s) => s.responses);
  const awards = useAppStore((s) => s.awards);
  const uploads = useAppStore((s) => s.uploads);
  const archiveEntries = useAppStore((s) => s.archiveEntries);
  const anythingElse = useAppStore((s) => s.anythingElse);
  const unlockedBadges = useAppStore((s) => s.unlockedBadges);
  const unlockBadges = useAppStore((s) => s.unlockBadges);
  const milestonesShown = useAppStore((s) => s.milestonesShown);
  const markMilestoneShown = useAppStore((s) => s.markMilestoneShown);

  const [counts, setCounts] = useState<WitnessCounts | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'filed' | 'skipped'>('all');
  const [activeMilestone, setActiveMilestone] = useState<number | null>(null);

  useEffect(() => {
    void fetchWitnessCounts().then(setCounts);
  }, []);

  // Recompute badges cleanly when desk loads
  useEffect(() => {
    if (!contributor) return;
    const earned = computeUnlockedBadges({
      caseMeta,
      responses,
      uploads,
      submittedAt: contributor.finishedAt,
    });
    unlockBadges(earned);
  }, [contributor, caseMeta, responses, uploads, unlockBadges]);

  const classmates = useMemo(() => {
    if (!contributor) return [];
    return getShuffledClassmates(ROSTER, contributor.rosterId, contributor.shuffleSeed);
  }, [contributor]);

  const statusFor = (id: string): FolderStatus => {
    return caseMeta[id]?.status ?? 'unopened';
  };

  const filedCount = classmates.filter((c) => statusFor(c.id) === 'filed').length;
  const skippedCount = classmates.filter((c) => statusFor(c.id) === 'skipped').length;
  const doneCount = filedCount + skippedCount;

  // Milestone celebration at 5, 11, 22 cases
  useEffect(() => {
    if (!contributor) return;
    const targets = [22, 11, 5];
    for (const m of targets) {
      if (doneCount >= m && !milestonesShown.includes(m)) {
        markMilestoneShown(m);
        setActiveMilestone(m);
        void triggerConfetti(m === 22 ? 'big' : 'small');
        break;
      }
    }
  }, [doneCount, contributor, milestonesShown, markMilestoneShown]);

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">Desk Locked</h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            Register your witness name &amp; scholar number before opening the 22 case files.
          </p>
          <Link
            href="/details"
            className="tactile-btn mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--stamp-red)] px-5 py-3 font-bold text-white"
          >
            Start at Witness Details →
          </Link>
        </NotebookCard>
      </main>
    );
  }

  const nextClassmate =
    classmates.find((c) => {
      const s = statusFor(c.id);
      return s === 'in_progress' || s === 'unopened';
    }) ?? classmates[0];

  const filteredClassmates = classmates.filter((c) => {
    const s = statusFor(c.id);
    if (filterMode === 'pending') return s === 'unopened' || s === 'in_progress';
    if (filterMode === 'filed') return s === 'filed';
    if (filterMode === 'skipped') return s === 'skipped';
    return true;
  });

  const awardsComplete = Object.keys(awards).length >= AWARDS.length;
  const allCasesHandled = doneCount >= 22;
  const canOpenReview = allCasesHandled && awardsComplete;
  const rank = getRankForXp(contributor.xp);
  const progressPct = Math.round((doneCount / 22) * 100);
  const topTeaser = counts?.most_filed_subject_id
    ? getRosterById(counts.most_filed_subject_id)
    : null;
  const archiveCount = Object.values(archiveEntries).reduce((sum, arr) => sum + arr.length, 0);
  const chaosCount = uploads.filter((u) => u.kind === 'chaos').length;

  return (
    <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Top Detective Desk Summary */}
      <section className="rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-4 sm:p-6 shadow-[5px_6px_0_var(--shadow-paper)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <EvidenceTag label={`DETECTIVE: ${getRosterById(contributor.rosterId)?.label ?? ''}`} tone="blue" />
            <h1 className="font-typewriter mt-2 text-2xl font-bold sm:text-3xl">
              The Case Desk
            </h1>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)] sm:text-sm">
              22 classmate folders shuffled uniquely for you. Your own file is locked in the vault.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nextClassmate && (
              <button
                type="button"
                onClick={() => {
                  void playSound('rustle');
                  router.push(`/case/${nextClassmate.id}`);
                }}
                className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--stamp-red)] px-4 py-2.5 text-sm font-bold text-white"
              >
                <FolderOpen className="h-4 w-4" />
                Open Next Case ({nextClassmate.label})
              </button>
            )}
          </div>
        </div>

        {/* Progress & Live Bureau Teaser */}
        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3.5">
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span className="font-typewriter text-sm">
                {doneCount} of 22 case files done ({filedCount} filed, {skippedCount} skipped)
              </span>
              <span className="font-mono-doc">{progressPct}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={22}
              className="mt-2 h-4 w-full overflow-hidden rounded-sm border border-[var(--border-ink)] bg-[var(--manila)]"
            >
              <div
                className="h-full bg-[var(--stamp-red)] transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--ink-muted)]">
              <span>
                Rank: <strong>{rank.current.badge} {rank.current.title}</strong> ({contributor.xp} XP)
              </span>
              {rank.nextRank && (
                <span>
                  {rank.nextRank.minXp - contributor.xp} XP to {rank.nextRank.title}
                </span>
              )}
            </div>
          </div>

          <div className="rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3.5 text-xs">
            <p className="font-mono-doc text-[10px] font-bold uppercase tracking-widest text-[var(--blueprint-ink)]">
              Bureau Dispatch
            </p>
            <p className="mt-1 font-semibold">
              {counts ? `${counts.submitted_count} of 23` : '0 of 23'} witnesses fully submitted
            </p>
            <p className="mt-1 text-[var(--ink-muted)]">
              {topTeaser && counts
                ? `Most-filed suspect: ${topTeaser.label} (${
                    counts.subject_filed_counts[topTeaser.id] ?? 0
                  } files)`
                : 'No spoilers—other witnesses’ answers remain sealed.'}
            </p>
          </div>
        </div>

        {/* Desk Special Items (Awards, Archive, Chaos Dump, Anything Else, Final Review) */}
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-mono-doc text-xs font-bold uppercase tracking-widest text-[var(--ink-muted)]">
              Special Desk Stations{' '}
              {doneCount < 5 && (
                <span className="font-normal">
                  (recommended after 5 files, or open anytime)
                </span>
              )}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            <Link
              href="/awards"
              className="tactile-btn flex items-center justify-between rounded-md bg-[var(--paper-card)] px-3.5 py-2.5 text-left"
            >
              <div>
                <p className="font-typewriter flex items-center gap-1.5 text-sm font-bold">
                  <Trophy className="h-4 w-4 text-[var(--stamp-red)]" /> Awards Podium
                </p>
                <p className="font-mono-doc text-[11px] text-[var(--ink-muted)]">
                  {Object.keys(awards).length}/14 voted {awardsComplete ? '✓' : '(Required)'}
                </p>
              </div>
            </Link>

            <Link
              href="/archive"
              className="tactile-btn flex items-center justify-between rounded-md bg-[var(--paper-card)] px-3.5 py-2.5 text-left"
            >
              <div>
                <p className="font-typewriter flex items-center gap-1.5 text-sm font-bold">
                  <Archive className="h-4 w-4 text-[var(--blueprint-ink)]" /> Class Archive
                </p>
                <p className="font-mono-doc text-[11px] text-[var(--ink-muted)]">
                  Evidence locker ({archiveCount})
                </p>
              </div>
            </Link>

            <Link
              href="/chaos"
              className="tactile-btn flex items-center justify-between rounded-md bg-[var(--paper-card)] px-3.5 py-2.5 text-left"
            >
              <div>
                <p className="font-typewriter flex items-center gap-1.5 text-sm font-bold">
                  <Camera className="h-4 w-4 text-[var(--ink)]" /> Chaos Dump
                </p>
                <p className="font-mono-doc text-[11px] text-[var(--ink-muted)]">
                  Candid photos ({chaosCount})
                </p>
              </div>
            </Link>

            <Link
              href="/extra"
              className="tactile-btn flex items-center justify-between rounded-md bg-[var(--paper-card)] px-3.5 py-2.5 text-left"
            >
              <div>
                <p className="font-typewriter flex items-center gap-1.5 text-sm font-bold">
                  <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Anything Else
                </p>
                <p className="font-mono-doc text-[11px] text-[var(--ink-muted)]">
                  Wild card ({anythingElse.length})
                </p>
              </div>
            </Link>

            <Link
              href="/review"
              className={`tactile-btn flex items-center justify-between rounded-md px-3.5 py-2.5 text-left ${
                canOpenReview
                  ? 'bg-[var(--highlighter)] text-[#1B1B1B]'
                  : 'bg-[var(--manila-dark)] text-[var(--ink)]'
              }`}
            >
              <div>
                <p className="font-typewriter flex items-center gap-1.5 text-sm font-bold">
                  <CheckSquare className="h-4 w-4" /> Final Review
                </p>
                <p className="font-mono-doc text-[11px]">
                  {canOpenReview ? 'Ready to Seal!' : 'Needs 22 cases + Awards'}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Badges Shelf */}
      <section className="mt-6 rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper-card)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-typewriter flex items-center gap-2 text-base font-bold">
            <Award className="h-5 w-5 text-[var(--stamp-red)]" />
            Detective Badges Shelf ({unlockedBadges.length}/{BADGES.length})
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BADGES.map((badge) => {
            const has = unlockedBadges.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`rounded border p-2.5 text-xs transition-opacity ${
                  has
                    ? 'border-[var(--border-ink)] bg-[var(--highlighter)]/35'
                    : 'border-dashed border-[var(--border-ink)]/40 bg-[var(--paper)] opacity-55'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{badge.emoji}</span>
                  <span className="font-typewriter font-bold leading-tight">{badge.title}</span>
                </div>
                <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{badge.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filter Tabs & 22 Folders Grid */}
      <section className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-typewriter text-xl font-bold">
            22 Classmate Folders (Free Choice)
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter case folders">
            {(
              [
                ['all', `All (22)`],
                ['pending', `Remaining (${22 - doneCount})`],
                ['filed', `Filed (${filedCount})`],
                ['skipped', `Skipped (${skippedCount})`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilterMode(key)}
                className={`min-h-[44px] rounded border-2 border-[var(--border-ink)] px-3 py-1 font-mono-doc text-xs font-bold ${
                  filterMode === key
                    ? 'bg-[var(--ink)] text-[var(--paper)]'
                    : 'bg-[var(--paper)] text-[var(--ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3.5 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {filteredClassmates.map((student, filteredIdx) => {
            const originalIdx = classmates.findIndex((c) => c.id === student.id) + 1;
            return (
              <CaseFolder
                key={student.id}
                caseIndex={originalIdx}
                staggerIndex={filteredIdx}
                label={student.label}
                devanagari={student.devanagari}
                status={statusFor(student.id)}
                filedByOthersCount={counts?.subject_filed_counts?.[student.id] ?? 0}
                onClick={() => {
                  void playSound('rustle');
                  router.push(`/case/${student.id}`);
                }}
              />
            );
          })}
        </div>
      </section>

      {/* Milestone Celebration Modal (5, 11, 22) */}
      <AnimatePresence>
        {activeMilestone && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-6 text-center shadow-[6px_8px_0_var(--border-ink)]"
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveMilestone(null)}
                  aria-label="Skip celebration"
                  className="inline-flex h-10 w-10 items-center justify-center rounded border border-[var(--border-ink)] bg-[var(--paper)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Stamp
                text={
                  activeMilestone === 22
                    ? 'ALL 22 FILES COMPLETE'
                    : activeMilestone === 11
                    ? 'HALFWAY THROUGH BATCH 23'
                    : '5 CASE FILES CLEARED'
                }
                color="red"
                animateSlam
                size="md"
              />
              <h2 className="font-typewriter mt-4 text-2xl font-bold">
                {activeMilestone === 22
                  ? 'Every Single Suspect Handled!'
                  : activeMilestone === 11
                  ? 'Half the Class Dossier Sealed!'
                  : 'Awards & Evidence Locker Unlocked!'}
              </h2>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                {activeMilestone === 22
                  ? 'Head to Awards Podium (if pending) and Final Review to seal your testimony.'
                  : activeMilestone === 11
                  ? '11 down, 11 left. Keep the courtroom drama flowing.'
                  : '5 files complete! Take a breather at the Awards Podium or keep interrogating.'}
              </p>
              <button
                type="button"
                onClick={() => setActiveMilestone(null)}
                className="tactile-btn mt-5 w-full rounded-md bg-[var(--blueprint)] px-5 py-3 font-bold text-white"
              >
                Continue Investigation
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
