export type FamiliarityOptionId =
  | 'best_friends'
  | 'same_group'
  | 'talk_sometimes'
  | 'barely_spoken'
  | 'distance_only';

export interface FamiliarityOption {
  id: FamiliarityOptionId;
  label: string;
  hint: string;
  allowsSkip: boolean;
  defaultWeight: number;
}

export const FAMILIARITY_OPTIONS: readonly FamiliarityOption[] = [
  {
    id: 'best_friends',
    label: 'Best friends',
    hint: 'Know their secrets, tiffin order, and exact panic face.',
    allowsSkip: false,
    defaultWeight: 1.5,
  },
  {
    id: 'same_group',
    label: 'Same group',
    hint: 'Sit near them, share notes, survive free periods together.',
    allowsSkip: false,
    defaultWeight: 1.25,
  },
  {
    id: 'talk_sometimes',
    label: 'Talk sometimes',
    hint: 'Cross paths in corridors, borrow pens, know the general vibe.',
    allowsSkip: false,
    defaultWeight: 1.0,
  },
  {
    id: 'barely_spoken',
    label: 'Barely spoken',
    hint: 'Know their name and attendance roll order, not much else.',
    allowsSkip: true,
    defaultWeight: 0.5,
  },
  {
    id: 'distance_only',
    label: 'Only know them from a distance',
    hint: 'Strictly observational data from across the classroom.',
    allowsSkip: true,
    defaultWeight: 0.5,
  },
] as const;

export const SKIP_REASON_CHOICES = [
  'I have barely spoken to them.',
  'I only know them from a distance.',
  'I honestly have nothing true to say about them.',
  'We are in completely different groups.',
  'Other',
] as const;

export interface SurvivalStatDef {
  key:
    | 'viva_bluffing'
    | 'tiffin_defense'
    | 'stealth'
    | 'crisis_cramming'
    | 'gossip_range'
    | 'excuse_creativity';
  label: string;
  description: string;
}

export const SURVIVAL_STATS: readonly SurvivalStatDef[] = [
  {
    key: 'viva_bluffing',
    label: 'Viva Bluffing',
    description: 'Ability to speak confidently for 90 seconds about a chapter never opened.',
  },
  {
    key: 'tiffin_defense',
    label: 'Tiffin Defense / Extraction',
    description: 'Guards own lunchbox like Fort Knox—or empties yours before recess bell.',
  },
  {
    key: 'stealth',
    label: 'Stealth',
    description: 'Sneaking snacks, escaping chalk duty, or vanishing before PT period.',
  },
  {
    key: 'crisis_cramming',
    label: 'Crisis Cramming',
    description: 'Last-minute clutch absorption of 4 chapters in the school bus.',
  },
  {
    key: 'gossip_range',
    label: 'Gossip Range',
    description: 'Radius (in classrooms) of breaking news detection and broadcast.',
  },
  {
    key: 'excuse_creativity',
    label: 'Excuse Creativity',
    description: 'Believability of "my dog ate the practical file" energy.',
  },
] as const;

export function getStatThumbMeta(value: number): { emoji: string; label: string } {
  if (value <= 15) return { emoji: '🧻', label: 'Wet Paper' };
  if (value <= 35) return { emoji: '😴', label: 'Barely Awake' };
  if (value <= 60) return { emoji: '💪', label: 'Solid Contender' };
  if (value <= 85) return { emoji: '🔥', label: 'Menace Mode' };
  return { emoji: '💀', label: 'Final Boss' };
}

export function getChaosMeta(value: number): string {
  if (value <= 2) return 'Harmless';
  if (value <= 4) return 'Mild Nuisance';
  if (value <= 6) return 'Known Instigator';
  if (value <= 8) return 'Bench Menace';
  return 'Wanted in Three States';
}

export const SOUND_EFFECTS = [
  'CRUNCH',
  'GASP',
  'SNORE',
  '*dramatic sigh*',
  'KAPOW',
] as const;

export const STEP_NARRATION = [
  {
    step: 1,
    title: 'Step 1: Identity',
    narrator: 'Establish aliases and known classroom persona before the suspect notices.',
  },
  {
    step: 2,
    title: 'Step 2: RPG Card Stats',
    narrator: 'Calibrate tactical school-survival metrics. Be brutally honest (within legal limits).',
  },
  {
    step: 3,
    title: 'Step 3: CID Dossier',
    narrator: 'Document offenses, co-conspirators, and current threat classification.',
  },
  {
    step: 4,
    title: 'Step 4: NCERT Specimen & Exam',
    narrator: 'Pin biological specimen notes and compose one cursed board-exam problem.',
  },
  {
    step: 5,
    title: 'Step 5: The Soft Spot',
    narrator: 'Drop the detective trench coat for a second. Roasts, compliments, and lore.',
  },
] as const;

