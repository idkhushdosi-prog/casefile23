'use client';

import React from 'react';
import { TapeCorner } from './TapeCorner';

interface NotebookCardProps {
  children: React.ReactNode;
  ruled?: boolean;
  taped?: boolean;
  className?: string;
}

export function NotebookCard({
  children,
  ruled = false,
  taped = true,
  className = '',
}: NotebookCardProps) {
  return (
    <div
      className={`game-panel relative rounded-md border-2 border-[var(--border-ink)] p-3.5 sm:p-6 shadow-[4px_5px_0_var(--shadow-paper)] ${
        ruled ? 'ruled-paper pl-7 sm:pl-14' : 'bg-[var(--paper-card)]'
      } ${className}`}
    >
      {taped && <TapeCorner position="top-center" />}
      {children}
    </div>
  );
}
