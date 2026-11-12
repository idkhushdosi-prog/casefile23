'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  Award,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  FileJson,
  FileSpreadsheet,
  FolderArchive,
  Lock,
  LogOut,
  Mail,
  Package,
  Send,
  Settings,
  Users,
} from 'lucide-react';
import type { ArchiveDispatchStatus } from '@/lib/serverEditorData';
import { ROSTER, getRosterById } from '@/data/roster';
import { AWARDS } from '@/data/awards';
import { FAMILIARITY_OPTIONS, type FamiliarityOptionId } from '@/data/questions';
import {
  analyzeNameCheck,
  aggregateSubjectProfile,
  buildCidDossierCsv,
  buildFullJson,
  buildMangaJson,
  buildNcertBookCsv,
  buildStatDeckCsv,
  type EditorDataset,
  type EditorPickRow,
} from '@/lib/exports';
import {
  loadEditorDataset,
  saveEditorPick,
  saveFamiliarityWeights,
} from '@/lib/editorStore';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { Stamp } from '@/components/ui/Stamp';

type EditorTab =
  | 'overview'
  | 'name_check'
  | 'coverage'
  | 'skips'
  | 'awards'
  | 'archive_extra'
  | 'photos'
  | 'settings';

function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function EditorDashboardPage() {
  const supabaseConfigured = isSupabaseConfigured();

  const [authChecking, setAuthChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [dataset, setDataset] = useState<EditorDataset | null>(null);
  const [dataSource, setDataSource] = useState<'supabase' | 'demo'>('demo');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>('overview');

  // Photo gallery filters & signed URLs
  const [photoStudentFilter, setPhotoStudentFilter] = useState<string>('all');
  const [photoKindFilter, setPhotoKindFilter] = useState<string>('all');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [zipping, setZipping] = useState(false);
  const [dispatchStatus, setDispatchStatus] = useState<ArchiveDispatchStatus | null>(null);
  const [masterZipping, setMasterZipping] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    kind: 'ok' | 'err';
    text: string;
  } | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoadError(null);
    try {
      const {
        dataset: ds,
        source,
        signedUrls: urls,
        dispatchStatus: dispatch,
      } = await loadEditorDataset();
      setDataset(ds);
      setDataSource(source);
      setSignedUrls(urls);
      setDispatchStatus(dispatch ?? null);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to load editor dataset.'
      );
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseConfigured) {
        // Local dev / unconfigured Supabase preview mode
        setAuthorized(true);
        setAuthChecking(false);
        await fetchDashboardData();
        return;
      }

      try {
        const res = await fetch('/api/editor/auth', { cache: 'no-store' });
        const json = (await res.json()) as {
          authorized?: boolean;
          passcodeConfigured?: boolean;
          serviceRoleConfigured?: boolean;
        };
        if (json.authorized) {
          setAuthorized(true);
          setAuthChecking(false);
          await fetchDashboardData();
          return;
        }
        if (!json.passcodeConfigured || !json.serviceRoleConfigured) {
          setAuthError(
            'Server missing EDITOR_PASSCODE or SUPABASE_SERVICE_ROLE_KEY in .env.local / Vercel env.'
          );
        }
      } catch {
        setAuthError('Could not reach editor authentication endpoint.');
      }

      setAuthorized(false);
      setAuthChecking(false);
    };

    void checkAuth();
  }, [supabaseConfigured, fetchDashboardData]);

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const passcode = passcodeInput.trim();
    if (!passcode) return;

    const res = await fetch('/api/editor/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      setAuthError(json.error || 'Incorrect editor passcode.');
      return;
    }

    setPasscodeInput('');
    setAuthorized(true);
    await fetchDashboardData();
  };

  const handleSignOut = async () => {
    await fetch('/api/editor/auth', { method: 'DELETE' });
    setAuthorized(false);
  };

  const togglePick = async (
    entryId: string,
    targetType: EditorPickRow['target_type'],
    patch: Partial<EditorPickRow>
  ) => {
    if (!dataset) return;
    const current: EditorPickRow = dataset.picks[entryId] ?? {
      entry_id: entryId,
      target_type: targetType,
      picked: false,
      edited_text: null,
      used_in: [],
    };
    const next: EditorPickRow = { ...current, ...patch };
    setDataset({
      ...dataset,
      picks: { ...dataset.picks, [entryId]: next },
    });
    await saveEditorPick(next, dataSource);
  };

  const updateWeight = async (famId: FamiliarityOptionId, weight: number) => {
    if (!dataset) return;
    const nextWeights = { ...dataset.weights, [famId]: weight };
    setDataset({ ...dataset, weights: nextWeights });
    await saveFamiliarityWeights(nextWeights, dataSource);
  };

  const handleBulkZipDownload = async () => {
    if (!dataset) return;
    setZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const manifestLines: string[] = [];

      for (const u of dataset.uploads) {
        const signed = signedUrls[u.storage_path];
        if (signed) {
          const resp = await fetch(signed);
          if (resp.ok) {
            const blob = await resp.blob();
            zip.file(u.storage_path, blob);
            manifestLines.push(`DOWNLOADED: ${u.storage_path}`);
            continue;
          }
        }
        manifestLines.push(
          `PLACEHOLDER (${u.kind}): ${u.storage_path} | tags=${u.tagged_roster_ids.join(',')} | caption=${u.caption || ''}`
        );
      }

      zip.file('MANIFEST.txt', manifestLines.join('\n'));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'class-of-23-originals.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setZipping(false);
    }
  };

  const handleMasterZipDownload = async () => {
    if (!dataset) return;
    setMasterZipping(true);
    try {
      const { buildCompleteArchiveZip } = await import('@/lib/archiveBundle');
      const bundle = await buildCompleteArchiveZip({
        dataset,
        fetchPhotoBytes: async (storagePath: string) => {
          const signed = signedUrls[storagePath];
          if (!signed) return null;
          const resp = await fetch(signed);
          if (!resp.ok) return null;
          const buf = await resp.arrayBuffer();
          return new Uint8Array(buf);
        },
      });
      const blob = new Blob([new Uint8Array(bundle.fullZip)], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'class-of-23-complete-archive.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setMasterZipping(false);
    }
  };

  const handleSendArchiveEmail = async () => {
    if (!dataset) return;
    setSendingEmail(true);
    setEmailFeedback(null);
    try {
      const res = await fetch('/api/editor/send-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataSource === 'demo' ? { demoDataset: dataset } : {}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        result?: {
          sentTo: string;
          attachedFilename: string;
          totalAnswers: number;
          includedPhotos: number;
        };
      };
      if (!res.ok || !data.ok || !data.result) {
        setEmailFeedback({
          kind: 'err',
          text: data.error || `Failed to send archive email (${res.status}).`,
        });
        return;
      }
      setEmailFeedback({
        kind: 'ok',
        text: `Emailed ${data.result.attachedFilename} (${data.result.totalAnswers} answers, ${data.result.includedPhotos} photos) to ${data.result.sentTo}.`,
      });
      if (dataSource === 'supabase') {
        await fetchDashboardData();
      }
    } catch (err) {
      setEmailFeedback({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Network error sending archive email.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const coverageRows = useMemo(() => {
    if (!dataset) return [];
    return ROSTER.map((student) => {
      const prof = aggregateSubjectProfile(student.id, dataset);
      return {
        student,
        filedCount: prof.filedCount,
        skipCount: prof.skipCount,
        lowCoverage: prof.filedCount < 12,
        topNick: prof.nicknamesRanked[0]?.name ?? '—',
        topArch: prof.archetypesRanked[0]?.title ?? '—',
      };
    });
  }, [dataset]);

  const awardsSummary = useMemo(() => {
    if (!dataset) return [];
    return AWARDS.map((aw) => {
      const votes = dataset.awards.filter((v) => v.award_key === aw.key);
      const counts = new Map<string, number>();
      for (const v of votes) {
        counts.set(v.voted_roster_id, (counts.get(v.voted_roster_id) ?? 0) + 1);
      }
      const ranked = Array.from(counts.entries())
        .map(([rosterId, count]) => ({
          rosterId,
          label: getRosterById(rosterId)?.label ?? rosterId,
          count,
        }))
        .sort((a, b) => b.count - a.count);
      const topCount = ranked[0]?.count ?? 0;
      const isTie = ranked.filter((r) => r.count === topCount && topCount > 0).length > 1;
      return { award: aw, totalVotes: votes.length, ranked, isTie };
    });
  }, [dataset]);

  if (authChecking) {
    return (
      <main className="mx-auto max-w-xl px-4 py-12 text-center">
        <NotebookCard>
          <p className="font-typewriter text-lg">Checking Editor Clearance…</p>
        </NotebookCard>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <NotebookCard>
          <div className="mb-3 flex items-center justify-between">
            <EvidenceTag label="EDITOR CLEARANCE ONLY" tone="red" />
            <Lock className="h-5 w-5 text-[var(--stamp-red)]" />
          </div>
          <h1 className="font-typewriter text-2xl font-bold">Student Editor Desk</h1>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            No email needed. Enter the batch&apos;s secret <code>EDITOR_PASSCODE</code> to review
            all 23 dossiers and export print files.
          </p>

          <form onSubmit={(e) => void handlePasscodeLogin(e)} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="editor-passcode"
                className="font-mono-doc block text-xs font-bold uppercase"
              >
                Editor Passcode
              </label>
              <input
                id="editor-passcode"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Enter secret editor passcode..."
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="mt-1 min-h-[46px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm"
              />
            </div>
            {authError && (
              <p role="alert" className="text-xs font-bold text-[var(--stamp-red)]">
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="tactile-btn flex w-full items-center justify-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-3 text-sm font-bold text-white"
            >
              <Lock className="h-4 w-4" /> Unlock Editor Desk
            </button>
          </form>
        </NotebookCard>
      </main>
    );
  }

  if (loadError || !dataset) {
    return (
      <main className="mx-auto max-w-xl px-4 py-10">
        <NotebookCard>
          <h1 className="font-typewriter text-xl font-bold text-[var(--stamp-red)]">
            Could not load Editor Dataset
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-muted)]">{loadError || 'Loading…'}</p>
          <button
            type="button"
            onClick={() => void fetchDashboardData()}
            className="tactile-btn mt-4 rounded bg-[var(--blueprint)] px-4 py-2 text-sm font-bold text-white"
          >
            Retry
          </button>
        </NotebookCard>
      </main>
    );
  }

  const submittedCount = dataset.contributors.filter((c) => c.status === 'submitted').length;
  const filteredUploads = dataset.uploads.filter((u) => {
    if (photoKindFilter !== 'all' && u.kind !== photoKindFilter) return false;
    if (
      photoStudentFilter !== 'all' &&
      !u.tagged_roster_ids.includes(photoStudentFilter)
    ) {
      return false;
    }
    return true;
  });

  return (
    <main className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
      {/* Editor Header + 5 Export Buttons */}
      <section className="rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-4 sm:p-6 shadow-[5px_6px_0_var(--shadow-paper)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <EvidenceTag label="CHIEF EDITOR DESK" tone="red" />
              <Stamp
                text={dataSource === 'supabase' ? 'LIVE SUPABASE' : 'SEEDED DEMO DATA'}
                color={dataSource === 'supabase' ? 'green' : 'blue'}
                size="sm"
                rotate={-2}
              />
            </div>
            <h1 className="font-typewriter mt-2 text-2xl font-bold sm:text-3xl">
              Editorial Review &amp; Export Console
            </h1>
            <p className="mt-1 text-xs text-[var(--ink-muted)]">
              {submittedCount} submitted • {dataset.contributors.length}/23 started •{' '}
              {dataset.responses.length} field answers logged
            </p>
          </div>

          {supabaseConfigured && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--paper)] px-3 py-2 text-xs font-bold"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </button>
          )}
        </div>

        {/* 5 Exports Bar */}
        <div className="mt-5 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3">
          <p className="font-mono-doc mb-2 text-xs font-bold uppercase text-[var(--ink-muted)]">
            Keepsake Production Exports (5 Formats)
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile('stat-deck.csv', buildStatDeckCsv(dataset), 'text/csv;charset=utf-8')
              }
              className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--highlighter)] px-3 py-2 text-xs font-bold text-[#1B1B1B]"
            >
              <FileSpreadsheet className="h-4 w-4" /> Stat Deck CSV
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile('ncert-book.csv', buildNcertBookCsv(dataset), 'text/csv;charset=utf-8')
              }
              className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--paper-card)] px-3 py-2 text-xs font-bold"
            >
              <FileSpreadsheet className="h-4 w-4" /> NCERT Book CSV
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile('cid-dossier.csv', buildCidDossierCsv(dataset), 'text/csv;charset=utf-8')
              }
              className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--paper-card)] px-3 py-2 text-xs font-bold"
            >
              <FileSpreadsheet className="h-4 w-4" /> CID Dossier CSV
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  'manga-export.json',
                  JSON.stringify(buildMangaJson(dataset), null, 2),
                  'application/json'
                )
              }
              className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--blueprint)] px-3 py-2 text-xs font-bold text-white"
            >
              <FileJson className="h-4 w-4" /> Manga JSON
            </button>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  'class-of-23-full.json',
                  JSON.stringify(buildFullJson(dataset), null, 2),
                  'application/json'
                )
              }
              className="tactile-btn inline-flex items-center gap-1.5 rounded bg-[var(--stamp-red)] px-3 py-2 text-xs font-bold text-white"
            >
              <FileJson className="h-4 w-4" /> Full JSON Export
            </button>
          </div>
        </div>

        {/* Master Archive ZIP & Automatic 23/23 Email Notification */}
        {(() => {
          const submittedCount = new Set(
            dataset.contributors
              .filter((c) => c.status === 'submitted')
              .map((c) => c.roster_id)
          ).size;

          return (
            <div className="mt-4 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3.5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mail className="h-4 w-4 text-[var(--stamp-red)]" />
                    <span className="font-mono-doc text-xs font-bold uppercase tracking-wider">
                      Complete Archive ZIP &amp; Auto-Email Dispatch
                    </span>
                    <span className="rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2 py-0.5 font-mono-doc text-[11px] font-bold">
                      {submittedCount} / {ROSTER.length} Submitted
                    </span>
                    {dispatchStatus?.status === 'sent' &&
                    dispatchStatus.dispatched_for_count >= ROSTER.length ? (
                      <span className="rounded bg-emerald-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-200">
                        AUTO-EMAILED (23/23){' '}
                        {dispatchStatus.dispatched_at
                          ? `(${new Date(dispatchStatus.dispatched_at).toLocaleDateString()})`
                          : ''}
                      </span>
                    ) : dispatchStatus?.status === 'sent' ? (
                      <span className="rounded bg-emerald-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-200">
                        LAST SENT AT {dispatchStatus.dispatched_for_count}/{ROSTER.length}
                      </span>
                    ) : dispatchStatus?.status === 'sending' ? (
                      <span className="rounded bg-amber-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
                        DISPATCHING NOW...
                      </span>
                    ) : dispatchStatus?.status === 'failed' ? (
                      <span className="rounded bg-red-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-red-900 dark:bg-red-950/80 dark:text-red-200">
                        DISPATCH ERROR
                      </span>
                    ) : (
                      <span className="rounded bg-slate-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                        WAITING FOR 23/23
                      </span>
                    )}
                  </div>
                  <p className="text-xs opacity-80">
                    When all 23/23 students submit, the server automatically emails{' '}
                    <code>ARCHIVE_NOTIFY_EMAIL</code> with one complete ZIP containing every single
                    question answer, 23 individual student dossiers, all 4 keepsake formats, and
                    uploaded photos.
                  </p>
                  {dispatchStatus?.status === 'failed' && dispatchStatus.error_message && (
                    <p className="font-mono-doc text-xs text-[var(--stamp-red)]">
                      Last dispatch error: {dispatchStatus.error_message}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={masterZipping}
                    onClick={handleMasterZipDownload}
                    className="tactile-btn min-h-[44px] inline-flex items-center gap-1.5 rounded bg-[var(--ink)] px-3.5 py-2 text-xs font-bold text-[var(--paper)] disabled:opacity-60"
                  >
                    <Package className="h-4 w-4" />
                    {masterZipping ? 'Building Master ZIP...' : 'Download Complete Master ZIP'}
                  </button>
                  <button
                    type="button"
                    disabled={sendingEmail}
                    onClick={handleSendArchiveEmail}
                    className="tactile-btn min-h-[44px] inline-flex items-center gap-1.5 rounded bg-[var(--blueprint)] px-3.5 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {sendingEmail ? 'Sending Email...' : 'Send Complete Archive Email Now'}
                  </button>
                </div>
              </div>

              {emailFeedback && (
                <div
                  role="status"
                  className={`mt-2.5 rounded border px-3 py-2 font-mono-doc text-xs ${
                    emailFeedback.kind === 'ok'
                      ? 'border-emerald-700 bg-emerald-100 text-emerald-950 dark:border-emerald-500/60 dark:bg-emerald-950/50 dark:text-emerald-200'
                      : 'border-[var(--stamp-red)] bg-red-100 text-[var(--stamp-red)] dark:bg-red-950/60 dark:text-red-200'
                  }`}
                >
                  {emailFeedback.text}
                </div>
              )}
            </div>
          );
        })()}

        {/* Section Tabs */}
        <nav
          aria-label="Editor sections"
          className="mt-4 flex flex-wrap gap-1.5"
        >
          {(
            [
              ['overview', 'Contributors Overview', Users],
              ['name_check', 'Name & Scholar Check', CheckCircle2],
              ['coverage', '23 Classmate Coverage', FolderArchive],
              ['skips', `Skips (${dataset.skips.length})`, AlertTriangle],
              ['awards', 'Awards Results', Award],
              ['archive_extra', 'Archive & Wild Cards', Archive],
              ['photos', `Photos (${dataset.uploads.length})`, Camera],
              ['settings', 'Stat Weights', Settings],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`min-h-[44px] inline-flex items-center gap-1.5 rounded border-2 border-[var(--border-ink)] px-3 py-1.5 text-xs font-bold ${
                activeTab === id
                  ? 'bg-[var(--ink)] text-[var(--paper)]'
                  : 'bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--paper-card)]'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </nav>
      </section>

      {/* TAB 1: CONTRIBUTORS OVERVIEW */}
      {activeTab === 'overview' && (
        <NotebookCard className="mt-6" taped={false}>
          <h2 className="font-typewriter text-xl font-bold">
            Batch 23 Submission Status (23 Students)
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border-ink)] font-mono-doc text-xs uppercase">
                  <th className="py-2 pr-3">Roster Name</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Scholar #</th>
                  <th className="py-2 pr-3">Full Name (CAPS)</th>
                  <th className="py-2">XP</th>
                </tr>
              </thead>
              <tbody>
                {ROSTER.map((r) => {
                  const c = dataset.contributors.find((x) => x.roster_id === r.id);
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[var(--border-ink)]/20 hover:bg-[var(--manila)]/40"
                    >
                      <td className="py-2.5 pr-3 font-bold">
                        <Link
                          href={`/editor/student/${r.id}`}
                          className="text-[var(--blueprint-ink)] underline"
                        >
                          {r.label}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        {!c ? (
                          <span className="rounded bg-slate-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                            PENDING
                          </span>
                        ) : c.status === 'submitted' ? (
                          <span className="rounded bg-emerald-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-emerald-900 dark:bg-emerald-900/70 dark:text-emerald-200">
                            SUBMITTED
                          </span>
                        ) : (
                          <span className="rounded bg-amber-200 px-2 py-0.5 font-mono-doc text-[10px] font-bold text-amber-900 dark:bg-amber-900/70 dark:text-amber-200">
                            IN PROGRESS
                          </span>
                        )}
                      </td>
                      <td className="font-mono-doc py-2.5 pr-3">{c?.scholar_number || '—'}</td>
                      <td className="font-mono-doc py-2.5 pr-3">{c?.full_name_caps || '—'}</td>
                      <td className="font-mono-doc py-2.5">{c?.xp ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </NotebookCard>
      )}

      {/* TAB 2: NAME CHECK */}
      {activeTab === 'name_check' && (
        <NotebookCard className="mt-6" taped={false}>
          <h2 className="font-typewriter text-xl font-bold">
            Name &amp; Spelling Check
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Compares selected roster entry against entered uppercase name components and flags
            missing parts or likely mismatches.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b-2 border-[var(--border-ink)] font-mono-doc uppercase">
                  <th className="py-2 pr-3">Roster</th>
                  <th className="py-2 pr-3">Scholar #</th>
                  <th className="py-2 pr-3">First</th>
                  <th className="py-2 pr-3">Middle</th>
                  <th className="py-2 pr-3">Last</th>
                  <th className="py-2 pr-3">Combined Full Name</th>
                  <th className="py-2">Flags</th>
                </tr>
              </thead>
              <tbody>
                {dataset.contributors.map((c) => {
                  const check = analyzeNameCheck(c);
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-[var(--border-ink)]/20 ${
                        check.severity === 'warn'
                          ? 'bg-amber-100/70 text-[#1B1B1B] dark:bg-amber-950/50 dark:text-amber-100'
                          : ''
                      }`}
                    >
                      <td className="py-2 pr-3 font-bold">
                        {getRosterById(c.roster_id)?.label ?? c.roster_id}
                      </td>
                      <td className="font-mono-doc py-2 pr-3">{c.scholar_number}</td>
                      <td className="font-mono-doc py-2 pr-3">{c.first_name_caps}</td>
                      <td className="font-mono-doc py-2 pr-3">{c.middle_name_caps || '—'}</td>
                      <td className="font-mono-doc py-2 pr-3">{c.last_name_caps}</td>
                      <td className="font-mono-doc py-2 pr-3 font-bold">{c.full_name_caps}</td>
                      <td className="py-2">
                        {check.issues.length === 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">Clean ✓</span>
                        ) : (
                          <span className="text-[var(--stamp-red)] font-bold">
                            ⚠ {check.issues.join(' ; ')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </NotebookCard>
      )}

      {/* TAB 3: COVERAGE TABLE */}
      {activeTab === 'coverage' && (
        <NotebookCard className="mt-6" taped={false}>
          <h2 className="font-typewriter text-xl font-bold">
            Classmate Coverage &amp; Dossier Links
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Warning flag triggers if fewer than 12 classmates have filed responses for a student.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--border-ink)] font-mono-doc text-xs uppercase">
                  <th className="py-2 pr-3">Classmate</th>
                  <th className="py-2 pr-3">Filed Responses</th>
                  <th className="py-2 pr-3">Skips</th>
                  <th className="py-2 pr-3">Top Nickname</th>
                  <th className="py-2 pr-3">Top Archetype</th>
                  <th className="py-2">Profile &amp; Preview</th>
                </tr>
              </thead>
              <tbody>
                {coverageRows.map((row) => (
                  <tr
                    key={row.student.id}
                    className="border-b border-[var(--border-ink)]/20 hover:bg-[var(--manila)]/40"
                  >
                    <td className="py-2.5 pr-3 font-bold">{row.student.label}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-mono-doc font-bold">{row.filedCount}</span>
                      {row.lowCoverage && (
                        <span className="ml-2 rounded bg-[var(--stamp-red)] px-1.5 py-0.5 font-mono-doc text-[10px] font-bold text-white">
                          LOW (&lt;12)
                        </span>
                      )}
                    </td>
                    <td className="font-mono-doc py-2.5 pr-3">{row.skipCount}</td>
                    <td className="py-2.5 pr-3">{row.topNick}</td>
                    <td className="py-2.5 pr-3">{row.topArch}</td>
                    <td className="py-2.5">
                      <Link
                        href={`/editor/student/${row.student.id}`}
                        className="inline-flex items-center gap-1 font-bold text-[var(--blueprint-ink)] underline"
                      >
                        Inspect &amp; Print Preview <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </NotebookCard>
      )}

      {/* TAB 4: SKIPS */}
      {activeTab === 'skips' && (
        <NotebookCard className="mt-6" taped={false}>
          <h2 className="font-typewriter text-xl font-bold">
            Skip Log (Editor-Only Visibility)
          </h2>
          <div className="mt-4 space-y-2.5">
            {dataset.skips.map((s, i) => {
              const contrib = dataset.contributors.find((c) => c.id === s.contributor_id);
              const by = getRosterById(contrib?.roster_id)?.label ?? 'Unknown';
              const target = getRosterById(s.subject_roster_id)?.label ?? s.subject_roster_id;
              return (
                <div
                  key={`${s.contributor_id}-${s.subject_roster_id}-${i}`}
                  className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3 text-xs"
                >
                  <p className="font-bold">
                    {by} skipped {target}
                  </p>
                  <p className="mt-0.5 text-[var(--stamp-red)]">{s.reason_choice}</p>
                  {s.reason_text && (
                    <p className="mt-1 italic text-[var(--ink-muted)]">&ldquo;{s.reason_text}&rdquo;</p>
                  )}
                </div>
              );
            })}
            {dataset.skips.length === 0 && (
              <p className="text-sm text-[var(--ink-muted)]">No skips recorded yet.</p>
            )}
          </div>
        </NotebookCard>
      )}

      {/* TAB 5: AWARDS */}
      {activeTab === 'awards' && (
        <NotebookCard className="mt-6" taped={false}>
          <h2 className="font-typewriter text-xl font-bold">
            Awards Results (14 Categories)
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {awardsSummary.map(({ award, totalVotes, ranked, isTie }) => (
              <div
                key={award.key}
                className="rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-typewriter text-sm font-bold">
                    {award.emoji} {award.title}
                  </h3>
                  {isTie && (
                    <span className="rounded bg-[var(--highlighter)] px-2 py-0.5 font-mono-doc text-[10px] font-bold text-[#1B1B1B]">
                      TIE!
                    </span>
                  )}
                </div>
                <p className="font-mono-doc mt-1 text-[11px] text-[var(--ink-muted)]">
                  {totalVotes} total votes
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {ranked.slice(0, 4).map((r) => (
                    <li key={r.rosterId} className="flex justify-between">
                      <span>{r.label}</span>
                      <span className="font-mono-doc font-bold">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </NotebookCard>
      )}

      {/* TAB 6: ARCHIVE & ANYTHING ELSE */}
      {activeTab === 'archive_extra' && (
        <div className="mt-6 space-y-5">
          <NotebookCard taped={false}>
            <h2 className="font-typewriter text-xl font-bold">
              Class Archive Entries ({dataset.archiveEntries.length})
            </h2>
            <div className="mt-3 space-y-2.5">
              {dataset.archiveEntries.map((a) => {
                const pick = dataset.picks[a.id];
                const rawJson = JSON.stringify(a.content);
                return (
                  <div
                    key={a.id}
                    className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-doc font-bold uppercase text-[var(--blueprint-ink)]">
                        {a.section_key}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void togglePick(a.id, 'archive', { picked: !pick?.picked })
                        }
                        className={`rounded border border-[var(--border-ink)] px-2.5 py-1 font-bold ${
                          pick?.picked
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--paper-card)]'
                        }`}
                      >
                        {pick?.picked ? '✓ Picked' : 'Pick'}
                      </button>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap">{pick?.edited_text || rawJson}</p>
                  </div>
                );
              })}
            </div>
          </NotebookCard>

          <NotebookCard taped={false}>
            <h2 className="font-typewriter text-xl font-bold">
              Anything Else &amp; Editor Notes ({dataset.anythingElse.length})
            </h2>
            <div className="mt-3 space-y-2.5">
              {dataset.anythingElse.map((item) => {
                const pick = dataset.picks[item.id];
                return (
                  <div
                    key={item.id}
                    className="rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-doc font-bold">
                        {item.is_editor_note
                          ? 'PRIVATE NOTE TO EDITOR'
                          : item.tagged_roster_id
                          ? `About: ${getRosterById(item.tagged_roster_id)?.label}`
                          : 'WHOLE CLASS'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void togglePick(item.id, 'anything_else', {
                            picked: !pick?.picked,
                          })
                        }
                        className={`rounded border border-[var(--border-ink)] px-2.5 py-1 font-bold ${
                          pick?.picked
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[var(--paper-card)]'
                        }`}
                      >
                        {pick?.picked ? '✓ Picked' : 'Pick'}
                      </button>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </NotebookCard>
        </div>
      )}

      {/* TAB 7: PHOTO GALLERY & BULK ZIP */}
      {activeTab === 'photos' && (
        <NotebookCard className="mt-6" taped={false}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-typewriter text-xl font-bold">
                Photo Gallery ({filteredUploads.length})
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                Filter by classmate or type, download singles, or bundle originals in ZIP.
              </p>
            </div>
            <button
              type="button"
              disabled={zipping}
              onClick={() => void handleBulkZipDownload()}
              className="tactile-btn inline-flex items-center gap-2 rounded bg-[var(--blueprint)] px-4 py-2 text-xs font-bold text-white"
            >
              <Download className="h-4 w-4" />
              {zipping ? 'Bundling ZIP…' : 'Bulk ZIP Download of Originals'}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <select
              aria-label="Filter photos by classmate"
              value={photoStudentFilter}
              onChange={(e) => setPhotoStudentFilter(e.target.value)}
              className="min-h-[40px] rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-2.5 text-xs"
            >
              <option value="all">All Students</option>
              {ROSTER.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter photos by type"
              value={photoKindFilter}
              onChange={(e) => setPhotoKindFilter(e.target.value)}
              className="min-h-[40px] rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-2.5 text-xs"
            >
              <option value="all">All Photo Types</option>
              <option value="portrait">Official Portrait</option>
              <option value="mugshot">CID Mugshot</option>
              <option value="worst_face">Worst Face</option>
              <option value="chaos">Chaos Dump</option>
              <option value="extra">Wild Card Extra</option>
            </select>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            {filteredUploads.map((u) => {
              const url = signedUrls[u.storage_path];
              return (
                <div
                  key={u.id}
                  className="rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3 text-xs"
                >
                  <div className="flex aspect-square items-center justify-center overflow-hidden rounded border border-[var(--border-ink)]/40 bg-[var(--manila)]">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={u.caption || u.kind} className="h-full w-full object-cover" />
                    ) : (
                      <div className="p-3 text-center font-mono-doc text-[11px]">
                        <p className="font-bold uppercase">{u.kind}</p>
                        <p className="mt-1 break-all opacity-75">{u.storage_path}</p>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 font-bold">{u.caption || '(no caption)'}</p>
                  <p className="text-[11px] text-[var(--ink-muted)]">
                    Tags:{' '}
                    {u.tagged_roster_ids
                      .map((id) => getRosterById(id)?.label ?? id)
                      .join(', ') || 'None'}
                  </p>
                  {url && (
                    <a
                      href={url}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-bold text-[var(--blueprint-ink)] underline"
                    >
                      <Download className="h-3.5 w-3.5" /> Download Original
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </NotebookCard>
      )}

      {/* TAB 8: WEIGHTS SETTINGS */}
      {activeTab === 'settings' && (
        <NotebookCard className="mt-6" taped={false}>
          <h2 className="font-typewriter text-xl font-bold">
            Familiarity Stat Weights Configuration
          </h2>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            Adjust how strongly each witness familiarity tier weights survival stats in
            exports and profile cards.
          </p>
          <div className="mt-4 space-y-3 max-w-md">
            {FAMILIARITY_OPTIONS.map((opt) => (
              <div
                key={opt.id}
                className="flex items-center justify-between gap-3 rounded border border-[var(--border-ink)] bg-[var(--paper)] p-3"
              >
                <div>
                  <p className="font-typewriter text-sm font-bold">{opt.label}</p>
                  <p className="text-[11px] text-[var(--ink-muted)]">Key: {opt.id}</p>
                </div>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="5"
                  value={dataset.weights[opt.id] ?? opt.defaultWeight}
                  onChange={(e) =>
                    void updateWeight(opt.id, Number(e.target.value) || 0)
                  }
                  className="font-mono-doc min-h-[40px] w-24 rounded border-2 border-[var(--border-ink)] bg-[var(--paper-card)] px-2 text-right font-bold"
                />
              </div>
            ))}
          </div>
        </NotebookCard>
      )}
    </main>
  );
}
