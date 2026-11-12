import JSZip from 'jszip';
import { ROSTER, getRosterById } from '@/data/roster';
import { AWARDS } from '@/data/awards';
import { getArchetypeById } from '@/data/archetypes';
import { QUESTION_KEYS, SURVIVAL_STATS } from '@/data/questions';
import {
  aggregateSubjectProfile,
  buildCidDossierCsv,
  buildFullJson,
  buildMangaJson,
  buildNcertBookCsv,
  buildStatDeckCsv,
  toCsv,
  type EditorDataset,
  type EditorResponseRow,
} from '@/lib/exports';

export const QUESTION_LABELS: Record<string, string> = {
  [QUESTION_KEYS.Q1_NICKNAME]: 'Q1. Nickname',
  [QUESTION_KEYS.Q2_ARCHETYPE]: 'Q2. School Archetype Card',
  [QUESTION_KEYS.Q3_QUIRK]: 'Q3. Unique Quirk / Superpower',
  [QUESTION_KEYS.Q4_DAILY_HABIT]: 'Q4. Daily Habit',
  [QUESTION_KEYS.Q5_HABITAT]: 'Q5. Classroom Habitat & Spots',
  [QUESTION_KEYS.Q6_STATS]: 'Q6. Survival Stats (6 axes)',
  [QUESTION_KEYS.Q7_CUSTOM_STAT]: 'Q7. Custom Stat & Rating',
  [QUESTION_KEYS.Q8_CATCHPHRASE]: 'Q8. Catchphrase',
  [QUESTION_KEYS.Q9_PASSIVE_TRAIT]: 'Q9. Passive Trait',
  [QUESTION_KEYS.Q10_ULTIMATE_MOVE]: 'Q10. Ultimate Move',
  [QUESTION_KEYS.Q11_OFFENSES]: 'Q11. Known Offenses (CID)',
  [QUESTION_KEYS.Q12_PARTNERS]: 'Q12. Partners in Crime',
  [QUESTION_KEYS.Q13_CHAOS]: 'Q13. Chaos Level & Reason',
  [QUESTION_KEYS.Q14_PREDATOR]: 'Q14. Natural Predator',
  [QUESTION_KEYS.Q15_DIAGRAM_LABELS]: 'Q15. NCERT Specimen Diagram Labels',
  [QUESTION_KEYS.Q16_EXAM_QUESTION]: 'Q16. CBSE Board-Exam Question',
  [QUESTION_KEYS.Q17_ROAST]: 'Q17. Roast With Love',
  [QUESTION_KEYS.Q18_GENUINE_COMPLIMENT]: 'Q18. Genuine Compliment',
  [QUESTION_KEYS.Q19_EMBARRASSING_COMPLIMENT]: 'Q19. Sincere Embarrassing Compliment',
  [QUESTION_KEYS.Q20_MISS_MOST]: 'Q20. What You Will Miss Most',
  [QUESTION_KEYS.Q21_SOUND_EFFECT]: 'Q21. Manga Sound Effect',
  [QUESTION_KEYS.Q22_TRAILER_LINE]: 'Q22. Movie Trailer Line',
  [QUESTION_KEYS.Q23_VILLAIN_ORIGIN]: 'Q23. Villain Origin Story',
  [QUESTION_KEYS.Q24_EXCUSE_HALL]: 'Q24. Excuse Hall of Fame',
  [QUESTION_KEYS.Q25_FUNNIEST_MOMENT]: 'Q25. Funniest Moment (Manga)',
};

