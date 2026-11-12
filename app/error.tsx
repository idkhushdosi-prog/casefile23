'use client';

import { useEffect } from 'react';
import { Flame, RotateCcw } from 'lucide-react';
import { NotebookCard } from '@/components/ui/NotebookCard';
import { Stamp } from '@/components/ui/Stamp';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Case File Error:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-lg items-center justify-center px-4 py-10">
      <NotebookCard className="w-full text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[var(--stamp-red)] bg-[var(--paper)] text-[var(--stamp-red)]">
            <Flame className="h-8 w-8" />
          </div>
        </div>
        <div className="mb-3 flex justify-center">
          <Stamp text="EVIDENCE ON FIRE" color="red" rotate={-3} />
        </div>
        <h1 className="font-typewriter text-2xl font-bold">
          The case file caught fire!
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-muted)]">
          Someone knocked over the detective lamp. Your typed answers are safely backed up
          in local storage—nothing was lost.
        </p>
        {error?.message && (
          <p className="font-mono-doc mt-3 rounded border border-dashed border-[var(--border-ink)] bg-[var(--paper)] p-2 text-xs text-[var(--ink-muted)]">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="tactile-btn inline-flex items-center justify-center gap-2 rounded-md bg-[var(--stamp-red)] px-5 py-2.5 font-semibold text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Extinguish &amp; Retry
          </button>
          <a
            href="/desk"
            className="tactile-btn inline-flex items-center justify-center rounded-md bg-[var(--manila)] px-5 py-2.5 font-semibold text-[var(--ink)]"
          >
            Return to Case Desk
          </a>
        </div>
      </NotebookCard>
    </main>
  );
}
