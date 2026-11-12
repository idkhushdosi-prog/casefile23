'use client';

import React from 'react';

interface EvidenceTagProps {
  label: string;
  tone?: 'yellow' | 'red' | 'blue' | 'manila';
  className?: string;
}

const TONE_MAP = {
  yellow: 'bg-[var(--highlighter)] text-[#1B1B1B]',
  red: 'bg-[var(--stamp-red)] text-white',
  blue: 'bg-[var(--blueprint)] text-white',
  manila: 'bg-[var(--manila-dark)] text-[var(--ink)]',
};

export function EvidenceTag({
  label,
  tone = 'yellow',
  className = '',
}: EvidenceTagProps) {
  return (
    <span
      className={`font-mono-doc inline-flex items-center gap-1.5 rounded-sm border border-[var(--border-ink)] px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide shadow-[1px_2px_0_var(--border-ink)] ${TONE_MAP[tone]} ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full border border-current bg-[var(--paper)]"
      />
      {label}
    </span>
  );
}
