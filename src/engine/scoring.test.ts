import { describe, expect, it } from 'vitest';
import type { SessionItem } from '../models/types';
import { bothQuestion, clozeQuestion, mcqQuestion } from '../test/factories';
import { quizRunReducer, startRun, toSessionRecord } from './quizRun';
import { computeScore, formatClock, formatDuration, percentOf } from './scoring';
import { settings } from '../test/factories';

describe('Calcul des scores', () => {
  it('compte les bonnes et mauvaises réponses et le pourcentage', () => {
    const score = computeScore([
      { correct: true, format: 'qcm' },
      { correct: false, format: 'qcm' },
      { correct: true, format: 'trous' },
    ]);
    expect(score.correct).toBe(2);
    expect(score.incorrect).toBe(1);
    expect(score.total).toBe(3);
    expect(score.percent).toBe(67);
  });

  it('détaille le score par type de question', () => {
    const score = computeScore([
      { correct: true, format: 'qcm' },
      { correct: true, format: 'qcm' },
      { correct: false, format: 'trous' },
      { correct: true, format: 'trous' },
    ]);
    expect(score.byFormat.qcm).toEqual({ correct: 2, total: 2, percent: 100 });
    expect(score.byFormat.trous).toEqual({ correct: 1, total: 2, percent: 50 });
  });

  it('renvoie 0 % pour une session vide', () => {
    expect(computeScore([]).percent).toBe(0);
    expect(percentOf(0, 0)).toBe(0);
  });

  it('formate les durées', () => {
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(65_000)).toBe('1 min 05 s');
    expect(formatClock(65_000)).toBe('01:05');
  });
});

describe('Déroulement d’une session', () => {
  const items: SessionItem[] = [
    { question: mcqQuestion(), format: 'qcm', choiceOrder: ['d', 'c', 'b', 'a'] },
    { question: clozeQuestion({}, ['Paris']), format: 'trous', choiceOrder: [] },
    { question: bothQuestion(), format: 'trous', choiceOrder: [] },
  ];

  it('enregistre chaque réponse, affiche la correction puis passe à la suite', () => {
    let state = startRun(items, 0);
    expect(state.phase).toBe('answering');

    state = quizRunReducer(state, { type: 'submit', answer: { format: 'qcm', selectedIds: ['b'] }, now: 1500 });
    expect(state.phase).toBe('feedback');
    expect(state.answers[0]).toMatchObject({ correct: true, timeMs: 1500, givenLabel: 'Réponse B' });

    // Une réponse validée ne peut plus être modifiée.
    const again = quizRunReducer(state, { type: 'submit', answer: { format: 'qcm', selectedIds: ['a'] }, now: 1600 });
    expect(again).toBe(state);

    state = quizRunReducer(state, { type: 'next', now: 2000 });
    state = quizRunReducer(state, { type: 'submit', answer: { format: 'trous', values: [' paris '] }, now: 3000 });
    expect(state.answers[1]).toMatchObject({ correct: true, timeMs: 1000 });

    state = quizRunReducer(state, { type: 'next', now: 3000 });
    state = quizRunReducer(state, { type: 'submit', answer: { format: 'trous', values: [''] }, now: 4000, timedOut: true });
    expect(state.answers[2]).toMatchObject({ correct: false, timedOut: true, givenLabel: '(aucune réponse)', expectedLabel: 'B' });

    state = quizRunReducer(state, { type: 'next', now: 5000 });
    expect(state.phase).toBe('finished');

    const record = toSessionRecord(state, { id: 'r1', subjectId: 's1', subjectTitle: 'Sujet', settings: settings({ mode: 'mixte' }) });
    expect(record).toMatchObject({ correctCount: 2, total: 3, percent: 67, durationMs: 5000, mode: 'mixte' });
  });
});
