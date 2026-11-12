'use client';

import React from 'react';
import { getArchetypeById } from '@/data/archetypes';
import {
  aggregateSubjectProfile,
  getEffectiveText,
  isRowPickedFor,
  type EditorDataset,
} from '@/lib/exports';
import { Stamp } from '@/components/ui/Stamp';

export function StudentPrintPreview({
  subjectId,
  chapterNum,
  dataset,
  portraitUrl,
  mugshotUrl,
}: {
  subjectId: string;
  chapterNum: number;
  dataset: EditorDataset;
  portraitUrl?: string | null;
  mugshotUrl?: string | null;
}) {
  const prof = aggregateSubjectProfile(subjectId, dataset);
  const name = prof.ownContributor?.full_name_caps || prof.subject?.label.toUpperCase() || subjectId;
  const topNick = prof.nicknamesRanked[0]?.name || prof.subject?.label || 'Mystery';
  const topArch = prof.archetypesRanked[0];
  const archDef = topArch ? getArchetypeById(topArch.id) : undefined;

  const pickOne = (qKey: string, fmt: 'deck' | 'ncert' | 'cid' | 'manga', field = 'value') => {
    const rows = prof.responses.filter((r) => r.question_key === qKey);
    const chosen = rows.find((r) => isRowPickedFor(r.id, dataset.picks, fmt)) ?? rows[0];
    if (!chosen) return '—';
    return getEffectiveText(chosen, String(chosen.answer?.[field] ?? ''), dataset.picks) || '—';
  };

  const examRows = prof.responses.filter((r) => r.question_key === 'q16_exam_question');
  const pickedExam =
    examRows.find((r) => isRowPickedFor(r.id, dataset.picks, 'ncert')) ?? examRows[0];

  const offenseRows = prof.responses.filter((r) => r.question_key === 'q11_offenses');
  const pickedOffenses = offenseRows.filter((r) => isRowPickedFor(r.id, dataset.picks, 'cid'));
  const shownOffenses = pickedOffenses.length > 0 ? pickedOffenses : offenseRows.slice(0, 2);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* 1. COLLECTIBLE STAT DECK CARD */}
      <article className="rounded-xl border-4 border-[#1B1B1B] bg-gradient-to-b from-[#FFE066] via-[#F6EEDB] to-[#D9C28A] p-4 text-[#1B1B1B] shadow-[5px_6px_0_var(--border-ink)]">
        <div className="flex items-center justify-between border-b-2 border-[#1B1B1B] pb-2">
          <div>
            <p className="font-mono-doc text-[10px] font-bold uppercase tracking-widest">
              CLASS OF 23 • STAT DECK
            </p>
            <h3 className="font-typewriter text-lg font-bold leading-tight">{name}</h3>
            <p className="font-hand text-base font-bold text-[#C8102E]">
              &ldquo;{topNick}&rdquo; • {topArch?.title ?? 'Wildcard'}
            </p>
          </div>
          <div className="rounded border-2 border-[#1B1B1B] bg-[#C8102E] px-2.5 py-1 text-center text-white">
            <span className="block font-mono-doc text-[9px]">CHAOS</span>
            <span className="font-stamp text-lg leading-none">{prof.chaosAvg}</span>
          </div>
        </div>

        <div className="my-3 flex h-36 items-center justify-center overflow-hidden rounded border-2 border-[#1B1B1B] bg-[#E8D5A8]">
          {portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portraitUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-mono-doc text-xs text-[#554C3D]">[OFFICIAL PORTRAIT]</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {prof.statAggregates.map((st) => (
            <div
              key={st.key}
              className="flex items-center justify-between rounded border border-[#1B1B1B]/40 bg-white/75 px-2 py-1"
            >
              <span className="truncate font-semibold">{st.label.split(' ')[0]}</span>
              <span className="font-mono-doc font-bold text-[#1F3A93]">{st.weighted}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1 border-t-2 border-[#1B1B1B]/40 pt-2 text-[11px]">
          <p>
            <strong>Quirk:</strong> {pickOne('q3_quirk', 'deck')}
          </p>
          <p>
            <strong>Passive:</strong> {pickOne('q9_passive_trait', 'deck')}
          </p>
          <p>
            <strong>Ultimate:</strong> {pickOne('q10_ultimate_move', 'deck')}
          </p>
          <p className="italic text-[#1F3A93]">
            &ldquo;{pickOne('q8_catchphrase', 'deck')}&rdquo;
          </p>
        </div>
      </article>

      {/* 2. NCERT PARODY CHAPTER PAGE */}
      <article className="rounded-md border-2 border-[#1B1B1B] bg-[#FCFBF7] p-5 text-[#1B1B1B] shadow-[5px_6px_0_var(--border-ink)]">
        <div className="border-b-2 border-[#1F3A93] pb-2">
          <p className="font-mono-doc text-[10px] font-bold uppercase tracking-widest text-[#1F3A93]">
            CHAPTER {chapterNum} • NCERT PARODY EDITION
          </p>
          <h3 className="font-serif text-lg font-bold leading-snug">
            {archDef?.ncertPrefix ?? 'Specimen Monograph'}: {prof.subject?.label}
          </h3>
          <p className="font-serif text-xs italic text-[#554C3D]">
            Binomial:{' '}
            {prof.note.pseudo_latin_binomial ||
              `Homo studenticus ${subjectId.replace(/[^a-z]/g, '')}`}
          </p>
        </div>

        <div className="mt-3 text-xs space-y-2 font-serif">
          <p>
            <strong>Natural Habitat:</strong> {prof.topBench}
            {prof.freeSpots[0] ? ` (also spotted at: ${prof.freeSpots[0]})` : ''}
          </p>

          <div className="rounded border border-[#1B1B1B]/30 bg-[#F6EEDB] p-2.5">
            <p className="font-mono-doc text-[10px] font-bold uppercase text-[#1F3A93]">
              Fig {chapterNum}.1 — Anatomical Specimen Notes
            </p>
            <ul className="mt-1 list-disc pl-4 space-y-0.5 text-[11px]">
              {prof.diagramLabels.slice(0, 5).map((l, i) => (
                <li key={i}>
                  <strong>{l.area}:</strong> {l.promptText} {l.labelText}
                </li>
              ))}
              {prof.diagramLabels.length === 0 && <li>No diagram labels yet.</li>}
            </ul>
          </div>

          <div className="rounded border-2 border-[#1F3A93] bg-[#EEF3FF] p-2.5">
            <p className="font-mono-doc text-[10px] font-bold uppercase text-[#1F3A93]">
              BOARD EXAM PRACTICE BOX
            </p>
            <p className="mt-1 text-xs">
              <strong>Q.</strong>{' '}
              {pickedExam
                ? getEffectiveText(
                    pickedExam,
                    String(pickedExam.answer?.question ?? ''),
                    dataset.picks
                  )
                : `Justify why ${prof.subject?.label} deserves extra recess.`}{' '}
              <strong>[{String(pickedExam?.answer?.marks ?? 5)} marks]</strong>
            </p>
          </div>

          <p className="border-t border-dashed border-[#1B1B1B]/30 pt-2 italic">
            <strong>Batch Note:</strong> {pickOne('q18_genuine_compliment', 'ncert')}
          </p>
        </div>
      </article>

      {/* 3. CID CONFIDENTIAL SUSPECT SHEET */}
      <article className="rounded-md border-2 border-[#1B1B1B] bg-[#E8D5A8] p-4 text-[#1B1B1B] shadow-[5px_6px_0_var(--border-ink)]">
        <div className="flex items-start justify-between border-b-2 border-[#C8102E] pb-2">
          <div>
            <p className="font-mono-doc text-[10px] font-bold uppercase tracking-widest text-[#C8102E]">
              CID DOSSIER // CASE #{String(chapterNum).padStart(2, '0')}
            </p>
            <h3 className="font-typewriter text-lg font-bold">{name}</h3>
            <p className="font-mono-doc text-[11px]">
              Aliases:{' '}
              {prof.nicknamesRanked
                .slice(0, 3)
                .map((n) => n.name)
                .join(', ') || 'None'}
            </p>
          </div>
          <Stamp text={`CHAOS ${prof.chaosAvg}/10`} color="red" size="sm" rotate={-4} />
        </div>

        <div className="my-3 flex h-32 items-center justify-center overflow-hidden rounded border-2 border-[#1B1B1B] bg-[#2C251D] text-white">
          {mugshotUrl || portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mugshotUrl || portraitUrl || ''}
              alt="Mugshot"
              className="h-full w-full object-cover grayscale contrast-125"
            />
          ) : (
            <span className="font-mono-doc text-xs">[CID MUGSHOT SLATE]</span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          <div>
            <p className="font-mono-doc text-[10px] font-bold uppercase text-[#C8102E]">
              Known Offenses
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {shownOffenses.map((o) => (
                <li key={o.id}>
                  {getEffectiveText(
                    o,
                    [o.answer?.offense1, o.answer?.offense2].filter(Boolean).join(' / '),
                    dataset.picks
                  )}
                </li>
              ))}
              {shownOffenses.length === 0 && <li>Clean record (suspicious).</li>}
            </ul>
          </div>

          <p>
            <strong>Partners in Crime:</strong>{' '}
            {prof.partnersRanked
              .slice(0, 3)
              .map((p) => `${p.label} (${p.count})`)
              .join(', ') || 'Operates solo'}
          </p>
          <p>
            <strong>Natural Predator:</strong> {pickOne('q14_predator', 'cid')}
          </p>
          <p>
            <strong>Origin Story:</strong> {pickOne('q23_villain_origin', 'cid')}
          </p>
        </div>
      </article>
    </div>
  );
}
