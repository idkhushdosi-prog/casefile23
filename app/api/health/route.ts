import { NextResponse } from 'next/server';
import { ROSTER } from '@/data/roster';
import { DIAGRAM_PROMPTS } from '@/data/diagramPrompts';
import { AWARDS } from '@/data/awards';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  getEmailTransportStatus,
  isEditorPasscodeConfigured,
  isServerSupabaseConfigured,
  isServiceRoleConfigured,
} from '@/lib/editorAuth';

export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  const rl = checkRateLimit(`health:${ip}`, 120, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, error: 'Too many requests' }, { status: 429 });
  }

  const emailStatus = getEmailTransportStatus();

  return NextResponse.json({
    ok: true,
    service: 'case-file-class-of-23',
    timestamp: new Date().toISOString(),
    rosterCount: ROSTER.length,
    diagramPromptCount: DIAGRAM_PROMPTS.length,
    awardsCount: AWARDS.length,
    supabaseConfigured: isServerSupabaseConfigured(),
    serviceRoleConfigured: isServiceRoleConfigured(),
    editorPasscodeConfigured: isEditorPasscodeConfigured(),
    archiveEmailConfigured: emailStatus.configured,
    archiveEmailRecipientConfigured: emailStatus.recipientConfigured,
    archiveEmailProvider: emailStatus.provider,
  });
}
