'use client';

import React, { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FolderClosed,
  LogOut,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { ROSTER, getRosterById } from '@/data/roster';
import {
  FAMILIARITY_OPTIONS,
  NARRATOR_REACTIONS,
  QUESTION_KEYS,
  SKIP_REASON_CHOICES,
  SOUND_EFFECTS,
  STEP_NARRATION,
  SURVIVAL_STATS,
  TEXT_LIMITS,
  getChaosMeta,
  type FamiliarityOptionId,
} from '@/data/questions';
import { getShuffledClassmates } from '@/lib/shuffle';
import { fetchNicknameSuggestions, type NicknameSuggestion } from '@/lib/supabase/client';
import { flushSyncQueue } from '@/lib/sync';
import { countWords, sanitizeText, skipReasonSchema } from '@/lib/validation';
import { computeUnlockedBadges } from '@/lib/xp';
import { useAppStore } from '@/store/useAppStore';
import { playSound, prefersReducedMotion, triggerConfetti } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { Stamp } from '@/components/ui/Stamp';
import { PolaroidPhoto } from '@/components/ui/PolaroidPhoto';
import { ArchetypeDeck } from '@/components/case/ArchetypeDeck';
import { HabitatGrid } from '@/components/case/HabitatGrid';
import { SurvivalSlider } from '@/components/case/SurvivalSlider';
import { StringBoard } from '@/components/case/StringBoard';
import { NcertDiagram, type DiagramLabelValue } from '@/components/case/NcertDiagram';

function QuestionSkipButton({
  skipped,
  onToggle,
}: {
  skipped: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1 rounded border px-2.5 py-1 font-mono-doc text-[11px] font-bold transition-colors ${
        skipped
          ? 'border-[var(--blueprint-ink)] bg-[var(--paper)] text-[var(--blueprint-ink)]'
          : 'border-[var(--border-ink)]/60 bg-[var(--paper)] text-[var(--ink-muted)] hover:border-[var(--border-ink)] hover:text-[var(--ink)]'
      }`}
    >
      <SkipForward className="h-3.5 w-3.5" />
      {skipped ? 'Undo Skip' : "Don't know / Skip"}
    </button>
  );
}

function SkippedQuestionBanner({ onUndo }: { onUndo: () => void }) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-dashed border-[var(--border-ink)]/50 bg-[var(--paper)] px-3 py-2.5 text-xs">
      <span className="font-mono-doc text-[var(--ink-muted)]">
        Skipped — marked as &ldquo;Don&apos;t know this answer&rdquo;.
      </span>
      <button
        type="button"
        onClick={onUndo}
        className="font-mono-doc min-h-[44px] px-2 font-bold text-[var(--blueprint-ink)] underline"
      >
        Answer instead
      </button>
    </div>
  );
}

export default function CaseFilePage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = use(params);
  const router = useRouter();

  const contributor = useAppStore((s) => s.contributor);
  const caseMeta = useAppStore((s) => s.caseMeta);
  const responses = useAppStore((s) => s.responses);
  const skips = useAppStore((s) => s.skips);
  const uploads = useAppStore((s) => s.uploads);
  const touchCaseStarted = useAppStore((s) => s.touchCaseStarted);
  const setCaseFamiliarity = useAppStore((s) => s.setCaseFamiliarity);
  const setCaseStatus = useAppStore((s) => s.setCaseStatus);
  const setResponse = useAppStore((s) => s.setResponse);
  const skipSubject = useAppStore((s) => s.skipSubject);
  const reopenSkippedSubject = useAppStore((s) => s.reopenSkippedSubject);
  const awardXp = useAppStore((s) => s.awardXp);
  const unlockBadges = useAppStore((s) => s.unlockBadges);

  const subject = getRosterById(subjectId);
  const meta = caseMeta[subjectId];
  const subjAnswers = responses[subjectId] ?? {};

  // Stage: 'folder_intro' | 'familiarity' | 'skip_form' | 'steps' | 'filed_done'
  const [stage, setStage] = useState<
    'folder_intro' | 'familiarity' | 'skip_form' | 'steps' | 'filed_done'
  >('folder_intro');
  const [step, setStep] = useState(1);
  const [nickSuggestions, setNickSuggestions] = useState<NicknameSuggestion[]>([]);
  const [skipChoice, setSkipChoice] = useState<string>(
    skips[subjectId]?.reasonChoice ?? ''
  );
  const [skipText, setSkipText] = useState<string>(
    skips[subjectId]?.reasonText ?? ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const classmates = useMemo(() => {
    if (!contributor) return [];
    return getShuffledClassmates(ROSTER, contributor.rosterId, contributor.shuffleSeed);
  }, [contributor]);

  const caseIndex = classmates.findIndex((c) => c.id === subjectId) + 1;
  const nextClassmate = useMemo(() => {
    return (
      classmates.find((c) => {
        if (c.id === subjectId) return false;
        const st = caseMeta[c.id]?.status ?? 'unopened';
        return st === 'unopened' || st === 'in_progress';
      }) ?? null
    );
  }, [classmates, caseMeta, subjectId]);

  useEffect(() => {
    if (!contributor || !subject || contributor.rosterId === subjectId) return;
    touchCaseStarted(subjectId);
    void fetchNicknameSuggestions(subjectId).then(setNickSuggestions);
  }, [contributor, subject, subjectId, touchCaseStarted]);

  // Auto-open past folder intro after brief animation
  useEffect(() => {
    if (stage !== 'folder_intro') return;
    const delay = prefersReducedMotion() ? 150 : 650;
    const t = setTimeout(() => {
      if (meta?.familiarity && meta.status !== 'skipped') {
        setStage('steps');
      } else {
        setStage('familiarity');
      }
    }, delay);
    return () => clearTimeout(t);
  }, [stage, meta?.familiarity, meta?.status]);

  // Read helpers for answers
  const getVal = <T,>(qKey: string, field: string, fallback: T): T => {
    const raw = subjAnswers[qKey]?.[field];
    return raw !== undefined ? (raw as T) : fallback;
  };

  const isQSkipped = (qKey: string): boolean => Boolean(subjAnswers[qKey]?.skipped);

  const toggleQSkip = (qKey: string) => {
    if (isQSkipped(qKey)) {
      setResponse(subjectId, qKey, {});
    } else {
      setResponse(subjectId, qKey, { skipped: true });
      setErrorMsg(null);
      void playSound('rustle');
    }
  };

  const triggerShake = (msg: string) => {
    setErrorMsg(msg);
    setShake(true);
    void playSound('error');
    setTimeout(() => setShake(false), 380);
  };

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">Witness Not Signed In</h1>
          <Link
            href="/details"
            className="tactile-btn mt-4 inline-flex rounded-md bg-[var(--stamp-red)] px-5 py-3 font-bold text-white"
          >
            Enter Witness Details
          </Link>
        </NotebookCard>
      </main>
    );
  }

  // Hard UI guard against self-writing
  if (!subject || contributor.rosterId === subjectId) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <Stamp text="CONFLICT OF INTEREST" color="red" size="md" animateSlam />
          <h1 className="font-typewriter mt-4 text-2xl font-bold">
            {!subject ? 'Unknown Case File' : 'Nice Try — Hands Off Your Own File!'}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">
            {!subject
              ? 'This student ID is not on the Batch of 23 roster.'
              : 'Remember the golden rule: nobody writes about themselves. Let the class handle your dossier.'}
          </p>
          <Link
            href="/desk"
            className="tactile-btn mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-3 font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Case Desk
          </Link>
        </NotebookCard>
      </main>
    );
  }

  // Current Q values
  const nickname = getVal<string>(QUESTION_KEYS.Q1_NICKNAME, 'value', '');
  const archetypeId = getVal<string>(QUESTION_KEYS.Q2_ARCHETYPE, 'archetypeId', '');
  const archetypeCustom = getVal<string>(QUESTION_KEYS.Q2_ARCHETYPE, 'customTitle', '');

  const quirk = getVal<string>(QUESTION_KEYS.Q3_QUIRK, 'value', '');
  const dailyHabit = getVal<string>(QUESTION_KEYS.Q4_DAILY_HABIT, 'value', '');
  const habitatBench = getVal<string>(QUESTION_KEYS.Q5_HABITAT, 'bench', '');
  const freePeriodSpot = getVal<string>(QUESTION_KEYS.Q5_HABITAT, 'freePeriodSpot', '');
  const canteenSpot = getVal<string>(QUESTION_KEYS.Q5_HABITAT, 'canteenSpot', '');

  const statsValues: Record<string, number> = {
    viva_bluffing: getVal<number>(QUESTION_KEYS.Q6_STATS, 'viva_bluffing', 50),
    tiffin_defense: getVal<number>(QUESTION_KEYS.Q6_STATS, 'tiffin_defense', 50),
    stealth: getVal<number>(QUESTION_KEYS.Q6_STATS, 'stealth', 50),
    crisis_cramming: getVal<number>(QUESTION_KEYS.Q6_STATS, 'crisis_cramming', 50),
    gossip_range: getVal<number>(QUESTION_KEYS.Q6_STATS, 'gossip_range', 50),
    excuse_creativity: getVal<number>(QUESTION_KEYS.Q6_STATS, 'excuse_creativity', 50),
  };

  const customStatName = getVal<string>(QUESTION_KEYS.Q7_CUSTOM_STAT, 'name', '');
  const customStatVal = getVal<number>(QUESTION_KEYS.Q7_CUSTOM_STAT, 'value', 75);
  const catchphrase = getVal<string>(QUESTION_KEYS.Q8_CATCHPHRASE, 'value', '');
  const passiveTrait = getVal<string>(QUESTION_KEYS.Q9_PASSIVE_TRAIT, 'value', '');
  const ultimateMove = getVal<string>(QUESTION_KEYS.Q10_ULTIMATE_MOVE, 'value', '');

  const offense1 = getVal<string>(QUESTION_KEYS.Q11_OFFENSES, 'offense1', '');
  const offense2 = getVal<string>(QUESTION_KEYS.Q11_OFFENSES, 'offense2', '');
  const partners = getVal<string[]>(QUESTION_KEYS.Q12_PARTNERS, 'partners', []);
  const chaosLevel = getVal<number>(QUESTION_KEYS.Q13_CHAOS, 'level', 5);
  const chaosWhy = getVal<string>(QUESTION_KEYS.Q13_CHAOS, 'why', '');
  const predator = getVal<string>(QUESTION_KEYS.Q14_PREDATOR, 'value', '');

  const diagramLabels = getVal<DiagramLabelValue>(
    QUESTION_KEYS.Q15_DIAGRAM_LABELS,
    'labels',
    {}
  );
  const examQuestion = getVal<string>(QUESTION_KEYS.Q16_EXAM_QUESTION, 'question', '');
  const examMarks = getVal<number>(QUESTION_KEYS.Q16_EXAM_QUESTION, 'marks', 5);

  const roast = getVal<string>(QUESTION_KEYS.Q17_ROAST, 'value', '');
  const genuineComp = getVal<string>(QUESTION_KEYS.Q18_GENUINE_COMPLIMENT, 'value', '');
  const embarrassingComp = getVal<string>(QUESTION_KEYS.Q19_EMBARRASSING_COMPLIMENT, 'value', '');
  const missMost = getVal<string>(QUESTION_KEYS.Q20_MISS_MOST, 'value', '');
  const soundEffect = getVal<string>(QUESTION_KEYS.Q21_SOUND_EFFECT, 'value', '');
  const trailerLine = getVal<string>(QUESTION_KEYS.Q22_TRAILER_LINE, 'value', '');
  const villainOrigin = getVal<string>(QUESTION_KEYS.Q23_VILLAIN_ORIGIN, 'value', '');
  const excuseHall = getVal<string>(QUESTION_KEYS.Q24_EXCUSE_HALL, 'value', '');
  const funniestMoment = getVal<string>(QUESTION_KEYS.Q25_FUNNIEST_MOMENT, 'value', '');

  const currentFamiliarity = meta?.familiarity ?? null;
  const familiarityDef = FAMILIARITY_OPTIONS.find((o) => o.id === currentFamiliarity);

  const validateCurrentStep = (): boolean => {
    setErrorMsg(null);
    if (step === 1) {
      if (!isQSkipped(QUESTION_KEYS.Q1_NICKNAME) && !nickname.trim()) {
        triggerShake('Give them a nickname—or tap "Don\'t know / Skip" on Q1!');
        return false;
      }
      if (!isQSkipped(QUESTION_KEYS.Q2_ARCHETYPE)) {
        if (!archetypeId) {
          triggerShake('Pick an Archetype Card—or tap "Don\'t know / Skip" on Q2!');
          return false;
        }
        if (archetypeId === 'custom' && !archetypeCustom.trim()) {
          triggerShake('Write a title for your custom archetype card!');
          return false;
        }
      }
      // Save Q1 cleanly if answered
      if (!isQSkipped(QUESTION_KEYS.Q1_NICKNAME) && nickname.trim()) {
        setResponse(subjectId, QUESTION_KEYS.Q1_NICKNAME, {
          value: sanitizeText(nickname, TEXT_LIMITS.SHORT),
        });
      }
    } else if (step === 2) {
      if (!isQSkipped(QUESTION_KEYS.Q3_QUIRK) && !quirk.trim()) {
        triggerShake('Drop a quirk for Q3—or tap "Don\'t know / Skip"!');
        return false;
      }
      if (!isQSkipped(QUESTION_KEYS.Q4_DAILY_HABIT) && !dailyHabit.trim()) {
        triggerShake('Enter their daily habit for Q4—or tap "Don\'t know / Skip"!');
        return false;
      }
      if (!isQSkipped(QUESTION_KEYS.Q5_HABITAT) && !habitatBench) {
        triggerShake('Tap a bench on the classroom map for Q5—or tap "Don\'t know / Skip"!');
        return false;
      }
      // Persist q6_stats explicitly if not skipped
      if (!isQSkipped(QUESTION_KEYS.Q6_STATS)) {
        setResponse(subjectId, QUESTION_KEYS.Q6_STATS, statsValues);
      }
    } else if (step === 3) {
      if (!isQSkipped(QUESTION_KEYS.Q11_OFFENSES) && !offense1.trim() && !offense2.trim()) {
        triggerShake('Add at least 1 classroom offense (Q11)—or tap "Don\'t know / Skip"!');
        return false;
      }
      if (!isQSkipped(QUESTION_KEYS.Q12_PARTNERS) && partners.length === 0) {
        triggerShake('Pin at least 1 partner in crime (Q12)—or tap "Don\'t know / Skip"!');
        return false;
      }
      if (!isQSkipped(QUESTION_KEYS.Q13_CHAOS)) {
        if (!chaosWhy.trim()) {
          triggerShake('Tell us WHY they earned that chaos level (Q13)—or tap "Don\'t know / Skip"!');
          return false;
        }
        setResponse(subjectId, QUESTION_KEYS.Q13_CHAOS, {
          level: chaosLevel,
          why: sanitizeText(chaosWhy, TEXT_LIMITS.SHORT),
        });
      }
    } else if (step === 4) {
      if (!isQSkipped(QUESTION_KEYS.Q15_DIAGRAM_LABELS)) {
        const filledLabels = Object.values(diagramLabels).filter(
          (l) => l.value && l.value.trim().length > 0
        );
        if (filledLabels.length < 2) {
          triggerShake('Pin at least 2 labels on the NCERT diagram (Q15)—or tap "Don\'t know / Skip"!');
          return false;
        }
      }
    }
    return true;
  };

  const handleNextStep = () => {
    if (!validateCurrentStep()) return;
    void playSound('rustle');
    if (step < 5) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleFileCase();
    }
  };

  const handleFileCase = () => {
    setCaseStatus(subjectId, 'filed');
    awardXp(50, `Filed ${subject.label}`, `case_filed:${subjectId}`);
    void flushSyncQueue();
    void playSound('stamp');
    void triggerConfetti('small');

    // Update badge calculations
    const latest = useAppStore.getState();
    const earned = computeUnlockedBadges({
      caseMeta: latest.caseMeta,
      responses: latest.responses,
      uploads: latest.uploads,
      submittedAt: latest.contributor?.finishedAt,
    });
    unlockBadges(earned);
    setStage('filed_done');
  };

  const handleConfirmSkip = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = skipReasonSchema.safeParse({
      reasonChoice: skipChoice,
      reasonText: skipText,
    });
    if (!parsed.success) {
      triggerShake(parsed.error.issues[0]?.message || 'Enter a valid skip reason.');
      return;
    }
    skipSubject(subjectId, parsed.data.reasonChoice, parsed.data.reasonText);
    void flushSyncQueue();
    void playSound('stamp');
    if (nextClassmate) {
      router.push(`/case/${nextClassmate.id}`);
    } else {
      router.push('/desk');
    }
  };

  const stepMeta = STEP_NARRATION[step - 1] ?? STEP_NARRATION[0];
  const narratorReaction =
    NARRATOR_REACTIONS[(caseIndex + filedCountSeed(caseMeta)) % NARRATOR_REACTIONS.length];

  return (
    <main className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Case Header Strip */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <EvidenceTag label={`CASE ${caseIndex || '?'} OF 22`} tone="red" />
          <span className="font-typewriter text-lg font-bold">{subject.label}</span>
          {subject.devanagari && (
            <span className="text-sm text-[var(--ink-muted)]">({subject.devanagari})</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            void flushSyncQueue();
            router.push('/desk');
          }}
          className="tactile-btn inline-flex items-center gap-1.5 rounded-md bg-[var(--paper)] px-3 py-2 text-xs font-bold"
        >
          <LogOut className="h-3.5 w-3.5" /> Save &amp; Exit to Desk
        </button>
      </div>

      {/* Stage 0: Folder-Open Animation */}
      <AnimatePresence mode="wait">
        {stage === 'folder_intro' && (
          <motion.div
            key="folder-intro"
            initial={{ opacity: 0, rotateX: -20, y: 12 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="flex min-h-[280px] flex-col items-center justify-center rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-8 text-center shadow-[5px_7px_0_var(--shadow-paper)]"
          >
            <FolderClosed className="h-12 w-12 text-[var(--stamp-red)]" />
            <p className="font-mono-doc mt-3 text-xs uppercase tracking-widest text-[var(--ink-muted)]">
              Unsealing Case {caseIndex} of 22…
            </p>
            <h1 className="font-typewriter mt-1 text-3xl font-bold">{subject.label}</h1>
          </motion.div>
        )}

        {/* Stage 1: Familiarity Gate */}
        {stage === 'familiarity' && (
          <motion.div
            key="familiarity"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <NotebookCard className={shake ? 'animate-shake' : ''}>
              <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <span className="font-mono-doc text-xs font-bold uppercase tracking-wider text-[var(--blueprint-ink)]">
                    Pre-Interrogation Check (Required)
                  </span>
                  <h1 className="font-typewriter mt-1 text-2xl font-bold">
                    How well do you know {subject.label}?
                  </h1>
                  <p className="mt-1 text-xs text-[var(--ink-muted)]">
                    This helps our editor weight classroom stats fairly. Skips are allowed only
                    if you barely know them.
                  </p>

                  {meta?.status === 'skipped' && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--stamp-red)] bg-[var(--paper)] p-2.5 text-xs">
                      <span>Currently marked <strong>SKIPPED</strong>. You can reopen &amp; answer anytime!</span>
                      <button
                        type="button"
                        onClick={() => reopenSkippedSubject(subjectId)}
                        className="font-bold text-[var(--blueprint-ink)] underline"
                      >
                        Reopen Case
                      </button>
                    </div>
                  )}

                  <div className="mt-4 space-y-2.5">
                    {FAMILIARITY_OPTIONS.map((opt) => {
                      const active = currentFamiliarity === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCaseFamiliarity(subjectId, opt.id);
                            setErrorMsg(null);
                            void playSound('typewriter');
                          }}
                          className={`flex min-h-[54px] w-full flex-col items-start rounded-md border-2 border-[var(--border-ink)] p-3 text-left transition-colors ${
                            active
                              ? 'bg-[var(--highlighter)] text-[#1B1B1B]'
                              : 'bg-[var(--paper)] hover:bg-[var(--manila)]'
                          }`}
                        >
                          <span className="font-typewriter text-sm font-bold">{opt.label}</span>
                          <span className="text-xs opacity-80">{opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-center sm:w-[190px]">
                  <PolaroidPhoto
                    caption={subject.label}
                    sublabel={`CASE ${caseIndex}/22`}
                    rotate={-2}
                  />
                </div>
              </div>

              {errorMsg && (
                <p role="alert" className="mt-3 text-xs font-bold text-[var(--stamp-red)]">
                  {errorMsg}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                {familiarityDef?.allowsSkip ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg(null);
                      setStage('skip_form');
                    }}
                    className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--paper)] px-4 py-2.5 text-sm font-bold text-[var(--stamp-red)]"
                  >
                    <SkipForward className="h-4 w-4" />
                    Skip this person (with reason)
                  </button>
                ) : (
                  <span className="text-xs text-[var(--ink-muted)]">
                    Select familiarity to begin the 5-step dossier.
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (!currentFamiliarity) {
                      triggerShake('Pick how well you know them first!');
                      return;
                    }
                    void playSound('rustle');
                    setStage('steps');
                    setStep(1);
                  }}
                  className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-3 text-sm font-bold text-white"
                >
                  Open Case Questions <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </NotebookCard>
          </motion.div>
        )}

        {/* Stage 1b: Skip Form */}
        {stage === 'skip_form' && (
          <motion.div
            key="skip-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <NotebookCard className={shake ? 'animate-shake' : ''}>
              <Stamp text="REQUEST TO SKIP" color="red" size="sm" rotate={-2} />
              <h1 className="font-typewriter mt-3 text-2xl font-bold">
                Why are we sealing {subject.label}&apos;s file blank?
              </h1>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                Skip reasons are visible only to the keepsake editor. You can always reopen
                this folder later.
              </p>

              <form onSubmit={handleConfirmSkip} className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="skip-reason-select"
                    className="font-mono-doc block text-xs font-bold uppercase"
                  >
                    Reason <span className="text-[var(--stamp-red)]">*</span>
                  </label>
                  <select
                    id="skip-reason-select"
                    value={skipChoice}
                    onChange={(e) => {
                      setSkipChoice(e.target.value);
                      setErrorMsg(null);
                    }}
                    className="mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-sm"
                  >
                    <option value="">-- Select a valid reason --</option>
                    {SKIP_REASON_CHOICES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {skipChoice === 'Other' && (
                  <div>
                    <label
                      htmlFor="skip-reason-other"
                      className="font-mono-doc block text-xs font-bold uppercase"
                    >
                      Explain in at least 10 words ({countWords(skipText)}/10 words)
                    </label>
                    <textarea
                      id="skip-reason-other"
                      rows={3}
                      maxLength={300}
                      placeholder="Write at least 10 words explaining why you cannot answer for this classmate..."
                      value={skipText}
                      onChange={(e) => {
                        setSkipText(e.target.value);
                        setErrorMsg(null);
                      }}
                      className="mt-1.5 w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3 text-sm"
                    />
                  </div>
                )}

                {errorMsg && (
                  <p role="alert" className="text-xs font-bold text-[var(--stamp-red)]">
                    {errorMsg}
                  </p>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStage('familiarity')}
                    className="tactile-btn rounded-md bg-[var(--paper)] px-4 py-2.5 text-sm font-bold"
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="tactile-btn rounded-md bg-[var(--stamp-red)] px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Stamp SKIPPED &amp; Continue
                  </button>
                </div>
              </form>
            </NotebookCard>
          </motion.div>
        )}

        {/* Stage 2: 5-Step Questions Flow */}
        {stage === 'steps' && (
          <motion.div
            key={`step-${step}`}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16 }}
          >
            {/* Mini Step Progress Bar (Arcade Stage Meter) */}
            <div className="mb-3 grid grid-cols-5 gap-1.5" aria-label="Case file steps">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    if (num < step) setStep(num);
                  }}
                  className={`flex h-5 items-center justify-center rounded-sm border-2 border-[var(--border-ink)] font-mono-doc text-[10px] font-bold transition-colors ${
                    num === step
                      ? 'bg-[var(--stamp-red)] text-white shadow-[0_2px_0_var(--btn-shadow)]'
                      : num < step
                      ? 'cursor-pointer bg-[var(--blueprint)] text-white'
                      : 'bg-[var(--paper)] text-[var(--ink-muted)] opacity-70'
                  }`}
                  aria-label={`Step ${num} of 5`}
                >
                  {num < step ? '✓' : `0${num}`}
                </button>
              ))}
            </div>

            <NotebookCard className={shake ? 'animate-shake' : ''}>
              <div className="mb-5 border-b-2 border-dashed border-[var(--border-ink)]/35 pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-doc text-xs font-bold uppercase text-[var(--stamp-red)]">
                    {stepMeta.title} ({step}/5)
                  </span>
                  <button
                    type="button"
                    onClick={() => setStage('familiarity')}
                    className="font-mono-doc text-xs underline text-[var(--ink-muted)]"
                  >
                    Change familiarity / Skip
                  </button>
                </div>
                <p className="font-typewriter mt-1 text-sm text-[var(--ink-muted)]">
                  &ldquo;{stepMeta.narrator}&rdquo;
                </p>
              </div>

              {/* STEP 1: IDENTITY */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <label
                          htmlFor="q1-nickname"
                          className="font-typewriter block text-base font-bold"
                        >
                          Q1. What is the most accurate, funniest, or most widely used nickname for{' '}
                          {subject.label}?
                        </label>
                        <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                          Tap an existing anonymous suggestion, invent a new one, or skip if unknown.
                        </p>
                      </div>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q1_NICKNAME)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q1_NICKNAME)}
                      />
                    </div>

                    {isQSkipped(QUESTION_KEYS.Q1_NICKNAME) ? (
                      <SkippedQuestionBanner
                        onUndo={() => toggleQSkip(QUESTION_KEYS.Q1_NICKNAME)}
                      />
                    ) : (
                      <>
                        {nickSuggestions.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {nickSuggestions.map((s) => (
                              <button
                                key={s.nickname}
                                type="button"
                                onClick={() => {
                                  setResponse(
                                    subjectId,
                                    QUESTION_KEYS.Q1_NICKNAME,
                                    { value: s.nickname },
                                    10
                                  );
                                  void playSound('typewriter');
                                }}
                                className={`min-h-[40px] rounded-full border-2 border-[var(--border-ink)] px-3 py-1 text-xs font-bold ${
                                  nickname === s.nickname
                                    ? 'bg-[var(--highlighter)] text-[#1B1B1B]'
                                    : 'bg-[var(--paper)] hover:bg-[var(--manila)]'
                                }`}
                              >
                                {s.nickname}{' '}
                                <span className="font-mono-doc opacity-70">×{s.suggestion_count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <input
                          id="q1-nickname"
                          type="text"
                          maxLength={TEXT_LIMITS.SHORT}
                          placeholder="Type or add a new nickname..."
                          value={nickname}
                          onChange={(e) =>
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q1_NICKNAME,
                              { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                              10
                            )
                          }
                          className="mt-2.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-sm"
                        />
                      </>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-typewriter text-base font-bold">
                        Q2. Pick their School Archetype Card
                      </p>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q2_ARCHETYPE)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q2_ARCHETYPE)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q2_ARCHETYPE) ? (
                      <SkippedQuestionBanner
                        onUndo={() => toggleQSkip(QUESTION_KEYS.Q2_ARCHETYPE)}
                      />
                    ) : (
                      <ArchetypeDeck
                        selectedId={archetypeId}
                        customTitle={archetypeCustom}
                        onSelect={(id, custom) => {
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q2_ARCHETYPE,
                            {
                              archetypeId: id,
                              customTitle: custom ?? archetypeCustom,
                            },
                            15
                          );
                          setErrorMsg(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: RPG CARD STATS */}
              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <label htmlFor="q3-quirk" className="font-typewriter block text-base font-bold">
                          Q3. Unique quirk, weird habit, or classroom superpower
                        </label>
                        <p className="text-xs text-[var(--ink-muted)]">
                          Example: &ldquo;Types with their eyes closed&rdquo; or &ldquo;Drops pen during total silence.&rdquo;
                        </p>
                      </div>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q3_QUIRK)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q3_QUIRK)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q3_QUIRK) ? (
                      <SkippedQuestionBanner onUndo={() => toggleQSkip(QUESTION_KEYS.Q3_QUIRK)} />
                    ) : (
                      <input
                        id="q3-quirk"
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        value={quirk}
                        onChange={(e) =>
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q3_QUIRK,
                            { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                            10
                          )
                        }
                        className="mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-sm"
                      />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="q4-habit" className="font-typewriter block text-base font-bold">
                        Q4. Daily habit: the thing they do every single day without fail
                      </label>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q4_DAILY_HABIT)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q4_DAILY_HABIT)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q4_DAILY_HABIT) ? (
                      <SkippedQuestionBanner
                        onUndo={() => toggleQSkip(QUESTION_KEYS.Q4_DAILY_HABIT)}
                      />
                    ) : (
                      <input
                        id="q4-habit"
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        placeholder="e.g. Asks someone for a blue pen at 8:05 AM sharp."
                        value={dailyHabit}
                        onChange={(e) =>
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q4_DAILY_HABIT,
                            { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                            10
                          )
                        }
                        className="mt-1.5 min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-sm"
                      />
                    )}
                  </div>

                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-typewriter text-base font-bold">Q5. Classroom Habitat</p>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q5_HABITAT)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q5_HABITAT)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q5_HABITAT) ? (
                      <SkippedQuestionBanner onUndo={() => toggleQSkip(QUESTION_KEYS.Q5_HABITAT)} />
                    ) : (
                      <>
                        <HabitatGrid
                          selectedBench={habitatBench}
                          onSelectBench={(bench) =>
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q5_HABITAT,
                              { bench, freePeriodSpot, canteenSpot },
                              10
                            )
                          }
                        />
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="q5-free"
                              className="font-mono-doc block text-xs font-bold uppercase"
                            >
                              Free period spot (optional)
                            </label>
                            <input
                              id="q5-free"
                              type="text"
                              maxLength={TEXT_LIMITS.SHORT}
                              placeholder="e.g. Railing outside chem lab"
                              value={freePeriodSpot}
                              onChange={(e) =>
                                setResponse(subjectId, QUESTION_KEYS.Q5_HABITAT, {
                                  bench: habitatBench,
                                  freePeriodSpot: e.target.value.slice(0, TEXT_LIMITS.SHORT),
                                  canteenSpot,
                                })
                              }
                              className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="q5-canteen"
                              className="font-mono-doc block text-xs font-bold uppercase"
                            >
                              Canteen spot (optional)
                            </label>
                            <input
                              id="q5-canteen"
                              type="text"
                              maxLength={TEXT_LIMITS.SHORT}
                              placeholder="e.g. Front of samosa queue"
                              value={canteenSpot}
                              onChange={(e) =>
                                setResponse(subjectId, QUESTION_KEYS.Q5_HABITAT, {
                                  bench: habitatBench,
                                  freePeriodSpot,
                                  canteenSpot: e.target.value.slice(0, TEXT_LIMITS.SHORT),
                                })
                              }
                              className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-typewriter text-base font-bold">
                        Q6. Survival Stats (1 = Wet Paper, 100 = Final Boss)
                      </p>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q6_STATS)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q6_STATS)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q6_STATS) ? (
                      <SkippedQuestionBanner onUndo={() => toggleQSkip(QUESTION_KEYS.Q6_STATS)} />
                    ) : (
                      SURVIVAL_STATS.map((stat) => (
                        <SurvivalSlider
                          key={stat.key}
                          id={`stat-${stat.key}`}
                          label={stat.label}
                          description={stat.description}
                          value={statsValues[stat.key]}
                          onChange={(val) =>
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q6_STATS,
                              { ...statsValues, [stat.key]: val },
                              10
                            )
                          }
                        />
                      ))
                    )}
                  </div>

                  {/* Optional Q7-Q10 */}
                  <div className="space-y-4 rounded-md border-2 border-dashed border-[var(--border-ink)]/50 bg-[var(--manila)]/50 p-4">
                    <p className="font-mono-doc text-xs font-bold uppercase text-[var(--blueprint-ink)]">
                      Bonus Card Lore (Optional — +XP)
                    </p>

                    <div>
                      <label htmlFor="q7-name" className="font-typewriter block text-sm font-bold">
                        Q7. Invent your own stat &amp; rate it
                      </label>
                      <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          id="q7-name"
                          type="text"
                          maxLength={100}
                          placeholder="e.g. Sharing Tiffin"
                          value={customStatName}
                          onChange={(e) =>
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q7_CUSTOM_STAT,
                              { name: e.target.value, value: customStatVal },
                              10
                            )
                          }
                          className="min-h-[44px] flex-1 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={1}
                            max={100}
                            aria-label="Custom stat rating"
                            value={customStatVal}
                            onChange={(e) =>
                              setResponse(subjectId, QUESTION_KEYS.Q7_CUSTOM_STAT, {
                                name: customStatName,
                                value: Number(e.target.value),
                              })
                            }
                            className="accent-[var(--blueprint)]"
                          />
                          <span className="font-mono-doc w-12 text-xs font-bold">
                            {customStatVal}/100
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="q8-catch" className="font-typewriter block text-sm font-bold">
                        Q8. Catchphrase (Example: &ldquo;Bas ek last doubt.&rdquo;)
                      </label>
                      <input
                        id="q8-catch"
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        value={catchphrase}
                        onChange={(e) =>
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q8_CATCHPHRASE,
                            { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                            10
                          )
                        }
                        className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="q9-passive" className="font-typewriter block text-sm font-bold">
                        Q9. Passive trait (Example: &ldquo;Stationery Black Hole: borrowed pens vanish.&rdquo;)
                      </label>
                      <input
                        id="q9-passive"
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        value={passiveTrait}
                        onChange={(e) =>
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q9_PASSIVE_TRAIT,
                            { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                            10
                          )
                        }
                        className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="q10-ult" className="font-typewriter block text-sm font-bold">
                        Q10. Ultimate move (Example: &ldquo;The Philosophical Diversion.&rdquo;)
                      </label>
                      <input
                        id="q10-ult"
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        value={ultimateMove}
                        onChange={(e) =>
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q10_ULTIMATE_MOVE,
                            { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                            10
                          )
                        }
                        className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: CID DOSSIER */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-typewriter text-base font-bold">
                          Q11. Known Offenses: hilarious crimes they&apos;re notorious for
                        </p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          Write 1 or 2 crimes — e.g. &ldquo;Ate a paratha during a chemistry titration.&rdquo;
                        </p>
                      </div>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q11_OFFENSES)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q11_OFFENSES)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q11_OFFENSES) ? (
                      <SkippedQuestionBanner
                        onUndo={() => toggleQSkip(QUESTION_KEYS.Q11_OFFENSES)}
                      />
                    ) : (
                      <div className="mt-2 space-y-2.5">
                        <input
                          type="text"
                          aria-label="Offense 1"
                          maxLength={TEXT_LIMITS.SHORT}
                          placeholder="Offense #1..."
                          value={offense1}
                          onChange={(e) =>
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q11_OFFENSES,
                              {
                                offense1: e.target.value.slice(0, TEXT_LIMITS.SHORT),
                                offense2,
                              },
                              10
                            )
                          }
                          className="min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-sm"
                        />
                        <input
                          type="text"
                          aria-label="Offense 2 (optional)"
                          maxLength={TEXT_LIMITS.SHORT}
                          placeholder="Offense #2 (optional)..."
                          value={offense2}
                          onChange={(e) =>
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q11_OFFENSES,
                              {
                                offense1,
                                offense2: e.target.value.slice(0, TEXT_LIMITS.SHORT),
                              },
                              10
                            )
                          }
                          className="min-h-[46px] w-full rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-typewriter text-base font-bold">
                        Q12. Partners in Crime (String Board)
                      </p>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q12_PARTNERS)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q12_PARTNERS)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q12_PARTNERS) ? (
                      <SkippedQuestionBanner
                        onUndo={() => toggleQSkip(QUESTION_KEYS.Q12_PARTNERS)}
                      />
                    ) : (
                      <StringBoard
                        subjectId={subjectId}
                        selfId={contributor.rosterId}
                        selectedPartners={partners}
                        onChange={(next) =>
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q12_PARTNERS,
                            { partners: next },
                            15
                          )
                        }
                      />
                    )}
                  </div>

                  <div className="rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label htmlFor="q13-chaos" className="font-typewriter text-base font-bold">
                        Q13. Chaos Level (1–10)
                      </label>
                      <div className="flex flex-wrap items-center gap-2">
                        {!isQSkipped(QUESTION_KEYS.Q13_CHAOS) && (
                          <span className="font-mono-doc rounded bg-[var(--stamp-red)] px-2.5 py-0.5 text-xs font-bold text-white">
                            {chaosLevel}/10 • {getChaosMeta(chaosLevel)}
                          </span>
                        )}
                        <QuestionSkipButton
                          skipped={isQSkipped(QUESTION_KEYS.Q13_CHAOS)}
                          onToggle={() => toggleQSkip(QUESTION_KEYS.Q13_CHAOS)}
                        />
                      </div>
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q13_CHAOS) ? (
                      <SkippedQuestionBanner onUndo={() => toggleQSkip(QUESTION_KEYS.Q13_CHAOS)} />
                    ) : (
                      <>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="font-mono-doc text-[10px]">Harmless</span>
                          <input
                            id="q13-chaos"
                            type="range"
                            min={1}
                            max={10}
                            value={chaosLevel}
                            onChange={(e) =>
                              setResponse(subjectId, QUESTION_KEYS.Q13_CHAOS, {
                                level: Number(e.target.value),
                                why: chaosWhy,
                              })
                            }
                            className="h-3 flex-1 cursor-pointer accent-[var(--stamp-red)]"
                          />
                          <span className="font-mono-doc text-[10px]">Wanted in 3 States</span>
                        </div>
                        <input
                          type="text"
                          aria-label="Why this chaos level?"
                          maxLength={TEXT_LIMITS.SHORT}
                          placeholder="One-line reason WHY..."
                          value={chaosWhy}
                          onChange={(e) =>
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q13_CHAOS,
                              {
                                level: chaosLevel,
                                why: e.target.value.slice(0, TEXT_LIMITS.SHORT),
                              },
                              10
                            )
                          }
                          className="mt-3 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper-card)] px-3 text-sm"
                        />
                      </>
                    )}
                  </div>

                  <div>
                    <label htmlFor="q14-predator" className="font-typewriter block text-sm font-bold">
                      Q14. Natural Predator (Optional): Which teacher, rule, or situation do they fear most?
                    </label>
                    <input
                      id="q14-predator"
                      type="text"
                      maxLength={TEXT_LIMITS.SHORT}
                      placeholder="e.g. Surprise practical viva or Physics attendance check"
                      value={predator}
                      onChange={(e) =>
                        setResponse(
                          subjectId,
                          QUESTION_KEYS.Q14_PREDATOR,
                          { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                          10
                        )
                      }
                      className="mt-1.5 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: NCERT DIAGRAM & EXAM */}
              {step === 4 && (
                <div className="space-y-6">
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-typewriter text-base font-bold">
                          Q15. Labeled NCERT Biological Specimen Diagram
                        </p>
                        <p className="mb-3 text-xs text-[var(--ink-muted)]">
                          Tap at least 2 hotspots on {subject.label}&apos;s diagram (or pick from the
                          Quick Label strip, or skip if unknown).
                        </p>
                      </div>
                      <QuestionSkipButton
                        skipped={isQSkipped(QUESTION_KEYS.Q15_DIAGRAM_LABELS)}
                        onToggle={() => toggleQSkip(QUESTION_KEYS.Q15_DIAGRAM_LABELS)}
                      />
                    </div>
                    {isQSkipped(QUESTION_KEYS.Q15_DIAGRAM_LABELS) ? (
                      <SkippedQuestionBanner
                        onUndo={() => toggleQSkip(QUESTION_KEYS.Q15_DIAGRAM_LABELS)}
                      />
                    ) : (
                      <NcertDiagram
                        subjectLabel={subject.label}
                        labels={diagramLabels}
                        onChange={(next) =>
                          setResponse(
                            subjectId,
                            QUESTION_KEYS.Q15_DIAGRAM_LABELS,
                            { labels: next },
                            15
                          )
                        }
                      />
                    )}
                  </div>

                  {/* Q16 Board Exam Question with NCERT Preview Box */}
                  <div className="rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)]/60 p-4">
                    <label htmlFor="q16-exam" className="font-typewriter block text-base font-bold">
                      Q16. Board-Exam Question (Optional)
                    </label>
                    <p className="text-xs text-[var(--ink-muted)]">
                      Example: &ldquo;Prove that {subject.label} was NOT sleeping. [5 marks]&rdquo;
                    </p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {[1, 2, 3, 5].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() =>
                            setResponse(subjectId, QUESTION_KEYS.Q16_EXAM_QUESTION, {
                              question: examQuestion,
                              marks: m,
                            })
                          }
                          className={`min-h-[40px] rounded border-2 border-[var(--border-ink)] px-3 font-mono-doc text-xs font-bold ${
                            examMarks === m
                              ? 'bg-[var(--blueprint)] text-white'
                              : 'bg-[var(--paper)]'
                          }`}
                        >
                          [{m} {m === 1 ? 'mark' : 'marks'}]
                        </button>
                      ))}
                    </div>

                    <textarea
                      id="q16-exam"
                      rows={2}
                      maxLength={TEXT_LIMITS.SHORT}
                      placeholder={`Write an exam question about ${subject.label}...`}
                      value={examQuestion}
                      onChange={(e) =>
                        setResponse(
                          subjectId,
                          QUESTION_KEYS.Q16_EXAM_QUESTION,
                          {
                            question: e.target.value.slice(0, TEXT_LIMITS.SHORT),
                            marks: examMarks,
                          },
                          15
                        )
                      }
                      className="mt-2.5 w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-2.5 text-sm"
                    />

                    {/* NCERT Style Preview Box */}
                    <div className="mt-3 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3 text-[var(--ink)]">
                      <p className="font-mono-doc text-[10px] font-bold uppercase tracking-widest text-[var(--blueprint-ink)]">
                        NCERT CHAPTER BOX PREVIEW — CBSE BOARD PATTERN
                      </p>
                      <p className="mt-1 font-serif text-sm">
                        <strong>Q.</strong>{' '}
                        {examQuestion.trim() || `Explain the phenomenon of ${subject.label}'s tiffin teleportation.`}{' '}
                        <span className="font-bold">
                          [{examMarks} {examMarks === 1 ? 'mark' : 'marks'}]
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: THE SOFT SPOT (Q17 - Q25, all optional) */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="rounded border border-[var(--blueprint-ink)]/50 bg-[var(--manila)] p-3 text-xs">
                    All questions in this final section are <strong>optional</strong>, though
                    filling even one or two makes their keepsake unforgettable!
                  </p>

                  {[
                    {
                      id: 'q17',
                      key: QUESTION_KEYS.Q17_ROAST,
                      val: roast,
                      label: 'Q17. Roast with love (one sentence)',
                      placeholder: 'A loving, funny roast an editor can print...',
                    },
                    {
                      id: 'q18',
                      key: QUESTION_KEYS.Q18_GENUINE_COMPLIMENT,
                      val: genuineComp,
                      label: 'Q18. A genuine compliment (sincere, no jokes)',
                      placeholder: 'Something genuinely kind they deserve to read...',
                    },
                    {
                      id: 'q19',
                      key: QUESTION_KEYS.Q19_EMBARRASSING_COMPLIMENT,
                      val: embarrassingComp,
                      label: 'Q19. An embarrassing compliment ("so sincere they’ll want to hide")',
                      placeholder: 'e.g. Honestly one of the kindest people when nobody is watching...',
                    },
                    {
                      id: 'q20',
                      key: QUESTION_KEYS.Q20_MISS_MOST,
                      val: missMost,
                      label: 'Q20. What will you miss most about sitting near them?',
                      placeholder: 'Small everyday moments...',
                    },
                  ].map((field) => (
                    <div key={field.id}>
                      <label htmlFor={field.id} className="font-typewriter block text-sm font-bold">
                        {field.label}
                      </label>
                      <input
                        id={field.id}
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        placeholder={field.placeholder}
                        value={field.val}
                        onChange={(e) =>
                          setResponse(
                            subjectId,
                            field.key,
                            { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                            10
                          )
                        }
                        className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                      />
                    </div>
                  ))}

                  {/* Q21 Sound Effect */}
                  <div>
                    <label htmlFor="q21-sfx" className="font-typewriter block text-sm font-bold">
                      Q21. Their manga sound effect
                    </label>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {SOUND_EFFECTS.map((sfx) => (
                        <button
                          key={sfx}
                          type="button"
                          onClick={() => {
                            setResponse(
                              subjectId,
                              QUESTION_KEYS.Q21_SOUND_EFFECT,
                              { value: sfx },
                              10
                            );
                            void playSound('stamp');
                          }}
                          className={`min-h-[40px] rounded border-2 border-[var(--border-ink)] px-3 font-stamp text-xs ${
                            soundEffect === sfx
                              ? 'bg-[var(--highlighter)] text-[#1B1B1B]'
                              : 'bg-[var(--paper)]'
                          }`}
                        >
                          {sfx}
                        </button>
                      ))}
                    </div>
                    <input
                      id="q21-sfx"
                      type="text"
                      maxLength={80}
                      placeholder="Or type a custom comic SFX..."
                      value={soundEffect}
                      onChange={(e) =>
                        setResponse(
                          subjectId,
                          QUESTION_KEYS.Q21_SOUND_EFFECT,
                          { value: e.target.value.slice(0, 80) },
                          10
                        )
                      }
                      className="mt-2 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                    />
                  </div>

                  {[
                    {
                      id: 'q22',
                      key: QUESTION_KEYS.Q22_TRAILER_LINE,
                      val: trailerLine,
                      label: 'Q22. Movie-trailer voiceover line for their life',
                      placeholder: '"In a world where homework exists, one legend refused..."',
                    },
                    {
                      id: 'q23',
                      key: QUESTION_KEYS.Q23_VILLAIN_ORIGIN,
                      val: villainOrigin,
                      label: 'Q23. Villain origin story (one line)',
                      placeholder: 'How did they become this way?',
                    },
                    {
                      id: 'q24',
                      key: QUESTION_KEYS.Q24_EXCUSE_HALL,
                      val: excuseHall,
                      label: 'Q24. Excuse hall of fame (best excuse they ever gave)',
                      placeholder: 'e.g. "Ma’am the stray cow blocked our gate."',
                    },
                  ].map((field) => (
                    <div key={field.id}>
                      <label htmlFor={field.id} className="font-typewriter block text-sm font-bold">
                        {field.label}
                      </label>
                      <input
                        id={field.id}
                        type="text"
                        maxLength={TEXT_LIMITS.SHORT}
                        placeholder={field.placeholder}
                        value={field.val}
                        onChange={(e) =>
                          setResponse(
                            subjectId,
                            field.key,
                            { value: e.target.value.slice(0, TEXT_LIMITS.SHORT) },
                            10
                          )
                        }
                        className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
                      />
                    </div>
                  ))}

                  <div>
                    <label htmlFor="q25-funniest" className="font-typewriter block text-sm font-bold">
                      Q25. Funniest moment with {subject.label} (used for the manga!)
                    </label>
                    <textarea
                      id="q25-funniest"
                      rows={4}
                      maxLength={TEXT_LIMITS.LONG}
                      placeholder="Tell the full story in English, Hindi, or Hinglish..."
                      value={funniestMoment}
                      onChange={(e) =>
                        setResponse(
                          subjectId,
                          QUESTION_KEYS.Q25_FUNNIEST_MOMENT,
                          { value: e.target.value.slice(0, TEXT_LIMITS.LONG) },
                          20
                        )
                      }
                      className="mt-1.5 w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3 text-sm"
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <p
                  role="alert"
                  className="mt-4 rounded border-2 border-[var(--stamp-red)] bg-[var(--paper)] p-2.5 text-xs font-bold text-[var(--stamp-red)]"
                >
                  {errorMsg}
                </p>
              )}

              {/* Step Footer Nav */}
              <div className="mt-6 flex flex-col-reverse gap-2.5 border-t-2 border-dashed border-[var(--border-ink)]/35 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    if (step > 1) {
                      setStep((s) => s - 1);
                      void playSound('rustle');
                    } else {
                      setStage('familiarity');
                    }
                  }}
                  className="tactile-btn inline-flex items-center justify-center gap-1.5 rounded-md bg-[var(--paper)] px-4 py-2.5 text-sm font-bold"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="tactile-btn btn-sheen inline-flex items-center justify-center gap-2 rounded-md bg-[var(--stamp-red)] px-6 py-2.5 text-sm font-bold text-white"
                >
                  {step < 5 ? (
                    <>
                      Next Step ({step + 1}/5) <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Stamp &amp; File Case!
                    </>
                  )}
                </button>
              </div>
            </NotebookCard>
          </motion.div>
        )}

        {/* Stage 3: Filed Celebration Screen */}
        {stage === 'filed_done' && (
          <motion.div
            key="filed-done"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <NotebookCard className="text-center">
              <div className="my-2 flex justify-center">
                <Stamp text="CASE FILED" color="green" size="lg" animateSlam rotate={-5} />
              </div>
              <h1 className="font-typewriter mt-3 text-2xl font-bold sm:text-3xl">
                {subject.label}&apos;s Dossier Sealed!
              </h1>
              <p className="font-typewriter mt-2 text-base text-[var(--ink-muted)]">
                &ldquo;{narratorReaction}&rdquo;
              </p>

              <div className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-[var(--border-ink)] bg-[var(--highlighter)] px-4 py-1.5 font-mono-doc text-sm font-bold text-[#1B1B1B]">
                <Sparkles className="h-4 w-4" /> +50 XP Earned
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/desk"
                  className="tactile-btn inline-flex items-center justify-center rounded-md bg-[var(--paper)] px-5 py-3 text-sm font-bold"
                >
                  Back to Case Desk
                </Link>
                {nextClassmate ? (
                  <button
                    type="button"
                    onClick={() => {
                      void playSound('rustle');
                      router.push(`/case/${nextClassmate.id}`);
                    }}
                    className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--blueprint)] px-6 py-3 text-sm font-bold text-white"
                  >
                    Next Case: {nextClassmate.label} <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <Link
                    href="/awards"
                    className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--stamp-red)] px-6 py-3 text-sm font-bold text-white"
                  >
                    Go to Awards Podium →
                  </Link>
                )}
              </div>
            </NotebookCard>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function filedCountSeed(meta: Record<string, { status: string }>): number {
  return Object.values(meta).filter((m) => m.status === 'filed').length;
}
