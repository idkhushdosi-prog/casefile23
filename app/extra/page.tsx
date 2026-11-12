'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Paperclip, Plus, Sparkles, Trash2 } from 'lucide-react';
import { ROSTER, getRosterById } from '@/data/roster';
import { TEXT_LIMITS } from '@/data/questions';
import { stripExifAndMeasure } from '@/lib/imageUtils';
import { uploadImageToSupabase, flushSyncQueue } from '@/lib/sync';
import { useAppStore } from '@/store/useAppStore';
import { playSound } from '@/lib/audio';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { EvidenceTag } from '@/components/ui/EvidenceTag';
import { generateUuid } from '@/lib/crypto';

export default function AnythingElsePage() {
  const contributor = useAppStore((s) => s.contributor);
  const anythingElse = useAppStore((s) => s.anythingElse);
  const addAnythingElse = useAppStore((s) => s.addAnythingElse);
  const removeAnythingElse = useAppStore((s) => s.removeAnythingElse);
  const editorNote = useAppStore((s) => s.editorNote);
  const setEditorNote = useAppStore((s) => s.setEditorNote);
  const upsertUpload = useAppStore((s) => s.upsertUpload);

  const [taggedRosterId, setTaggedRosterId] = useState<string>(''); // '' = Whole class
  const [body, setBody] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  if (!contributor) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10">
        <NotebookCard className="text-center">
          <h1 className="font-typewriter text-2xl font-bold">Wild Card Locked</h1>
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

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() && !attachedFile) return;

    setSaving(true);
    try {
      let uploadId: string | null = null;
      if (attachedFile) {
        uploadId = generateUuid();

        let blobToUpload: Blob = attachedFile;
        let width = 0;
        let height = 0;
        let previewDataUrl: string | undefined;
        let sha256Hash: string | undefined;
        let mimeType = attachedFile.type || 'application/octet-stream';
        let ext = attachedFile.name.split('.').pop() || 'bin';

        if (attachedFile.type.startsWith('image/')) {
          const clean = await stripExifAndMeasure(attachedFile);
          blobToUpload = clean.file;
          width = clean.width;
          height = clean.height;
          previewDataUrl = clean.previewDataUrl;
          sha256Hash = clean.sha256;
          mimeType = clean.mimeType;
          ext = clean.ext;
        }

        const { storagePath, uploaded, error } = await uploadImageToSupabase({
          blob: blobToUpload,
          folder: 'extra',
          filename: `extra-${uploadId}.${ext}`,
          mimeType,
        });

        upsertUpload({
          id: uploadId,
          kind: 'extra',
          storagePath,
          previewDataUrl,
          caption: body.trim().slice(0, 140),
          taggedRosterIds: taggedRosterId ? [taggedRosterId] : [],
          sha256Hash,
          width,
          height,
          synced: uploaded,
          error: error || null,
          createdAt: new Date().toISOString(),
        });
      }

      const id = generateUuid();

      addAnythingElse({
        id,
        taggedRosterId: taggedRosterId || null,
        body: body.trim().slice(0, TEXT_LIMITS.EXTRA),
        uploadId,
        createdAt: new Date().toISOString(),
      });

      setBody('');
      setAttachedFile(null);
      void playSound('stamp');
      void flushSyncQueue();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-3 py-5 sm:px-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <EvidenceTag label="THE WILD CARD • ANYTHING ELSE" tone="yellow" />
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
          <Sparkles className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          Anything Else (Unlimited Entries)
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">
          Drop extra stories, inside jokes, doodle descriptions, scanned notes, or warnings
          for a specific classmate or the whole batch. Up to 10,000 characters per entry.
        </p>

        <form onSubmit={(e) => void handleAddEntry(e)} className="mt-5 space-y-3 rounded-md border-2 border-[var(--border-ink)] bg-[var(--manila)] p-4">
          <div>
            <label
              htmlFor="extra-target"
              className="font-mono-doc block text-xs font-bold uppercase"
            >
              Who is this about?
            </label>
            <select
              id="extra-target"
              value={taggedRosterId}
              onChange={(e) => setTaggedRosterId(e.target.value)}
              className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm font-medium"
            >
              <option value="">Whole Class (Batch 23)</option>
              {ROSTER.filter((r) => r.id !== contributor.rosterId).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="extra-body" className="font-mono-doc block text-xs font-bold uppercase">
              Story / Fact / Warning / Rant / Note
            </label>
            <textarea
              id="extra-body"
              rows={4}
              maxLength={TEXT_LIMITS.EXTRA}
              placeholder="Write as much as you want..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="tactile-btn inline-flex cursor-pointer items-center gap-2 rounded bg-[var(--paper)] px-3 py-2 text-xs font-bold">
              <Paperclip className="h-4 w-4" />
              {attachedFile ? attachedFile.name : 'Optional Photo / Scanned Note'}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={(e) => setAttachedFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <button
              type="submit"
              disabled={saving || (!body.trim() && !attachedFile)}
              className="tactile-btn inline-flex items-center gap-2 rounded-md bg-[var(--blueprint)] px-5 py-2.5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              {saving ? 'Adding Exhibit…' : 'Add Wild Card Entry'}
            </button>
          </div>
        </form>

        {/* Entries list */}
        {anythingElse.length > 0 && (
          <div className="mt-5 space-y-2.5">
            <h2 className="font-mono-doc text-xs font-bold uppercase text-[var(--ink-muted)]">
              Your Wild Card Submissions ({anythingElse.length})
            </h2>
            {anythingElse.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] p-3"
              >
                <div>
                  <span className="font-mono-doc inline-block rounded bg-[var(--highlighter)] px-2 py-0.5 text-[10px] font-bold text-[#1B1B1B]">
                    {item.taggedRosterId
                      ? getRosterById(item.taggedRosterId)?.label ?? item.taggedRosterId
                      : 'WHOLE CLASS'}
                  </span>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{item.body}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeAnythingElse(item.id)}
                  aria-label="Delete wild card entry"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded text-[var(--stamp-red)] hover:bg-[var(--manila)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Final Box: Anything the editor should know? */}
        <div className="mt-6 rounded-md border-2 border-[var(--border-ink)] bg-[var(--paper)] p-4">
          <label
            htmlFor="editor-note-box"
            className="font-typewriter block text-base font-bold"
          >
            Anything the editor should know?
          </label>
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
            Spelling corrections, things to keep out of print, or secret ideas for the final book.
          </p>
          <textarea
            id="editor-note-box"
            rows={3}
            maxLength={TEXT_LIMITS.EXTRA}
            placeholder="Private message straight to the editor..."
            value={editorNote}
            onChange={(e) => setEditorNote(e.target.value)}
            className="mt-2 w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper-card)] p-3 text-sm"
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <Link
            href="/desk"
            onClick={() => void flushSyncQueue()}
            className="tactile-btn rounded-md bg-[var(--paper)] px-4 py-2.5 text-sm font-bold"
          >
            ← Back to Desk
          </Link>
          <Link
            href="/review"
            onClick={() => void flushSyncQueue()}
            className="tactile-btn rounded-md bg-[var(--stamp-red)] px-5 py-2.5 text-sm font-bold text-white"
          >
            Go to Final Review →
          </Link>
        </div>
      </NotebookCard>
    </main>
  );
}
