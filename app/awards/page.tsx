'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ArrowLeft, CheckCircle2, Trophy } from 'lucide-react';
import { AWARDS } from '@/data/awards';
import { ROSTER, getRosterById } from '@/data/roster';
import { useAppStore } from '@/store/useAppStore';
import { flushSyncQueue } from '@/lib/sync';
import { playSound } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { Stamp } from '@/components/ui/Stamp';

function DraggableNominee({
  id,
  label,
  isActiveTap,
  onClick,
}: {
  id: string;
  label: string;
  isActiveTap: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `nominee:${id}`,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 40 }
    : undefined;

  return (
    <button
      ref={setNodeRef}
      style={style}
      type="button"
      onClick={onClick}
      {...listeners}
      {...attributes}
      className={`min-h-[44px] rounded border-2 border-[var(--border-ink)] px-2.5 py-1 text-xs font-bold touch-none transition-colors ${
        isActiveTap
          ? 'bg-[var(--stamp-red)] text-white'
          : 'bg-[var(--paper)] hover:bg-[var(--highlighter)] hover:text-[#1B1B1B]'
      } ${isDragging ? 'scale-105 shadow-xl' : ''}`}
    >
      {label}
    </button>
  );
}

function AwardTrophySlot({
  awardKey,
  title,
  emoji,
  promptLine,
  votedRosterId,
  isFocused,
  onFocusSlot,
  candidates,
  onSelectVote,
}: {
  awardKey: string;
  title: string;
  emoji: string;
  promptLine: string;
  votedRosterId?: string;
  isFocused: boolean;
  onFocusSlot: () => void;
  candidates: readonly { id: string; label: string }[];
  onSelectVote: (rosterId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `award:${awardKey}` });
  const winner = getRosterById(votedRosterId);

  return (
    <div
      ref={setNodeRef}
      onClick={onFocusSlot}
      className={`rounded-md border-2 border-[var(--border-ink)] p-4 transition-all ${
        isOver
          ? 'bg-[var(--highlighter)] text-[#1B1B1B] ring-4 ring-[var(--stamp-red)]'
          : isFocused
          ? 'bg-[var(--manila)] ring-2 ring-[var(--blueprint-ink)]'
          : winner
          ? 'bg-[var(--paper-card)]'
          : 'bg-[var(--paper)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="text-2xl">{emoji}</span>
          <div>
            <h2 className="font-typewriter text-base font-bold leading-snug">{title}</h2>
            <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{promptLine}</p>
          </div>
        </div>
        {winner && <Stamp text={winner.label} color="blue" size="sm" rotate={-2} />}
      </div>

      {/* Accessible Dropdown + One-Tap Support */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={`award-select-${awardKey}`} className="sr-only">
          Vote for {title}
        </label>
        <select
          id={`award-select-${awardKey}`}
          value={votedRosterId ?? ''}
          onChange={(e) => {
            if (e.target.value) onSelectVote(e.target.value);
          }}
          className="min-h-[44px] flex-1 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm font-semibold"
        >
          <option value="">-- Drag token here or choose classmate --</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function AwardsPodiumPage() {
  const contributor = useAppStore((s) => s.contributor);
  const awards = useAppStore((s) => s.awards);
  const setAwardVote = useAppStore((s) => s.setAwardVote);

  const [focusedAwardKey, setFocusedAwardKey] = useState<string>(AWARDS[0].key);
  const [selectedTapNominee, setSelectedTapNominee] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">Identify Yourself First</h1>
          <Link
            href="/details"
            className="tactile-btn mt-4 inline-flex rounded-md bg-[var(--stamp-red)] px-5 py-3 font-bold text-white"
          >
            Go to Witness Details →
          </Link>
        </NotebookCard>
      </main>
    );
  }

  // Strictly disallow voting for self
  const candidates = ROSTER.filter((r) => r.id !== contributor.rosterId);
  const votedCount = Object.keys(awards).length;

  const castVote = (awardKey: string, rosterId: string) => {
    if (rosterId === contributor.rosterId) return;
    setAwardVote(awardKey, rosterId);
    void playSound('stamp');
    void flushSyncQueue();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (activeId.startsWith('nominee:') && overId.startsWith('award:')) {
      const rosterId = activeId.replace('nominee:', '');
      const awardKey = overId.replace('award:', '');
      castVote(awardKey, rosterId);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <EvidenceTag label="AWARDS PODIUM • 14 CATEGORIES" tone="yellow" />
        <Link
          href="/desk"
          className="tactile-btn inline-flex items-center gap-1.5 rounded-md bg-[var(--paper)] px-3 py-2 text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Case Desk
        </Link>
      </div>

      <NotebookCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-typewriter flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <Trophy className="h-7 w-7 text-[var(--stamp-red)]" />
              Class of 23 Awards Podium
            </h1>
            <p className="mt-1 text-sm text-[var(--ink-muted)]">
              Vote in all 14 categories (including classmates you skipped in case files). You
              cannot vote for yourself, and &ldquo;Nobody&rdquo; is not an option.
            </p>
          </div>
          <span className="font-mono-doc rounded border-2 border-[var(--border-ink)] bg-[var(--highlighter)] px-3 py-1.5 text-sm font-bold text-[#1B1B1B]">
            {votedCount} / 14 Voted
          </span>
        </div>

        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {/* Sticky Classmate Token Tray */}
          <div className="mt-5 rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-3">
            <p className="font-mono-doc mb-2 text-xs font-bold uppercase text-[var(--ink-muted)]">
              Nominee Tray — Drag onto any trophy below OR tap a name then tap a trophy:
              {selectedTapNominee && (
                <span className="ml-2 text-[var(--stamp-red)]">
                  Selected: {getRosterById(selectedTapNominee)?.label} (now tap a category!)
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {candidates.map((c) => (
                <DraggableNominee
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  isActiveTap={selectedTapNominee === c.id}
                  onClick={() => {
                    if (selectedTapNominee === c.id) {
                      setSelectedTapNominee(null);
                    } else {
                      setSelectedTapNominee(c.id);
                      if (focusedAwardKey) {
                        castVote(focusedAwardKey, c.id);
                        setSelectedTapNominee(null);
                      }
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* 14 Award Cards */}
          <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {AWARDS.map((aw) => (
              <AwardTrophySlot
                key={aw.key}
                awardKey={aw.key}
                title={aw.title}
                emoji={aw.emoji}
                promptLine={aw.promptLine}
                votedRosterId={awards[aw.key]}
                isFocused={focusedAwardKey === aw.key}
                onFocusSlot={() => {
                  setFocusedAwardKey(aw.key);
                  if (selectedTapNominee) {
                    castVote(aw.key, selectedTapNominee);
                    setSelectedTapNominee(null);
                  }
                }}
                candidates={candidates}
                onSelectVote={(rosterId) => castVote(aw.key, rosterId)}
              />
            ))}
          </div>
        </DndContext>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-[var(--border-ink)]/35 pt-4">
          <span className="text-xs font-semibold text-[var(--ink-muted)]">
            {votedCount >= 14
              ? 'All 14 trophies assigned! Ready whenever you are.'
              : `${14 - votedCount} categories still waiting for your verdict.`}
          </span>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/desk"
              className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--paper)] px-4 py-2.5 text-sm font-bold"
            >
              Back to Desk
            </Link>
            <Link
              href="/archive"
              className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-2.5 text-sm font-bold text-white"
            >
              <CheckCircle2 className="h-4 w-4" />
              Next: Class Archive →
            </Link>
          </div>
        </div>
      </NotebookCard>
    </main>
  );
}
