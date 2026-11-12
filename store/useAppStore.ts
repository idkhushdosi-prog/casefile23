'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { generateSeed } from '@/lib/shuffle';
import { generateUuid } from '@/lib/crypto';
import type { FamiliarityOptionId } from '@/data/questions';

export type CaseStatus = 'unopened' | 'in_progress' | 'filed' | 'skipped';
export type SyncStatus = 'saved' | 'syncing' | 'offline' | 'error';

export interface ContributorProfile {
  id: string; // auth.uid() or local temp uuid before Supabase auth
  rosterId: string;
  scholarNumber: string;
  firstNameCaps: string;
  middleNameCaps: string;
  lastNameCaps: string;
  fullNameCaps: string;
  consentPortrait: boolean;
  shuffleSeed: number;
  xp: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'in_progress' | 'submitted';
}

export interface CaseMetaRecord {
  subjectRosterId: string;
  familiarity: FamiliarityOptionId | null;
  status: CaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export type ResponseMap = Record<string, Record<string, Record<string, unknown>>>;

export interface SkipRecord {
  subjectRosterId: string;
  reasonChoice: string;
  reasonText: string;
  createdAt: string;
}

export interface ArchiveEntryRecord {
  id: string;
  sectionKey: string;
  content: Record<string, unknown>;
  taggedRosterId?: string | null;
  updatedAt: string;
}

export interface AnythingElseRecord {
  id: string;
  taggedRosterId: string | null; // null = Whole class
  body: string;
  isEditorNote?: boolean;
  uploadId?: string | null;
  createdAt: string;
}

export interface UploadRecord {
  id: string;
  kind: 'portrait' | 'mugshot' | 'worst_face' | 'chaos' | 'extra';
  storagePath: string;
  previewDataUrl?: string;
  caption: string;
  photoType?: string;
  taggedRosterIds: string[];
  sha256Hash?: string;
  width: number;
  height: number;
  isLowRes?: boolean;
  synced: boolean;
  error?: string | null;
  createdAt: string;
}

export interface SyncTask {
  key: string; // coalescing key
  type:
    | 'upsert_contributor'
    | 'upsert_case_meta'
    | 'upsert_response'
    | 'upsert_skip'
    | 'delete_skip'
    | 'upsert_award'
    | 'upsert_archive'
    | 'delete_archive'
    | 'upsert_anything_else'
    | 'delete_anything_else'
    | 'upsert_upload';
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: string;
}

export interface XpFloatEvent {
  id: string;
  amount: number;
  label: string;
}

interface AppState {
  // Preferences
  theme: 'light' | 'night';
  sepiaMode: boolean;
  soundMuted: boolean;

  // Contributor & session
  contributor: ContributorProfile | null;
  caseMeta: Record<string, CaseMetaRecord>;
  responses: ResponseMap;
  skips: Record<string, SkipRecord>;
  awards: Record<string, string>;
  archiveEntries: Record<string, ArchiveEntryRecord[]>;
  anythingElse: AnythingElseRecord[];
  editorNote: string;
  uploads: UploadRecord[];
  unlockedBadges: string[];
  milestonesShown: number[];
  awardedResponseXpKeys: string[];

  // Sync & UI
  syncQueue: SyncTask[];
  syncStatus: SyncStatus;
  lastSavedAt: string | null;
  xpFloats: XpFloatEvent[];
  badgePopQueue: string[];

  // Actions
  setTheme: (theme: 'light' | 'night') => void;
  toggleTheme: () => void;
  toggleSepiaMode: () => void;
  setSoundMuted: (muted: boolean) => void;
  toggleSoundMuted: () => void;

  setContributor: (profile: ContributorProfile) => void;
  updateContributorFields: (patch: Partial<ContributorProfile>) => void;
  setContributorId: (id: string) => void;

  touchCaseStarted: (subjectRosterId: string) => void;
  setCaseFamiliarity: (subjectRosterId: string, familiarity: FamiliarityOptionId) => void;
  setCaseStatus: (subjectRosterId: string, status: CaseStatus) => void;
  setResponse: (
    subjectRosterId: string,
    questionKey: string,
    answer: Record<string, unknown>,
    xpBonus?: number
  ) => void;
  skipSubject: (subjectRosterId: string, reasonChoice: string, reasonText: string) => void;
  reopenSkippedSubject: (subjectRosterId: string) => void;

