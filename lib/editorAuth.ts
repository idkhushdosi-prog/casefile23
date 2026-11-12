import crypto from 'crypto';
import { cookies } from 'next/headers';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const EDITOR_COOKIE_NAME = 'casefile_editor_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function isServerSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      anon &&
      url.startsWith('http') &&
      !url.includes('your-project-id') &&
      !anon.includes('your-supabase-anon-key')
  );
}

export function isServiceRoleConfigured(): boolean {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(srk && !srk.includes('your-supabase-service-role-key'));
}

export function isEditorPasscodeConfigured(): boolean {
  return Boolean((process.env.EDITOR_PASSCODE || '').trim());
}

export function getArchiveNotifyEmail(): string {
  return (process.env.ARCHIVE_NOTIFY_EMAIL || '').trim();
}

export function getEmailTransportStatus(): {
  configured: boolean;
  provider: 'resend' | 'smtp' | null;
  recipientConfigured: boolean;
} {
  const resend = Boolean((process.env.RESEND_API_KEY || '').trim());
  const smtp = Boolean(
    (process.env.SMTP_USER || '').trim() && (process.env.SMTP_PASS || '').trim()
  );
  const recipientConfigured = Boolean(getArchiveNotifyEmail());
  const provider = resend ? 'resend' : smtp ? 'smtp' : null;
  return {
    configured: Boolean(provider && recipientConfigured),
    provider,
    recipientConfigured,
  };
}

function getSigningSecret(): string {
  const srk = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const pass = (process.env.EDITOR_PASSCODE || '').trim();
  return crypto.createHash('sha256').update(`casefile23:${srk}:${pass}`).digest('hex');
}

export function verifyPasscode(candidate: string): boolean {
  const expected = (process.env.EDITOR_PASSCODE || '').trim();
  if (!expected || !candidate) return false;
  const a = crypto.createHash('sha256').update(candidate.trim()).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export function createEditorSessionToken(): string {
  const issuedAt = String(Date.now());
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(issuedAt)
    .digest('hex');
  return `${issuedAt}.${sig}`;
}

export function verifyEditorSessionToken(token: string | undefined): boolean {
  if (!token || !isEditorPasscodeConfigured()) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [issuedAtStr, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (
    !Number.isFinite(issuedAt) ||
    Date.now() - issuedAt > SESSION_TTL_MS ||
    Date.now() < issuedAt - 60_000
  ) {
    return false;
  }
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(issuedAtStr)
    .digest('hex');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function isEditorAuthorizedOnServer(): Promise<boolean> {
  if (!isServerSupabaseConfigured()) {
    return true;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(EDITOR_COOKIE_NAME)?.value;
  return verifyEditorSessionToken(token);
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isServerSupabaseConfigured() || !isServiceRoleConfigured()) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
