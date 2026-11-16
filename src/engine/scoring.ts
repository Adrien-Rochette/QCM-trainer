import type { AnswerRecord, QuestionFormat } from '../models/types';

export interface FormatScore {
  correct: number;
  total: number;
  percent: number;
}

export interface ScoreSummary {
  correct: number;
  incorrect: number;
  total: number;
  /** Pourcentage de réussite arrondi à l'entier (0 si aucune réponse). */
  percent: number;
  byFormat: Record<QuestionFormat, FormatScore>;
}

export function percentOf(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}

/** Calcule le score d'une session : une question juste vaut 1 point, sinon 0. */
export function computeScore(answers: readonly Pick<AnswerRecord, 'correct' | 'format'>[]): ScoreSummary {
  const byFormat: Record<QuestionFormat, FormatScore> = {
    qcm: { correct: 0, total: 0, percent: 0 },
    trous: { correct: 0, total: 0, percent: 0 },
  };
  let correct = 0;
  for (const answer of answers) {
    const bucket = byFormat[answer.format];
    bucket.total++;
    if (answer.correct) {
      bucket.correct++;
      correct++;
    }
  }
  for (const bucket of Object.values(byFormat)) bucket.percent = percentOf(bucket.correct, bucket.total);
  return {
    correct,
    incorrect: answers.length - correct,
    total: answers.length,
    percent: percentOf(correct, answers.length),
    byFormat,
  };
}

/** Formate une durée en « 1 min 05 s » ou « 42 s ». */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, '0')} s`;
  return `${seconds} s`;
}

/** Formate un chronomètre en « 01:05 ». */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
