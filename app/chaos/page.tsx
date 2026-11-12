'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { ROSTER } from '@/data/roster';
import { stripExifAndMeasure } from '@/lib/imageUtils';
import { uploadImageToSupabase, flushSyncQueue } from '@/lib/sync';
import { useAppStore, type UploadRecord } from '@/store/useAppStore';
import { playSound } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { generateUuid } from '@/lib/crypto';

const PHOTO_TYPES = [
  { id: 'candid', label: 'Candid' },
  { id: 'funny_face', label: 'Funny Face' },
  { id: 'evidence', label: 'Bench / Whiteboard Evidence' },
  { id: 'tiffin_crime', label: 'Tiffin Crime Scene' },
] as const;

export default function ChaosDumpPage() {
  const contributor = useAppStore((s) => s.contributor);
  const uploads = useAppStore((s) => s.uploads);
  const upsertUpload = useAppStore((s) => s.upsertUpload);
  const removeUpload = useAppStore((s) => s.removeUpload);
  const awardXp = useAppStore((s) => s.awardXp);

  const [pendingBlobs, setPendingBlobs] = useState<Map<string, { blob: Blob; mimeType: string; ext: string }>>(
    () => new Map()
  );
  const [draggingOver, setDraggingOver] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">Chaos Dump Locked</h1>
          <Link
            href="/details"
            className="tactile-btn mt-4 inline-flex rounded-md bg-[var(--stamp-red)] px-5 py-3 font-bold text-white"
          >
            Enter Witness Details →
          </Link>
        </NotebookCard>
      </main>
    );
  }

  const chaosPhotos = uploads.filter((u) => u.kind === 'chaos');

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setErrorMsg(null);
    setProcessingCount((c) => c + files.length);

    for (const file of files) {
      try {
        const processed = await stripExifAndMeasure(file);
        const id = generateUuid();
        const filename = `chaos-${id}.${processed.ext}`;

        const { storagePath, uploaded, error } = await uploadImageToSupabase({
          blob: processed.file,
          folder: 'chaos',
          filename,
          mimeType: processed.mimeType,
        });

        if (!uploaded) {
          setPendingBlobs((prev) => {
            const copy = new Map(prev);
            copy.set(id, {
              blob: processed.file,
              mimeType: processed.mimeType,
              ext: processed.ext,
            });
            return copy;
          });
        }

        upsertUpload({
          id,
          kind: 'chaos',
          storagePath,
          previewDataUrl: processed.previewDataUrl,
          caption: '',
          photoType: 'candid',
          taggedRosterIds: [],
          sha256Hash: processed.sha256,
          width: processed.width,
          height: processed.height,
          isLowRes: processed.isLowRes,
          synced: uploaded,
          error: error || null,
          createdAt: new Date().toISOString(),
        });

        void playSound('shutter');
        awardXp(20, 'Chaos Photo Added', `chaos:${id}`);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to process one photo.');
      } finally {
        setProcessingCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const retryUpload = async (item: UploadRecord) => {
    const cached = pendingBlobs.get(item.id);
    if (!cached) {
      void flushSyncQueue();
      return;
    }
    const { storagePath, uploaded, error } = await uploadImageToSupabase({
      blob: cached.blob,
      folder: 'chaos',
      filename: `chaos-${item.id}.${cached.ext}`,
      mimeType: cached.mimeType,
    });
    upsertUpload({
      ...item,
      storagePath,
      synced: uploaded,
      error: error || null,
    });
  };

  const untaggedCount = chaosPhotos.filter((p) => p.taggedRosterIds.length === 0).length;

  return (
    <main className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <EvidenceTag label="CHAOS DUMP • EVIDENCE PHOTOS" tone="red" />
        <Link
          href="/desk"
          onClick={() => void flushSyncQueue()}
          className="tactile-btn inline-flex items-center gap-1.5 rounded-md bg-[var(--paper)] px-3 py-2 text-xs font-bold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Case Desk
        </Link>
      </div>

      <NotebookCard>
        <h1 className="font-typewriter flex items-center gap-2 text-2xl font-bold sm:text-3xl">
          <Camera className="h-7 w-7 text-[var(--stamp-red)]" />
          Chaos Photo Dump
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Upload group candids, blackboard art, sleeping bench legends, or tiffin crime
          scenes at full original resolution. EXIF GPS data is stripped automatically.
        </p>

        {/* Dropzone + Camera Capture */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDraggingOver(true);
          }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDraggingOver(false);
            if (e.dataTransfer.files) void handleFiles(e.dataTransfer.files);
          }}
          className={`mt-5 rounded-md border-2 border-dashed border-[var(--border-ink)] p-6 text-center transition-colors ${
            draggingOver ? 'bg-[var(--highlighter)]/40' : 'bg-[var(--manila)]/60'
          }`}
        >
          <Upload className="mx-auto h-9 w-9 text-[var(--blueprint-ink)]" />
          <p className="font-typewriter mt-2 text-base font-bold">
            Drop photos here or pick from phone gallery
          </p>
          <p className="mt-1 text-xs text-[var(--ink-muted)]">
            {processingCount > 0
              ? `Stripping EXIF & preparing ${processingCount} photo(s)…`
              : 'Every uploaded photo must tag at least 1 classmate below.'}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <label className="tactile-btn inline-flex cursor-pointer items-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-2.5 text-sm font-bold text-white">
              <Upload className="h-4 w-4" /> Choose Multiple Photos
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files) void handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>

            <label className="tactile-btn inline-flex cursor-pointer items-center gap-2 rounded-md bg-[var(--paper)] px-4 py-2.5 text-sm font-bold">
              <Camera className="h-4 w-4" /> Quick Camera Snap
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  if (e.target.files) void handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {errorMsg && (
          <p role="alert" className="mt-3 text-xs font-bold text-[var(--stamp-red)]">
            {errorMsg}
          </p>
        )}

        {untaggedCount > 0 && (
          <p className="mt-4 rounded border-2 border-[var(--stamp-red)] bg-[var(--paper)] p-3 text-xs font-bold text-[var(--stamp-red)]">
            {untaggedCount} photo(s) still need at least 1 classmate tagged!
          </p>
        )}

        {/* Uploaded Photos List */}
        <div className="mt-6 space-y-4">
          {chaosPhotos.map((photo) => (
            <div
              key={photo.id}
              className="rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3.5"
            >
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="sm:w-44 shrink-0">
                  <div className="aspect-square overflow-hidden rounded border border-[var(--border-ink)] bg-[var(--manila)]">
                    {photo.previewDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.previewDataUrl}
                        alt={photo.caption || 'Chaos evidence'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs">
                        Saved ({photo.width}×{photo.height})
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono-doc">
                    <span>
                      {photo.width}×{photo.height}
                    </span>
                    {photo.error ? (
                      <button
                        type="button"
                        onClick={() => void retryUpload(photo)}
                        className="inline-flex items-center gap-1 font-bold text-[var(--stamp-red)] underline"
                      >
                        <RefreshCw className="h-3 w-3" /> Retry
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Saved
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {PHOTO_TYPES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() =>
                            upsertUpload({ ...photo, photoType: t.id })
                          }
                          className={`min-h-[36px] rounded border px-2.5 text-xs font-bold ${
                            photo.photoType === t.id
                              ? 'border-[var(--border-ink)] bg-[var(--blueprint)] text-white'
                              : 'border-[var(--border-ink)]/40 bg-[var(--paper-card)]'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeUpload(photo.id)}
                      aria-label="Remove photo"
                      className="inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--border-ink)]/40 text-[var(--stamp-red)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div>
                    <label className="font-mono-doc block text-xs font-bold uppercase">
                      One-line caption
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      placeholder="What is happening in this exhibit?"
                      value={photo.caption}
                      onChange={(e) =>
                        upsertUpload({ ...photo, caption: e.target.value })
                      }
                      className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper-card)] px-3 text-sm"
                    />
                  </div>

                  <div>
                    <p className="font-mono-doc mb-1 text-xs font-bold uppercase">
                      Tag classmates in this photo{' '}
                      <span className="text-[var(--stamp-red)]">* (min 1)</span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {ROSTER.map((r) => {
                        const tagged = photo.taggedRosterIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              const next = tagged
                                ? photo.taggedRosterIds.filter((id) => id !== r.id)
                                : [...photo.taggedRosterIds, r.id];
                              upsertUpload({ ...photo, taggedRosterIds: next });
                            }}
                            className={`min-h-[36px] rounded border px-2 text-xs font-semibold ${
                              tagged
                                ? 'border-[var(--border-ink)] bg-[var(--highlighter)] text-[#1B1B1B]'
                                : 'border-[var(--border-ink)]/35 bg-[var(--paper-card)]'
                            }`}
                          >
                            {tagged ? '✓ ' : ''}
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t-2 border-dashed border-[var(--border-ink)]/35 pt-4">
          <Link
            href="/desk"
            className="tactile-btn rounded-md bg-[var(--paper)] px-4 py-2.5 text-sm font-bold"
          >
            ← Back to Desk
          </Link>
          <Link
            href="/extra"
            className="tactile-btn rounded-md bg-[var(--blueprint)] px-5 py-2.5 text-sm font-bold text-white"
          >
            Next: Anything Else →
          </Link>
        </div>
      </NotebookCard>
    </main>
  );
}
