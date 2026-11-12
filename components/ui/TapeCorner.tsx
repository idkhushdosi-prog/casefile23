'use client';

import React from 'react';

export function TapeCorner({
  position = 'top-left',
  className = '',
}: {
  position?: 'top-left' | 'top-right' | 'top-center';
  className?: string;
}) {
  const posClass =
    position === 'top-left'
      ? '-top-2.5 left-4 -rotate-12'
      : position === 'top-right'
      ? '-top-2.5 right-4 rotate-12'
      : '-top-3 left-1/2 -translate-x-1/2 -rotate-2';

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 h-6 w-16 border border-black/10 bg-[var(--tape-bg)] shadow-sm backdrop-blur-[1px] ${posClass} ${className}`}
    />
  );
}
