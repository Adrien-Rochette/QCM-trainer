import { Check, X } from 'lucide-react';
import { useId } from 'react';
import { cn } from '../../lib/cn';
import type { McqPart } from '../../models/types';
import { RichText } from './RichText';

export interface McqQuestionViewProps {
  mcq: McqPart;
  /** Ordre d'affichage des propositions (identifiants). */
  order: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  /** Réponse validée : plus aucune modification possible. */
  locked: boolean;
  /** Affiche la correction (vert / rouge). */
  reveal: boolean;
}

/** Question à choix multiples : boutons radio si une seule bonne réponse, cases à cocher sinon. */
export function McqQuestionView({ mcq, order, selected, onChange, locked, reveal }: McqQuestionViewProps) {
  const name = useId();
  const multiple = mcq.correctIds.length > 1;
  const byId = new Map(mcq.choices.map((c) => [c.id, c]));
  const choices = order.map((id) => byId.get(id)).filter((c) => c !== undefined);
  const correct = new Set(mcq.correctIds);

  function toggle(id: string) {
    if (locked) return;
    if (multiple) onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
    else onChange([id]);
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg leading-relaxed font-semibold text-slate-900 sm:text-xl dark:text-white">
        <RichText text={mcq.prompt} />
      </legend>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {multiple ? 'Plusieurs réponses possibles : cochez toutes les bonnes réponses.' : 'Une seule bonne réponse.'}
      </p>
      <div className="grid gap-2.5">
        {choices.map((choice, index) => {
          const isSelected = selected.includes(choice.id);
          const isCorrect = correct.has(choice.id);
          const state = !reveal ? (isSelected ? 'selected' : 'idle') : isCorrect ? (isSelected ? 'correct' : 'missed') : isSelected ? 'wrong' : 'dim';
          const letter = String.fromCharCode(65 + index);
          return (
            <label
              key={choice.id}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500 has-[:focus-visible]:ring-offset-2 dark:has-[:focus-visible]:ring-offset-slate-900',
                locked ? 'cursor-default' : 'cursor-pointer',
                state === 'idle' && 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-indigo-500/60 dark:hover:bg-indigo-500/5',
                state === 'selected' && 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/10',
                state === 'correct' && 'border-emerald-500 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-500/10',
                state === 'missed' && 'border-emerald-500 border-dashed bg-emerald-50/40 dark:bg-emerald-500/5',
                state === 'wrong' && 'border-rose-500 bg-rose-50 dark:border-rose-500 dark:bg-rose-500/10',
                state === 'dim' && 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900',
              )}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                name={name}
                value={choice.id}
                checked={isSelected}
                onChange={() => toggle(choice.id)}
                disabled={locked}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center text-sm font-bold transition-colors',
                  multiple ? 'rounded-lg' : 'rounded-full',
                  state === 'idle' && 'bg-slate-100 text-slate-600 group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300',
                  state === 'selected' && 'bg-indigo-600 text-white dark:bg-indigo-500',
                  (state === 'correct' || state === 'missed') && 'bg-emerald-600 text-white',
                  state === 'wrong' && 'bg-rose-600 text-white',
                  state === 'dim' && 'bg-slate-100 text-slate-500 dark:bg-slate-800',
                )}
              >
                {state === 'correct' || state === 'missed' ? <Check className="size-4" /> : state === 'wrong' ? <X className="size-4" /> : letter}
              </span>
              <span className="flex-1 text-[0.95rem] text-slate-800 dark:text-slate-100">
                <span className="sr-only">{letter}. </span>
                <RichText text={choice.text} />
              </span>
              {reveal && state === 'missed' && (
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Bonne réponse non cochée</span>
              )}
              {reveal && state === 'wrong' && <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Votre choix</span>}
              {reveal && state === 'correct' && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Votre choix</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
