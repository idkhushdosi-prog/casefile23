import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ROSTER } from '../data/roster';
import { ARCHETYPES } from '../data/archetypes';
import { AWARDS } from '../data/awards';
import { DIAGRAM_PROMPTS } from '../data/diagramPrompts';
import {
  DEFAULT_FAMILIARITY_WEIGHTS,
  type EditorDataset,
  type EditorContributorRow,
  type EditorResponseRow,
  type EditorCaseMetaRow,
  type EditorSkipRow,
  type EditorAwardRow,
  type EditorArchiveRow,
  type EditorAnythingElseRow,
  type EditorUploadRow,
} from '../lib/exports';
import type { FamiliarityOptionId } from '../data/questions';

function makeDeterministicUuid(prefix: number, index: number): string {
  const hexPrefix = prefix.toString(16).padStart(8, '0');
  const hexIndex = index.toString(16).padStart(12, '0');
  return `${hexPrefix}-0000-4000-8000-${hexIndex}`;
}

const SAMPLE_NICKNAMES = [
  'Chief Chai',
  'Proxy King',
  'Bench Ninja',
  'Zero-Period Ghost',
  'Chalk Boss',
  'Samosa Baron',
  'Last-Minute Flash',
  'Doodle Maestro',
  'Syllabus Skipper',
  'Canteen CEO',
];

const SAMPLE_QUIRKS = [
  'Can sleep sitting upright with an open NCERT textbook.',
  'Always arrives 12 seconds before the assembly gate closes.',
  'Carries 4 pens, none of which work properly.',
  'Drops a steel water bottle during pin-drop test silence.',
  'Speaks fluent Hinglish at 2x speed before exams.',
];

const SAMPLE_OFFENSES = [
  'Ate aloo paratha behind the chemistry register.',
  'Answered proxy attendance in two different octaves.',
  'Hid an entire football inside a school blazer.',
  'Convinced a substitute teacher the test was cancelled.',
  'Borrowed a blue gel pen in August and never returned it.',
  'Turned the third fan switch off during peak May heat.',
];

const SAMPLE_COMPLIMENTS = [
  'Always checks on friends before anyone else notices something is wrong.',
  'Makes an ordinary Tuesday morning feel like a festival.',
  'Quietly shares notes at 11 PM before every pre-board.',
  'Never lets anyone eat lunch alone in the corridor.',
];

const SAMPLE_ROASTS = [
  'Confidence level 100%, syllabus completion 4%.',
  'Takes 15 minutes to write the date and margin line, then asks for extra sheet.',
  'Claims they failed, then celebrates 94% softly.',
  'Can lose a geometry box while holding it in their own hands.',
];

const SAMPLE_SFX = ['CRUNCH', 'GASP', 'SNORE', '*dramatic sigh*', 'KAPOW'];
const BENCHES = ['R1-W1', 'R2-M1', 'R3-D1', 'R4-W2', 'R5-W1', 'R5-D2'];
const FAMILIARITIES: FamiliarityOptionId[] = [
  'best_friends',
  'same_group',
  'talk_sometimes',
  'barely_spoken',
  'distance_only',
];

