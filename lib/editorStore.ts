'use client';

import {
  type EditorDataset,
  type EditorNoteRow,
  type EditorPickRow,
  type FamiliarityWeights,
} from '@/lib/exports';
import type { ArchiveDispatchStatus } from '@/lib/serverEditorData';
import { isSupabaseConfigured } from '@/lib/supabase/client';

const DEMO_PICKS_STORAGE_KEY = 'casefile23-demo-editor-overrides';

export async function loadEditorDataset(): Promise<{
  dataset: EditorDataset;
  source: 'supabase' | 'demo';
  signedUrls: Record<string, string>;
  dispatchStatus?: ArchiveDispatchStatus;
}> {
  if (isSupabaseConfigured()) {
    const res = await fetch('/api/editor/dataset', { cache: 'no-store' });
    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(errJson.error || `Failed to load Supabase dataset (${res.status}).`);
    }
    const data = (await res.json()) as {
      dataset: EditorDataset;
      signedUrls?: Record<string, string>;
      dispatchStatus?: ArchiveDispatchStatus;
    };
    return {
      source: 'supabase',
      dataset: data.dataset,
      signedUrls: data.signedUrls ?? {},
      dispatchStatus: data.dispatchStatus,
    };
  }

  // Fallback: load /demo-seed.json when Supabase is not configured
  const res = await fetch('/demo-seed.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Demo seed data not found. Run `npm run seed` to generate public/demo-seed.json.');
  }
  const base = (await res.json()) as EditorDataset;
  const overridesRaw =
    typeof window !== 'undefined' ? localStorage.getItem(DEMO_PICKS_STORAGE_KEY) : null;
  if (overridesRaw) {
    try {
      const ov = JSON.parse(overridesRaw) as {
        picks?: Record<string, EditorPickRow>;
        notes?: Record<string, EditorNoteRow>;
        weights?: FamiliarityWeights;
      };
      return {
        source: 'demo',
        signedUrls: {},
        dataset: {
          ...base,
          picks: { ...base.picks, ...(ov.picks ?? {}) },
          notes: { ...base.notes, ...(ov.notes ?? {}) },
          weights: ov.weights ?? base.weights,
        },
      };
    } catch {
      // Ignore malformed local override
    }
  }
  return { source: 'demo', dataset: base, signedUrls: {} };
}

async function postEditorMutation(
  action: 'save_pick' | 'save_note' | 'save_weights',
  payload: EditorPickRow | EditorNoteRow | FamiliarityWeights
): Promise<void> {
  const res = await fetch('/api/editor/mutations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    const errJson = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(errJson.error || 'Failed to save editor update.');
  }
}

export async function saveEditorPick(
  pick: EditorPickRow,
  source: 'supabase' | 'demo'
): Promise<void> {
  if (source === 'supabase' && isSupabaseConfigured()) {
    await postEditorMutation('save_pick', pick);
    return;
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(DEMO_PICKS_STORAGE_KEY);
    const cur = raw ? JSON.parse(raw) : {};
    cur.picks = { ...(cur.picks ?? {}), [pick.entry_id]: pick };
    localStorage.setItem(DEMO_PICKS_STORAGE_KEY, JSON.stringify(cur));
  }
}

export async function saveEditorNote(
  note: EditorNoteRow,
  source: 'supabase' | 'demo'
): Promise<void> {
  if (source === 'supabase' && isSupabaseConfigured()) {
    await postEditorMutation('save_note', note);
    return;
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(DEMO_PICKS_STORAGE_KEY);
    const cur = raw ? JSON.parse(raw) : {};
    cur.notes = { ...(cur.notes ?? {}), [note.subject_roster_id]: note };
    localStorage.setItem(DEMO_PICKS_STORAGE_KEY, JSON.stringify(cur));
  }
}

export async function saveFamiliarityWeights(
  weights: FamiliarityWeights,
  source: 'supabase' | 'demo'
): Promise<void> {
  if (source === 'supabase' && isSupabaseConfigured()) {
    await postEditorMutation('save_weights', weights);
    return;
  }

  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(DEMO_PICKS_STORAGE_KEY);
    const cur = raw ? JSON.parse(raw) : {};
    cur.weights = weights;
    localStorage.setItem(DEMO_PICKS_STORAGE_KEY, JSON.stringify(cur));
  }
}
