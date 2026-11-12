export interface RosterEntry {
  id: string;
  label: string;
  devanagari?: string;
}

/**
 * Exact alphabetical roster of the 23 students in the Class of 23.
 * Used solely to populate the name-selection dropdown and classmate folders.
 * Note: Scholar numbers are NEVER stored here.
 * Saksham R. and Sakshama T. are two distinct students.
 */
export const ROSTER: readonly RosterEntry[] = [
  { id: 'afsha', label: 'Afsha', devanagari: 'अफ़्शा' },
  { id: 'alvina', label: 'Alvina', devanagari: 'अल्विना' },
  { id: 'angel', label: 'Angel', devanagari: 'एंजेल' },
  { id: 'anika', label: 'Anika', devanagari: 'अनिका' },
  { id: 'aryan', label: 'Aryan', devanagari: 'आर्यन' },
  { id: 'atharv', label: 'Atharv', devanagari: 'अथर्व' },
  { id: 'avika', label: 'Avika', devanagari: 'अविका' },
  { id: 'deepal', label: 'Deepal', devanagari: 'दीपल' },
  { id: 'dhun', label: 'Dhun', devanagari: 'धुन' },
  { id: 'garvit', label: 'Garvit', devanagari: 'गर्वित' },
  { id: 'hitarth', label: 'Hitarth', devanagari: 'हितार्थ' },
  { id: 'ipshita', label: 'Ipshita', devanagari: 'इप्शिता' },
  { id: 'khush', label: 'Khush', devanagari: 'खुश' },
  { id: 'mehshar', label: 'Mehshar', devanagari: 'मेहशर' },
  { id: 'saksham-r', label: 'Saksham R.', devanagari: 'सक्षम आर.' },
  { id: 'sakshama-t', label: 'Sakshama T.', devanagari: 'सक्षमा टी.' },
  { id: 'shreyansh', label: 'Shreyansh', devanagari: 'श्रेयांश' },
  { id: 'shrishti', label: 'Shrishti', devanagari: 'सृष्टि' },
  { id: 'siddhi', label: 'Siddhi', devanagari: 'सिद्धि' },
  { id: 'simra', label: 'Simra', devanagari: 'सिमरा' },
  { id: 'tamanna', label: 'Tamanna', devanagari: 'तमन्ना' },
  { id: 'vaishnavi', label: 'Vaishnavi', devanagari: 'वैष्णवी' },
  { id: 'yashika', label: 'Yashika', devanagari: 'यशिका' },
] as const;

export const ROSTER_BY_ID: Record<string, RosterEntry> = Object.fromEntries(
  ROSTER.map((entry) => [entry.id, entry])
);

export function getRosterById(id: string | null | undefined): RosterEntry | undefined {
  if (!id) return undefined;
  return ROSTER_BY_ID[id];
}

export function getOtherClassmates(selfId: string | null | undefined): RosterEntry[] {
  if (!selfId) return [...ROSTER];
  return ROSTER.filter((entry) => entry.id !== selfId);
}