function buildFakeDataset(): EditorDataset {
  const contributors: EditorContributorRow[] = [];
  const responses: EditorResponseRow[] = [];
  const caseMeta: EditorCaseMetaRow[] = [];
  const skips: EditorSkipRow[] = [];
  const awards: EditorAwardRow[] = [];
  const archiveEntries: EditorArchiveRow[] = [];
  const anythingElse: EditorAnythingElseRow[] = [];
  const uploads: EditorUploadRow[] = [];

  let respCounter = 1;
  let archCounter = 1;
  let extraCounter = 1;
  let uploadCounter = 1;

  ROSTER.forEach((student, idx) => {
    const contribId = makeDeterministicUuid(0x10000000, idx + 1);
    const upperParts = student.label.toUpperCase().replace(/[^A-Z\s.]/g, '').trim().split(/\s+/);
    const first = upperParts[0] || 'STUDENT';
    const last = upperParts[1] || 'BATCH23';
    const isSubmitted = idx < 20; // 20 submitted, 3 in progress
    // Synthetic runtime test digits (not real student scholar numbers)
    const syntheticNumber = String(100 + idx * 17);

    contributors.push({
      id: contribId,
      roster_id: student.id,
      scholar_number: syntheticNumber,
      first_name_caps: first,
      middle_name_caps: idx % 5 === 0 ? 'KUMAR' : null,
      last_name_caps: last,
      full_name_caps: idx % 5 === 0 ? `${first} KUMAR ${last}` : `${first} ${last}`,
      consent_portrait: true,
      shuffle_seed: 1000 + idx * 37,
      xp: isSubmitted ? 1250 + idx * 15 : 420,
      started_at: '2026-11-01T09:00:00.000Z',
      finished_at: isSubmitted ? '2026-11-02T22:15:00.000Z' : null,
      status: isSubmitted ? 'submitted' : 'in_progress',
    });

    // Portrait & mugshot placeholder metadata
    uploads.push({
      id: makeDeterministicUuid(0x50000000, uploadCounter++),
      contributor_id: contribId,
      kind: 'portrait',
      storage_path: `portraits/${contribId}/portrait.jpg`,
      caption: `Official portrait (${student.label})`,
      photo_type: 'portrait',
      tagged_roster_ids: [student.id],
      width: 1400,
      height: 1400,
      created_at: '2026-11-01T09:10:00.000Z',
    });
    uploads.push({
      id: makeDeterministicUuid(0x50000000, uploadCounter++),
      contributor_id: contribId,
      kind: 'mugshot',
      storage_path: `portraits/${contribId}/mugshot.jpg`,
      caption: `CID mugshot (${student.label})`,
      photo_type: 'mugshot',
      tagged_roster_ids: [student.id],
      width: 1400,
      height: 1400,
      created_at: '2026-11-01T09:12:00.000Z',
    });

    // Peer responses about the other 22 classmates (NEVER self)
    const others = ROSTER.filter((o) => o.id !== student.id);
    others.forEach((subject, oIdx) => {
      const fam = FAMILIARITIES[(idx + oIdx) % FAMILIARITIES.length];
      const shouldSkip =
        (fam === 'barely_spoken' || fam === 'distance_only') && (idx * 3 + oIdx) % 4 === 0;

      if (shouldSkip) {
        const useOther = (idx + oIdx) % 3 === 0;
        caseMeta.push({
          contributor_id: contribId,
          subject_roster_id: subject.id,
          familiarity: fam,
          status: 'skipped',
        });
        skips.push({
          contributor_id: contribId,
          subject_roster_id: subject.id,
          reason_choice: useOther
            ? 'Other'
            : fam === 'barely_spoken'
            ? 'I have barely spoken to them.'
            : 'I only know them from a distance.',
          reason_text: useOther
            ? 'We have been in separate sections until this year so I honestly have zero funny stories to write.'
            : null,
          created_at: '2026-11-01T12:00:00.000Z',
        });
        return;
      }

      caseMeta.push({
        contributor_id: contribId,
        subject_roster_id: subject.id,
        familiarity: fam,
        status: 'filed',
      });

      const pushResp = (qKey: string, answer: Record<string, unknown>) => {
        responses.push({
          id: makeDeterministicUuid(0x20000000, respCounter++),
          contributor_id: contribId,
          subject_roster_id: subject.id,
          question_key: qKey,
          answer,
          updated_at: '2026-11-01T14:00:00.000Z',
        });
      };

      const arch = ARCHETYPES[(oIdx + (idx % 3)) % (ARCHETYPES.length - 1)];
      const nick = SAMPLE_NICKNAMES[(oIdx + (idx % 2)) % SAMPLE_NICKNAMES.length];
      const partnerA = others[(oIdx + 1) % others.length].id;
      const partnerB = others[(oIdx + 2) % others.length].id;
      const dp1 = DIAGRAM_PROMPTS[(idx + oIdx) % DIAGRAM_PROMPTS.length];
      const dp2 = DIAGRAM_PROMPTS[(idx + oIdx + 11) % DIAGRAM_PROMPTS.length];

      pushResp('q1_nickname', { value: nick });
      pushResp('q2_archetype', { archetypeId: arch.id });
      pushResp('q3_quirk', { value: SAMPLE_QUIRKS[(idx + oIdx) % SAMPLE_QUIRKS.length] });
      pushResp('q4_daily_habit', {
        value: 'Asks "Sir aaj attendance hogi?" right after recess.',
      });
      pushResp('q5_habitat', {
        bench: BENCHES[(oIdx + idx) % BENCHES.length],
        freePeriodSpot: 'Water cooler railing',
        canteenSpot: 'Samosa counter left corner',
      });
      pushResp('q6_stats', {
        viva_bluffing: 45 + ((oIdx * 13 + idx * 7) % 52),
        tiffin_defense: 35 + ((oIdx * 11 + idx * 5) % 60),
        stealth: 40 + ((oIdx * 7 + idx * 9) % 55),
        crisis_cramming: 50 + ((oIdx * 17 + idx * 3) % 48),
        gossip_range: 30 + ((oIdx * 19 + idx * 4) % 68),
        excuse_creativity: 48 + ((oIdx * 23 + idx * 6) % 50),
      });
      pushResp('q8_catchphrase', { value: 'Bas ek last doubt ma’am!' });
      pushResp('q9_passive_trait', {
        value: 'Stationery Magnet: pens disappear within 30 seconds.',
      });
      pushResp('q10_ultimate_move', { value: 'The Last-Bench Vanishing Act' });
      pushResp('q11_offenses', {
        offense1: SAMPLE_OFFENSES[(idx + oIdx) % SAMPLE_OFFENSES.length],
        offense2: SAMPLE_OFFENSES[(idx + oIdx + 2) % SAMPLE_OFFENSES.length],
      });
      pushResp('q12_partners', { partners: [partnerA, partnerB] });
      pushResp('q13_chaos', {
        level: 4 + ((idx + oIdx) % 6),
        why: 'Unpredictable energy before every practical exam.',
      });
      pushResp('q14_predator', { value: 'Surprise practical viva' });
      pushResp('q15_diagram_labels', {
        labels: {
          [dp1.area]: { promptId: dp1.id, promptText: dp1.text, value: dp1.example || 'Pure chaos' },
          [dp2.area]: { promptId: dp2.id, promptText: dp2.text, value: dp2.example || '2 samosas' },
        },
      });
      pushResp('q16_exam_question', {
        question: `Prove mathematically that ${subject.label} was awake during double Physics.`,
        marks: 5,
      });
      pushResp('q17_roast', { value: SAMPLE_ROASTS[(idx + oIdx) % SAMPLE_ROASTS.length] });
      pushResp('q18_genuine_compliment', {
        value: SAMPLE_COMPLIMENTS[(idx + oIdx) % SAMPLE_COMPLIMENTS.length],
      });
      pushResp('q21_sound_effect', { value: SAMPLE_SFX[(idx + oIdx) % SAMPLE_SFX.length] });
      pushResp('q22_trailer_line', {
        value: `In a world of strict attendance, ${subject.label} chose vibes.`,
      });
      pushResp('q23_villain_origin', {
        value: 'Lost their favourite gel pen in Class 9 and never trusted again.',
      });
    });

    // Awards votes (all 14 categories, never voting for self)
    AWARDS.forEach((aw, aIdx) => {
      const target = others[(idx + aIdx * 2) % others.length];
      awards.push({
        contributor_id: contribId,
        award_key: aw.key,
        voted_roster_id: target.id,
      });
    });

    // Archive samples for first 6 contributors
    if (idx < 6) {
      archiveEntries.push({
        id: makeDeterministicUuid(0x30000000, archCounter++),
        contributor_id: contribId,
        section_key: 'manga_scenes',
        content: {
          selected: [
            'Morning assembly chaos',
            'Surprise unit test panic',
            'Canteen samosa raid',
            'Substitute period anarchy',
            'Sports / PT period escape',
            'Last bell stampede',
          ],
          customScene: 'The day the ceiling fan wobbled at speed 5.',
        },
        tagged_roster_id: null,
        updated_at: '2026-11-02T10:00:00.000Z',
      });
      archiveEntries.push({
        id: makeDeterministicUuid(0x30000000, archCounter++),
        contributor_id: contribId,
        section_key: 'unwritten_rules',
        content: {
          rules: [
            'Nobody touches the third fan switch.',
            'Always clap when chalk breaks mid-lecture.',
          ],
        },
        tagged_roster_id: null,
        updated_at: '2026-11-02T10:05:00.000Z',
      });
      anythingElse.push({
        id: makeDeterministicUuid(0x40000000, extraCounter++),
        contributor_id: contribId,
        tagged_roster_id: others[0].id,
        body: `Shoutout to ${others[0].label} for carrying our entire pre-board group study.`,
        is_editor_note: false,
        created_at: '2026-11-02T11:00:00.000Z',
      });
      uploads.push({
        id: makeDeterministicUuid(0x50000000, uploadCounter++),
        contributor_id: contribId,
        kind: 'chaos',
        storage_path: `chaos/${contribId}/bench-evidence.jpg`,
        caption: 'Back bench doodle museum before Physics lab',
        photo_type: 'evidence',
        tagged_roster_ids: [others[0].id, others[1].id],
        width: 1600,
        height: 1200,
        created_at: '2026-11-02T11:30:00.000Z',
      });
    }
  });

  return {
    contributors,
    responses,
    caseMeta,
    skips,
    awards,
    archiveEntries,
    anythingElse,
    uploads,
    picks: {},
    notes: {},
    weights: DEFAULT_FAMILIARITY_WEIGHTS,
  };
}

