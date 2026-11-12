import { ROSTER, getRosterById } from '@/data/roster';
import { getArchetypeById } from '@/data/archetypes';
import { AWARDS } from '@/data/awards';
import {
  FAMILIARITY_OPTIONS,
  SURVIVAL_STATS,
  type FamiliarityOptionId,
} from '@/data/questions';
import { buildFullNameCaps } from '@/lib/validation';

export interface EditorContributorRow {
  id: string;
  roster_id: string;
  scholar_number: string;
  first_name_caps: string;
  middle_name_caps: string | null;
  last_name_caps: string;
  full_name_caps: string;
  consent_portrait: boolean;
  shuffle_seed: number;
  xp: number;
  started_at: string;
  finished_at: string | null;
  status: 'in_progress' | 'submitted';
}

export interface EditorResponseRow {
  id: string;
  contributor_id: string;
  subject_roster_id: string;
  question_key: string;
  answer: Record<string, unknown>;
  updated_at: string;
}

export interface EditorCaseMetaRow {
  contributor_id: string;
  subject_roster_id: string;
  familiarity: FamiliarityOptionId | null;
  status: 'unopened' | 'in_progress' | 'filed' | 'skipped';
}

export interface EditorSkipRow {
  contributor_id: string;
  subject_roster_id: string;
  reason_choice: string;
  reason_text: string | null;
  created_at: string;
}

export interface EditorAwardRow {
  contributor_id: string;
  award_key: string;
  voted_roster_id: string;
}

export interface EditorArchiveRow {
  id: string;
  contributor_id: string;
  section_key: string;
  content: Record<string, unknown>;
  tagged_roster_id: string | null;
  updated_at: string;
}

export interface EditorAnythingElseRow {
  id: string;
  contributor_id: string;
  tagged_roster_id: string | null;
  body: string;
  is_editor_note: boolean;
  created_at: string;
}

export interface EditorUploadRow {
  id: string;
  contributor_id: string;
  kind: 'portrait' | 'mugshot' | 'worst_face' | 'chaos' | 'extra';
  storage_path: string;
  caption: string | null;
  photo_type: string | null;
  tagged_roster_ids: string[];
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface EditorPickRow {
  entry_id: string;
  target_type: 'response' | 'archive' | 'anything_else' | 'upload';
  picked: boolean;
  edited_text: string | null;
  used_in: string[];
}

export interface EditorNoteRow {
  subject_roster_id: string;
  note: string;
  pseudo_latin_binomial: string | null;
}

export type FamiliarityWeights = Record<FamiliarityOptionId, number>;

export const DEFAULT_FAMILIARITY_WEIGHTS: FamiliarityWeights = {
  best_friends: 1.5,
  same_group: 1.25,
  talk_sometimes: 1.0,
  barely_spoken: 0.5,
  distance_only: 0.5,
};

export interface EditorDataset {
  contributors: EditorContributorRow[];
  responses: EditorResponseRow[];
  caseMeta: EditorCaseMetaRow[];
  skips: EditorSkipRow[];
  awards: EditorAwardRow[];
  archiveEntries: EditorArchiveRow[];
  anythingElse: EditorAnythingElseRow[];
  uploads: EditorUploadRow[];
  picks: Record<string, EditorPickRow>;
  notes: Record<string, EditorNoteRow>;
  weights: FamiliarityWeights;
}

export function computeTrimmedMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  // Trim top & bottom 10% outlier when we have >= 5 samples
  let slice = sorted;
  if (sorted.length >= 5) {
    const trim = Math.max(1, Math.floor(sorted.length * 0.1));
    slice = sorted.slice(trim, sorted.length - trim);
    if (slice.length === 0) slice = sorted;
  }
  const mid = Math.floor(slice.length / 2);
  if (slice.length % 2 === 1) return Math.round(slice[mid]);
  return Math.round((slice[mid - 1] + slice[mid]) / 2);
}

export function computeWeightedAverage(
  samples: { value: number; familiarity: FamiliarityOptionId | null | undefined }[],
  weights: FamiliarityWeights
): number {
  if (samples.length === 0) return 0;
  let totalWeight = 0;
  let totalSum = 0;
  for (const s of samples) {
    const w = s.familiarity ? weights[s.familiarity] ?? 1.0 : 1.0;
    totalWeight += w;
    totalSum += s.value * w;
  }
  if (totalWeight === 0) return 0;
  return Math.round(totalSum / totalWeight);
}

