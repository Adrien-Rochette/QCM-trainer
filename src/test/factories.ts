import type { Difficulty, Question, SessionRecord, SessionSettings } from '../models/types';

let counter = 0;

export function mcqQuestion(overrides: Partial<Question> = {}, correctIds: string[] = ['b']): Question {
  counter++;
  return {
    id: `q${counter}`,
    subjectId: 's1',
    mcq: {
      prompt: `Question QCM ${counter}`,
      choices: [
        { id: 'a', text: 'Réponse A' },
        { id: 'b', text: 'Réponse B' },
        { id: 'c', text: 'Réponse C' },
        { id: 'd', text: 'Réponse D' },
      ],
      correctIds,
    },
    tags: [],
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function clozeQuestion(overrides: Partial<Question> = {}, answers: string[] = ['Paris']): Question {
  counter++;
  return {
    id: `q${counter}`,
    subjectId: 's1',
    cloze: { text: `Phrase ${counter} : ___.`, blanks: [{ answers }] },
    tags: [],
    createdAt: counter,
    updatedAt: counter,
    ...overrides,
  };
}

export function bothQuestion(overrides: Partial<Question> = {}, difficulty?: Difficulty): Question {
  const mcq = mcqQuestion();
  return {
    ...mcq,
    cloze: { text: 'La réponse est ___.', blanks: [{ answers: ['B'] }] },
    ...(difficulty ? { difficulty } : {}),
    ...overrides,
  };
}

export function settings(overrides: Partial<SessionSettings> = {}): SessionSettings {
  return {
    mode: 'qcm',
    count: 10,
    difficulty: 'tous',
    order: 'aleatoire',
    timer: 'aucun',
    secondsPerQuestion: 30,
    onlyMistakes: false,
    ignoreAccents: false,
    ...overrides,
  };
}

export function sessionRecord(
  answers: { questionId: string; correct: boolean; format?: 'qcm' | 'trous' }[],
  overrides: Partial<SessionRecord> = {},
): SessionRecord {
  const correctCount = answers.filter((a) => a.correct).length;
  return {
    id: `session-${++counter}`,
    subjectId: 's1',
    subjectTitle: 'Sujet',
    mode: 'qcm',
    settings: settings(),
    startedAt: 1000,
    finishedAt: 2000 + counter,
    durationMs: 1000,
    answers: answers.map((a) => ({
      questionId: a.questionId,
      format: a.format ?? 'qcm',
      correct: a.correct,
      given: [],
      prompt: `Énoncé ${a.questionId}`,
      givenLabel: '',
      expectedLabel: '',
      timeMs: 100,
    })),
    correctCount,
    total: answers.length,
    percent: answers.length ? Math.round((correctCount / answers.length) * 100) : 0,
    ...overrides,
  };
}
