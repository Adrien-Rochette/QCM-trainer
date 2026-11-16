import { describe, expect, it } from 'vitest';
import { checkClozeAnswer, isClozeAnswerCorrect, isMcqAnswerCorrect, normalizeAnswer } from './answerCheck';

describe('Validation d’une réponse QCM', () => {
  it('accepte la bonne réponse unique', () => {
    expect(isMcqAnswerCorrect({ correctIds: ['b'] }, ['b'])).toBe(true);
  });

  it('refuse une mauvaise réponse', () => {
    expect(isMcqAnswerCorrect({ correctIds: ['b'] }, ['a'])).toBe(false);
  });

  it('refuse une réponse vide', () => {
    expect(isMcqAnswerCorrect({ correctIds: ['b'] }, [])).toBe(false);
  });

  it('exige l’ensemble exact des bonnes réponses quand il y en a plusieurs', () => {
    const mcq = { correctIds: ['a', 'c', 'e'] };
    expect(isMcqAnswerCorrect(mcq, ['e', 'a', 'c'])).toBe(true); // l'ordre ne compte pas
    expect(isMcqAnswerCorrect(mcq, ['a', 'c'])).toBe(false); // incomplet
    expect(isMcqAnswerCorrect(mcq, ['a', 'c', 'e', 'b'])).toBe(false); // une de trop
    expect(isMcqAnswerCorrect(mcq, ['a', 'b', 'c'])).toBe(false); // une fausse
  });

  it('ne compte pas deux fois une réponse cochée en double', () => {
    expect(isMcqAnswerCorrect({ correctIds: ['a', 'b'] }, ['a', 'a'])).toBe(false);
  });
});

describe('Validation d’une réponse à trous', () => {
  const cloze = { text: 'La capitale de la France est ___.', blanks: [{ answers: ['Paris'] }] };

  it('ignore la casse et les espaces superflus', () => {
    expect(isClozeAnswerCorrect(cloze, ['paris'])).toBe(true);
    expect(isClozeAnswerCorrect(cloze, ['  PARIS  '])).toBe(true);
  });

  it('normalise les espaces internes multiples', () => {
    const c = { text: '___', blanks: [{ answers: ['mont Blanc'] }] };
    expect(isClozeAnswerCorrect(c, ['mont    blanc'])).toBe(true);
  });

  it('refuse une réponse vide', () => {
    expect(isClozeAnswerCorrect(cloze, [''])).toBe(false);
    expect(isClozeAnswerCorrect(cloze, ['   '])).toBe(false);
    expect(isClozeAnswerCorrect(cloze, [])).toBe(false);
  });

  it('ne fait aucune comparaison approximative', () => {
    expect(isClozeAnswerCorrect(cloze, ['Pari'])).toBe(false);
    expect(isClozeAnswerCorrect(cloze, ['Pariss'])).toBe(false);
    expect(isClozeAnswerCorrect(cloze, ['Paris France'])).toBe(false);
  });

  it('tient compte des accents par défaut', () => {
    const c = { text: '___', blanks: [{ answers: ['Méditerranée'] }] };
    expect(isClozeAnswerCorrect(c, ['mediterranee'])).toBe(false);
    expect(isClozeAnswerCorrect(c, ['méditerranée'])).toBe(true);
  });

  it('peut ignorer les accents sur option', () => {
    const c = { text: '___', blanks: [{ answers: ['Méditerranée'] }] };
    expect(isClozeAnswerCorrect(c, ['mediterranee'], { ignoreAccents: true })).toBe(true);
    const oe = { text: '___', blanks: [{ answers: ['Schœlcher'] }] };
    expect(isClozeAnswerCorrect(oe, ['schoelcher'], { ignoreAccents: true })).toBe(true);
  });

  it('unifie les apostrophes typographiques', () => {
    const c = { text: '___', blanks: [{ answers: ["l'Amazone"] }] };
    expect(isClozeAnswerCorrect(c, ['l’Amazone'])).toBe(true);
  });

  it('gère les formes décomposées Unicode (NFD)', () => {
    expect(normalizeAnswer('été')).toBe(normalizeAnswer('été'));
  });
});

describe('Réponses alternatives', () => {
  const cloze = { text: 'La capitale de la Mongolie est ___.', blanks: [{ answers: ['Oulan-Bator', 'Oulan Bator', 'Ulaanbaatar'] }] };

  it('accepte chacune des formulations définies', () => {
    expect(isClozeAnswerCorrect(cloze, ['Oulan-Bator'])).toBe(true);
    expect(isClozeAnswerCorrect(cloze, ['oulan bator'])).toBe(true);
    expect(isClozeAnswerCorrect(cloze, ['ULAANBAATAR'])).toBe(true);
  });

  it('refuse une formulation non prévue', () => {
    expect(isClozeAnswerCorrect(cloze, ['Oulanbator'])).toBe(false);
  });

  it('gère plusieurs blancs (évolution future)', () => {
    const multi = { text: '___ et ___', blanks: [{ answers: ['un'] }, { answers: ['deux', '2'] }] };
    expect(isClozeAnswerCorrect(multi, ['un', '2'])).toBe(true);
    expect(checkClozeAnswer(multi, ['un', 'trois'])).toEqual([true, false]);
    expect(isClozeAnswerCorrect(multi, ['un'])).toBe(false);
  });
});
