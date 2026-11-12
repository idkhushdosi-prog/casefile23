import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_FAMILIARITY_WEIGHTS,
  type EditorDataset,
  type EditorNoteRow,
  type EditorPickRow,
  type FamiliarityWeights,
} from '@/lib/exports';

export interface ArchiveDispatchStatus {
  dispatched_for_count: number;
  status: 'idle' | 'sending' | 'sent' | 'failed';
  recipient_email: string | null;
  storage_zip_path: string | null;
  error_message: string | null;
  dispatched_at: string | null;
}

export async function loadServerEditorDataset(supabase: SupabaseClient): Promise<{
  dataset: EditorDataset;
  dispatchStatus: ArchiveDispatchStatus;
}> {
  const [
    contribRes,
    respRes,
    metaRes,
    skipRes,
    awardRes,
    archRes,
    extraRes,
    uploadRes,
    pickRes,
    noteRes,
    settingsRes,
    dispatchRes,
  ] = await Promise.all([
    supabase.from('contributors').select('*'),
    supabase.from('responses').select('*'),
    supabase.from('case_meta').select('*'),
    supabase.from('skips').select('*'),
    supabase.from('awards').select('*'),
    supabase.from('archive_entries').select('*'),
    supabase.from('anything_else').select('*'),
    supabase.from('uploads').select('*'),
    supabase.from('editor_picks').select('*'),
    supabase.from('editor_notes').select('*'),
    supabase.from('editor_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('archive_dispatches').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (contribRes.error) {
    if (
      contribRes.error.code === 'PGRST205' ||
      contribRes.error.code === '42P01' ||
      contribRes.error.message.includes('Could not find the table')
    ) {
      throw new Error(
        'Database tables have not been created yet. Open Supabase SQL Editor, run supabase/schema.sql, then click Retry.'
      );
    }
    throw new Error(`Supabase query failed: ${contribRes.error.message}`);
  }

  const picks: Record<string, EditorPickRow> = {};
  for (const row of pickRes.data ?? []) {
    picks[row.entry_id] = {
      entry_id: row.entry_id,
      target_type: row.target_type,
      picked: Boolean(row.picked),
      edited_text: row.edited_text,
      used_in: Array.isArray(row.used_in) ? row.used_in : [],
    };
  }

  const notes: Record<string, EditorNoteRow> = {};
  for (const row of noteRes.data ?? []) {
    notes[row.subject_roster_id] = {
      subject_roster_id: row.subject_roster_id,
      note: row.note || '',
      pseudo_latin_binomial: row.pseudo_latin_binomial || '',
    };
  }

  const weights: FamiliarityWeights =
    (settingsRes.data?.familiarity_weights as FamiliarityWeights) ??
    DEFAULT_FAMILIARITY_WEIGHTS;

  const dispatchRow = dispatchRes.data;
  const dispatchStatus: ArchiveDispatchStatus = {
    dispatched_for_count: dispatchRow?.dispatched_for_count ?? 0,
    status: (dispatchRow?.status as ArchiveDispatchStatus['status']) ?? 'idle',
    recipient_email: dispatchRow?.recipient_email ?? null,
    storage_zip_path: dispatchRow?.storage_zip_path ?? null,
    error_message: dispatchRow?.error_message ?? null,
    dispatched_at: dispatchRow?.dispatched_at ?? null,
  };

  return {
    dataset: {
      contributors: contribRes.data ?? [],
      responses: respRes.data ?? [],
      caseMeta: metaRes.data ?? [],
      skips: skipRes.data ?? [],
      awards: awardRes.data ?? [],
      archiveEntries: archRes.data ?? [],
      anythingElse: extraRes.data ?? [],
      uploads: uploadRes.data ?? [],
      picks,
      notes,
      weights,
    },
    dispatchStatus,
  };
}