async function pushToSupabaseIfConfigured(dataset: EditorDataset) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey || url.includes('your-project-id')) {
    console.log(
      'ℹ️  Supabase service role env vars not set — skipped remote DB insert (local public/demo-seed.json written).'
    );
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('🚀 Pushing seeded contributors & responses to Supabase...');

  for (const c of dataset.contributors) {
    // Ensure auth user exists with matching UUID
    await admin.auth.admin
      .createUser({
        id: c.id,
        email: `seed-${c.roster_id}@example.local`,
        email_confirm: true,
      })
      .catch(() => undefined);

    const { error } = await admin.from('contributors').upsert(c, { onConflict: 'id' });
    if (error) console.warn(`Contributor ${c.roster_id}:`, error.message);
  }

  const chunk = <T,>(arr: T[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
      arr.slice(i * size, i * size + size)
    );

  for (const batch of chunk(dataset.caseMeta, 200)) {
    await admin.from('case_meta').upsert(batch, {
      onConflict: 'contributor_id,subject_roster_id',
    });
  }
  for (const batch of chunk(dataset.responses, 200)) {
    await admin.from('responses').upsert(batch, {
      onConflict: 'contributor_id,subject_roster_id,question_key',
    });
  }
  for (const batch of chunk(dataset.skips, 200)) {
    await admin.from('skips').upsert(batch, {
      onConflict: 'contributor_id,subject_roster_id',
    });
  }
  for (const batch of chunk(dataset.awards, 200)) {
    await admin.from('awards').upsert(batch, {
      onConflict: 'contributor_id,award_key',
    });
  }
  if (dataset.archiveEntries.length > 0) {
    await admin.from('archive_entries').upsert(dataset.archiveEntries, { onConflict: 'id' });
  }
  if (dataset.anythingElse.length > 0) {
    await admin.from('anything_else').upsert(dataset.anythingElse, { onConflict: 'id' });
  }
  if (dataset.uploads.length > 0) {
    await admin.from('uploads').upsert(dataset.uploads, { onConflict: 'id' });
  }

  console.log('✅ Supabase seed push complete.');
}

async function main() {
  const dataset = buildFakeDataset();
  const outPath = path.join(process.cwd(), 'public', 'demo-seed.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2), 'utf-8');
  console.log(
    `✅ Generated ${outPath} with ${dataset.contributors.length} contributors, ${dataset.responses.length} responses, ${dataset.skips.length} skips, ${dataset.awards.length} award votes.`
  );
  await pushToSupabaseIfConfigured(dataset);
}

void main();
