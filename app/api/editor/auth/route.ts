import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';
import {
  EDITOR_COOKIE_NAME,
  createEditorSessionToken,
  isEditorAuthorizedOnServer,
  isEditorPasscodeConfigured,
  isServerSupabaseConfigured,
  isServiceRoleConfigured,
  verifyPasscode,
} from '@/lib/editorAuth';

export async function GET() {
  const authorized = await isEditorAuthorizedOnServer();
  return NextResponse.json({
    authorized,
    supabaseConfigured: isServerSupabaseConfigured(),
    passcodeConfigured: isEditorPasscodeConfigured(),
    serviceRoleConfigured: isServiceRoleConfigured(),
  });
}

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for') || 'local';
  const rl = checkRateLimit(`editor-login:${ip}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Too many passcode attempts. Wait a minute.' },
      { status: 429 }
    );
  }

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json({ ok: true, mode: 'demo' });
  }

  if (!isEditorPasscodeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'EDITOR_PASSCODE is not set on the server. Add EDITOR_PASSCODE to your .env.local or Vercel Environment Variables.',
      },
      { status: 500 }
    );
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'SUPABASE_SERVICE_ROLE_KEY is missing on the server. Add it to load student dossiers securely without an editor email.',
      },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as { passcode?: string };
    const passcode = (body.passcode || '').trim();
    if (!verifyPasscode(passcode)) {
      return NextResponse.json(
        { ok: false, error: 'Incorrect editor passcode.' },
        { status: 401 }
      );
    }

    const token = createEditorSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(EDITOR_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(EDITOR_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return res;
}
