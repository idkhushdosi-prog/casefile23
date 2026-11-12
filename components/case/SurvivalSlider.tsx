'use client';

import { getStatThumbMeta } from '@/data/questions';

interface SurvivalSliderProps {
  id: string;
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
}

export function SurvivalSlider({
  id,
  label,
  description,
  value,
  onChange,
}: SurvivalSliderProps) {
  const thumbMeta = getStatThumbMeta(value);

  return (
    <div className="rounded border border-[var(--border-ink)]/50 bg-[var(--paper)] p-3">
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={id} className="font-typewriter text-sm font-bold">
          {label}
          <span className="mt-0.5 block font-sans text-xs font-normal text-[var(--ink-muted)]">
            {description}
          </span>
        </label>
        <span className="shrink-0 font-mono-doc text-xs font-bold" aria-live="polite">
          {thumbMeta.emoji} {value}/100
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full accent-[var(--blueprint)]"
      />
      <p className="font-mono-doc text-[10px] text-[var(--ink-muted)]">{thumbMeta.label}</p>
    </div>
  );
}