export function formatAnswerReadable(
  questionKey: string,
  answer: Record<string, unknown> | null | undefined
): string {
  if (!answer) return '';
  if (answer.skipped) return "[SKIPPED — Witness marked Don't Know]";

  switch (questionKey) {
    case QUESTION_KEYS.Q2_ARCHETYPE: {
      const id = String(answer.archetypeId ?? '');
      const custom = String(answer.customTitle ?? '').trim();
      const title =
        id === 'custom' && custom ? custom : getArchetypeById(id)?.title ?? (custom || id);
      return custom && id !== 'custom' ? `${title} (${custom})` : title;
    }
    case QUESTION_KEYS.Q5_HABITAT: {
      const parts = [
        answer.bench ? `Bench: ${answer.bench}` : '',
        answer.freePeriodSpot ? `Free period: ${answer.freePeriodSpot}` : '',
        answer.canteenSpot ? `Canteen: ${answer.canteenSpot}` : '',
      ].filter(Boolean);
      return parts.join(' | ');
    }
    case QUESTION_KEYS.Q6_STATS: {
      return SURVIVAL_STATS.map((s) => `${s.label}: ${answer[s.key] ?? '—'}/100`).join(' | ');
    }
    case QUESTION_KEYS.Q7_CUSTOM_STAT: {
      const name = String(answer.name ?? '').trim();
      if (!name) return '';
      return `${name}: ${answer.value ?? '—'}/100`;
    }
    case QUESTION_KEYS.Q11_OFFENSES: {
      return [answer.offense1, answer.offense2]
        .map((x) => String(x ?? '').trim())
        .filter(Boolean)
        .join(' ; ');
    }
    case QUESTION_KEYS.Q12_PARTNERS: {
      const ids = Array.isArray(answer.partners) ? (answer.partners as string[]) : [];
      return ids.map((id) => getRosterById(id)?.label ?? id).join(', ');
    }
    case QUESTION_KEYS.Q13_CHAOS: {
      const lvl = answer.level ?? '';
      const why = String(answer.why ?? '').trim();
      return `${lvl}/10${why ? ` — ${why}` : ''}`;
    }
    case QUESTION_KEYS.Q15_DIAGRAM_LABELS: {
      const labels =
        (answer.labels as Record<string, { promptText?: string; value?: string }>) ?? {};
      return Object.entries(labels)
        .filter(([, v]) => v?.value?.trim())
        .map(([area, v]) => `[${v.promptText || area}]: ${v.value!.trim()}`)
        .join(' | ');
    }
    case QUESTION_KEYS.Q16_EXAM_QUESTION: {
      const q = String(answer.question ?? '').trim();
      if (!q) return '';
      return `${q} [${answer.marks ?? 5} marks]`;
    }
    default:
      return String(answer.value ?? '').trim();
  }
}

function buildAllAnswersCsv(data: EditorDataset): string {
  const contribById = Object.fromEntries(data.contributors.map((c) => [c.id, c]));
  const metaMap = new Map<string, string>();
  for (const m of data.caseMeta) {
    metaMap.set(`${m.contributor_id}:${m.subject_roster_id}`, m.familiarity || '');
  }

  const sorted = [...data.responses].sort(
    (a, b) =>
      a.subject_roster_id.localeCompare(b.subject_roster_id) ||
      a.contributor_id.localeCompare(b.contributor_id) ||
      a.question_key.localeCompare(b.question_key)
  );

  const rows = sorted.map((r) => {
    const witness = contribById[r.contributor_id];
    const witnessLabel = witness
      ? getRosterById(witness.roster_id)?.label ?? witness.roster_id
      : 'Unknown';
    const subjectLabel = getRosterById(r.subject_roster_id)?.label ?? r.subject_roster_id;
    const fam = metaMap.get(`${r.contributor_id}:${r.subject_roster_id}`) ?? '';
    const skipped = Boolean(r.answer?.skipped);

    return [
      witness?.roster_id ?? '',
      witnessLabel,
      witness?.full_name_caps ?? '',
      r.subject_roster_id,
      subjectLabel,
      fam,
      r.question_key,
      QUESTION_LABELS[r.question_key] ?? r.question_key,
      skipped ? 'YES' : 'NO',
      formatAnswerReadable(r.question_key, r.answer),
      JSON.stringify(r.answer ?? {}),
      r.updated_at,
    ];
  });

  return toCsv(
    [
      'witness_roster_id',
      'witness_name',
      'witness_full_name_caps',
      'subject_roster_id',
      'subject_name',
      'familiarity',
      'question_key',
      'question_label',
      'skipped_question',
      'answer_formatted',
      'answer_raw_json',
      'updated_at',
    ],
    rows
  );
}

function buildContributorsCsv(data: EditorDataset): string {
  return toCsv(
    [
      'roster_id',
      'roster_label',
      'scholar_number',
      'first_name_caps',
      'middle_name_caps',
      'last_name_caps',
      'full_name_caps',
      'consent_portrait',
      'xp',
      'status',
      'started_at',
      'finished_at',
    ],
    ROSTER.map((r) => {
      const c = data.contributors.find((x) => x.roster_id === r.id);
      return [
        r.id,
        r.label,
        c?.scholar_number ?? '',
        c?.first_name_caps ?? '',
        c?.middle_name_caps ?? '',
        c?.last_name_caps ?? '',
        c?.full_name_caps ?? '',
        c?.consent_portrait ? 'YES' : 'NO',
        c?.xp ?? 0,
        c?.status ?? 'not_started',
        c?.started_at ?? '',
        c?.finished_at ?? '',
      ];
    })
  );
}

