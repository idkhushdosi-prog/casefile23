'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Printer } from 'lucide-react';
import { ROSTER, getRosterById } from '@/data/roster';
import {
  aggregateSubjectProfile,
  type EditorDataset,
  type EditorPickRow,
} from '@/lib/exports';
import {
  loadEditorDataset,
  saveEditorNote,
  saveEditorPick,
} from '@/lib/editorStore';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { StudentPrintPreview } from '@/components/editor/StudentPrintPreview';

const KEEPSAKE_FORMATS = ['deck', 'ncert', 'cid', 'manga'] as const;

export default function EditorStudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: subjectId } = use(params);
  const [dataset, setDataset] = useState<EditorDataset | null>(null);
  const [source, setSource] = useState<'supabase' | 'demo'>('demo');
  const [unauthorized, setUnauthorized] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [signedPortrait, setSignedPortrait] = useState<string | null>(null);
  const [signedMugshot, setSignedMugshot] = useState<string | null>(null);
  const [binomial, setBinomial] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const run = async () => {
      if (isSupabaseConfigured()) {
        const res = await fetch('/api/editor/auth', { cache: 'no-store' });
        const json = (await res.json()) as { authorized?: boolean };
        if (!json.authorized) {
          setUnauthorized(true);
          return;
        }
      }

      const { dataset: ds, source: src, signedUrls } = await loadEditorDataset();
      setDataset(ds);
      setSource(src);
      const n = ds.notes[subjectId];
      setBinomial(n?.pseudo_latin_binomial || '');
      setNote(n?.note || '');

      if (src === 'supabase') {
        const prof = aggregateSubjectProfile(subjectId, ds);
        if (prof.portraitUpload?.storage_path && signedUrls[prof.portraitUpload.storage_path]) {
          setSignedPortrait(signedUrls[prof.portraitUpload.storage_path]);
        }
        if (prof.mugshotUpload?.storage_path && signedUrls[prof.mugshotUpload.storage_path]) {
          setSignedMugshot(signedUrls[prof.mugshotUpload.storage_path]);
        }
      }
    };
    void run();
  }, [subjectId]);

  if (unauthorized) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <NotebookCard>
          <h1 className="font-typewriter text-xl font-bold text-[var(--stamp-red)]">
            Editor Clearance Required
          </h1>
          <p className="mt-2 text-xs text-[var(--ink-muted)]">
            Unlock the Editor Desk with the batch&apos;s Editor Passcode first.
          </p>
          <Link
            href="/editor"
            className="tactile-btn mt-4 inline-flex rounded bg-[var(--blueprint)] px-5 py-2.5 text-sm font-bold text-white"
          >
            Go to Editor Login →
          </Link>
        </NotebookCard>
      </main>
    );
  }

  if (!dataset) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 text-center">
        <NotebookCard>Loading Student Dossier…</NotebookCard>
      </main>
    );
  }

  const prof = aggregateSubjectProfile(subjectId, dataset);
  const chapterNum = Math.max(1, ROSTER.findIndex((r) => r.id === subjectId) + 1);

  const updatePick = async (entryId: string, patch: Partial<EditorPickRow>) => {
    const existing: EditorPickRow = dataset.picks[entryId] ?? {
      entry_id: entryId,
      target_type: 'response',
      picked: false,
      edited_text: null,
      used_in: [],
    };
    const next: EditorPickRow = { ...existing, ...patch };
    setDataset({
      ...dataset,
      picks: { ...dataset.picks, [entryId]: next },
    });
    await saveEditorPick(next, source);
  };

  const handleSaveNote = async () => {
    const nextNote = {
      subject_roster_id: subjectId,
      note,
      pseudo_latin_binomial: binomial,
    };
    setDataset({
      ...dataset,
      notes: { ...dataset.notes, [subjectId]: nextNote },
    });
    await saveEditorNote(nextNote, source);
  };

  const textResponses = prof.responses.filter(
    (r) => !['q6_stats', 'q5_habitat', 'q12_partners', 'q15_diagram_labels'].includes(r.question_key)
  );

  return (
    <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <EvidenceTag label={`EDITOR PROFILE • CHAPTER ${chapterNum}`} tone="blue" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowPrintPreview((p) => !p)}
            className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--highlighter)] px-4 py-2 text-xs font-bold text-[#1B1B1B]"
          >
            <Printer className="h-4 w-4" />
            {showPrintPreview ? 'Hide Print Preview' : 'Show Print Preview (Deck / NCERT / CID)'}
          </button>
          <Link
            href="/editor"
            className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--paper)] px-3 py-2 text-xs font-bold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Editor Desk
          </Link>
        </div>
      </div>

      {showPrintPreview && (
        <section className="mb-6">
          <StudentPrintPreview
            subjectId={subjectId}
            chapterNum={chapterNum}
            dataset={dataset}
            portraitUrl={signedPortrait}
            mugshotUrl={signedMugshot}
          />
        </section>
      )}

      <NotebookCard>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-dashed border-[var(--border-ink)]/35 pb-4">
          <div>
            <h1 className="font-typewriter text-2xl font-bold sm:text-3xl">
              {prof.subject?.label ?? subjectId}{' '}
              <span className="text-base font-normal text-[var(--ink-muted)]">
                ({prof.ownContributor?.full_name_caps || 'Name pending'})
              </span>
            </h1>
            <p className="font-mono-doc mt-1 text-xs text-[var(--ink-muted)]">
              Filed: {prof.filedCount} • Skips: {prof.skipCount} • Chaos Avg: {prof.chaosAvg}/10
            </p>
          </div>
        </div>

        {/* Editor Notes & NCERT Pseudo-Latin Binomial */}
        <div className="mt-4 grid grid-cols-1 gap-3 rounded border-2 border-[var(--border-ink)] bg-[var(--manila)] p-3.5 sm:grid-cols-2">
          <div>
            <label className="font-mono-doc block text-xs font-bold uppercase">
              NCERT Pseudo-Latin Binomial
            </label>
            <input
              type="text"
              placeholder={`e.g. Homo studenticus ${subjectId}`}
              value={binomial}
              onChange={(e) => setBinomial(e.target.value)}
              onBlur={() => void handleSaveNote()}
              className="mt-1 min-h-[42px] w-full rounded border border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm italic"
            />
          </div>
          <div>
            <label className="font-mono-doc block text-xs font-bold uppercase">
              Editor Private Note
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                placeholder="Print reminder or spelling note..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => void handleSaveNote()}
                className="min-h-[42px] flex-1 rounded border border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => void handleSaveNote()}
                className="tactile-btn rounded bg-[var(--blueprint)] px-3 text-xs font-bold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Aggregated Nicknames, Archetypes, Partners, Stats & Habitat Heatmap */}
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3.5 text-xs">
            <h2 className="font-typewriter text-base font-bold">
              Nicknames &amp; Archetype Votes
            </h2>
            <p className="font-mono-doc mt-2 text-[10px] font-bold uppercase text-[var(--blueprint-ink)]">
              Nicknames Ranked
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {prof.nicknamesRanked.map((n) => (
                <span
                  key={n.name}
                  className="rounded border border-[var(--border-ink)] bg-[var(--highlighter)] px-2 py-0.5 font-bold text-[#14181F]"
                >
                  {n.name} ×{n.count}
                </span>
              ))}
            </div>
            <p className="font-mono-doc mt-3 text-[10px] font-bold uppercase text-[var(--blueprint-ink)]">
              Archetype Tally
            </p>
            <ul className="mt-1 space-y-1">
              {prof.archetypesRanked.map((a) => (
                <li key={a.title} className="flex justify-between">
                  <span>{a.title}</span>
                  <span className="font-mono-doc font-bold">{a.count}</span>
                </li>
              ))}
            </ul>
            <p className="font-mono-doc mt-3 text-[10px] font-bold uppercase text-[var(--stamp-red)]">
              Partners in Crime Graph
            </p>
            <ul className="mt-1 space-y-1">
              {prof.partnersRanked.slice(0, 5).map((p) => (
                <li key={p.rosterId} className="flex justify-between">
                  <span>
                    {prof.subject?.label} ──🔴── {p.label}
                  </span>
                  <span className="font-mono-doc font-bold">{p.count} links</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stats + Habitat Heatmap */}
          <div className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3.5 text-xs">
            <h2 className="font-typewriter text-base font-bold">
              Stats (Trimmed Median vs Weighted Avg)
            </h2>
            <div className="mt-2 space-y-1.5">
              {prof.statAggregates.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2">
                  <span>{s.label}</span>
                  <span className="font-mono-doc font-bold">
                    Med: {s.median} | Wtd: {s.weighted}
                  </span>
                </div>
              ))}
            </div>

            <h3 className="font-mono-doc mt-4 text-[10px] font-bold uppercase text-[var(--blueprint-ink)]">
              Habitat Seat Heatmap (Top: {prof.topBench})
            </h3>
            <div className="mt-1.5 grid grid-cols-6 gap-1">
              {[1, 2, 3, 4, 5].flatMap((row) =>
                ['W1', 'W2', 'M1', 'M2', 'D1', 'D2'].map((col) => {
                  const key = `R${row}-${col}`;
                  const cnt = prof.habitatCounts[key] ?? 0;
                  return (
                    <div
                      key={key}
                      title={`${key}: ${cnt} votes`}
                      className={`rounded border border-[var(--border-ink)]/40 py-1 text-center font-mono-doc text-[10px] ${
                        cnt >= 3
                          ? 'bg-[var(--stamp-red)] font-bold text-white'
                          : cnt > 0
                          ? 'bg-[var(--highlighter)] font-bold text-[#1B1B1B]'
                          : 'bg-[var(--paper-card)] opacity-60'
                      }`}
                    >
                      {cnt || '·'}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* All Text Answers with Pick / Reject, Inline Edit, and Format Checkboxes */}
        <section className="mt-6">
          <h2 className="font-typewriter text-xl font-bold">
            Witness Testimony &amp; Curation ({textResponses.length} answers)
          </h2>
          <div className="mt-3 space-y-3">
            {textResponses.map((r) => {
              const pick = dataset.picks[r.id];
              const rawText =
                r.question_key === 'q11_offenses'
                  ? [r.answer?.offense1, r.answer?.offense2].filter(Boolean).join(' / ')
                  : r.question_key === 'q13_chaos'
                  ? `Level ${r.answer?.level}/10: ${r.answer?.why}`
                  : r.question_key === 'q16_exam_question'
                  ? `${r.answer?.question} [${r.answer?.marks} marks]`
                  : r.question_key === 'q7_custom_stat'
                  ? `${r.answer?.name}: ${r.answer?.value}/100`
                  : String(r.answer?.value ?? r.answer?.customTitle ?? r.answer?.archetypeId ?? '');

              const editedVal = pick?.edited_text ?? rawText;
              const usedIn = pick?.used_in ?? [];

              return (
                <div
                  key={r.id}
                  className={`rounded border-2 p-3 text-xs ${
                    pick?.picked
                      ? 'border-emerald-700 bg-emerald-50/60 dark:bg-emerald-950/25'
                      : 'border-[var(--border-ink)]/40 bg-[var(--paper)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-doc font-bold uppercase text-[var(--blueprint-ink)]">
                      {r.question_key}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {KEEPSAKE_FORMATS.map((fmt) => {
                        const checked = usedIn.includes(fmt);
                        return (
                          <label
                            key={fmt}
                            className="inline-flex cursor-pointer items-center gap-1 rounded border border-[var(--border-ink)]/40 bg-[var(--paper-card)] px-2 py-0.5 uppercase font-mono-doc text-[10px]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const nextFormats = checked
                                  ? usedIn.filter((f) => f !== fmt)
                                  : [...usedIn, fmt];
                                void updatePick(r.id, { used_in: nextFormats });
                              }}
                            />
                            {fmt}
                          </label>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => void updatePick(r.id, { picked: !pick?.picked })}
                        className={`inline-flex items-center gap-1 rounded border border-[var(--border-ink)] px-2.5 py-1 font-bold ${
                          pick?.picked
                            ? 'bg-emerald-700 text-white'
                            : 'bg-[var(--paper-card)]'
                        }`}
                      >
                        <Check className="h-3 w-3" />
                        {pick?.picked ? 'Picked' : 'Pick / Reject'}
                      </button>
                    </div>
                  </div>

                  <p className="mt-1.5 text-[11px] text-[var(--ink-muted)]">
                    Original: {rawText}
                  </p>
                  <input
                    type="text"
                    aria-label={`Edit text for ${r.question_key}`}
                    value={editedVal}
                    onChange={(e) =>
                      void updatePick(r.id, { edited_text: e.target.value })
                    }
                    className="mt-1.5 min-h-[38px] w-full rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2.5 text-xs"
                  />
                </div>
              );
            })}
          </div>
        </section>
      </NotebookCard>
    </main>
  );
}

void getRosterById;
