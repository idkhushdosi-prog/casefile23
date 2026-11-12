import { NextResponse } from 'next/server';
import {
  getSupabaseAdminClient,
  isEditorAuthorizedOnServer,
  isServerSupabaseConfigured,
} from '@/lib/editorAuth';
import { loadServerEditorDataset } from '@/lib/serverEditorData';

export const dynamic = 'force-dynamic';

export async function GET() {
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

  let dataset;
  let dispatchStatus;
  try {
    const loaded = await loadServerEditorDataset(supabase);
    dataset = loaded.dataset;
    dispatchStatus = loaded.dispatchStatus;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load Supabase dataset.';
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const signedUrls: Record<string, string> = {};
  const paths = dataset.uploads.map((u) => u.storage_path).filter(Boolean);
  if (paths.length > 0) {
    const { data: signedData } = await supabase.storage
      .from('keepsake')
      .createSignedUrls(paths, 3600);
    if (Array.isArray(signedData)) {
      for (const item of signedData) {
        if (item.path && item.signedUrl) signedUrls[item.path] = item.signedUrl;
      }
    }
  }

  return NextResponse.json({
    dataset,
    signedUrls,
    dispatchStatus,
  });
}
