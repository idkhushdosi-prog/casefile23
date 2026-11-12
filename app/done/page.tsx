'use client';

import React, { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Award, CheckCircle2, Home, Sparkles } from 'lucide-react';
import { BADGES } from '@/data/questions';
import { getRosterById } from '@/data/roster';
import { getRankForXp } from '@/lib/xp';
import { triggerConfetti } from '@/lib/audio';
import { useAppStore } from '@/store/useAppStore';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { Stamp } from '@/components/ui/Stamp';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'they', 'their', 'them', 'from',
  'have', 'always', 'every', 'when', 'what', 'about', 'during', 'class', 'will',
  'into', 'your', 'just', 'like', 'some', 'very', 'more', 'most', 'only', 'also',
  'been', 'were', 'was', 'are', 'not', 'but', 'she', 'her', 'his', 'him', 'all',
  'one', 'out', 'who', 'can', 'had', 'has', 'any', 'you',
]);

export default function CaseClosedPage() {
  const contributor = useAppStore((s) => s.contributor);
  const responses = useAppStore((s) => s.responses);
  const archiveEntries = useAppStore((s) => s.archiveEntries);
  const anythingElse = useAppStore((s) => s.anythingElse);
  const unlockedBadges = useAppStore((s) => s.unlockedBadges);
  const caseMeta = useAppStore((s) => s.caseMeta);

  useEffect(() => {
    void triggerConfetti('big');
  }, []);

  // Hidden Easter Egg Stat: most-used word across everything the user typed!
  const hiddenStats = useMemo(() => {
    const wordCounts = new Map<string, number>();
    let totalChars = 0;

    const collectText = (val: unknown) => {
      if (typeof val === 'string') {
        totalChars += val.length;
        const words = val
          .toLowerCase()
          .replace(/[^a-z\u0900-\u097f\s]/g, ' ')
          .split(/\s+/);
        for (const w of words) {
          if (w.length >= 4 && !STOP_WORDS.has(w)) {
            wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
          }
        }
      } else if (Array.isArray(val)) {
        val.forEach(collectText);
      } else if (val && typeof val === 'object') {
        Object.values(val).forEach(collectText);
      }
    };

    collectText(responses);
    collectText(archiveEntries);
    collectText(anythingElse);

    const topWord = Array.from(wordCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    return {
      mostUsedWord: topWord?.[0] ?? 'legend',
      mostUsedCount: topWord?.[1] ?? 0,
      totalChars,
    };
  }, [responses, archiveEntries, anythingElse]);

  const filedCount = Object.values(caseMeta).filter((c) => c.status === 'filed').length;
  const rank = getRankForXp(contributor?.xp ?? 0);

  return (
    <main className="mx-auto max-w-2xl px-3 py-6 sm:px-4 sm:py-12">
      <NotebookCard className="text-center">
        <div className="my-2 flex justify-center">
          <Stamp text="CASE CLOSED" color="green" size="lg" animateSlam rotate={-4} />
        </div>

        <h1 className="font-typewriter fluid-page-title mt-4 font-bold">
          Thank You, {getRosterById(contributor?.rosterId)?.label ?? 'Witness'}!
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)] sm:text-base">
          Your testimony for Batch 23 is sealed and queued for the keepsake editor. Time to
          sit back and wait for the printed editions!
        </p>

        {/* Stats Card */}
        <div className="mt-6 grid grid-cols-1 gap-2.5 text-center min-[360px]:grid-cols-3">
          <div className="rounded border-2 border-[var(--border-ink)] bg-[var(--manila)] p-3 shadow-[2px_3px_0_var(--shadow-paper)]">
            <p className="font-mono-doc text-[10px] uppercase text-[var(--ink-muted)]">
              Files Filed
            </p>
            <p className="font-typewriter text-2xl font-bold">{filedCount}/22</p>
          </div>
          <div className="rounded border-2 border-[var(--border-ink)] bg-[var(--manila)] p-3 shadow-[2px_3px_0_var(--shadow-paper)]">
            <p className="font-mono-doc text-[10px] uppercase text-[var(--ink-muted)]">
              Total XP
            </p>
            <p className="font-typewriter text-2xl font-bold">{contributor?.xp ?? 0}</p>
          </div>
          <div className="rounded border-2 border-[var(--border-ink)] bg-[var(--manila)] p-3 shadow-[2px_3px_0_var(--shadow-paper)]">
            <p className="font-mono-doc text-[10px] uppercase text-[var(--ink-muted)]">
              Final Rank
            </p>
            <p className="font-typewriter mt-1 text-sm font-bold leading-tight">
              {rank.current.badge} {rank.current.title}
            </p>
          </div>
        </div>

        {/* Hidden Personal Stat Easter Egg */}
        <div className="mt-5 rounded-md border-2 border-dashed border-[var(--stamp-red)] bg-[var(--paper)] p-4 text-left">
          <p className="font-mono-doc flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--stamp-red)]">
            <Sparkles className="h-4 w-4" /> Classified Forensic Note About You
          </p>
          <p className="font-typewriter mt-1 text-base">
            Your most-used word across all dossiers:{' '}
            <span className="highlighter-mark font-bold text-[#1B1B1B]">
              &ldquo;{hiddenStats.mostUsedWord}&rdquo;
            </span>{' '}
            {hiddenStats.mostUsedCount > 0 && (
              <span className="text-xs text-[var(--ink-muted)]">
                (used {hiddenStats.mostUsedCount} times across {hiddenStats.totalChars.toLocaleString()} characters!)
              </span>
            )}
          </p>
        </div>

        {/* Badges */}
        {unlockedBadges.length > 0 && (
          <div className="mt-5 text-left">
            <p className="font-mono-doc mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-[var(--ink-muted)]">
              <Award className="h-4 w-4 text-[var(--blueprint-ink)]" /> Badges Earned ({unlockedBadges.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {unlockedBadges.map((bid) => {
                const b = BADGES.find((x) => x.id === bid);
                if (!b) return null;
                return (
                  <span
                    key={bid}
                    className="inline-flex items-center gap-1 rounded border border-[var(--border-ink)] bg-[var(--highlighter)] px-2.5 py-1 text-xs font-bold text-[#1B1B1B]"
                  >
                    {b.emoji} {b.title}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/desk"
            className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--paper)] px-5 py-3 text-sm font-bold"
          >
            <CheckCircle2 className="h-4 w-4" /> View / Update Case Desk
          </Link>
          <Link
            href="/"
            className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-3 text-sm font-bold text-white"
          >
            <Home className="h-4 w-4" /> Back to Briefing
          </Link>
        </div>
      </NotebookCard>
    </main>
  );
}
