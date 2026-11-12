'use client';

import { ensureAnonymousSession, getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  useAppStore,
  type ArchiveEntryRecord,
  type AnythingElseRecord,
  type CaseMetaRecord,
  type ContributorProfile,
  type SkipRecord,
  type SyncTask,
} from '@/store/useAppStore';

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

export function scheduleSyncFlush(delayMs = 550): void {
  if (typeof window === 'undefined') return;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    void flushSyncQueue();
  }, delayMs);
}

export async function flushSyncQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (isFlushing) return;

  const store = useAppStore.getState();
  if (store.syncQueue.length === 0) {
    store.setSyncStatus('saved');
    return;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    store.setSyncStatus('offline');
    return;
  }

  if (!isSupabaseConfigured()) {
    // In local-only mode without Supabase configured, clear queue gracefully and report saved locally
    for (const task of [...store.syncQueue]) {
      store.removeSyncTask(task.key);
    }
    store.setSyncStatus('saved');
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  isFlushing = true;
  store.setSyncStatus('syncing');

  try {
    const uid = await ensureAnonymousSession();
    if (!uid) {
      store.setSyncStatus('error');
      return;
    }

    if (store.contributor && store.contributor.id !== uid) {
      store.setContributorId(uid);
    }

    // Ensure contributor row exists first if queued
    const ordered = [...useAppStore.getState().syncQueue].sort((a, b) => {
      if (a.type === 'upsert_contributor') return -1;
      if (b.type === 'upsert_contributor') return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });

    for (const task of ordered) {
      const ok = await executeTask(supabase, uid, task);
      if (ok) {
        useAppStore.getState().removeSyncTask(task.key);
      } else {
        useAppStore.getState().markSyncTaskFailed(task.key);
      }
    }
  } finally {
    isFlushing = false;
    const remaining = useAppStore.getState().syncQueue;
    if (remaining.length === 0) {
      useAppStore.getState().setSyncStatus('saved');
    }
  }
}

