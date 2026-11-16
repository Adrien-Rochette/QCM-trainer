import { percentOf } from '../engine/scoring';
import type { Question, SessionRecord } from '../models/types';

export interface MissedQuestion {
  questionId: string;
  prompt: string;
  misses: number;
  attempts: number;
  missRate: number;
  /** Faux si la question a été supprimée depuis. */
  stillExists: boolean;
}

export interface SessionsSummary {
  quizCount: number;
  averagePercent: number;
  bestPercent: number;
  totalAnswers: number;
  correctAnswers: number;
  /** Taux de réussite sur l'ensemble des réponses données (en %). */
  successRate: number;
  totalDurationMs: number;
}

export function summarizeSessions(sessions: readonly SessionRecord[]): SessionsSummary {
  let totalAnswers = 0;
  let correctAnswers = 0;
  let percentSum = 0;
  let best = 0;
  let totalDurationMs = 0;
  for (const s of sessions) {
    totalAnswers += s.total;
    correctAnswers += s.correctCount;
    percentSum += s.percent;
    best = Math.max(best, s.percent);
    totalDurationMs += s.durationMs;
  }
  return {
    quizCount: sessions.length,
    averagePercent: sessions.length ? Math.round(percentSum / sessions.length) : 0,
    bestPercent: best,
    totalAnswers,
    correctAnswers,
    successRate: percentOf(correctAnswers, totalAnswers),
    totalDurationMs,
  };
}

/** Sessions les plus récentes en premier. */
export function recentSessions(sessions: readonly SessionRecord[], limit = 5): SessionRecord[] {
  return [...sessions].sort((a, b) => b.finishedAt - a.finishedAt).slice(0, limit);
}

export function questionPrompt(question: Question): string {
  return question.mcq?.prompt ?? question.cloze?.text ?? '';
}

/**
 * Questions fréquemment ratées : nombre d'erreurs décroissant, puis taux d'erreur.
 * Les deux formats (QCM et à trous) d'une même question sont regroupés.
 */
export function frequentlyMissed(
  sessions: readonly SessionRecord[],
  questions: readonly Question[] = [],
  limit = 10,
): MissedQuestion[] {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const acc = new Map<string, { prompt: string; misses: number; attempts: number }>();
  for (const session of sessions) {
    for (const answer of session.answers) {
      const entry = acc.get(answer.questionId) ?? { prompt: answer.prompt, misses: 0, attempts: 0 };
      entry.attempts++;
      if (!answer.correct) entry.misses++;
      acc.set(answer.questionId, entry);
    }
  }
  return [...acc.entries()]
    .filter(([, e]) => e.misses > 0)
    .map(([questionId, e]) => {
      const current = byId.get(questionId);
      return {
        questionId,
        prompt: current ? questionPrompt(current) : e.prompt,
        misses: e.misses,
        attempts: e.attempts,
        missRate: percentOf(e.misses, e.attempts),
        stillExists: current !== undefined || questions.length === 0,
      };
    })
    .sort((a, b) => b.misses - a.misses || b.missRate - a.missRate || a.prompt.localeCompare(b.prompt, 'fr'))
    .slice(0, limit);
}

/**
 * Questions à réviser : celles dont la réponse la plus récente était fausse.
 * Une question ratée puis réussie ensuite n'en fait plus partie.
 */
export function mistakeQuestionIds(sessions: readonly SessionRecord[]): Set<string> {
  const latest = new Map<string, boolean>();
  const ordered = [...sessions].sort((a, b) => a.finishedAt - b.finishedAt);
  for (const session of ordered) {
    for (const answer of session.answers) latest.set(answer.questionId, answer.correct);
  }
  return new Set([...latest.entries()].filter(([, correct]) => !correct).map(([id]) => id));
}

export interface SubjectOverview extends SessionsSummary {
  subjectId: string;
  title: string;
  lastPlayedAt?: number;
}

export function overviewBySubject(
  sessions: readonly SessionRecord[],
  subjects: readonly { id: string; title: string }[],
): SubjectOverview[] {
  return subjects.map((subject) => {
    const own = sessions.filter((s) => s.subjectId === subject.id);
    const last = own.reduce<number | undefined>((max, s) => (max === undefined || s.finishedAt > max ? s.finishedAt : max), undefined);
    return { subjectId: subject.id, title: subject.title, ...summarizeSessions(own), ...(last !== undefined ? { lastPlayedAt: last } : {}) };
  });
}
