import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import {
  getArchiveNotifyEmail,
  getEmailTransportStatus,
  getSupabaseAdminClient,
  isEditorAuthorizedOnServer,
  isServerSupabaseConfigured,
} from '@/lib/editorAuth';
import { sendCompleteArchiveEmail } from '@/lib/emailArchive';
import type { EditorDataset } from '@/lib/exports';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

function isValidDemoDataset(candidate: unknown): candidate is EditorDataset {
  if (!candidate || typeof candidate !== 'object') return false;
  const obj = candidate as Record<string, unknown>;
  return Array.isArray(obj.contributors) && Array.isArray(obj.responses);
}

export async function POST(request: Request) {
  const authorized = await isEditorAuthorizedOnServer();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(`editor-send-archive:${ip}`, 5, 60_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many email requests. Please wait a minute before retrying.' },
      { status: 429 }
    );
  }

  const recipient = getArchiveNotifyEmail();
  const transportStatus = getEmailTransportStatus();
  if (!recipient || !transportStatus.provider) {
    const missing: string[] = [];
    if (!recipient) missing.push('ARCHIVE_NOTIFY_EMAIL');
    if (!transportStatus.provider) {
      missing.push('RESEND_API_KEY (or SMTP_USER + SMTP_PASS)');
    }
    return NextResponse.json(
      {
        error: `Email delivery is not configured on the server. Missing: ${missing.join(', ')}.`,
      },
      { status: 400 }
    );
  }

  const supabaseConfigured = isServerSupabaseConfigured();
  const supabase = supabaseConfigured ? getSupabaseAdminClient() : null;

  if (supabaseConfigured && !supabase) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is missing on the server.' },
      { status: 500 }
    );
  }

  let body: { demoDataset?: unknown } = {};
  try {
    body = (await request.json()) as { demoDataset?: unknown };
  } catch {
    body = {};
  }

  let datasetOverride: EditorDataset | undefined;
  if (!supabaseConfigured) {
    if (isValidDemoDataset(body.demoDataset)) {
      datasetOverride = body.demoDataset;
    } else {
      const seedPath = path.join(process.cwd(), 'public', 'demo-seed.json');
      const rawSeed = await fs.readFile(seedPath, 'utf8');
      datasetOverride = JSON.parse(rawSeed) as EditorDataset;
    }
  }

  try {
    const result = await sendCompleteArchiveEmail({
      trigger: 'manual_editor',
      datasetOverride,
    });

    if (supabase) {
      const sentAt = new Date().toISOString();
      await supabase.from('archive_dispatches').upsert(
        {
          id: 1,
          status: 'sent',
          dispatched_for_count: result.submittedCount,
          recipient_email: result.sentTo,
          storage_zip_path: 'exports/class-of-23-complete-archive.zip',
          error_message: null,
          dispatched_at: sentAt,
          updated_at: sentAt,
        },
        { onConflict: 'id' }
      );
    }

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send complete archive email';
    if (supabase) {
      await supabase.from('archive_dispatches').upsert(
        {
          id: 1,
          status: 'failed',
          error_message: message,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