function buildSkipsCsv(data: EditorDataset): string {
  const contribById = Object.fromEntries(data.contributors.map((c) => [c.id, c]));
  return toCsv(
    [
      'witness_roster_id',
      'witness_name',
      'subject_roster_id',
      'subject_name',
      'reason_choice',
      'reason_text',
      'created_at',
    ],
    data.skips.map((s) => {
      const w = contribById[s.contributor_id];
      return [
        w?.roster_id ?? '',
        w ? getRosterById(w.roster_id)?.label ?? w.roster_id : 'Unknown',
        s.subject_roster_id,
        getRosterById(s.subject_roster_id)?.label ?? s.subject_roster_id,
        s.reason_choice,
        s.reason_text ?? '',
        s.created_at,
      ];
    })
  );
}

function buildAwardsCsv(data: EditorDataset): string {
  const contribById = Object.fromEntries(data.contributors.map((c) => [c.id, c]));
  const rows: unknown[][] = [];

  for (const aw of AWARDS) {
    const votes = data.awards.filter((v) => v.award_key === aw.key);
    const counts = new Map<string, number>();
    for (const v of votes) {
      counts.set(v.voted_roster_id, (counts.get(v.voted_roster_id) ?? 0) + 1);
    }
    const tally = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([rid, c]) => `${getRosterById(rid)?.label ?? rid} (${c})`)
      .join(' | ');

    if (votes.length === 0) {
      rows.push([aw.key, aw.title, '', '', '', tally]);
      continue;
    }

    for (const v of votes) {
      const w = contribById[v.contributor_id];
      rows.push([
        aw.key,
        aw.title,
        w ? getRosterById(w.roster_id)?.label ?? w.roster_id : 'Unknown',
        v.voted_roster_id,
        getRosterById(v.voted_roster_id)?.label ?? v.voted_roster_id,
        tally,
      ]);
    }
  }

  return toCsv(
    [
      'award_key',
      'award_title',
      'voter_name',
      'voted_for_roster_id',
      'voted_for_name',
      'overall_award_ranking',
    ],
    rows
  );
}

function buildArchiveEntriesCsv(data: EditorDataset): string {
  const contribById = Object.fromEntries(data.contributors.map((c) => [c.id, c]));
  return toCsv(
    ['id', 'witness_name', 'section_key', 'tagged_student', 'content_json', 'updated_at'],
    data.archiveEntries.map((a) => {
      const w = contribById[a.contributor_id];
      return [
        a.id,
        w ? getRosterById(w.roster_id)?.label ?? w.roster_id : 'Unknown',
        a.section_key,
        a.tagged_roster_id ? getRosterById(a.tagged_roster_id)?.label ?? a.tagged_roster_id : '',
        JSON.stringify(a.content ?? {}),
        a.updated_at,
      ];
    })
  );
}

function buildAnythingElseCsv(data: EditorDataset): string {
  const contribById = Object.fromEntries(data.contributors.map((c) => [c.id, c]));
  return toCsv(
    ['id', 'witness_name', 'tagged_student', 'is_editor_note', 'body', 'created_at'],
    data.anythingElse.map((x) => {
      const w = contribById[x.contributor_id];
      return [
        x.id,
        w ? getRosterById(w.roster_id)?.label ?? w.roster_id : 'Unknown',
        x.tagged_roster_id ? getRosterById(x.tagged_roster_id)?.label ?? x.tagged_roster_id : '',
        x.is_editor_note ? 'YES' : 'NO',
        x.body,
        x.created_at,
      ];
    })
  );
}

function listResponseLines(
  responses: EditorResponseRow[],
  qKey: string,
  contribById: Record<string, { roster_id: string; label: string }>
): string[] {
  return responses
    .filter((r) => r.question_key === qKey)
    .map((r) => {
      const w = contribById[r.contributor_id];
      const text = formatAnswerReadable(qKey, r.answer);
      return text ? `- **${w?.label ?? 'Witness'}:** ${text}` : '';
    })
    .filter(Boolean);
}

