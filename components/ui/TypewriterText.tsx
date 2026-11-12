'use client';

import React, { useEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/audio';

interface TypewriterTextProps {
  text: string;
  speedMs?: number;
  className?: string;
  showCursor?: boolean;
}

export function TypewriterText({
  text,
  speedMs = 20,
  className = '',
  showCursor = false,
}: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState(text);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setDisplayed(text);
      return;
    }
    setDisplayed('');
    let idx = 0;
    const timer = setInterval(() => {
      idx += 1;
      setDisplayed(text.slice(0, idx));
      if (idx >= text.length) {
        clearInterval(timer);
      }
    }, speedMs);
    return () => clearInterval(timer);
  }, [text, speedMs]);

  return (
    <span className={`font-typewriter ${className}`}>
      {displayed}
      {showCursor && displayed.length < text.length && (
        <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-current align-middle" />
      )}
    </span>
  );
}
