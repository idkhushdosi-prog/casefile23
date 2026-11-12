'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Stamp } from './Stamp';
import { prefersReducedMotion } from '@/lib/audio';

export type FolderStatus = 'unopened' | 'in_progress' | 'filed' | 'skipped';

interface CaseFolderProps {
  label: string;
  devanagari?: string;
  caseIndex: number;
  staggerIndex?: number;
  status: FolderStatus;
  filedByOthersCount?: number;
  onClick: () => void;
}

const STATUS_BADGE: Record<FolderStatus, { text: string; color: 'ink' | 'blue' | 'green' | 'red'; led: string }> = {
  unopened: { text: 'UNOPENED', color: 'ink', led: 'bg-[var(--ink-muted)]' },
  in_progress: { text: 'IN PROGRESS', color: 'blue', led: 'bg-[var(--blueprint)]' },
  filed: { text: 'FILED', color: 'green', led: 'bg-[var(--stamp-green)]' },
  skipped: { text: 'SKIPPED', color: 'red', led: 'bg-[var(--stamp-red)]' },
};

export function CaseFolder({
  label,
  devanagari,
  caseIndex,
  staggerIndex,
  status,
  filedByOthersCount = 0,
  onClick,
}: CaseFolderProps) {
  const badge = STATUS_BADGE[status];
  const reduce = prefersReducedMotion();
  const delay = Math.min((staggerIndex ?? caseIndex - 1) * 0.022, 0.32);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.24, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduce ? undefined : { y: -4, rotate: -0.6 }}
      whileTap={reduce ? undefined : { y: 1, scale: 0.99 }}
      aria-label={`Open case folder ${caseIndex} for ${label}. Status: ${badge.text}`}
      className="group relative flex min-h-[112px] w-full flex-col justify-between text-left will-change-transform focus-visible:outline-none sm:min-h-[128px]"
    >
      {/* Manila Folder Top Tab (Cartridge Slot) */}
      <div className="flex items-end justify-between pl-2 pr-3">
        <span className="font-mono-doc inline-flex items-center gap-1.5 rounded-t-md border-2 border-b-0 border-[var(--border-ink)] bg-[var(--manila)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink)] transition-colors group-hover:bg-[var(--highlighter)] group-hover:text-[#1B1B1B]">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full border border-[var(--border-ink)] ${badge.led}`} />
          FILE #{String(caseIndex).padStart(2, '0')}
        </span>
        {filedByOthersCount > 0 && (
          <span className="font-mono-doc mb-0.5 text-[10px] text-[var(--ink-muted)]">
            {filedByOthersCount} filed
          </span>
        )}
      </div>

      {/* Manila Folder Body */}
      <div
        className={`game-panel relative flex flex-1 flex-col justify-between rounded-b-md rounded-tr-md border-2 border-[var(--border-ink)] p-3 sm:p-3.5 transition-all group-hover:shadow-[5px_7px_0_var(--shadow-paper)] ${
          status === 'filed'
            ? 'bg-[var(--manila-dark)]'
            : status === 'skipped'
            ? 'bg-[var(--paper)] opacity-90'
            : 'bg-[var(--manila)] group-hover:bg-[var(--manila-dark)]'
        }`}
      >
        {/* Paperclip decoration */}
        <span
          aria-hidden="true"
          className="absolute right-3 top-2 h-6 w-2.5 rounded-full border-2 border-[var(--ink-muted)] opacity-50 transition-transform group-hover:rotate-6"
        />

        <div>
          <h3 className="font-typewriter pr-5 text-base font-bold leading-snug text-[var(--ink)] sm:text-lg">
            {label}
          </h3>
          {devanagari && (
            <p className="text-xs text-[var(--ink-muted)]">{devanagari}</p>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 sm:mt-3">
          <Stamp text={badge.text} color={badge.color} size="sm" rotate={-3} />
          <span className="font-mono-doc inline-flex items-center gap-0.5 text-xs font-bold text-[var(--blueprint-ink)] underline-offset-2 transition-transform group-hover:translate-x-0.5 group-hover:underline">
            {status === 'filed'
              ? 'Edit →'
              : status === 'skipped'
              ? 'Reopen →'
              : status === 'in_progress'
              ? 'Resume →'
              : 'Open →'}
          </span>
        </div>
      </div>
    </motion.button>
  );
}
