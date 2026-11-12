'use client';

import { DIAGRAM_AREAS, DIAGRAM_PROMPTS, type DiagramArea } from '@/data/diagramPrompts';

export interface DiagramLabel {
  promptId: string;
  promptText: string;
  value: string;
}

export type DiagramLabelValue = Partial<Record<DiagramArea, DiagramLabel>>;

interface NcertDiagramProps {
  subjectLabel: string;
  labels: DiagramLabelValue;
  onChange: (labels: DiagramLabelValue) => void;
}

export function NcertDiagram({ subjectLabel, labels, onChange }: NcertDiagramProps) {
  const updateArea = (area: DiagramArea, patch: Partial<DiagramLabel>) => {
    const current = labels[area] ?? { promptId: '', promptText: '', value: '' };
    onChange({ ...labels, [area]: { ...current, ...patch } });
  };

  return (
    <fieldset className="space-y-3 rounded border-2 border-[var(--blueprint-ink)]/50 bg-[var(--paper)] p-3">
      <legend className="px-1 font-mono-doc text-xs font-bold uppercase text-[var(--blueprint-ink)]">
        Specimen diagram labels — {subjectLabel}
      </legend>
      <p className="text-xs text-[var(--ink-muted)]">
        Choose a prompt and add a short observation for at least two body or belongings areas.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.entries(DIAGRAM_AREAS) as [DiagramArea, (typeof DIAGRAM_AREAS)[DiagramArea]][]).map(
          ([area, areaMeta]) => {
            const label = labels[area] ?? { promptId: '', promptText: '', value: '' };
            const prompts = DIAGRAM_PROMPTS.filter((prompt) => prompt.area === area);
            return (
              <div
                key={area}
                className="rounded border border-[var(--border-ink)]/50 p-2.5"
              >
                <label
                  htmlFor={`diagram-prompt-${area}`}
                  className="font-mono-doc block text-xs font-bold uppercase"
                >
                  {areaMeta.label}
                </label>
                <select
                  id={`diagram-prompt-${area}`}
                  value={label.promptId}
                  onChange={(event) => {
                    const prompt = prompts.find((item) => item.id === event.target.value);
                    updateArea(area, {
                      promptId: prompt?.id ?? '',
                      promptText: prompt?.text ?? '',
                    });
                  }}
                  className="mt-1 min-h-[40px] w-full rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2 text-xs"
                >
                  <option value="">Choose a prompt…</option>
                  {prompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.text}
                    </option>
                  ))}
                </select>
                {label.promptId && (
                  <input
                    type="text"
                    maxLength={160}
                    aria-label={`${areaMeta.label} observation`}
                    placeholder={
                      prompts.find((prompt) => prompt.id === label.promptId)?.example ??
                      'Add an observation…'
                    }
                    value={label.value}
                    onChange={(event) => updateArea(area, { value: event.target.value })}
                    className="mt-1.5 min-h-[40px] w-full rounded border border-[var(--border-ink)] bg-[var(--paper-card)] px-2 text-xs"
                  />
                )}
              </div>
            );
          }
        )}
      </div>
    </fieldset>
  );
}