export const QUESTION_KEYS = {
  Q1_NICKNAME: 'q1_nickname',
  Q2_ARCHETYPE: 'q2_archetype',
  Q3_QUIRK: 'q3_quirk',
  Q4_DAILY_HABIT: 'q4_daily_habit',
  Q5_HABITAT: 'q5_habitat',
  Q6_STATS: 'q6_stats',
  Q7_CUSTOM_STAT: 'q7_custom_stat',
  Q8_CATCHPHRASE: 'q8_catchphrase',
  Q9_PASSIVE_TRAIT: 'q9_passive_trait',
  Q10_ULTIMATE_MOVE: 'q10_ultimate_move',
  Q11_OFFENSES: 'q11_offenses',
  Q12_PARTNERS: 'q12_partners',
  Q13_CHAOS: 'q13_chaos',
  Q14_PREDATOR: 'q14_predator',
  Q15_DIAGRAM_LABELS: 'q15_diagram_labels',
  Q16_EXAM_QUESTION: 'q16_exam_question',
  Q17_ROAST: 'q17_roast',
  Q18_GENUINE_COMPLIMENT: 'q18_genuine_compliment',
  Q19_EMBARRASSING_COMPLIMENT: 'q19_embarrassing_compliment',
  Q20_MISS_MOST: 'q20_miss_most',
  Q21_SOUND_EFFECT: 'q21_sound_effect',
  Q22_TRAILER_LINE: 'q22_trailer_line',
  Q23_VILLAIN_ORIGIN: 'q23_villain_origin',
  Q24_EXCUSE_HALL: 'q24_excuse_hall',
  Q25_FUNNIEST_MOMENT: 'q25_funniest_moment',
} as const;

export interface ArchiveSectionDef {
  key: string;
  title: string;
  subtitle: string;
  example: string;
  kind: 'teachers' | 'bingo' | 'timeline' | 'manga_scenes' | 'three_words_song' | 'list' | 'text';
}

export const MANGA_SUGGESTED_SCENES = [
  'Morning assembly chaos',
  'Surprise unit test panic',
  'Canteen samosa raid',
  'Substitute period anarchy',
  'Sports / PT period escape',
  'Last bell stampede',
  'Chalk fight / fan switch war',
  'Chemistry / Physics lab mishap',
  'Pre-board result day corridor',
  'Annual day backstage madness',
] as const;

