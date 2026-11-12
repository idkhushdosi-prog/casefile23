'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface StampProps {
  text: string;
  color?: 'red' | 'blue' | 'ink' | 'green';
  rotate?: number;
  size?: 'sm' | 'md' | 'lg';
  animateSlam?: boolean;
  className?: string;
}

const COLOR_MAP = {
  red: 'border-[var(--stamp-red)] text-[var(--stamp-red)]',
  blue: 'border-[var(--blueprint-ink)] text-[var(--blueprint-ink)]',
  ink: 'border-[var(--ink)] text-[var(--ink)]',
  green: 'border-emerald-700 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400',
};

const SIZE_MAP = {
  sm: 'px-2 py-0.5 text-xs border-2',
  md: 'px-3 py-1 text-sm border-[3px]',
  lg: 'px-4 py-1.5 text-lg sm:text-xl border-4',
};

export function Stamp({
  text,
  color = 'red',
  rotate = -6,
  size = 'md',
  animateSlam = false,
  className = '',
}: StampProps) {
  const baseClass = `font-stamp inline-block select-none rounded-sm uppercase tracking-wider opacity-90 shadow-[inset_0_0_0_1px_currentColor] ${COLOR_MAP[color]} ${SIZE_MAP[size]} ${className}`;

  if (animateSlam) {
    return (
      <motion.span
        initial={{ scale: 2.2, opacity: 0, rotate: rotate - 10 }}
        animate={{ scale: 1, opacity: 0.92, rotate }}
        transition={{ type: 'spring', stiffness: 420, damping: 20 }}
        className={baseClass}
      >
        {text}
      </motion.span>
    );
  }

  return (
    <span style={{ transform: `rotate(${rotate}deg)` }} className={baseClass}>
      {text}
    </span>
  );
}
