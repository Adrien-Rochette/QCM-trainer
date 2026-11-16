import { describe, expect, it } from 'vitest';
import type { Question } from '../models/types';
import { bothQuestion, clozeQuestion, mcqQuestion, settings } from '../test/factories';
import { seededRng } from './random';
import { buildRetrySession, buildSession, compatibleQuestions } from './sessionBuilder';

const ids = (qs: { question: Question }[]) => qs.map((i) => i.question.id);

function hasDuplicates(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

describe('Filtrage des questions compatibles', () => {
  const questions = [
    mcqQuestion({ difficulty: 'facile' }),
    clozeQuestion({ difficulty: 'moyen' }),
    bothQuestion({}, 'difficile'),
    mcqQuestion(),
  ];

  it('ne garde que les questions du format demandé', () => {
    expect(compatibleQuestions(questions, settings({ mode: 'qcm' }))).toHaveLength(3);
    expect(compatibleQuestions(questions, settings({ mode: 'trous' }))).toHaveLength(2);
    expect(compatibleQuestions(questions, settings({ mode: 'mixte' }))).toHaveLength(4);
  });

  it('filtre par difficulté (les questions sans difficulté sont exclues)', () => {
    const result = compatibleQuestions(questions, settings({ mode: 'mixte', difficulty: 'facile' }));
    expect(result.map((q) => q.id)).toEqual([questions[0]!.id]);
  });

  it('ne garde que les erreurs si demandé', () => {
    const mistakes = new Set([questions[1]!.id]);
    const result = compatibleQuestions(questions, settings({ mode: 'mixte', onlyMistakes: true }), mistakes);
    expect(result.map((q) => q.id)).toEqual([questions[1]!.id]);
  });
});

describe('Construction d’une session', () => {
  const pool = Array.from({ length: 12 }, () => mcqQuestion());

  it('respecte le nombre de questions demandé', () => {
    const plan = buildSession({ questions: pool, settings: settings({ count: 5 }), rng: seededRng(1) });
    expect(plan.items).toHaveLength(5);
    expect(plan.adjusted).toBe(false);
  });

  it('adapte la session si le nombre demandé dépasse les questions disponibles', () => {
    const plan = buildSession({ questions: pool, settings: settings({ count: 20 }), rng: seededRng(1) });
    expect(plan.items).toHaveLength(12);
    expect(plan.available).toBe(12);
    expect(plan.adjusted).toBe(true);
  });

  it('« toutes » prend l’ensemble des questions compatibles', () => {
    const plan = buildSession({ questions: pool, settings: settings({ count: 'all' }), rng: seededRng(1) });
    expect(plan.items).toHaveLength(12);
    expect(plan.adjusted).toBe(false);
  });

  it('conserve l’ordre de création en mode séquentiel, sans mélanger les propositions', () => {
    const plan = buildSession({ questions: [...pool].reverse(), settings: settings({ count: 'all', order: 'sequentiel' }) });
    expect(ids(plan.items)).toEqual(pool.map((q) => q.id));
    expect(plan.items[0]!.choiceOrder).toEqual(['a', 'b', 'c', 'd']);
  });

  it('mélange les propositions sans perdre la correspondance avec les bonnes réponses', () => {
    const plan = buildSession({ questions: pool, settings: settings({ count: 'all' }), rng: seededRng(7) });
    const orders = plan.items.map((i) => i.choiceOrder.join(''));
    expect(orders.some((o) => o !== 'abcd')).toBe(true);
    for (const item of plan.items) {
      expect([...item.choiceOrder].sort()).toEqual(['a', 'b', 'c', 'd']);
      expect(item.question.mcq!.correctIds).toEqual(['b']);
    }
  });

  it('ne modifie pas les questions d’origine (instantané)', () => {
    const plan = buildSession({ questions: pool, settings: settings({ count: 5 }), rng: seededRng(3) });
    for (const item of plan.items) item.question.mcq!.prompt = 'modifié';
    expect(pool.every((q) => q.mcq!.prompt !== 'modifié')).toBe(true);
  });
});

describe('Absence de doublons dans une session', () => {
  it('ne répète jamais une question, quel que soit le tirage', () => {
    const questions = [
      ...Array.from({ length: 8 }, () => mcqQuestion()),
      ...Array.from({ length: 8 }, () => clozeQuestion()),
      ...Array.from({ length: 8 }, () => bothQuestion()),
    ];
    for (let seed = 0; seed < 200; seed++) {
      for (const mode of ['qcm', 'trous', 'mixte'] as const) {
        const plan = buildSession({ questions, settings: settings({ mode, count: 'all' }), rng: seededRng(seed) });
        expect(hasDuplicates(ids(plan.items))).toBe(false);
      }
    }
  });
});

describe('Sélection en mode mixte', () => {
  it('vise 50 % de QCM et 50 % de questions à trous quand les données le permettent', () => {
    const questions = [
      ...Array.from({ length: 10 }, () => mcqQuestion()),
      ...Array.from({ length: 10 }, () => clozeQuestion()),
    ];
    for (let seed = 0; seed < 50; seed++) {
      const plan = buildSession({ questions, settings: settings({ mode: 'mixte', count: 10 }), rng: seededRng(seed) });
      const qcm = plan.items.filter((i) => i.format === 'qcm').length;
      expect(qcm).toBe(5);
      expect(plan.items).toHaveLength(10);
    }
  });

  it('choisit un seul format pour une question qui possède les deux', () => {
    const questions = Array.from({ length: 10 }, () => bothQuestion());
    const plan = buildSession({ questions, settings: settings({ mode: 'mixte', count: 10 }), rng: seededRng(4) });
    expect(hasDuplicates(ids(plan.items))).toBe(false);
    expect(plan.items.filter((i) => i.format === 'qcm')).toHaveLength(5);
    expect(plan.items.filter((i) => i.format === 'trous')).toHaveLength(5);
  });

  it('équilibre avec les questions bi-format quand un format manque', () => {
    const questions = [
      ...Array.from({ length: 2 }, () => mcqQuestion()),
      ...Array.from({ length: 8 }, () => clozeQuestion()),
      ...Array.from({ length: 10 }, () => bothQuestion()),
    ];
    for (let seed = 0; seed < 50; seed++) {
      const plan = buildSession({ questions, settings: settings({ mode: 'mixte', count: 10 }), rng: seededRng(seed) });
      expect(plan.items.filter((i) => i.format === 'qcm')).toHaveLength(5);
    }
  });

  it('utilise les questions restantes si un format est insuffisant', () => {
    const questions = [...Array.from({ length: 9 }, () => mcqQuestion()), clozeQuestion()];
    const plan = buildSession({ questions, settings: settings({ mode: 'mixte', count: 10 }), rng: seededRng(2) });
    expect(plan.items).toHaveLength(10);
    expect(plan.items.filter((i) => i.format === 'trous')).toHaveLength(1);
    expect(plan.items.filter((i) => i.format === 'qcm')).toHaveLength(9);
  });

  it('affecte chaque élément à un format réellement disponible', () => {
    const questions = [
      ...Array.from({ length: 5 }, () => mcqQuestion()),
      ...Array.from({ length: 5 }, () => clozeQuestion()),
      ...Array.from({ length: 5 }, () => bothQuestion()),
    ];
    for (let seed = 0; seed < 50; seed++) {
      const plan = buildSession({ questions, settings: settings({ mode: 'mixte', count: 'all' }), rng: seededRng(seed) });
      for (const item of plan.items) {
        expect(item.format === 'qcm' ? item.question.mcq : item.question.cloze).toBeDefined();
      }
    }
  });

  it('équilibre aussi en mode séquentiel', () => {
    const questions = Array.from({ length: 6 }, () => bothQuestion());
    const plan = buildSession({ questions, settings: settings({ mode: 'mixte', count: 'all', order: 'sequentiel' }), rng: seededRng(9) });
    expect(ids(plan.items)).toEqual(questions.map((q) => q.id));
    expect(plan.items.filter((i) => i.format === 'qcm')).toHaveLength(3);
  });
});

describe('Session « Revoir mes erreurs »', () => {
  it('reprend les mêmes questions dans le même format', () => {
    const questions = Array.from({ length: 4 }, () => bothQuestion());
    const plan = buildSession({ questions, settings: settings({ mode: 'mixte', count: 'all' }), rng: seededRng(5) });
    const retry = buildRetrySession(plan.items.slice(0, 2), true, seededRng(6));
    expect(retry).toHaveLength(2);
    const original = new Map(plan.items.map((i) => [i.question.id, i.format]));
    for (const item of retry) expect(item.format).toBe(original.get(item.question.id));
  });
});
