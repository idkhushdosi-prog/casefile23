import { NextResponse } from 'next/server';
import { ROSTER } from '@/data/roster';
import {
  getEmailTransportStatus,
  getSupabaseAdminClient,
  isServerSupabaseConfigured,
} from '@/lib/editorAuth';
import { sendCompleteArchiveEmail } from '@/lib/emailArchive';
import { checkRateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_ROSTER_IDS = new Set(ROSTER.map((r) => r.id));

function getClientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed } = checkRateLimit(`submission-complete:${ip}`, 20, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({
      ok: true,
      mode: 'demo',
      allComplete: false,
      dispatched: false,
      message: 'Supabase is not configured; running in local demo mode.',
    });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is missing on the server.' },
      { status: 500 }
    );
  }

  // Verify the caller holds a valid Supabase session token
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return NextResponse.json({ error: 'Missing Authorization bearer token.' }, { status: 401 });
  }
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Invalid Supabase session.' }, { status: 401 });
  }

  // Count distinct roster members with status = 'submitted'
  const { data: submittedRows, error: countError } = await supabase
    .from('contributors')
    .select('roster_id')
    .eq('status', 'submitted');

  if (countError) {
    return NextResponse.json(
      { error: `Failed to check submitted count: ${countError.message}` },
      { status: 500 }
    );
  }

  const distinctSubmitted = new Set(
    (submittedRows ?? [])
      .map((row) => String(row.roster_id || ''))
      .filter((id) => VALID_ROSTER_IDS.has(id))
  );
  const submittedCount = distinctSubmitted.size;
  const totalRequired = ROSTER.length;

  if (submittedCount < totalRequired) {
    return NextResponse.json({
      ok: true,
      submittedCount,
      totalRequired,
      allComplete: false,
      dispatched: false,
    });
  }

  // All 23/23 students have submitted — check if already sent or sending
  await supabase
    .from('archive_dispatches')
    .upsert({ id: 1 }, { onConflict: 'id', ignoreDuplicates: true });

  const { data: currentDispatch } = await supabase
    .from('archive_dispatches')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (
    currentDispatch?.status === 'sent' &&
    (currentDispatch.dispatched_for_count ?? 0) >= totalRequired
  ) {
    return NextResponse.json({
      ok: true,
      submittedCount,
      totalRequired,
      allComplete: true,
      dispatched: true,
      alreadySent: true,
      dispatchedAt: currentDispatch.dispatched_at,
    });
  }

  const transportStatus = getEmailTransportStatus();
  if (!transportStatus.configured) {
    const missingReason = !transportStatus.recipientConfigured
      ? 'ARCHIVE_NOTIFY_EMAIL is not configured.'
      : 'Email transport is not configured (set RESEND_API_KEY or SMTP_USER + SMTP_PASS).';

    await supabase
      .from('archive_dispatches')
      .update({
        status: 'failed',
        error_message: missingReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .neq('status', 'sent');

    return NextResponse.json({
      ok: true,
      submittedCount,
      totalRequired,
      allComplete: true,
      dispatched: false,
      reason: missingReason,
    });
  }

  // Acquire atomic dispatch lock on idle/failed, earlier manual send (<23), or stale 'sending' (> 5 mins)
  const nowIso = new Date().toISOString();
  const { data: claimed } = await supabase
    .from('archive_dispatches')
    .update({
      status: 'sending',
      error_message: null,
      updated_at: nowIso,
    })
    .eq('id', 1)
    .or(`status.in.(idle,failed),and(status.eq.sent,dispatched_for_count.lt.${totalRequired})`)
    .select('id');

  let lockAcquired = Boolean(claimed && claimed.length > 0);
  if (!lockAcquired) {
    const staleThreshold = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: staleClaimed } = await supabase
      .from('archive_dispatches')
      .update({
        status: 'sending',
        error_message: null,
        updated_at: nowIso,
      })
      .eq('id', 1)
      .eq('status', 'sending')
      .lt('updated_at', staleThreshold)
      .select('id');
    lockAcquired = Boolean(staleClaimed && staleClaimed.length > 0);
  }

  if (!lockAcquired) {
    return NextResponse.json({
      ok: true,
      submittedCount,
      totalRequired,
      allComplete: true,
      dispatched: currentDispatch?.status === 'sent',
      inProgress: currentDispatch?.status === 'sending',
    });
  }

  try {
    const result = await sendCompleteArchiveEmail({ trigger: 'auto_23_complete' });
    const sentAt = new Date().toISOString();

    await supabase
      .from('archive_dispatches')
      .update({
        status: 'sent',
        dispatched_for_count: result.submittedCount,
        recipient_email: result.sentTo,
        storage_zip_path: 'exports/class-of-23-complete-archive.zip',
        error_message: null,
        dispatched_at: sentAt,
        updated_at: sentAt,
      })
      .eq('id', 1);

    return NextResponse.json({
      ok: true,
      submittedCount: result.submittedCount,
      totalRequired,
      allComplete: true,
      dispatched: true,
      sentTo: result.sentTo,
      provider: result.provider,
      attachedFilename: result.attachedFilename,
      dispatchedAt: sentAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send archive email';
    await supabase
      .from('archive_dispatches')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    return NextResponse.json(
      {
        ok: false,
        submittedCount,
        totalRequired,
        allComplete: true,
        dispatched: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