export const ARCHIVE_SECTIONS: readonly ArchiveSectionDef[] = [
  {
    key: 'teacher_files',
    title: '1. Teacher Files',
    subtitle: 'Log memorable teachers, their signature phrase, and classic classroom reaction.',
    example: 'Sharma Sir — "Pin-drop silence, this is not a fish market" — slams register gently.',
    kind: 'teachers',
  },
  {
    key: 'teacher_bingo',
    title: '2. Teacher Bingo (9 squares)',
    subtitle: '9 phrases you could bet your lunch money a teacher would say every single week.',
    example: '"This batch is the worst batch I have taught in 18 years."',
    kind: 'bingo',
  },
  {
    key: 'canteen_menu',
    title: '3. Canteen Menu of Memory',
    subtitle: 'Legendary canteen items, weird combinations, or the day someone got scammed for ₹10.',
    example: 'Cold bread pakora with extra green chutney; bhaiya rounding ₹27 to ₹30.',
    kind: 'text',
  },
  {
    key: 'bench_whiteboard_lore',
    title: '4. Bench & Whiteboard Lore',
    subtitle: 'What was permanently scratched on desks or drawn on the board before sir walked in?',
    example: 'A detailed portrait of a potato labelled "Monday Morning" on row 4 bench 2.',
    kind: 'text',
  },
  {
    key: 'unwritten_rules',
    title: '5. Unwritten Class Rules',
    subtitle: 'Sacred laws nobody wrote in the school diary, yet everyone obeyed.',
    example: 'Nobody touches the third fan switch. If the teacher says "who did this?", everyone blinks.',
    kind: 'list',
  },
  {
    key: 'timeline_chaotic_days',
    title: '6. The Timeline (5 Most Chaotic School Days)',
    subtitle: 'Approximate month/date, what happened, and who was involved.',
    example: 'Nov — Power cut during double period; impromptu antakshari until principal passed.',
    kind: 'timeline',
  },
  {
    key: 'substitute_stories',
    title: '7. Substitute Teacher Stories',
    subtitle: 'The legendary free/sub period when nobody was truly in charge.',
    example: 'Convinced the substitute ma\'am we had already finished the syllabus.',
    kind: 'text',
  },
  {
    key: 'assembly_pt_moments',
    title: '8. Assembly, Prayer & PT Period Moments',
    subtitle: 'Fainting drills, forgotten pledge lines, shoe inspections, or PT uniform evasions.',
    example: 'Half the batch pretending to tie shoelaces to dodge morning jogging.',
    kind: 'text',
  },
  {
    key: 'exam_hall_stories',
    title: '9. Exam Hall Stories',
    subtitle: 'The strangest, funniest, or most dramatic thing during a test or pre-board.',
    example: 'Someone dropped a metal geometry box during pin-drop silence; echo lasted 8 seconds.',
    kind: 'text',
  },
  {
    key: 'free_period_legends',
    title: '10. Free Period Legends',
    subtitle: 'What did this class actually do when no teacher showed up?',
    example: 'Pen-fighting world championship on the back desk + someone doing loud cricket commentary.',
    kind: 'text',
  },
  {
    key: 'trips_annual_sports',
    title: '11. Field Trip, Annual Day & Sports Day Moments',
    subtitle: 'Bus songs, backstage chaos, relay baton drops, or questionable packed lunches.',
    example: 'Singing 2000s Bollywood at full lungs on the bus back while teachers gave up.',
    kind: 'text',
  },
  {
    key: 'manga_scenes',
    title: '12. Manga Scene Votes',
    subtitle: 'Pick 6 chaotic school scenes for the photo-manga, plus add your own wild scene.',
    example: 'Surprise test panic + last bell stampede.',
    kind: 'manga_scenes',
  },
  {
    key: 'class_vibe_song',
    title: '13. "Our Class in 3 Words" & Class Song',
    subtitle: 'Distill Batch 23 into 3 words and name the song that lived rent-free in everyone\'s head.',
    example: '3 words: "Loud, late, undefeated." Song: "Kabira / Ilahi / Give Me Some Sunshine"',
    kind: 'three_words_song',
  },
  {
    key: 'batch_message',
    title: '14. Message to the Batch',
    subtitle: 'One unforgettable line for the very last page of the keepsake.',
    example: 'May we always find front-row energy even when life puts us on the back bench.',
    kind: 'text',
  },
] as const;

export const NARRATOR_REACTIONS: readonly string[] = [
  'Another one down. The class is shaking.',
  'Evidence stamped, dried, and tucked behind the tea stain.',
  'That file belongs in a museum. Or a court exhibit.',
  'Witness testimony logged. Nobody check the back row.',
  'Folder sealed. Our print editor just gasped out loud.',
  'Strong work, detective. Only a few suspects remain.',
  'Filed under "Technically True, Spiritually Accurate."',
  'The printer is already sweating over that quote.',
];

export const RANKS = [
  { minXp: 0, title: 'Rookie Witness', badge: '🪪' },
  { minXp: 150, title: 'Junior Detective', badge: '🔍' },
  { minXp: 400, title: 'Inspector', badge: '🕵️' },
  { minXp: 800, title: 'Chief Witness', badge: '📋' },
  { minXp: 1300, title: 'Commissioner of Chaos', badge: '🚨' },
] as const;

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export const BADGES: readonly BadgeDef[] = [
  {
    id: 'chief_witness',
    title: 'Chief Witness',
    description: 'All 22 classmate cases filed.',
    emoji: '🏛️',
  },
  {
    id: 'poet_of_lore',
    title: 'Poet of Lore',
    description: '10+ long descriptive answers penned.',
    emoji: '🖋️',
  },
  {
    id: 'honorary_detective',
    title: 'Honorary Detective',
    description: '5+ photos uploaded to the evidence locker.',
    emoji: '📸',
  },
  {
    id: 'never_skipped',
    title: 'Never Skipped',
    description: 'Completed all 22 classmates without a single skip.',
    emoji: '🛡️',
  },
  {
    id: 'night_owl',
    title: 'Night Owl',
    description: 'Investigated or submitted between 12 AM and 5 AM.',
    emoji: '🦉',
  },
  {
    id: 'speed_reader',
    title: 'Speed Reader',
    description: 'Completed and filed a full case file in under 3 minutes.',
    emoji: '⚡',
  },
  {
    id: 'roast_master',
    title: 'Roast Master',
    description: '10+ loving roasts delivered.',
    emoji: '🔥',
  },
  {
    id: 'softie',
    title: 'Softie',
    description: '10+ sincere compliments written.',
    emoji: '💛',
  },
] as const;

export const TEXT_LIMITS = {
  SHORT: 300,
  LONG: 2000,
  EXTRA: 10000,
} as const;
