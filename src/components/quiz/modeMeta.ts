import { ListChecks, PenLine, Shuffle, type LucideIcon } from 'lucide-react';
import type { QuizMode } from '../../models/types';

export interface ModeMeta {
  title: string;
  description: string;
  icon: LucideIcon;
  /** Classes de couleur de la carte (icône, halo). */
  accent: string;
  ring: string;
}

export const MODE_META: Record<QuizMode, ModeMeta> = {
  qcm: {
    title: 'Mode QCM',
    description: 'Répondez à des questions à choix multiples : une ou plusieurs bonnes réponses.',
    icon: ListChecks,
    accent: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    ring: 'hover:border-indigo-300 dark:hover:border-indigo-500/50',
  },
  trous: {
    title: 'Mode Compléter',
    description: 'Retrouvez le mot ou l’expression manquante dans une phrase.',
    icon: PenLine,
    accent: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    ring: 'hover:border-sky-300 dark:hover:border-sky-500/50',
  },
  mixte: {
    title: 'Mode Mixte',
    description: 'Alternez aléatoirement entre QCM et phrases à compléter.',
    icon: Shuffle,
    accent: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    ring: 'hover:border-violet-300 dark:hover:border-violet-500/50',
  },
};