async function executeTask(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  uid: string,
  task: SyncTask
): Promise<boolean> {
  try {
    const p = task.payload;
    switch (task.type) {
      case 'upsert_contributor': {
        const c = p as unknown as ContributorProfile;
        const { error } = await supabase.from('contributors').upsert(
          {
            id: uid,
            roster_id: c.rosterId,
            scholar_number: c.scholarNumber,
            first_name_caps: c.firstNameCaps,
            middle_name_caps: c.middleNameCaps || null,
            last_name_caps: c.lastNameCaps,
            full_name_caps: c.fullNameCaps,
            consent_portrait: c.consentPortrait,
            shuffle_seed: c.shuffleSeed,
            xp: c.xp,
            started_at: c.startedAt,
            finished_at: c.finishedAt,
            status: c.status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
        return !error;
      }

      case 'upsert_case_meta': {
        const m = p as unknown as CaseMetaRecord;
        const { error } = await supabase.from('case_meta').upsert(
          {
            contributor_id: uid,
            subject_roster_id: m.subjectRosterId,
            familiarity: m.familiarity,
            status: m.status,
            started_at: m.startedAt,
            completed_at: m.completedAt,
            updated_at: m.updatedAt,
          },
          { onConflict: 'contributor_id,subject_roster_id' }
        );
        return !error;
      }

      case 'upsert_response': {
        const { subjectRosterId, questionKey, answer } = p as {
          subjectRosterId: string;
          questionKey: string;
          answer: Record<string, unknown>;
        };
        const { error } = await supabase.from('responses').upsert(
          {
            contributor_id: uid,
            subject_roster_id: subjectRosterId,
            question_key: questionKey,
            answer,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'contributor_id,subject_roster_id,question_key' }
        );
        return !error;
      }

      case 'upsert_skip': {
        const s = p as unknown as SkipRecord;
        const { error } = await supabase.from('skips').upsert(
          {
            contributor_id: uid,
            subject_roster_id: s.subjectRosterId,
            reason_choice: s.reasonChoice,
            reason_text: s.reasonText || null,
          },
          { onConflict: 'contributor_id,subject_roster_id' }
        );
        return !error;
      }

      case 'delete_skip': {
        const { subjectRosterId } = p as { subjectRosterId: string };
        const { error } = await supabase
          .from('skips')
          .delete()
          .eq('contributor_id', uid)
          .eq('subject_roster_id', subjectRosterId);
        return !error;
      }

      case 'upsert_award': {
        const { awardKey, votedRosterId } = p as {
          awardKey: string;
          votedRosterId: string;
        };
        const { error } = await supabase.from('awards').upsert(
          {
            contributor_id: uid,
            award_key: awardKey,
            voted_roster_id: votedRosterId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'contributor_id,award_key' }
        );
        return !error;
      }

      case 'upsert_archive': {
        const entry = p as unknown as ArchiveEntryRecord;
        const { error } = await supabase.from('archive_entries').upsert(
          {
            id: entry.id,
            contributor_id: uid,
            section_key: entry.sectionKey,
            content: entry.content,
            tagged_roster_id: entry.taggedRosterId || null,
            updated_at: entry.updatedAt,
          },
          { onConflict: 'id' }
        );
        return !error;
      }

      case 'delete_archive': {
        const { id } = p as { id: string };
        const { error } = await supabase
          .from('archive_entries')
          .delete()
          .eq('id', id)
          .eq('contributor_id', uid);
        return !error;
      }

      case 'upsert_anything_else': {
        const item = p as unknown as AnythingElseRecord;
        const { error } = await supabase.from('anything_else').upsert(
          {
            id: item.id,
            contributor_id: uid,
            tagged_roster_id: item.taggedRosterId || null,
            body: item.body,
            is_editor_note: Boolean(item.isEditorNote),
          },
          { onConflict: 'id' }
        );
        return !error;
      }

      case 'delete_anything_else': {
        const { id } = p as { id: string };
        const { error } = await supabase
          .from('anything_else')
          .delete()
          .eq('id', id)
          .eq('contributor_id', uid);
        return !error;
      }

      case 'upsert_upload': {
        const u = p as {
          id: string;
          kind: string;
          storagePath: string;
          caption?: string;
          photoType?: string;
          taggedRosterIds: string[];
          sha256Hash?: string;
          width: number;
          height: number;
        };
        const { error } = await supabase.from('uploads').upsert(
          {
            id: u.id,
            contributor_id: uid,
            kind: u.kind,
            storage_path: u.storagePath,
            caption: u.caption || null,
            photo_type: u.photoType || null,
            tagged_roster_ids: u.taggedRosterIds,
            sha256_hash: u.sha256Hash || null,
            width: u.width,
            height: u.height,
          },
          { onConflict: 'id' }
        );
        return !error;
      }

      default:
        return true;
    }
  } catch {
    return false;
  }
}

export async function uploadImageToSupabase(params: {
  blob: Blob;
  folder: 'portraits' | 'chaos' | 'extra';
  filename: string;
  mimeType: string;
}): Promise<{ storagePath: string; uploaded: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  const localUid = useAppStore.getState().contributor?.id || 'local-witness';

  if (!supabase) {
    return {
      storagePath: `${params.folder}/${localUid}/${params.filename}`,
      uploaded: false,
    };
  }

  const uid = (await ensureAnonymousSession()) || localUid;
  const storagePath = `${params.folder}/${uid}/${params.filename}`;

  const { error } = await supabase.storage.from('keepsake').upload(storagePath, params.blob, {
    contentType: params.mimeType,
    upsert: true,
  });

  if (error) {
    return {
      storagePath,
      uploaded: false,
      error: error.message,
    };
  }

  return {
    storagePath,
    uploaded: true,
  };
}
