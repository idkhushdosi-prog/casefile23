'use client';

const benchSeats = ['W1', 'W2', 'M1', 'M2', 'D1', 'D2'] as const;
const benchRows = Array.from({ length: 5 }, (_, index) => index + 1);
const benches = benchRows.flatMap((row) =>
  benchSeats.map((seat) => ({
    id: `R${row}-${seat}`,
    label: `Row ${row}, ${seat.startsWith('W') ? 'window' : seat.startsWith('M') ? 'middle' : 'door'} seat ${seat.slice(1)}`,
  }))
);

interface HabitatGridProps {
  selectedBench: string;
  onSelectBench: (bench: string) => void;
}

export function HabitatGrid({ selectedBench, onSelectBench }: HabitatGridProps) {
  return (
    <div
      role="group"
      aria-label="Choose a classroom seat"
      className="grid grid-cols-3 gap-2 sm:grid-cols-6"
    >
      {benches.map((bench) => {
        const selected = selectedBench === bench.id;
        return (
          <button
            key={bench.id}
            type="button"
            aria-label={bench.label}
            aria-pressed={selected}
            onClick={() => onSelectBench(bench.id)}
            className={`min-h-[44px] rounded border-2 px-2 py-1 font-mono-doc text-xs font-bold ${
              selected
                ? 'border-[var(--blueprint)] bg-[var(--highlighter)] text-[#1B1B1B]'
                : 'border-[var(--border-ink)] bg-[var(--paper)] hover:bg-[var(--manila)]'
            }`}
          >
            {bench.id}
          </button>
        );
      })}
    </div>
  );
}