  setAwardVote: (awardKey: string, votedRosterId: string) => void;
  setArchiveSectionEntries: (sectionKey: string, entries: ArchiveEntryRecord[]) => void;
  addAnythingElse: (entry: AnythingElseRecord) => void;
  removeAnythingElse: (id: string) => void;
  setEditorNote: (note: string) => void;

  upsertUpload: (upload: UploadRecord) => void;
  removeUpload: (id: string) => void;

  awardXp: (amount: number, label: string, onceKey?: string) => void;
  dismissXpFloat: (id: string) => void;
  unlockBadges: (badgeIds: string[]) => void;
  dismissBadgePop: () => void;
  markMilestoneShown: (count: number) => void;

  enqueueSync: (task: Omit<SyncTask, 'attempts' | 'createdAt'>) => void;
  removeSyncTask: (key: string) => void;
  markSyncTaskFailed: (key: string) => void;
  setSyncStatus: (status: SyncStatus) => void;
  resetAllLocal: () => void;
}

const initialState = {
  theme: 'light' as const,
  sepiaMode: false,
  soundMuted: true, // Strictly muted by default per browser autoplay rules & checklist #11
  contributor: null,
  caseMeta: {},
  responses: {},
  skips: {},
  awards: {},
  archiveEntries: {},
  anythingElse: [],
  editorNote: '',
  uploads: [],
  unlockedBadges: [],
  milestonesShown: [],
  awardedResponseXpKeys: [],
  syncQueue: [],
  syncStatus: 'saved' as SyncStatus,
  lastSavedAt: null,
  xpFloats: [],
  badgePopQueue: [],
};

function makeLocalUuid(): string {
  return generateUuid();
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'night' : 'light' })),
      toggleSepiaMode: () => set((s) => ({ sepiaMode: !s.sepiaMode })),
      setSoundMuted: (soundMuted) => set({ soundMuted }),
      toggleSoundMuted: () => set((s) => ({ soundMuted: !s.soundMuted })),

      setContributor: (profile) => {
        const now = new Date().toISOString();
        set({ contributor: profile, lastSavedAt: now });
        get().enqueueSync({
          key: 'contributor',
          type: 'upsert_contributor',
          payload: profile as unknown as Record<string, unknown>,
        });
      },

      updateContributorFields: (patch) => {
        const current = get().contributor;
        if (!current) return;
        const updated: ContributorProfile = {
          ...current,
          ...patch,
          shuffleSeed: current.shuffleSeed || generateSeed(),
        };
        set({ contributor: updated, lastSavedAt: new Date().toISOString() });
        get().enqueueSync({
          key: 'contributor',
          type: 'upsert_contributor',
          payload: updated as unknown as Record<string, unknown>,
        });
      },

      setContributorId: (id) => {
        const current = get().contributor;
        if (!current || current.id === id) return;
        set({
          contributor: { ...current, id },
        });
      },

      touchCaseStarted: (subjectRosterId) => {
        const existing = get().caseMeta[subjectRosterId];
        const now = new Date().toISOString();
        if (existing && existing.startedAt) return;
        const next: CaseMetaRecord = {
          subjectRosterId,
          familiarity: existing?.familiarity ?? null,
          status: existing?.status === 'filed' || existing?.status === 'skipped' ? existing.status : 'in_progress',
          startedAt: existing?.startedAt ?? now,
          completedAt: existing?.completedAt ?? null,
          updatedAt: now,
        };
        set((s) => ({
          caseMeta: { ...s.caseMeta, [subjectRosterId]: next },
          lastSavedAt: now,
        }));
        get().enqueueSync({
          key: `case_meta:${subjectRosterId}`,
          type: 'upsert_case_meta',
          payload: next as unknown as Record<string, unknown>,
        });
      },

      setCaseFamiliarity: (subjectRosterId, familiarity) => {
        const existing = get().caseMeta[subjectRosterId];
        const now = new Date().toISOString();
        const next: CaseMetaRecord = {
          subjectRosterId,
          familiarity,
          status:
            existing?.status === 'filed'
              ? 'filed'
              : 'in_progress',
          startedAt: existing?.startedAt ?? now,
          completedAt: existing?.completedAt ?? null,
          updatedAt: now,
        };
        set((s) => ({
          caseMeta: { ...s.caseMeta, [subjectRosterId]: next },
          lastSavedAt: now,
        }));
        get().enqueueSync({
          key: `case_meta:${subjectRosterId}`,
          type: 'upsert_case_meta',
          payload: next as unknown as Record<string, unknown>,
        });
      },

      setCaseStatus: (subjectRosterId, status) => {
        const existing = get().caseMeta[subjectRosterId];
        const now = new Date().toISOString();
        const next: CaseMetaRecord = {
          subjectRosterId,
          familiarity: existing?.familiarity ?? null,
          status,
          startedAt: existing?.startedAt ?? now,
          completedAt: status === 'filed' ? existing?.completedAt ?? now : existing?.completedAt ?? null,
          updatedAt: now,
        };
        set((s) => ({
          caseMeta: { ...s.caseMeta, [subjectRosterId]: next },
          lastSavedAt: now,
        }));
        get().enqueueSync({
          key: `case_meta:${subjectRosterId}`,
          type: 'upsert_case_meta',
          payload: next as unknown as Record<string, unknown>,
        });
      },

      setResponse: (subjectRosterId, questionKey, answer, xpBonus = 0) => {
        const contributor = get().contributor;
        if (contributor && contributor.rosterId === subjectRosterId) {
          // Hard client-side guard against self-writing
          return;
        }
        const now = new Date().toISOString();
        set((s) => {
          const subjectMap = s.responses[subjectRosterId] ?? {};
          return {
            responses: {
              ...s.responses,
              [subjectRosterId]: {
                ...subjectMap,
                [questionKey]: answer,
              },
            },
            lastSavedAt: now,
          };
        });
        get().enqueueSync({
          key: `response:${subjectRosterId}:${questionKey}`,
          type: 'upsert_response',
          payload: { subjectRosterId, questionKey, answer },
        });
        if (xpBonus > 0) {
          get().awardXp(xpBonus, 'Field Notes', `resp:${subjectRosterId}:${questionKey}`);
        }
      },

      skipSubject: (subjectRosterId, reasonChoice, reasonText) => {
        const contributor = get().contributor;
        if (contributor && contributor.rosterId === subjectRosterId) return;
        const now = new Date().toISOString();
        const skipObj: SkipRecord = {
          subjectRosterId,
          reasonChoice,
          reasonText,
          createdAt: now,
        };
        const existingMeta = get().caseMeta[subjectRosterId];
        const nextMeta: CaseMetaRecord = {
          subjectRosterId,
          familiarity: existingMeta?.familiarity ?? 'barely_spoken',
          status: 'skipped',
          startedAt: existingMeta?.startedAt ?? now,
          completedAt: now,
          updatedAt: now,
        };
        set((s) => ({
          skips: { ...s.skips, [subjectRosterId]: skipObj },
          caseMeta: { ...s.caseMeta, [subjectRosterId]: nextMeta },
          lastSavedAt: now,
        }));
        get().enqueueSync({
          key: `skip:${subjectRosterId}`,
          type: 'upsert_skip',
          payload: skipObj as unknown as Record<string, unknown>,
        });
        get().enqueueSync({
          key: `case_meta:${subjectRosterId}`,
          type: 'upsert_case_meta',
          payload: nextMeta as unknown as Record<string, unknown>,
        });
      },

      reopenSkippedSubject: (subjectRosterId) => {
        const existingMeta = get().caseMeta[subjectRosterId];
        const now = new Date().toISOString();
        const nextMeta: CaseMetaRecord = {
          subjectRosterId,
          familiarity: existingMeta?.familiarity ?? null,
          status: 'in_progress',
          startedAt: existingMeta?.startedAt ?? now,
          completedAt: null,
          updatedAt: now,
        };
        set((s) => {
          const nextSkips = { ...s.skips };
          delete nextSkips[subjectRosterId];
          return {
            skips: nextSkips,
            caseMeta: { ...s.caseMeta, [subjectRosterId]: nextMeta },
            lastSavedAt: now,
          };
        });
        get().enqueueSync({
          key: `skip:${subjectRosterId}`,
          type: 'delete_skip',
          payload: { subjectRosterId },
        });
        get().enqueueSync({
          key: `case_meta:${subjectRosterId}`,
          type: 'upsert_case_meta',
          payload: nextMeta as unknown as Record<string, unknown>,
        });
      },

      setAwardVote: (awardKey, votedRosterId) => {
        const contributor = get().contributor;
        if (contributor && contributor.rosterId === votedRosterId) return;
        const now = new Date().toISOString();
        const alreadyVoted = Boolean(get().awards[awardKey]);
        set((s) => ({
          awards: { ...s.awards, [awardKey]: votedRosterId },
          lastSavedAt: now,
        }));
        get().enqueueSync({
          key: `award:${awardKey}`,
          type: 'upsert_award',
          payload: { awardKey, votedRosterId },
        });
        if (!alreadyVoted) {
          get().awardXp(15, 'Award Vote', `award:${awardKey}`);
        }
      },

      setArchiveSectionEntries: (sectionKey, entries) => {
        const now = new Date().toISOString();
        const prev = get().archiveEntries[sectionKey] ?? [];
        const nextIds = new Set(entries.map((e) => e.id));
        const deleted = prev.filter((p) => !nextIds.has(p.id));

        set((s) => ({
          archiveEntries: { ...s.archiveEntries, [sectionKey]: entries },
          lastSavedAt: now,
        }));

        for (const d of deleted) {
          get().enqueueSync({
            key: `archive:${d.id}`,
            type: 'delete_archive',
            payload: { id: d.id },
          });
        }
        for (const e of entries) {
          get().enqueueSync({
            key: `archive:${e.id}`,
            type: 'upsert_archive',
            payload: e as unknown as Record<string, unknown>,
          });
        }
      },

      addAnythingElse: (entry) => {
        const now = new Date().toISOString();
        set((s) => ({
          anythingElse: [entry, ...s.anythingElse],
          lastSavedAt: now,
        }));
        get().enqueueSync({
          key: `extra:${entry.id}`,
          type: 'upsert_anything_else',
          payload: entry as unknown as Record<string, unknown>,
        });
        get().awardXp(20, 'Wild Card Entry', `extra:${entry.id}`);
      },

      removeAnythingElse: (id) => {
        set((s) => ({
          anythingElse: s.anythingElse.filter((e) => e.id !== id),
          lastSavedAt: new Date().toISOString(),
        }));
        get().enqueueSync({
          key: `extra:${id}`,
          type: 'delete_anything_else',
          payload: { id },
        });
      },

      setEditorNote: (editorNote) => {
        const now = new Date().toISOString();
        set({ editorNote, lastSavedAt: now });
        const fixedNoteId = '00000000-0000-4000-8000-000000000001';
        const contrib = get().contributor;
        // Deterministic UUID per contributor if available, else local UUID stored in payload
        const noteEntry: AnythingElseRecord = {
          id: contrib?.id ? `${contrib.id.slice(0, 24)}000000000001` : fixedNoteId,
          taggedRosterId: null,
          body: editorNote,
          isEditorNote: true,
          createdAt: now,
        };
        if (editorNote.trim().length > 0) {
          get().enqueueSync({
            key: 'extra:editor_note',
            type: 'upsert_anything_else',
            payload: noteEntry as unknown as Record<string, unknown>,
          });
        }
      },

      upsertUpload: (upload) => {
        const now = new Date().toISOString();
        set((s) => {
          // For portrait, mugshot, worst_face keep latest per kind; for chaos/extra match by id
          const isSingleKind =
            upload.kind === 'portrait' ||
            upload.kind === 'mugshot' ||
            upload.kind === 'worst_face';
          const filtered = s.uploads.filter((u) =>
            isSingleKind ? u.kind !== upload.kind : u.id !== upload.id
          );
          return {
            uploads: [upload, ...filtered],
            lastSavedAt: now,
          };
        });
        get().enqueueSync({
          key: `upload:${upload.id}`,
          type: 'upsert_upload',
          payload: {
            id: upload.id,
            kind: upload.kind,
            storagePath: upload.storagePath,
            caption: upload.caption,
            photoType: upload.photoType,
            taggedRosterIds: upload.taggedRosterIds,
            sha256Hash: upload.sha256Hash,
            width: upload.width,
            height: upload.height,
          },
        });
      },

      removeUpload: (id) => {
        set((s) => ({
          uploads: s.uploads.filter((u) => u.id !== id),
          lastSavedAt: new Date().toISOString(),
        }));
      },

      awardXp: (amount, label, onceKey) => {
        const state = get();
        if (onceKey && state.awardedResponseXpKeys.includes(onceKey)) {
          return;
        }
        const floatId = makeLocalUuid();
        set((s) => {
          const nextXp = (s.contributor?.xp ?? 0) + amount;
          const nextContrib = s.contributor
            ? { ...s.contributor, xp: nextXp }
            : null;
          return {
            contributor: nextContrib,
            awardedResponseXpKeys: onceKey
              ? [...s.awardedResponseXpKeys, onceKey]
              : s.awardedResponseXpKeys,
            xpFloats: [...s.xpFloats.slice(-4), { id: floatId, amount, label }],
          };
        });
        if (get().contributor) {
          get().enqueueSync({
            key: 'contributor',
            type: 'upsert_contributor',
            payload: get().contributor as unknown as Record<string, unknown>,
          });
        }
      },

      dismissXpFloat: (id) => {
        set((s) => ({ xpFloats: s.xpFloats.filter((f) => f.id !== id) }));
      },

      unlockBadges: (badgeIds) => {
        const existing = new Set(get().unlockedBadges);
        const newlyUnlocked = badgeIds.filter((id) => !existing.has(id));
        if (newlyUnlocked.length === 0) return;
        set((s) => ({
          unlockedBadges: [...s.unlockedBadges, ...newlyUnlocked],
          badgePopQueue: [...s.badgePopQueue, ...newlyUnlocked],
        }));
      },

      dismissBadgePop: () => {
        set((s) => ({ badgePopQueue: s.badgePopQueue.slice(1) }));
      },

      markMilestoneShown: (count) => {
        set((s) =>
          s.milestonesShown.includes(count)
            ? s
            : { milestonesShown: [...s.milestonesShown, count] }
        );
      },

      enqueueSync: (task) => {
        set((s) => {
          const rest = s.syncQueue.filter((t) => t.key !== task.key);
          return {
            syncQueue: [
              ...rest,
              {
                ...task,
                attempts: 0,
                createdAt: new Date().toISOString(),
              },
            ],
            syncStatus:
              typeof navigator !== 'undefined' && !navigator.onLine
                ? 'offline'
                : 'syncing',
          };
        });
      },

      removeSyncTask: (key) => {
        set((s) => {
          const nextQueue = s.syncQueue.filter((t) => t.key !== key);
          return {
            syncQueue: nextQueue,
            syncStatus:
              nextQueue.length === 0
                ? 'saved'
                : typeof navigator !== 'undefined' && !navigator.onLine
                ? 'offline'
                : s.syncStatus,
          };
        });
      },

      markSyncTaskFailed: (key) => {
        set((s) => ({
          syncQueue: s.syncQueue.map((t) =>
            t.key === key ? { ...t, attempts: t.attempts + 1 } : t
          ),
          syncStatus:
            typeof navigator !== 'undefined' && !navigator.onLine
              ? 'offline'
              : 'error',
        }));
      },

      setSyncStatus: (syncStatus) => set({ syncStatus }),

      resetAllLocal: () => set({ ...initialState }),
    }),
    {
      name: 'casefile23-store-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sepiaMode: state.sepiaMode,
        soundMuted: state.soundMuted,
        contributor: state.contributor,
        caseMeta: state.caseMeta,
        responses: state.responses,
        skips: state.skips,
        awards: state.awards,
        archiveEntries: state.archiveEntries,
        anythingElse: state.anythingElse,
        editorNote: state.editorNote,
        // Strip huge dataUrls from localStorage persistence if needed? Keeping small 420px preview thumbnails (~20KB each) is fine for portraits, cap chaos thumbnails in persistence if very numerous
        uploads: state.uploads.map((u, idx) =>
          idx > 15 && u.kind === 'chaos' ? { ...u, previewDataUrl: undefined } : u
        ),
        unlockedBadges: state.unlockedBadges,
        milestonesShown: state.milestonesShown,
        awardedResponseXpKeys: state.awardedResponseXpKeys,
        syncQueue: state.syncQueue,
        lastSavedAt: state.lastSavedAt,
      }),
    }
  )
);
