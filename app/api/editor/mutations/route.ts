import { NextResponse } from 'next/server';
import {
  getSupabaseAdminClient,
  isEditorAuthorizedOnServer,
  isServerSupabaseConfigured,
} from '@/lib/editorAuth';
import type { EditorNoteRow, EditorPickRow, FamiliarityWeights } from '@/lib/exports';

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 400 });
  }

  const authorized = await isEditorAuthorizedOnServer();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is missing on the server.' },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as
      | { action: 'save_pick'; payload: EditorPickRow }
      | { action: 'save_note'; payload: EditorNoteRow }
      | { action: 'save_weights'; payload: FamiliarityWeights };

    if (body.action === 'save_pick') {
      const pick = body.payload;
      const { error } = await supabase.from('editor_picks').upsert(
        {
          entry_id: pick.entry_id,
          target_type: pick.target_type,
          picked: pick.picked,
          edited_text: pick.edited_text,
          used_in: pick.used_in,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'entry_id' }
      );
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'save_note') {
      const note = body.payload;
      const { error } = await supabase.from('editor_notes').upsert(
        {
          subject_roster_id: note.subject_roster_id,
          note: note.note,
          pseudo_latin_binomial: note.pseudo_latin_binomial || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'subject_roster_id' }
      );
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'save_weights') {
      const weights = body.payload;
      const { error } = await supabase.from('editor_settings').upsert(
        {
          id: 1,
          familiarity_weights: weights,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }
}