function buildStudentMarkdown(
  subjectId: string,
  chapterNum: number,
  data: EditorDataset,
  contribById: Record<string, { roster_id: string; label: string }>
): string {
  const prof = aggregateSubjectProfile(subjectId, data);
  const label = prof.subject?.label ?? subjectId;
  const fullName = prof.ownContributor?.full_name_caps || 'Not entered yet';
  const scholar = prof.ownContributor?.scholar_number || '—';

  const sections: string[] = [
    `# Chapter ${chapterNum}: ${label}`,
    '',
    `- **Full Name (CAPS):** ${fullName}`,
    `- **Scholar Number:** ${scholar}`,
    `- **Witness Cases Filed About ${label}:** ${prof.filedCount}`,
    `- **Person Skips:** ${prof.skipCount}`,
    `- **Chaos Score Average:** ${prof.chaosAvg}/10`,
    `- **NCERT Binomial:** ${prof.note.pseudo_latin_binomial || `Homo studenticus ${subjectId}`}`,
    prof.note.note ? `- **Editor Note:** ${prof.note.note}` : '',
    '',
    '## Top Nicknames & Archetypes',
    `- **Nicknames:** ${prof.nicknamesRanked.map((n) => `${n.name} (×${n.count})`).join(', ') || 'None'}`,
    `- **Archetypes:** ${prof.archetypesRanked.map((a) => `${a.title} (×${a.count})`).join(', ') || 'None'}`,
    `- **Partners in Crime:** ${prof.partnersRanked.map((p) => `${p.label} (×${p.count})`).join(', ') || 'None'}`,
    `- **Top Classroom Bench:** ${prof.topBench}`,
    '',
    '## Survival Stats (Median | Familiarity-Weighted Avg)',
    ...prof.statAggregates.map(
      (s) => `- **${s.label}:** Median ${s.median}/100 | Weighted ${s.weighted}/100 (${s.sampleCount} ratings)`
    ),
    '',
    '## Portraits & Tagged Photos',
    `- **Official Portrait:** ${prof.portraitUpload?.storage_path || 'None'}`,
    `- **CID Mugshot:** ${prof.mugshotUpload?.storage_path || 'None'}`,
    `- **Worst Face:** ${prof.worstFaceUpload?.storage_path || 'None'}`,
    `- **Tagged Candid / Chaos Photos (${prof.taggedPhotos.length}):** ${
      prof.taggedPhotos.map((p) => p.storage_path).join(', ') || 'None'
    }`,
    '',
    '## Every Peer Answer Written About ' + label,
  ];

  const orderedKeys = Object.values(QUESTION_KEYS).filter(
    (k) => k !== QUESTION_KEYS.Q6_STATS
  );
  for (const key of orderedKeys) {
    const lines = listResponseLines(prof.responses, key, contribById);
    if (lines.length === 0) continue;
    sections.push(`### ${QUESTION_LABELS[key] ?? key}`, ...lines, '');
  }

  return sections.filter((line) => line !== undefined).join('\n');
}

export interface BuiltArchiveBundle {
  dataOnlyZip: Uint8Array;
  fullZip: Uint8Array;
  includedPhotos: number;
  missingPhotos: string[];
  submittedCount: number;
  totalAnswers: number;
}

