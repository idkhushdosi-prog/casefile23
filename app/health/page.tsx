import React from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { ROSTER } from '@/data/roster';
import { DIAGRAM_PROMPTS } from '@/data/diagramPrompts';
import { AWARDS } from '@/data/awards';
import { ARCHETYPES } from '@/data/archetypes';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { Stamp } from '@/components/ui/Stamp';
import {
  getEmailTransportStatus,
  isEditorPasscodeConfigured,
  isServerSupabaseConfigured,
  isServiceRoleConfigured,
} from '@/lib/editorAuth';

export const dynamic = 'force-dynamic';

export default function HealthPage() {
  const supabaseConfigured = isServerSupabaseConfigured();
  const serviceRoleConfigured = isServiceRoleConfigured();
  const editorPasscodeConfigured = isEditorPasscodeConfigured();
  const emailStatus = getEmailTransportStatus();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <NotebookCard>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-typewriter text-2xl font-bold">
              Bureau System Health
            </h1>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              Diagnostics for CASE FILE: CLASS OF 23
            </p>
          </div>
          <Stamp text="OPERATIONAL" color="green" size="sm" rotate={-3} />
        </div>

        <div className="mt-5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3">
            <span>Roster Integrity</span>
            <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {ROSTER.length}/23 Students
            </span>
          </div>
          <div className="flex items-center justify-between rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3">
            <span>Diagram Prompt Bank</span>
            <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {DIAGRAM_PROMPTS.length} Prompts
            </span>
          </div>
          <div className="flex items-center justify-between rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3">
            <span>Awards &amp; Archetypes</span>
            <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {AWARDS.length} Awards • {ARCHETYPES.length} Cards
            </span>
          </div>
          <div className="flex items-center justify-between rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3">
            <span>Supabase Connection</span>
            {supabaseConfigured ? (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> Local / Demo Mode
              </span>
            )}
          </div>
          <div className="flex items-center justify-between rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3">
            <span>Supabase Service Key (Editor Read/Write)</span>
            {serviceRoleConfigured ? (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Set
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> Missing SUPABASE_SERVICE_ROLE_KEY
              </span>
            )}
          </div>
          <div className="flex items-center justify-between rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3">
            <span>Student Editor Passcode</span>
            {editorPasscodeConfigured ? (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Set
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" /> Missing EDITOR_PASSCODE
              </span>
            )}
          </div>
          <div className="flex items-center justify-between rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3">
            <span>23/23 Archive Email Notification</span>
            {emailStatus.configured ? (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Ready ({emailStatus.provider?.toUpperCase()})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono-doc text-xs font-bold text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />{' '}
                {!emailStatus.recipientConfigured
                  ? 'Missing ARCHIVE_NOTIFY_EMAIL'
                  : 'Missing RESEND_API_KEY or SMTP'}
              </span>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="tactile-btn rounded-md bg-[var(--paper)] px-4 py-2 text-xs font-bold"
          >
            ← Home
          </Link>
          <Link
            href="/api/health"
            className="tactile-btn rounded-md bg-[var(--blueprint)] px-4 py-2 text-xs font-bold text-white"
          >
            View JSON Endpoint
          </Link>
        </div>
      </NotebookCard>
    </main>
  );
}
