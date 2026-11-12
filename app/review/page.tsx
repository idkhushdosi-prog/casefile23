'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, Lock, Send } from 'lucide-react';
import { ROSTER, getRosterById } from '@/data/roster';
import { AWARDS } from '@/data/awards';
import { computeUnlockedBadges, getRankForXp } from '@/lib/xp';
import { flushSyncQueue } from '@/lib/sync';
import {
  ensureAnonymousSession,
  getSupabaseClient,
  isSupabaseConfigured,
} from '@/lib/supabase/client';
import { useAppStore } from '@/store/useAppStore';
import { playSound, triggerConfetti } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { Stamp } from '@/components/ui/Stamp';

export default function FinalReviewPage() {
  const router = useRouter();
  const contributor = useAppStore((s) => s.contributor);
  const caseMeta = useAppStore((s) => s.caseMeta);
  const responses = useAppStore((s) => s.responses);
  const awards = useAppStore((s) => s.awards);
  const archiveEntries = useAppStore((s) => s.archiveEntries);
  const anythingElse = useAppStore((s) => s.anythingElse);
  const uploads = useAppStore((s) => s.uploads);
  const updateContributorFields = useAppStore((s) => s.updateContributorFields);
  const unlockBadges = useAppStore((s) => s.unlockBadges);

  const [submitting, setSubmitting] = useState(false);

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">No Testimony Found</h1>
          <Link
            href="/details"
            className="tactile-btn mt-4 inline-flex rounded-md bg-[var(--stamp-red)] px-5 py-3 font-bold text-white"
          >
            Start Investigation →
          </Link>
        </NotebookCard>
      </main>
    );
  }

  const others = ROSTER.filter((r) => r.id !== contributor.rosterId);
  const incompleteSubjects = others.filter((r) => {
    const st = caseMeta[r.id]?.status;
    return st !== 'filed' && st !== 'skipped';
  });
  const filedCount = others.filter((r) => caseMeta[r.id]?.status === 'filed').length;
  const skippedCount = others.filter((r) => caseMeta[r.id]?.status === 'skipped').length;
  const missingAwards = AWARDS.filter((a) => !awards[a.key]);

  const readyToSubmit =
    incompleteSubjects.length === 0 && missingAwards.length === 0;

  const rank = getRankForXp(contributor.xp);
  const archiveCount = Object.values(archiveEntries).reduce((sum, a) => sum + a.length, 0);

  const handleFinalSubmit = async () => {
    if (!readyToSubmit) return;
    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      updateContributorFields({
        status: 'submitted',
        finishedAt: now,
      });

      const earned = computeUnlockedBadges({
        caseMeta,
        responses,
        uploads,
        submittedAt: now,
      });
      unlockBadges(earned);

      await flushSyncQueue();
      if (isSupabaseConfigured()) {
        try {
          const supabase = getSupabaseClient();
          let token: string | undefined;
          if (supabase) {
            const { data } = await supabase.auth.getSession();
            token = data.session?.access_token;
            if (!token) {
              await ensureAnonymousSession();
              const refreshed = await supabase.auth.getSession();
              token = refreshed.data.session?.access_token;
            }
          }
          await fetch('/api/submission/complete', {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          });
        } catch {
          // Never block the student's Case Closed celebration if email dispatch fails
        }
      }
      void playSound('stamp');
      void triggerConfetti('big');
      router.push('/done');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <EvidenceTag label="FINAL REVIEW & SEALING" tone="red" />
        <Link
          href="/desk"
          className="tactile-btn rounded-md bg-[var(--paper)] px-3 py-2 text-xs font-bold"
        >
          ← Back to Case Desk
        </Link>
      </div>

      <NotebookCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-typewriter text-2xl font-bold sm:text-3xl">
              Final Case File Review
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Inspect your witness checklist before stamping the master folder closed.
            </p>
          </div>
          <Stamp
            text={readyToSubmit ? 'READY TO SEAL' : 'PENDING ITEMS'}
            color={readyToSubmit ? 'green' : 'red'}
            size="sm"
            rotate={-3}
          />
        </div>

        {/* Witness Identity Card */}
        <div className="mt-5 rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-4 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-mono-doc text-xs uppercase text-[var(--ink-muted)]">
                Witness Identity
              </p>
              <p className="font-typewriter text-lg font-bold">
                {contributor.fullNameCaps} ({getRosterById(contributor.rosterId)?.label})
              </p>
              <p className="font-mono-doc text-xs">
                Scholar #{contributor.scholarNumber} • Rank: {rank.current.badge}{' '}
                {rank.current.title} ({contributor.xp} XP)
              </p>
            </div>
            <Link href="/details" className="font-mono-doc text-xs font-bold text-[var(--blueprint-ink)] underline">
              Edit Name/Details
            </Link>
          </div>
        </div>

        {/* Checklist */}
        <div className="mt-5 space-y-3">
          <div className="flex items-start justify-between gap-3 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3.5">
            <div className="flex items-start gap-2.5">
              {incompleteSubjects.length === 0 ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--stamp-red)]" />
              )}
              <div>
                <p className="font-typewriter font-bold">
                  22 Classmate Case Files ({filedCount} filed, {skippedCount} skipped)
                </p>
                {incompleteSubjects.length > 0 ? (
                  <p className="mt-1 text-xs text-[var(--stamp-red)]">
                    Still pending ({incompleteSubjects.length}):{' '}
                    {incompleteSubjects.map((s) => s.label).join(', ')}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--ink-muted)]">
                    All 22 classmates accounted for!
                  </p>
                )}
              </div>
            </div>
            <Link href="/desk" className="font-mono-doc shrink-0 text-xs font-bold text-[var(--blueprint-ink)] underline">
              View Desk
            </Link>
          </div>

          <div className="flex items-start justify-between gap-3 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3.5">
            <div className="flex items-start gap-2.5">
              {missingAwards.length === 0 ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--stamp-red)]" />
              )}
              <div>
                <p className="font-typewriter font-bold">
                  Awards Podium ({14 - missingAwards.length}/14 categories voted)
                </p>
                {missingAwards.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--stamp-red)]">
                    {missingAwards.length} award category votes still missing.
                  </p>
                )}
              </div>
            </div>
            <Link href="/awards" className="font-mono-doc shrink-0 text-xs font-bold text-[var(--blueprint-ink)] underline">
              Open Awards
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Link
              href="/archive"
              className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3 hover:bg-[var(--manila)]"
            >
              <p className="font-typewriter text-sm font-bold">Class Archive</p>
              <p className="font-mono-doc text-xs text-[var(--ink-muted)]">
                {archiveCount} section entries (optional)
              </p>
            </Link>
            <Link
              href="/chaos"
              className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3 hover:bg-[var(--manila)]"
            >
              <p className="font-typewriter text-sm font-bold">Chaos Dump</p>
              <p className="font-mono-doc text-xs text-[var(--ink-muted)]">
                {uploads.filter((u) => u.kind === 'chaos').length} photos (optional)
              </p>
            </Link>
            <Link
              href="/extra"
              className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3 hover:bg-[var(--manila)]"
            >
              <p className="font-typewriter text-sm font-bold">Anything Else</p>
              <p className="font-mono-doc text-xs text-[var(--ink-muted)]">
                {anythingElse.length} wild card notes (optional)
              </p>
            </Link>
          </div>
        </div>

        <div className="mt-6">
          {!readyToSubmit ? (
            <div className="flex items-center gap-2 rounded border-2 border-dashed border-[var(--stamp-red)] bg-[var(--manila)] p-3 text-xs font-semibold">
              <Lock className="h-4 w-4 shrink-0 text-[var(--stamp-red)]" />
              <span>
                Finish all remaining classmate folders and all 14 awards to unlock final submission.
              </span>
            </div>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleFinalSubmit()}
              className="tactile-btn flex w-full items-center justify-center gap-2 rounded-md bg-[var(--stamp-red)] px-6 py-4 font-typewriter text-lg font-bold text-white"
            >
              <Send className="h-5 w-5" />
              {submitting ? 'Sealing Vault…' : 'Seal & Submit Official Testimony'}
            </button>
          )}
        </div>
      </NotebookCard>
    </main>
  );
}
