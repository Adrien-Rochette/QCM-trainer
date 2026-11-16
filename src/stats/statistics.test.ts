import { describe, expect, it } from 'vitest';
import { mcqQuestion, sessionRecord } from '../test/factories';
import { frequentlyMissed, mistakeQuestionIds, overviewBySubject, recentSessions, summarizeSessions } from './statistics';

describe('Statistiques', () => {
  const s1 = sessionRecord([{ questionId: 'a', correct: false }, { questionId: 'b', correct: true }], { finishedAt: 100 });
  const s2 = sessionRecord([{ questionId: 'a', correct: false }, { questionId: 'b', correct: false }], { finishedAt: 200 });
  const s3 = sessionRecord([{ questionId: 'a', correct: true }, { questionId: 'c', correct: true }], { finishedAt: 300 });

  it('calcule nombre de quiz, score moyen, meilleur score et taux de réussite', () => {
    const summary = summarizeSessions([s1, s2, s3]);
    expect(summary.quizCount).toBe(3);
    expect(summary.averagePercent).toBe(50); // (50 + 0 + 100) / 3
    expect(summary.bestPercent).toBe(100);
    expect(summary.totalAnswers).toBe(6);
    expect(summary.successRate).toBe(50);
  });

  it('gère l’absence d’historique', () => {
    expect(summarizeSessions([])).toMatchObject({ quizCount: 0, averagePercent: 0, bestPercent: 0, successRate: 0 });
  });

  it('classe les questions les plus souvent ratées', () => {
    const missed = frequentlyMissed([s1, s2, s3]);
    expect(missed.map((m) => m.questionId)).toEqual(['a', 'b']);
    expect(missed[0]).toMatchObject({ misses: 2, attempts: 3, missRate: 67 });
  });

  it('utilise l’énoncé actuel et signale les questions supprimées', () => {
    const current = mcqQuestion({ id: 'a' });
    const missed = frequentlyMissed([s1, s2], [current]);
    expect(missed.find((m) => m.questionId === 'a')).toMatchObject({ prompt: current.mcq!.prompt, stillExists: true });
    expect(missed.find((m) => m.questionId === 'b')).toMatchObject({ stillExists: false });
  });

  it('retient comme erreurs les questions dont la dernière réponse est fausse', () => {
    expect([...mistakeQuestionIds([s3, s1, s2])].sort()).toEqual(['b']);
  });

  it('trie les résultats récents du plus récent au plus ancien', () => {
    expect(recentSessions([s1, s3, s2], 2).map((s) => s.finishedAt)).toEqual([300, 200]);
  });

  it('résume l’activité par sujet', () => {
    const other = sessionRecord([{ questionId: 'x', correct: true }], { subjectId: 's2', finishedAt: 50 });
    const overview = overviewBySubject([s1, s2, other], [
      { id: 's1', title: 'Un' },
      { id: 's2', title: 'Deux' },
      { id: 's3', title: 'Trois' },
    ]);
    expect(overview.map((o) => o.quizCount)).toEqual([2, 1, 0]);
    expect(overview[0]!.lastPlayedAt).toBe(200);
    expect(overview[2]!.lastPlayedAt).toBeUndefined();
  });
});
