export interface ArchetypeCard {
  id: string;
  title: string;
  tagline: string;
  emoji: string;
  ncertPrefix: string;
  isCustom?: boolean;
}

export const ARCHETYPES: readonly ArchetypeCard[] = [
  {
    id: 'backbench-tactician',
    title: 'Backbench Tactician',
    tagline: 'Controls the entire ecosystem from the last two benches without moving a muscle.',
    emoji: '♟️',
    ncertPrefix: 'Taxonomy of the Last-Row Strategist',
  },
  {
    id: 'proxy-master',
    title: 'Proxy Master',
    tagline: 'Can answer attendance in four distinct voices while sitting under the fan.',
    emoji: '🎭',
    ncertPrefix: 'Acoustics of Attendance Replication',
  },
  {
    id: 'tiffin-raider',
    title: 'Tiffin Raider',
    tagline: 'Appears beside your lunchbox 0.3 seconds after the lid clicks open.',
    emoji: '🍱',
    ncertPrefix: 'Predatory Behaviour Around Aloo Parathas',
  },
  {
    id: 'last-minute-topper',
    title: 'Last-Minute Topper',
    tagline: '"Bro I haven\'t touched the book" — proceeds to score 97 out of 100.',
    emoji: '⚡',
    ncertPrefix: 'Quantum Mechanics of One-Night Revision',
  },
  {
    id: 'teachers-pet-undercover',
    title: "Teacher's Pet (Undercover)",
    tagline: 'Acts rebellious with friends, gets extra attendance and chalk duty voluntarily.',
    emoji: '🕵️',
    ncertPrefix: 'Dual-Agent Symbiosis in Classroom Ecosystems',
  },
  {
    id: 'the-silent-sleeper',
    title: 'The Silent Sleeper',
    tagline: 'Can enter deep REM sleep upright behind an open NCERT textbook.',
    emoji: '😴',
    ncertPrefix: 'Vertical Hibernation in Mammals',
  },
  {
    id: 'silent-menace',
    title: 'Silent Menace',
    tagline: 'Barely speaks all period, drops one devastating roast, vanishes.',
    emoji: '🥷',
    ncertPrefix: 'Low-Frequency High-Impact Specimens',
  },
  {
    id: 'group-project-ghost',
    title: 'Group Project Ghost',
    tagline: 'Missing for 3 weeks, spawns on presentation morning asking "which slide am I?"',
    emoji: '👻',
    ncertPrefix: 'Phantom Participation in Cooperative Units',
  },
  {
    id: 'emotional-support-friend',
    title: 'Emotional Support Friend',
    tagline: 'Carries tissues, backup pens, mints, and unconditional moral validation.',
    emoji: '🫶',
    ncertPrefix: 'Vital Stabilising Agents of Class XII',
  },
  {
    id: 'class-lawyer',
    title: 'Class Lawyer',
    tagline: 'Negotiates test postponements and extra 5 minutes with Supreme Court poise.',
    emoji: '⚖️',
    ncertPrefix: 'Constitutional Rhetoric for Postponing Unit Tests',
  },
  {
    id: 'canteen-warden',
    title: 'Canteen Warden',
    tagline: 'Knows the exact samosa frying schedule and has credit with the canteen bhaiya.',
    emoji: '🥟',
    ncertPrefix: 'Supply Chain Logistics of School Recess',
  },
  {
    id: 'walking-wikipedia',
    title: 'Walking Wikipedia',
    tagline: 'Knows random lore about dinosaurs, exams, and 2014 Bollywood trivia simultaneously.',
    emoji: '📚',
    ncertPrefix: 'Hyper-Indexed Memory Storage Systems',
  },
  {
    id: 'chief-of-gossip',
    title: 'Chief of Gossip',
    tagline: 'Has breaking news from three sections over before the bell even finishes ringing.',
    emoji: '📡',
    ncertPrefix: 'High-Speed Biological Information Networks',
  },
  {
    id: 'custom',
    title: 'Write your own',
    tagline: 'None of these dossiers fit? Coin a fresh classification for the record.',
    emoji: '✍️',
    ncertPrefix: 'Unclassified Specimen Study',
    isCustom: true,
  },
] as const;

export function getArchetypeById(id: string): ArchetypeCard | undefined {
  return ARCHETYPES.find((a) => a.id === id);
}
