import { BADGES, RANKS } from '@/data/questions';
import type { CaseMetaRecord, ResponseMap, UploadRecord } from '@/store/useAppStore';

export function getRankForXp(xp: number) {
  let current: (typeof RANKS)[number] = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.minXp) {
      current = rank;
    }
  }
  const currentIdx = RANKS.findIndex((r) => r.title === current.title);
  const nextRank = currentIdx < RANKS.length - 1 ? RANKS[currentIdx + 1] : null;
  return { current, nextRank };
}

export function computeUnlockedBadges(params: {
  caseMeta: Record<string, CaseMetaRecord>;
  responses: ResponseMap;
  uploads: UploadRecord[];
  submittedAt?: string | null;
}): string[] {
  const { caseMeta, responses, uploads, submittedAt } = params;
  const unlocked: string[] = [];

  const allCases = Object.values(caseMeta);
  const filedCases = allCases.filter((c) => c.status === 'filed');
  const skippedCases = allCases.filter((c) => c.status === 'skipped');

  // 1. Chief Witness: all 22 cases filed
  if (filedCases.length >= 22) {
    unlocked.push('chief_witness');
  }

  // 2. Never Skipped: all 22 classmates completed without a skip
  if (filedCases.length >= 22 && skippedCases.length === 0) {
    unlocked.push('never_skipped');
  }

  // 3. Speed Reader: finished a case in under 3 minutes
  const hasSpeedRun = filedCases.some((c) => {
    if (!c.startedAt || !c.completedAt) return false;
    const diffMs = new Date(c.completedAt).getTime() - new Date(c.startedAt).getTime();
    return diffMs > 0 && diffMs < 3 * 60 * 1000;
  });
  if (hasSpeedRun) {
    unlocked.push('speed_reader');
  }

  // 4. Honorary Detective: 5+ photos uploaded
  if (uploads.length >= 5) {
    unlocked.push('honorary_detective');
  }

  // Count roasts, compliments, and long answers
  let longAnswerCount = 0;
  let roastCount = 0;
  let complimentCount = 0;

  for (const subjectResponses of Object.values(responses)) {
    const r = subjectResponses || {};
    if (typeof r.q17_roast?.value === 'string' && r.q17_roast.value.trim().length > 3) {
      roastCount += 1;
    }
    if (
      typeof r.q18_genuine_compliment?.value === 'string' &&
      r.q18_genuine_compliment.value.trim().length > 3
    ) {
      complimentCount += 1;
    }

    // Long descriptive answers across optional & required fields
    const textKeys = [
      'q3_quirk',
      'q4_daily_habit',
      'q14_predator',
      'q16_exam_question',
      'q17_roast',
      'q18_genuine_compliment',
      'q19_embarrassing_compliment',
      'q20_miss_most',
      'q22_trailer_line',
      'q23_villain_origin',
      'q24_excuse_hall',
      'q25_funniest_moment',
    ];
    for (const k of textKeys) {
      const val = r[k];
      const str =
        typeof val?.value === 'string'
          ? val.value
          : typeof val?.question === 'string'
          ? val.question
          : '';
      if (str.trim().length >= 30) {
        longAnswerCount += 1;
      }
    }
  }

  if (longAnswerCount >= 10) unlocked.push('poet_of_lore');
  if (roastCount >= 10) unlocked.push('roast_master');
  if (complimentCount >= 10) unlocked.push('softie');

  // Night Owl: any case completed or submitted between 12 AM and 5 AM local time
  const isNightHour = (iso?: string | null) => {
    if (!iso) return false;
    const hr = new Date(iso).getHours();
    return hr >= 0 && hr < 5;
  };
  if (isNightHour(submittedAt) || filedCases.some((c) => isNightHour(c.completedAt))) {
    unlocked.push('night_owl');
  }

  return unlocked.filter((id) => BADGES.some((b) => b.id === id));
}