export async function buildCompleteArchiveZip(params: {
  dataset: EditorDataset;
  fetchPhotoBytes?: (storagePath: string) => Promise<Uint8Array | null>;
}): Promise<BuiltArchiveBundle> {
  const { dataset, fetchPhotoBytes } = params;

  const contribById: Record<string, { roster_id: string; label: string }> = {};
  for (const c of dataset.contributors) {
    contribById[c.id] = {
      roster_id: c.roster_id,
      label: getRosterById(c.roster_id)?.label ?? c.roster_id,
    };
  }

  const submittedCount = dataset.contributors.filter((c) => c.status === 'submitted').length;
  const fullJson = buildFullJson(dataset);

  const manifestLines = dataset.uploads.map(
    (u) =>
      `${u.storage_path} | kind=${u.kind} | owner=${
        contribById[u.contributor_id]?.label ?? u.contributor_id
      } | size=${u.width ?? '?'}x${u.height ?? '?'} | tags=${u.tagged_roster_ids.join(',')} | caption=${
        u.caption ?? ''
      }`
  );

  const overviewMd = [
    '# CASE FILE: CLASS OF 23 — COMPLETE KEEPSAKE MASTER ARCHIVE',
    '',
    `- **Generated At:** ${new Date().toISOString()}`,
    `- **Submitted Witnesses:** ${submittedCount} of ${ROSTER.length}`,
    `- **Total Question Responses Logged:** ${dataset.responses.length}`,
    `- **Uploaded Photos Tracked:** ${dataset.uploads.length}`,
    '',
    '## Folder Structure',
    '- `4-formats/` — Ready-to-use files for your 4 keepsakes:',
    '  - `1-stat-deck.csv` — 23-card collectible Character Stat Deck',
    '  - `2-ncert-book.csv` — NCERT parody textbook chapters, diagrams & board questions',
    '  - `3-cid-dossier.csv` — Confidential Class Dossier suspect sheets',
    '  - `4-photo-manga.json` — Photo-manga comic book scenes, quotes, SFX & chaos feed',
    '- `all-answers/` — Every single question answer, skip reason, award vote, archive entry & raw JSON:',
    '  - `all-question-answers.csv` — Flat spreadsheet of every question and answer for every witness/student pair',
    '  - `contributors-directory.csv` — Full batch directory (names in CAPS, scholar numbers, completion status)',
    '  - `case-skip-reasons.csv` — All person-level skips and explanations',
    '  - `awards-tallies-and-votes.csv` — All 14 award tallies + individual witness ballots',
    '  - `class-archive-entries.csv` — Class Archive memories (Teacher files, Bingo, Rules, Timeline, etc.)',
    '  - `anything-else-notes.csv` — Wild card extra notes & stories',
    '  - `raw-complete-backup.json` — Complete lossless JSON export of all tables and aggregated profiles',
    '- `students/` — 23 readable per-student Markdown dossiers (`01-afsha.md` ... `23-yashika.md`) + `all-student-profiles.json`',
    '- `photos/` — `MANIFEST.txt` plus all uploaded high-resolution portraits, CID mugshots, worst faces, and chaos photos',
  ].join('\n');

  const dataFiles: { path: string; content: string }[] = [
    { path: '00-START-HERE.md', content: overviewMd },
    { path: '4-formats/1-stat-deck.csv', content: buildStatDeckCsv(dataset) },
    { path: '4-formats/2-ncert-book.csv', content: buildNcertBookCsv(dataset) },
    { path: '4-formats/3-cid-dossier.csv', content: buildCidDossierCsv(dataset) },
    {
      path: '4-formats/4-photo-manga.json',
      content: JSON.stringify(buildMangaJson(dataset), null, 2),
    },
    { path: 'all-answers/all-question-answers.csv', content: buildAllAnswersCsv(dataset) },
    { path: 'all-answers/contributors-directory.csv', content: buildContributorsCsv(dataset) },
    { path: 'all-answers/case-skip-reasons.csv', content: buildSkipsCsv(dataset) },
    { path: 'all-answers/awards-tallies-and-votes.csv', content: buildAwardsCsv(dataset) },
    { path: 'all-answers/class-archive-entries.csv', content: buildArchiveEntriesCsv(dataset) },
    { path: 'all-answers/anything-else-notes.csv', content: buildAnythingElseCsv(dataset) },
    {
      path: 'all-answers/raw-complete-backup.json',
      content: JSON.stringify(fullJson, null, 2),
    },
    {
      path: 'students/all-student-profiles.json',
      content: JSON.stringify(fullJson.profiles, null, 2),
    },
    {
      path: 'photos/MANIFEST.txt',
      content: manifestLines.length > 0 ? manifestLines.join('\n') : 'No uploaded photos yet.',
    },
  ];

  ROSTER.forEach((student, idx) => {
    const num = String(idx + 1).padStart(2, '0');
    dataFiles.push({
      path: `students/${num}-${student.id}.md`,
      content: buildStudentMarkdown(student.id, idx + 1, dataset, contribById),
    });
  });

  const dataZip = new JSZip();
  const fullZipObj = new JSZip();
  for (const f of dataFiles) {
    dataZip.file(f.path, f.content);
    fullZipObj.file(f.path, f.content);
  }

  let includedPhotos = 0;
  const missingPhotos: string[] = [];

  if (fetchPhotoBytes) {
    for (const u of dataset.uploads) {
      if (!u.storage_path) continue;
      try {
        const bytes = await fetchPhotoBytes(u.storage_path);
        if (bytes && bytes.byteLength > 0) {
          fullZipObj.file(`photos/${u.storage_path}`, bytes);
          includedPhotos += 1;
        } else {
          missingPhotos.push(u.storage_path);
        }
      } catch {
        missingPhotos.push(u.storage_path);
      }
    }
  } else {
    for (const u of dataset.uploads) {
      if (u.storage_path) missingPhotos.push(u.storage_path);
    }
  }

  const [dataOnlyZip, fullZip] = await Promise.all([
    dataZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
    fullZipObj.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    }),
  ]);

  return {
    dataOnlyZip,
    fullZip,
    includedPhotos,
    missingPhotos,
    submittedCount,
    totalAnswers: dataset.responses.length,
  };
}