export function analyzeNameCheck(c: EditorContributorRow): {
  issues: string[];
  severity: 'ok' | 'warn';
} {
  const issues: string[] = [];
  const roster = getRosterById(c.roster_id);

  if (!c.first_name_caps?.trim()) issues.push('Missing first name');
  if (!c.last_name_caps?.trim()) issues.push('Missing surname');

  const expectedFull = buildFullNameCaps(
    c.first_name_caps,
    c.middle_name_caps,
    c.last_name_caps
  );
  if (expectedFull !== c.full_name_caps) {
    issues.push('Combined full_name_caps spacing mismatch');
  }

  if (roster) {
    const rosterFirst = roster.label.split(' ')[0].replace(/[^A-Za-z]/g, '').toUpperCase();
    const enteredFirst = c.first_name_caps.replace(/[^A-Za-z]/g, '').toUpperCase();
    if (enteredFirst && rosterFirst && enteredFirst !== rosterFirst) {
      // Check Levenshtein distance
      const dist = levenshtein(enteredFirst, rosterFirst);
      if (dist >= 3) {
        issues.push(`First name "${c.first_name_caps}" differs sharply from roster "${roster.label}"`);
      } else {
        issues.push(`Minor spelling difference vs roster "${roster.label}"`);
      }
    }
    // Special disambiguation check for Saksham R. vs Sakshama T.
    if (c.roster_id === 'saksham-r' && enteredFirst.startsWith('SAKSHAMA')) {
      issues.push('Possible Saksham R. / Sakshama T. mix-up!');
    }
    if (c.roster_id === 'sakshama-t' && enteredFirst === 'SAKSHAM') {
      issues.push('Possible Sakshama T. / Saksham R. mix-up!');
    }
  }

  return {
    issues,
    severity: issues.length > 0 ? 'warn' : 'ok',
  };
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

export function getEffectiveText(
  row: { id: string },
  rawText: string,
  picks: Record<string, EditorPickRow>
): string {
  const p = picks[row.id];
  if (p?.edited_text && p.edited_text.trim().length > 0) {
    return p.edited_text.trim();
  }
  return rawText;
}

export function isRowPickedFor(
  rowId: string,
  picks: Record<string, EditorPickRow>,
  format?: 'deck' | 'ncert' | 'cid' | 'manga'
): boolean {
  const p = picks[rowId];
  if (!p || !p.picked) return false;
  if (!format) return true;
  return p.used_in.length === 0 || p.used_in.includes(format);
}

export function aggregateSubjectProfile(
  subjectId: string,
  data: EditorDataset
) {
  const subject = getRosterById(subjectId);
  const contribById = Object.fromEntries(data.contributors.map((c) => [c.id, c]));
  const metaByContrib: Record<string, EditorCaseMetaRow> = {};
  for (const m of data.caseMeta) {
    if (m.subject_roster_id === subjectId) {
      metaByContrib[m.contributor_id] = m;
    }
  }

  const subjectResponses = data.responses.filter(
    (r) => r.subject_roster_id === subjectId && !r.answer?.skipped
  );
  const subjectSkips = data.skips.filter((s) => s.subject_roster_id === subjectId);

  // Nicknames
  const nicknameCounts = new Map<string, number>();
  for (const r of subjectResponses) {
    if (r.question_key === 'q1_nickname') {
      const val = String(r.answer?.value ?? '').trim();
      if (val) nicknameCounts.set(val, (nicknameCounts.get(val) ?? 0) + 1);
    }
  }
  const nicknamesRanked = Array.from(nicknameCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  // Archetypes
  const archetypeCounts = new Map<string, { title: string; count: number; id: string }>();
  for (const r of subjectResponses) {
    if (r.question_key === 'q2_archetype') {
      const id = String(r.answer?.archetypeId ?? 'custom');
      const custom = String(r.answer?.customTitle ?? '').trim();
      const title =
        id === 'custom' && custom
          ? custom
          : getArchetypeById(id)?.title ?? (custom || id);
      const key = `${id}:${title}`;
      const existing = archetypeCounts.get(key);
      if (existing) existing.count += 1;
      else archetypeCounts.set(key, { id, title, count: 1 });
    }
  }
  const archetypesRanked = Array.from(archetypeCounts.values()).sort(
    (a, b) => b.count - a.count
  );

  // Stats (median + weighted average)
  const statAggregates = SURVIVAL_STATS.map((stat) => {
    const samples: { value: number; familiarity: FamiliarityOptionId | null }[] = [];
    for (const r of subjectResponses) {
      if (r.question_key === 'q6_stats') {
        const rawVal = Number((r.answer as Record<string, unknown>)?.[stat.key]);
        if (!Number.isNaN(rawVal) && rawVal > 0) {
          samples.push({
            value: rawVal,
            familiarity: metaByContrib[r.contributor_id]?.familiarity ?? null,
          });
        }
      }
    }
    return {
      key: stat.key,
      label: stat.label,
      median: computeTrimmedMedian(samples.map((s) => s.value)),
      weighted: computeWeightedAverage(samples, data.weights),
      sampleCount: samples.length,
    };
  });

  // Chaos level average
  const chaosValues: number[] = [];
  const chaosReasons: { row: EditorResponseRow; level: number; why: string }[] = [];
  for (const r of subjectResponses) {
    if (r.question_key === 'q13_chaos') {
      const level = Number(r.answer?.level ?? 0);
      const why = String(r.answer?.why ?? '').trim();
      if (level > 0) {
        chaosValues.push(level);
        chaosReasons.push({ row: r, level, why });
      }
    }
  }
  const chaosAvg =
    chaosValues.length > 0
      ? Number((chaosValues.reduce((a, b) => a + b, 0) / chaosValues.length).toFixed(1))
      : 0;

  // Habitat grid heatmap (5 rows x 6 seats)
  const habitatCounts: Record<string, number> = {};
  const freeSpots: string[] = [];
  const canteenSpots: string[] = [];
  for (const r of subjectResponses) {
    if (r.question_key === 'q5_habitat') {
      const bench = String(r.answer?.bench ?? '');
      if (bench) habitatCounts[bench] = (habitatCounts[bench] ?? 0) + 1;
      const free = String(r.answer?.freePeriodSpot ?? '').trim();
      const cant = String(r.answer?.canteenSpot ?? '').trim();
      if (free) freeSpots.push(free);
      if (cant) canteenSpots.push(cant);
    }
  }
  const topBench = Object.entries(habitatCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Back Window';

  // Partners in crime counts
  const partnerCounts = new Map<string, number>();
  for (const r of subjectResponses) {
    if (r.question_key === 'q12_partners') {
      const ids = Array.isArray(r.answer?.partners)
        ? (r.answer.partners as string[])
        : [];
      for (const pid of ids) {
        partnerCounts.set(pid, (partnerCounts.get(pid) ?? 0) + 1);
      }
    }
  }
  const partnersRanked = Array.from(partnerCounts.entries())
    .map(([rosterId, count]) => ({
      rosterId,
      label: getRosterById(rosterId)?.label ?? rosterId,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Diagram labels
  const diagramLabels: { id: string; area: string; promptText: string; labelText: string }[] = [];
  for (const r of subjectResponses) {
    if (r.question_key === 'q15_diagram_labels') {
      const labels = (r.answer?.labels as Record<string, { promptText?: string; value?: string }>) ?? {};
      for (const [area, item] of Object.entries(labels)) {
        if (item?.value?.trim()) {
          diagramLabels.push({
            id: r.id,
            area,
            promptText: item.promptText || area,
            labelText: item.value.trim(),
          });
        }
      }
    }
  }

  // Own contributor record (if they registered)
  const ownContributor = data.contributors.find((c) => c.roster_id === subjectId) ?? null;
  const ownUploads = ownContributor
    ? data.uploads.filter((u) => u.contributor_id === ownContributor.id)
    : [];
  const portraitUpload = ownUploads.find((u) => u.kind === 'portrait') ?? null;
  const mugshotUpload = ownUploads.find((u) => u.kind === 'mugshot') ?? null;
  const worstFaceUpload = ownUploads.find((u) => u.kind === 'worst_face') ?? null;
  const taggedPhotos = data.uploads.filter((u) =>
    u.tagged_roster_ids.includes(subjectId)
  );

  // Filed count
  const filedCount = data.caseMeta.filter(
    (m) => m.subject_roster_id === subjectId && m.status === 'filed'
  ).length;

  return {
    subject,
    ownContributor,
    filedCount,
    skipCount: subjectSkips.length,
    skips: subjectSkips.map((s) => ({
      ...s,
      byLabel: getRosterById(contribById[s.contributor_id]?.roster_id)?.label ?? 'Unknown Witness',
    })),
    nicknamesRanked,
    archetypesRanked,
    statAggregates,
    chaosAvg,
    chaosReasons,
    habitatCounts,
    topBench,
    freeSpots,
    canteenSpots,
    partnersRanked,
    diagramLabels,
    responses: subjectResponses,
    portraitUpload,
    mugshotUpload,
    worstFaceUpload,
    taggedPhotos,
    note: data.notes[subjectId] ?? {
      subject_roster_id: subjectId,
      note: '',
      pseudo_latin_binomial: '',
    },
  };
}

export function csvCell(value: unknown): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.map(csvCell).join(','),
    ...rows.map((r) => r.map(csvCell).join(',')),
  ].join('\n');
}

function pickFirstText(
  responses: EditorResponseRow[],
  questionKey: string,
  picks: Record<string, EditorPickRow>,
  format: 'deck' | 'ncert' | 'cid' | 'manga',
  field = 'value'
): string {
  const matching = responses.filter((r) => r.question_key === questionKey);
  const picked = matching.find((r) => isRowPickedFor(r.id, picks, format));
  const chosen = picked ?? matching[0];
  if (!chosen) return '';
  const raw = String(chosen.answer?.[field] ?? '').trim();
  return getEffectiveText(chosen, raw, picks);
}

/**
 * Export 1: Stat Deck CSV
 */
export function buildStatDeckCsv(data: EditorDataset): string {
  const headers = [
    'roster_id',
    'full_name',
    'top_nickname',
    'top_archetype',
    ...SURVIVAL_STATS.flatMap((s) => [`${s.key}_median`, `${s.key}_weighted`]),
    'quirk',
    'passive_trait',
    'ultimate_move',
    'catchphrase',
    'habitat',
    'back_of_card_line',
    'portrait_path',
  ];

  const rows = ROSTER.map((student) => {
    const prof = aggregateSubjectProfile(student.id, data);
    const fullName = prof.ownContributor?.full_name_caps || student.label.toUpperCase();
    const topNick = prof.nicknamesRanked[0]?.name || student.label;
    const topArch = prof.archetypesRanked[0]?.title || 'Class Mystery';
    const statCols = prof.statAggregates.flatMap((s) => [s.median, s.weighted]);
    const quirk = pickFirstText(prof.responses, 'q3_quirk', data.picks, 'deck');
    const passive = pickFirstText(prof.responses, 'q9_passive_trait', data.picks, 'deck');
    const ultimate = pickFirstText(prof.responses, 'q10_ultimate_move', data.picks, 'deck');
    const catchphrase = pickFirstText(prof.responses, 'q8_catchphrase', data.picks, 'deck');
    const habitat = `${prof.topBench}${prof.freeSpots[0] ? ` / ${prof.freeSpots[0]}` : ''}`;
    const backLine =
      pickFirstText(prof.responses, 'q22_trailer_line', data.picks, 'deck') ||
      pickFirstText(prof.responses, 'q17_roast', data.picks, 'deck');
    const portraitPath = prof.portraitUpload?.storage_path || '';

    return [
      student.id,
      fullName,
      topNick,
      topArch,
      ...statCols,
      quirk,
      passive,
      ultimate,
      catchphrase,
      habitat,
      backLine,
      portraitPath,
    ];
  });

  return toCsv(headers, rows);
}

/**
 * Export 2: NCERT Book CSV
 */
export function buildNcertBookCsv(data: EditorDataset): string {
  const headers = [
    'chapter_number',
    'chapter_title',
    'roster_id',
    'full_name',
    'nickname',
    'pseudo_latin_binomial',
    'habitat',
    'diagram_labels',
    'exam_question',
    'exam_marks',
    'closing_compliment',
    'portrait_path',
  ];

  const rows = ROSTER.map((student, idx) => {
    const prof = aggregateSubjectProfile(student.id, data);
    const topArch = prof.archetypesRanked[0];
    const archDef = topArch ? getArchetypeById(topArch.id) : undefined;
    const chapterTitle = archDef
      ? `${archDef.ncertPrefix}: Study of ${student.label}`
      : `Special Specimen Study: ${student.label}`;
    const fullName = prof.ownContributor?.full_name_caps || student.label.toUpperCase();
    const nickname = prof.nicknamesRanked[0]?.name || student.label;
    const binomial =
      prof.note.pseudo_latin_binomial ||
      `Homo studenticus ${student.id.replace(/[^a-z]/g, '')}`;
    const habitat = `${prof.topBench}${prof.canteenSpots[0] ? ` | Canteen: ${prof.canteenSpots[0]}` : ''}`;
    const labels = prof.diagramLabels
      .slice(0, 8)
      .map((l) => `${l.area}: ${l.promptText} ${l.labelText}`)
      .join(' ; ');

    const examRows = prof.responses.filter((r) => r.question_key === 'q16_exam_question');
    const pickedExam =
      examRows.find((r) => isRowPickedFor(r.id, data.picks, 'ncert')) ?? examRows[0];
    const examQuestion = pickedExam
      ? getEffectiveText(
          pickedExam,
          String(pickedExam.answer?.question ?? ''),
          data.picks
        )
      : '';
    const examMarks = pickedExam ? String(pickedExam.answer?.marks ?? 5) : '';
    const closingCompliment =
      pickFirstText(prof.responses, 'q18_genuine_compliment', data.picks, 'ncert') ||
      pickFirstText(prof.responses, 'q20_miss_most', data.picks, 'ncert');

    return [
      idx + 1,
      chapterTitle,
      student.id,
      fullName,
      nickname,
      binomial,
      habitat,
      labels,
      examQuestion,
      examMarks,
      closingCompliment,
      prof.portraitUpload?.storage_path || '',
    ];
  });

  return toCsv(headers, rows);
}

/**
 * Export 3: CID Dossier CSV
 */
export function buildCidDossierCsv(data: EditorDataset): string {
  const headers = [
    'roster_id',
    'full_name',
    'aliases',
    'partners_in_crime',
    'offenses_picked',
    'chaos_level',
    'natural_predator',
    'mugshot_path',
    'threat_summary',
  ];

  const rows = ROSTER.map((student) => {
    const prof = aggregateSubjectProfile(student.id, data);
    const fullName = prof.ownContributor?.full_name_caps || student.label.toUpperCase();
    const aliases = prof.nicknamesRanked
      .slice(0, 4)
      .map((n) => `${n.name} (${n.count})`)
      .join(' | ');
    const partners = prof.partnersRanked
      .slice(0, 6)
      .map((p) => `${p.label} (${p.count})`)
      .join(' | ');

    const offenseRows = prof.responses.filter((r) => r.question_key === 'q11_offenses');
    const pickedOffenses = offenseRows.filter((r) => isRowPickedFor(r.id, data.picks, 'cid'));
    const chosenOffenses = pickedOffenses.length > 0 ? pickedOffenses : offenseRows.slice(0, 3);
    const offensesText = chosenOffenses
      .map((r) => {
        const raw = [r.answer?.offense1, r.answer?.offense2].filter(Boolean).join(' / ');
        return getEffectiveText(r, raw, data.picks);
      })
      .filter(Boolean)
      .join(' ; ');

    const predator = pickFirstText(prof.responses, 'q14_predator', data.picks, 'cid');
    const villainOrigin = pickFirstText(prof.responses, 'q23_villain_origin', data.picks, 'cid');
    const threatSummary = `Chaos ${prof.chaosAvg}/10 — ${
      villainOrigin || prof.chaosReasons[0]?.why || 'Known classroom instigator'
    }`;

    return [
      student.id,
      fullName,
      aliases,
      partners,
      offensesText,
      prof.chaosAvg,
      predator,
      prof.mugshotUpload?.storage_path || prof.portraitUpload?.storage_path || '',
      threatSummary,
    ];
  });

  return toCsv(headers, rows);
}

/**
 * Export 4: Manga JSON
 */
export function buildMangaJson(data: EditorDataset) {
  const sceneVotes = new Map<string, number>();
  const chaosScenes: { contributorId: string; content: unknown }[] = [];

  for (const a of data.archiveEntries) {
    if (a.section_key === 'manga_scenes') {
      const selected = Array.isArray(a.content?.selected)
        ? (a.content.selected as string[])
        : [];
      for (const s of selected) {
        sceneVotes.set(s, (sceneVotes.get(s) ?? 0) + 1);
      }
      if (typeof a.content?.customScene === 'string' && a.content.customScene.trim()) {
        const custom = a.content.customScene.trim();
        sceneVotes.set(custom, (sceneVotes.get(custom) ?? 0) + 1);
      }
    }
    if (
      a.section_key === 'timeline_chaotic_days' ||
      a.section_key === 'free_period_legends' ||
      a.section_key === 'substitute_stories'
    ) {
      chaosScenes.push({ contributorId: a.contributor_id, content: a.content });
    }
  }

  const perStudent = ROSTER.map((student) => {
    const prof = aggregateSubjectProfile(student.id, data);
    const sfx = prof.responses
      .filter((r) => r.question_key === 'q21_sound_effect')
      .map((r) => String(r.answer?.value ?? '').trim())
      .filter(Boolean);
    const catchphrases = prof.responses
      .filter((r) => r.question_key === 'q8_catchphrase')
      .map((r) => getEffectiveText(r, String(r.answer?.value ?? '').trim(), data.picks))
      .filter(Boolean);
    const funniestMoments = prof.responses
      .filter((r) => r.question_key === 'q25_funniest_moment')
      .map((r) => getEffectiveText(r, String(r.answer?.value ?? '').trim(), data.picks))
      .filter(Boolean);

    return {
      roster_id: student.id,
      label: student.label,
      top_nickname: prof.nicknamesRanked[0]?.name ?? student.label,
      top_archetype: prof.archetypesRanked[0]?.title ?? 'Classmate',
      sound_effects: sfx,
      catchphrases,
      character_intro_callout:
        pickFirstText(prof.responses, 'q22_trailer_line', data.picks, 'manga') ||
        pickFirstText(prof.responses, 'q3_quirk', data.picks, 'manga'),
      funniest_moments: funniestMoments,
    };
  });

  const candidPhotos = data.uploads
    .filter((u) => u.kind === 'chaos' || u.kind === 'extra')
    .map((u) => ({
      id: u.id,
      kind: u.kind,
      storage_path: u.storage_path,
      caption: u.caption,
      photo_type: u.photo_type,
      tagged_roster_ids: u.tagged_roster_ids,
    }));

  return {
    generated_at: new Date().toISOString(),
    scene_list_votes: Array.from(sceneVotes.entries())
      .map(([scene, votes]) => ({ scene, votes }))
      .sort((a, b) => b.votes - a.votes),
    chaos_scenes: chaosScenes,
    characters: perStudent,
    candid_photos: candidPhotos,
  };
}

/**
 * Export 5: Single Full JSON Export
 */
export function buildFullJson(data: EditorDataset) {
  const awardsSummary = AWARDS.map((aw) => {
    const votes = data.awards.filter((v) => v.award_key === aw.key);
    const counts = new Map<string, number>();
    for (const v of votes) {
      counts.set(v.voted_roster_id, (counts.get(v.voted_roster_id) ?? 0) + 1);
    }
    const ranked = Array.from(counts.entries())
      .map(([rosterId, count]) => ({
        rosterId,
        label: getRosterById(rosterId)?.label ?? rosterId,
        count,
      }))
      .sort((a, b) => b.count - a.count);
    const topCount = ranked[0]?.count ?? 0;
    const tiedWinners = ranked.filter((r) => r.count === topCount && topCount > 0);
    return {
      award_key: aw.key,
      title: aw.title,
      total_votes: votes.length,
      is_tie: tiedWinners.length > 1,
      ranked,
    };
  });

  return {
    exported_at: new Date().toISOString(),
    roster: ROSTER,
    contributors: data.contributors,
    profiles: ROSTER.map((s) => aggregateSubjectProfile(s.id, data)),
    awards: awardsSummary,
    raw_responses: data.responses,
    raw_case_meta: data.caseMeta,
    raw_awards_votes: data.awards,
    archive_entries: data.archiveEntries,
    anything_else: data.anythingElse,
    skips: data.skips,
    uploads: data.uploads,
    editor_picks: data.picks,
    editor_notes: data.notes,
    familiarity_weights: data.weights,
    familiarity_options: FAMILIARITY_OPTIONS,
  };
}
