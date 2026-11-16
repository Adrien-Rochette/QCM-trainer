import { useEffect, useRef } from 'react';
import { splitCloze } from '../../lib/cloze';
import { cn } from '../../lib/cn';
import type { ClozePart } from '../../models/types';
import { RichText } from './RichText';

export interface ClozeQuestionViewProps {
  cloze: ClozePart;
  values: string[];
  onChange: (values: string[]) => void;
  locked: boolean;
  /** Résultat par blanc, une fois la réponse validée. */
  results?: boolean[];
  /** Appelé lorsque l'utilisateur appuie sur Entrée. */
  onEnter?: () => void;
  autoFocus?: boolean;
}

/** Phrase à compléter : un champ de saisie est inséré à la place de chaque blanc. */
export function ClozeQuestionView({ cloze, values, onChange, locked, results, onEnter, autoFocus }: ClozeQuestionViewProps) {
  const segments = splitCloze(cloze.text);
  const firstInput = useRef<HTMLInputElement>(null);
  const multiple = cloze.blanks.length > 1;

  useEffect(() => {
    if (autoFocus && !locked) firstInput.current?.focus();
  }, [autoFocus, locked, cloze]);

  function update(index: number, value: string) {
    const next = [...values];
    while (next.length < cloze.blanks.length) next.push('');
    next[index] = value;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {multiple ? 'Complétez les mots ou expressions manquants.' : 'Complétez le mot ou l’expression manquante.'}
      </p>
      <p className="text-lg leading-[2.6] font-semibold text-slate-900 sm:text-xl dark:text-white">
        {segments.map((segment, i) => {
          if (segment.kind === 'text') return <RichText key={i} text={segment.value} />;
          const value = values[segment.index] ?? '';
          const result = results?.[segment.index];
          return (
            <input
              key={i}
              ref={segment.index === 0 ? firstInput : undefined}
              type="text"
              value={value}
              onChange={(e) => update(segment.index, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onEnter?.();
                }
              }}
              readOnly={locked}
              aria-label={multiple ? `Blanc ${segment.index + 1}` : 'Votre réponse'}
              aria-invalid={result === false ? true : undefined}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              size={Math.max(10, value.length + 2)}
              placeholder="…"
              className={cn(
                'mx-1 inline-block max-w-full rounded-lg border-0 border-b-2 bg-slate-100 px-3 py-1 text-center align-baseline text-lg font-semibold outline-none transition-colors placeholder:text-slate-400 sm:text-xl dark:bg-slate-800',
                result === undefined && 'border-indigo-400 text-indigo-700 focus:border-indigo-600 focus:bg-indigo-50 dark:text-indigo-300 dark:focus:bg-indigo-500/10',
                result === true && 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
                result === false && 'border-rose-500 bg-rose-50 text-rose-800 line-through decoration-2 dark:bg-rose-500/10 dark:text-rose-300',
              )}
            />
          );
        })}
      </p>
      {!locked && <p className="text-xs text-slate-500 dark:text-slate-400">Appuyez sur Entrée pour valider.</p>}
    </div>
  );
}
