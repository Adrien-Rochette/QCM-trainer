import { CheckCircle2, Clock, Lightbulb, XCircle } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { AnswerRecord, Question } from '../../models/types';
import { RichText } from './RichText';

/** Correction affichée après validation : résultat, bonne réponse et explication. */
export function FeedbackPanel({ answer, question }: { answer: AnswerRecord; question: Question }) {
  const alternatives =
    answer.format === 'trous' && question.cloze
      ? question.cloze.blanks.map((b) => b.answers.slice(1)).filter((list) => list.length > 0)
      : [];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'animate-slide-up rounded-2xl border px-5 py-4',
        answer.correct
          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : 'border-rose-200 bg-rose-50/70 dark:border-rose-500/30 dark:bg-rose-500/10',
      )}
    >
      <div className="flex items-center gap-2">
        {answer.correct ? (
          <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        ) : (
          <XCircle className="size-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
        )}
        <p className={cn('font-semibold', answer.correct ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200')}>
          {answer.correct ? 'Bonne réponse !' : answer.timedOut ? 'Temps écoulé' : 'Réponse incorrecte'}
        </p>
        {answer.timedOut && <Clock className="size-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />}
      </div>

      {!answer.correct && (
        <div className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
          <p>
            {answer.format === 'qcm' ? 'Réponse(s) attendue(s) : ' : 'Réponse attendue : '}
            <strong className="font-semibold text-slate-900 dark:text-white">
              <RichText text={answer.expectedLabel} />
            </strong>
          </p>
          {answer.format === 'trous' && answer.givenLabel !== '(aucune réponse)' && (
            <p className="text-slate-500 dark:text-slate-400">Vous avez écrit : « {answer.givenLabel} »</p>
          )}
        </div>
      )}
      {alternatives.length > 0 && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Également accepté : {alternatives.map((list) => list.join(', ')).join(' / ')}
        </p>
      )}

      {question.explanation && (
        <div className="mt-3 flex gap-2 border-t border-black/5 pt-3 text-sm leading-relaxed text-slate-700 dark:border-white/10 dark:text-slate-200">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
          <p>
            <RichText text={question.explanation} />
          </p>
        </div>
      )}
    </div>
  );
}
