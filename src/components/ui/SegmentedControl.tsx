import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string | number> {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
}

/** Groupe de boutons radio (navigation aux flèches, comme un groupe radio natif). */
export function SegmentedControl<T extends string | number>({ label, value, options, onChange, hideLabel }: SegmentedControlProps<T>) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    for (let step = 1; step <= options.length; step++) {
      const next = (index + dir * step + options.length) % options.length;
      const option = options[next];
      if (option && !option.disabled) {
        onChange(option.value);
        refs.current[next]?.focus();
        return;
      }
    }
  }

  return (
    <div className="space-y-1.5">
      <div id={labelId} className={cn('text-sm font-medium text-slate-700 dark:text-slate-200', hideLabel && 'sr-only')}>
        {label}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800/80"
      >
        {options.map((option, i) => {
          const selected = option.value === value;
          return (
            <button
              key={String(option.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                'min-w-14 flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40',
                selected
                  ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
