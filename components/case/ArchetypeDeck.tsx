'use client';

import { ARCHETYPES } from '@/data/archetypes';

interface ArchetypeDeckProps {
  selectedId: string;
  customTitle: string;
  onSelect: (id: string, customTitle?: string) => void;
}

export function ArchetypeDeck({
  selectedId,
  customTitle,
  onSelect,
}: ArchetypeDeckProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {ARCHETYPES.map((archetype) => {
          const selected = selectedId === archetype.id;
          return (
            <button
              key={archetype.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(archetype.id, archetype.isCustom ? customTitle : undefined)}
              className={`min-h-[90px] rounded-md border-2 p-3 text-left transition-colors ${
                selected
                  ? 'border-[var(--blueprint)] bg-[var(--highlighter)] text-[#1B1B1B]'
                  : 'border-[var(--border-ink)] bg-[var(--paper)] hover:bg-[var(--manila)]'
              }`}
            >
              <span className="flex items-center gap-2 font-typewriter text-sm font-bold">
                <span aria-hidden="true">{archetype.emoji}</span>
                {archetype.title}
              </span>
              <span className="mt-1 block text-xs">{archetype.tagline}</span>
            </button>
          );
        })}
      </div>
      {selectedId === 'custom' && (
        <label className="block font-mono-doc text-xs font-bold uppercase">
          Custom archetype title
          <input
            type="text"
            maxLength={80}
            value={customTitle}
            onChange={(event) => onSelect('custom', event.target.value)}
            className="mt-1 min-h-[44px] w-full rounded border-2 border-[var(--border-ink)] bg-[var(--paper)] px-3 text-sm font-normal normal-case"
          />
        </label>
      )}
    </div>
  );
}
