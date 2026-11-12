'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Archive } from 'lucide-react';
import {
  ARCHIVE_SECTIONS,
  MANGA_SUGGESTED_SCENES,
  TEXT_LIMITS,
} from '@/data/questions';
import { useAppStore, type ArchiveEntryRecord } from '@/store/useAppStore';
import { flushSyncQueue } from '@/lib/sync';
import { playSound } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { generateUuid as makeUuid } from '@/lib/crypto';

export default function ClassArchivePage() {
  const contributor = useAppStore((s) => s.contributor);
  const archiveEntries = useAppStore((s) => s.archiveEntries);
  const setArchiveSectionEntries = useAppStore((s) => s.setArchiveSectionEntries);
  const awardXp = useAppStore((s) => s.awardXp);

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">Evidence Locker Locked</h1>
          <Link
            href="/details"
            className="tactile-btn mt-4 inline-flex rounded-md bg-[var(--stamp-red)] px-5 py-3 font-bold text-white"
          >
            Enter Witness Details →
          </Link>
        </NotebookCard>
      </main>
    );
  }

  const getSingleEntry = (sectionKey: string): ArchiveEntryRecord => {
    const list = archiveEntries[sectionKey] ?? [];
    if (list[0]) return list[0];
    return {
      id: makeUuid(),
      sectionKey,
      content: {},
      updatedAt: new Date().toISOString(),
    };
  };

  const saveSingleContent = (sectionKey: string, content: Record<string, unknown>) => {
    const existing = getSingleEntry(sectionKey);
    const updated: ArchiveEntryRecord = {
      ...existing,
      content,
      updatedAt: new Date().toISOString(),
    };
    setArchiveSectionEntries(sectionKey, [updated]);
    awardXp(15, 'Archive Logged', `archive:${sectionKey}`);
  };

  const getListEntries = (sectionKey: string): ArchiveEntryRecord[] => {
    return archiveEntries[sectionKey] ?? [];
  };

  return (
    <main className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <EvidenceTag label="THE EVIDENCE LOCKER • CLASS ARCHIVE" tone="blue" />
        <Link
          href="/desk"
          onClick={() => void flushSyncQueue()}
          className="tactile-btn inline-flex items-center gap-1.5 rounded-md bg-[var(--paper)] px-3 py-2 text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Save &amp; Back to Desk
        </Link>
      </div>

      <NotebookCard className="mb-6">
        <h1 className="font-typewriter flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Archive className="h-7 w-7 text-[var(--blueprint-ink)]" />
          Class Archive: The Evidence Locker
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          All 14 sections are optional—fill whichever school memories crack you up most.
          Strictly school lore (classrooms, corridors, canteen, assembly, trips).
        </p>
      </NotebookCard>

      <div className="space-y-5">
        {ARCHIVE_SECTIONS.map((sec) => {
          // 1. Teacher Files (repeatable)
          if (sec.kind === 'teachers') {
            const entries = getListEntries(sec.key);
            return (
              <NotebookCard key={sec.key} taped={false}>
                <h2 className="font-typewriter text-lg font-bold">{sec.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{sec.subtitle}</p>
                <p className="font-mono-doc mt-1 text-[11px] text-[var(--blueprint-ink)]">
                  Example: {sec.example}
                </p>

                <div className="mt-3 space-y-3">
                  {entries.map((item, idx) => {
                    const c = item.content as {
                      teacher?: string;
                      phrase?: string;
                      reaction?: string;
                    };
                    return (
                      <div
                        key={item.id}
                        className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono-doc text-xs font-bold">
                            Teacher #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setArchiveSectionEntries(
                                sec.key,
                                entries.filter((e) => e.id !== item.id)
                              )
                            }
                            aria-label="Delete teacher entry"
                            className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--stamp-red)] hover:bg-[var(--manila)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <input
                            type="text"
                            maxLength={100}
                            placeholder="Teacher name / subject"
                            value={c.teacher || ''}
                            onChange={(e) => {
                              const next = entries.map((en) =>
                                en.id === item.id
                                  ? {
                                      ...en,
                                      content: { ...c, teacher: e.target.value },
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : en
                              );
                              setArchiveSectionEntries(sec.key, next);
                            }}
                            className="min-h-[44px] rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2.5 text-sm"
                          />
                          <input
                            type="text"
                            maxLength={TEXT_LIMITS.SHORT}
                            placeholder="Signature phrase"
                            value={c.phrase || ''}
                            onChange={(e) => {
                              const next = entries.map((en) =>
                                en.id === item.id
                                  ? {
                                      ...en,
                                      content: { ...c, phrase: e.target.value },
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : en
                              );
                              setArchiveSectionEntries(sec.key, next);
                            }}
                            className="min-h-[44px] rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2.5 text-sm"
                          />
                          <input
                            type="text"
                            maxLength={TEXT_LIMITS.SHORT}
                            placeholder="Typical reaction"
                            value={c.reaction || ''}
                            onChange={(e) => {
                              const next = entries.map((en) =>
                                en.id === item.id
                                  ? {
                                      ...en,
                                      content: { ...c, reaction: e.target.value },
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : en
                              );
                              setArchiveSectionEntries(sec.key, next);
                            }}
                            className="min-h-[44px] rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2.5 text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => {
                      setArchiveSectionEntries(sec.key, [
                        ...entries,
                        {
                          id: makeUuid(),
                          sectionKey: sec.key,
                          content: { teacher: '', phrase: '', reaction: '' },
                          updatedAt: new Date().toISOString(),
                        },
                      ]);
                      awardXp(15, 'Teacher File Added', `archive:${sec.key}`);
                      void playSound('typewriter');
                    }}
                    className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--manila)] px-4 py-2 text-xs font-bold"
                  >
                    <Plus className="h-4 w-4" /> Add Teacher File
                  </button>
                </div>
              </NotebookCard>
            );
          }

          // 2. Teacher Bingo (9 squares)
          if (sec.kind === 'bingo') {
            const single = getSingleEntry(sec.key);
            const squares = Array.isArray(single.content?.squares)
              ? (single.content.squares as string[])
              : Array.from({ length: 9 }, () => '');
            return (
              <NotebookCard key={sec.key} taped={false}>
                <h2 className="font-typewriter text-lg font-bold">{sec.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{sec.subtitle}</p>
                <p className="font-mono-doc mt-1 text-[11px] text-[var(--blueprint-ink)]">
                  Example: {sec.example}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <input
                      key={idx}
                      type="text"
                      maxLength={140}
                      placeholder={`Bingo square #${idx + 1}`}
                      value={squares[idx] || ''}
                      onChange={(e) => {
                        const next = [...squares];
                        next[idx] = e.target.value;
                        saveSingleContent(sec.key, { squares: next });
                      }}
                      className="min-h-[46px] rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-2.5 text-xs"
                    />
                  ))}
                </div>
              </NotebookCard>
            );
          }

          // 5. Unwritten Class Rules (list)
          if (sec.kind === 'list') {
            const single = getSingleEntry(sec.key);
            const items = Array.isArray(single.content?.rules)
              ? (single.content.rules as string[])
              : [''];
            return (
              <NotebookCard key={sec.key} taped={false}>
                <h2 className="font-typewriter text-lg font-bold">{sec.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{sec.subtitle}</p>
                <p className="font-mono-doc mt-1 text-[11px] text-[var(--blueprint-ink)]">
                  Example: {sec.example}
                </p>

                <div className="mt-3 space-y-2">
                  {items.map((rule, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        placeholder={`Rule #${idx + 1}...`}
                        value={rule}
                        onChange={(e) => {
                          const next = [...items];
                          next[idx] = e.target.value;
                          saveSingleContent(sec.key, { rules: next });
                        }}
                        className="min-h-[44px] flex-1 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            saveSingleContent(sec.key, {
                              rules: items.filter((_, i) => i !== idx),
                            })
                          }
                          aria-label="Remove rule"
                          className="inline-flex h-[44px] w-[44px] items-center justify-center rounded border border-[var(--border-ink)] text-[var(--stamp-red)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => saveSingleContent(sec.key, { rules: [...items, ''] })}
                    className="tactile-btn inline-flex items-center gap-1 rounded bg-[var(--manila)] px-3 py-2 text-xs font-bold"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Another Rule
                  </button>
                </div>
              </NotebookCard>
            );
          }

          // 6. The Timeline (5 chaotic school days)
          if (sec.kind === 'timeline') {
            const single = getSingleEntry(sec.key);
            const days = Array.isArray(single.content?.days)
              ? (single.content.days as { date: string; event: string; involved: string }[])
              : Array.from({ length: 5 }, () => ({ date: '', event: '', involved: '' }));
            return (
              <NotebookCard key={sec.key} taped={false}>
                <h2 className="font-typewriter text-lg font-bold">{sec.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{sec.subtitle}</p>
                <p className="font-mono-doc mt-1 text-[11px] text-[var(--blueprint-ink)]">
                  Example: {sec.example}
                </p>

                <div className="mt-3 space-y-2.5">
                  {days.map((d, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 gap-2 rounded border border-[var(--border-ink)] bg-[var(--paper)] p-2.5 sm:grid-cols-4"
                    >
                      <input
                        type="text"
                        maxLength={60}
                        placeholder={`Day ${idx + 1} (Month/Date)`}
                        value={d.date}
                        onChange={(e) => {
                          const next = days.map((row, i) =>
                            i === idx ? { ...row, date: e.target.value } : row
                          );
                          saveSingleContent(sec.key, { days: next });
                        }}
                        className="min-h-[44px] rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        placeholder="What happened?"
                        value={d.event}
                        onChange={(e) => {
                          const next = days.map((row, i) =>
                            i === idx ? { ...row, event: e.target.value } : row
                          );
                          saveSingleContent(sec.key, { days: next });
                        }}
                        className="sm:col-span-2 min-h-[44px] rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        maxLength={150}
                        placeholder="Who was involved?"
                        value={d.involved}
                        onChange={(e) => {
                          const next = days.map((row, i) =>
                            i === idx ? { ...row, involved: e.target.value } : row
                          );
                          saveSingleContent(sec.key, { days: next });
                        }}
                        className="min-h-[44px] rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </NotebookCard>
            );
          }

          // 12. Manga scene votes (choose 6 + write-in)
          if (sec.kind === 'manga_scenes') {
            const single = getSingleEntry(sec.key);
            const selected = Array.isArray(single.content?.selected)
              ? (single.content.selected as string[])
              : [];
            const customScene = String(single.content?.customScene ?? '');
            return (
              <NotebookCard key={sec.key} taped={false}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-typewriter text-lg font-bold">{sec.title}</h2>
                  <span className="font-mono-doc rounded bg-[var(--highlighter)] px-2 py-0.5 text-xs font-bold text-[#1B1B1B]">
                    {selected.length}/6 picked
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{sec.subtitle}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {MANGA_SUGGESTED_SCENES.map((scene) => {
                    const active = selected.includes(scene);
                    return (
                      <button
                        key={scene}
                        type="button"
                        onClick={() => {
                          let next: string[];
                          if (active) {
                            next = selected.filter((s) => s !== scene);
                          } else if (selected.length < 6) {
                            next = [...selected, scene];
                          } else {
                            return;
                          }
                          saveSingleContent(sec.key, { selected: next, customScene });
                          void playSound('typewriter');
                        }}
                        className={`min-h-[44px] rounded border-2 border-[var(--border-ink)] px-3 py-1.5 text-xs font-bold ${
                          active
                            ? 'bg-[var(--stamp-red)] text-white'
                            : 'bg-[var(--paper)] hover:bg-[var(--manila)]'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {scene}
                      </button>
                    );
                  })}
                </div>

                <input
                  type="text"
                  maxLength={TEXT_LIMITS.SHORT}
                  placeholder="Write-in manga scene idea..."
                  value={customScene}
                  onChange={(e) =>
                    saveSingleContent(sec.key, {
                      selected,
                      customScene: e.target.value,
                    })
                  }
                  className="mt-3 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                />
              </NotebookCard>
            );
          }

          // 13. Class in 3 words & Class song
          if (sec.kind === 'three_words_song') {
            const single = getSingleEntry(sec.key);
            const threeWords = String(single.content?.threeWords ?? '');
            const song = String(single.content?.song ?? '');
            return (
              <NotebookCard key={sec.key} taped={false}>
                <h2 className="font-typewriter text-lg font-bold">{sec.title}</h2>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{sec.subtitle}</p>
                <p className="font-mono-doc mt-1 text-[11px] text-[var(--blueprint-ink)]">
                  Example: {sec.example}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-mono-doc block text-xs font-bold uppercase">
                      Our class in 3 words
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="e.g. Loud, late, undefeated."
                      value={threeWords}
                      onChange={(e) =>
                        saveSingleContent(sec.key, {
                          threeWords: e.target.value,
                          song,
                        })
                      }
                      className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-mono-doc block text-xs font-bold uppercase">
                      The song that played in everyone&apos;s head
                    </label>
                    <input
                      type="text"
                      maxLength={150}
                      placeholder="e.g. Ilahi / Give Me Some Sunshine"
                      value={song}
                      onChange={(e) =>
                        saveSingleContent(sec.key, {
                          threeWords,
                          song: e.target.value,
                        })
                      }
                      className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                    />
                  </div>
                </div>
              </NotebookCard>
            );
          }

          // Default open text section
          const single = getSingleEntry(sec.key);
          const textVal = String(single.content?.text ?? '');
          return (
            <NotebookCard key={sec.key} taped={false}>
              <h2 className="font-typewriter text-lg font-bold">{sec.title}</h2>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{sec.subtitle}</p>
              <p className="font-mono-doc mt-1 text-[11px] text-[var(--blueprint-ink)]">
                Example: {sec.example}
              </p>
              <textarea
                rows={3}
                maxLength={TEXT_LIMITS.LONG}
                placeholder="Write your memories here (English / हिन्दी / Hinglish)..."
                value={textVal}
                onChange={(e) =>
                  saveSingleContent(sec.key, {
                    text: e.target.value.slice(0, TEXT_LIMITS.LONG),
                  })
                }
                className="mt-2.5 w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3 text-sm"
              />
            </NotebookCard>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap justify-between gap-3">
        <Link
          href="/desk"
          onClick={() => void flushSyncQueue()}
          className="tactile-btn rounded-md bg-[var(--paper)] px-5 py-3 text-sm font-bold"
        >
          ← Back to Case Desk
        </Link>
        <Link
          href="/chaos"
          onClick={() => void flushSyncQueue()}
          className="tactile-btn rounded-md bg-[var(--stamp-red)] px-6 py-3 text-sm font-bold text-white"
        >
          Next: Chaos Dump (Photos) →
        </Link>
      </div>
    </main>
  );
}
