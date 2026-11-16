import type { AnswerRecord, SessionItem, SessionRecord, SessionSettings, UserAnswer } from '../models/types';
import { isClozeAnswerCorrect, isMcqAnswerCorrect, type NormalizeOptions } from './answerCheck';
import { computeScore } from './scoring';

/**
 * Déroulement d'une session de quiz, sous forme de machine à états pure
 * (indépendante de React) : réponse → correction → question suivante → fin.
 */

export type RunPhase = 'answering' | 'feedback' | 'finished';

export interface QuizRunState {
  items: SessionItem[];
  index: number;
  phase: RunPhase;
  answers: AnswerRecord[];
  startedAt: number;
  questionStartedAt: number;
  finishedAt?: number;
  options: NormalizeOptions;
}

export type QuizRunAction =
  | { type: 'submit'; answer: UserAnswer; now: number; timedOut?: boolean }
  | { type: 'next'; now: number };

const NO_ANSWER = '(aucune réponse)';

export function startRun(items: SessionItem[], now: number, options: NormalizeOptions = {}): QuizRunState {
  return {
    items,
    index: 0,
    phase: items.length === 0 ? 'finished' : 'answering',
    answers: [],
    startedAt: now,
    questionStartedAt: now,
    finishedAt: items.length === 0 ? now : undefined,
    options,
  };
}

/** Évalue la réponse donnée à un élément de session et produit l'enregistrement correspondant. */
export function evaluateAnswer(
  item: SessionItem,
  answer: UserAnswer,
  options: NormalizeOptions = {},
): Omit<AnswerRecord, 'timeMs'> {
  const { question } = item;
  if (item.format === 'qcm') {
    const mcq = question.mcq;
    if (!mcq) throw new Error(`La question ${question.id} n'a pas de version QCM.`);
    const selected = answer.format === 'qcm' ? answer.selectedIds : [];
    const textOf = (id: string) => mcq.choices.find((c) => c.id === id)?.text ?? id;
    const inDisplayOrder = (ids: readonly string[]) => item.choiceOrder.filter((id) => ids.includes(id));
    return {
      questionId: question.id,
      format: 'qcm',
      correct: isMcqAnswerCorrect(mcq, selected),
      given: [...selected],
      prompt: mcq.prompt,
      givenLabel: selected.length ? inDisplayOrder(selected).map(textOf).join(' · ') : NO_ANSWER,
      expectedLabel: inDisplayOrder(mcq.correctIds).map(textOf).join(' · '),
    };
  }

  const cloze = question.cloze;
  if (!cloze) throw new Error(`La question ${question.id} n'a pas de version à trous.`);
  const values = answer.format === 'trous' ? answer.values : [];
  const trimmed = values.map((v) => v.trim());
  return {
    questionId: question.id,
    format: 'trous',
    correct: isClozeAnswerCorrect(cloze, values, options),
    given: trimmed,
    prompt: cloze.text,
    givenLabel: trimmed.some(Boolean) ? trimmed.map((v) => v || '…').join(' / ') : NO_ANSWER,
    expectedLabel: cloze.blanks.map((b) => b.answers[0] ?? '').join(' / '),
  };
}

export function quizRunReducer(state: QuizRunState, action: QuizRunAction): QuizRunState {
  switch (action.type) {
    case 'submit': {
      // Une réponse validée ne peut plus être modifiée.
      if (state.phase !== 'answering') return state;
      const item = state.items[state.index];
      if (!item) return state;
      const record: AnswerRecord = {
        ...evaluateAnswer(item, action.answer, state.options),
        timeMs: Math.max(0, action.now - state.questionStartedAt),
        ...(action.timedOut ? { timedOut: true } : {}),
      };
      return { ...state, phase: 'feedback', answers: [...state.answers, record] };
    }
    case 'next': {
      if (state.phase !== 'feedback') return state;
      const nextIndex = state.index + 1;
      if (nextIndex >= state.items.length) {
        return { ...state, phase: 'finished', finishedAt: action.now };
      }
      return { ...state, index: nextIndex, phase: 'answering', questionStartedAt: action.now };
    }
    default:
      return state;
  }
}

export function currentAnswer(state: QuizRunState): AnswerRecord | undefined {
  return state.phase === 'answering' ? undefined : state.answers[state.index];
}

/** Transforme une session terminée en enregistrement d'historique. */
export function toSessionRecord(
  state: QuizRunState,
  meta: { id: string; subjectId: string; subjectTitle: string; settings: SessionSettings },
): SessionRecord {
  const finishedAt = state.finishedAt ?? Date.now();
  const score = computeScore(state.answers);
  return {
    id: meta.id,
    subjectId: meta.subjectId,
    subjectTitle: meta.subjectTitle,
    mode: meta.settings.mode,
    settings: meta.settings,
    startedAt: state.startedAt,
    finishedAt,
    durationMs: Math.max(0, finishedAt - state.startedAt),
    answers: state.answers,
    correctCount: score.correct,
    total: score.total,
    percent: score.percent,
  };
}
