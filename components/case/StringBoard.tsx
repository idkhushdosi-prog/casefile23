'use client';

import { ROSTER } from '@/data/roster';

interface StringBoardProps {
  subjectId: string;
  selfId: string;
  selectedPartners: string[];
  onChange: (partners: string[]) => void;
}

export function StringBoard({
  subjectId,
  selfId,
  selectedPartners,
  onChange,
}: StringBoardProps) {
  const classmates = ROSTER.filter(
    (student) => student.id !== subjectId && student.id !== selfId
  );

  const togglePartner = (id: string) => {
    onChange(
      selectedPartners.includes(id)
        ? selectedPartners.filter((partnerId) => partnerId !== id)
        : [...selectedPartners, id]
    );
  };

  return (
    <div
      role="group"
      aria-label="Choose partners in crime"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {classmates.map((student) => {
        const selected = selectedPartners.includes(student.id);
        return (
          <button
            key={student.id}
            type="button"
            aria-pressed={selected}
            onClick={() => togglePartner(student.id)}
            className={`min-h-[44px] rounded border-2 px-2 py-2 text-left text-xs font-bold ${
              selected
                ? 'border-[var(--stamp-red)] bg-[var(--highlighter)] text-[#1B1B1B]'
                : 'border-[var(--border-ink)] bg-[var(--paper)] hover:bg-[var(--manila)]'
            }`}
          >
            {selected ? '● ' : '○ '}
            {student.label}
          </button>
        );
      })}
    </div>
  );
}
