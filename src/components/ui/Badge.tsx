import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { Difficulty, QuestionFormat } from '../../models/types';
import { DIFFICULTY_LABELS, FORMAT_LABELS } from '../../models/types';

export type BadgeTone = 'neutral' | 'indigo' | 'violet' | 'sky' | 'emerald' | 'amber' | 'rose';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const DIFFICULTY_TONES: Record<Difficulty, BadgeTone> = { facile: 'emerald', moyen: 'amber', difficile: 'rose' };

export function DifficultyBadge({ difficulty }: { difficulty?: Difficulty }) {
  if (!difficulty) return null;
  return <Badge tone={DIFFICULTY_TONES[difficulty]}>{DIFFICULTY_LABELS[difficulty]}</Badge>;
}

export const FORMAT_TONES: Record<QuestionFormat, BadgeTone> = { qcm: 'indigo', trous: 'sky' };

export function FormatBadge({ format }: { format: QuestionFormat }) {
  return <Badge tone={FORMAT_TONES[format]}>{FORMAT_LABELS[format]}</Badge>;
}
