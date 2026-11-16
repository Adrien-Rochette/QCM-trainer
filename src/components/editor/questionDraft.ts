import { countBlanks } from '../../lib/cloze';
import { choiceIdAt } from '../../lib/ids';
import type { Difficulty, Question } from '../../models/types';

/**
 * État du formulaire de l'éditeur, plus simple à manipuler que le modèle stocké.
 * La conversion vers le modèle (`draftToContent`) est ensuite validée par Zod.
 */
export interface DraftChoice {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuestionDraft {
  subjectId: string;
  hasMcq: boolean;
  prompt: string;
  choices: DraftChoice[];
  hasCloze: boolean;
  clozeText: string;
  /** Réponses acceptées, une liste par blanc. */
  blankAnswers: string[][];
  explanation: string;
  difficulty: Difficulty | '';
  tags: string;
}

export function emptyDraft(subjectId: string, keep?: Pick<QuestionDraft, 'difficulty' | 'tags' | 'hasMcq' | 'hasCloze'>): QuestionDraft {
  return {
    subjectId,
    hasMcq: keep?.hasMcq ?? true,
    prompt: '',
    choices: [0, 1, 2, 3].map((i) => ({ id: choiceIdAt(i), text: '', correct: false })),
    hasCloze: keep?.hasCloze ?? true,
    clozeText: '',
    blankAnswers: [['']],
    explanation: '',
    difficulty: keep?.difficulty ?? '',
    tags: keep?.tags ?? '',
  };
}

export function draftFromQuestion(q: Question): QuestionDraft {
  return {
    subjectId: q.subjectId,
    hasMcq: q.mcq !== undefined,
    prompt: q.mcq?.prompt ?? '',
    choices: q.mcq
      ? q.mcq.choices.map((c) => ({ id: c.id, text: c.text, correct: q.mcq!.correctIds.includes(c.id) }))
      : emptyDraft(q.subjectId).choices,
    hasCloze: q.cloze !== undefined,
    clozeText: q.cloze?.text ?? '',
    blankAnswers: q.cloze ? q.cloze.blanks.map((b) => [...b.answers]) : [['']],
    explanation: q.explanation ?? '',
    difficulty: q.difficulty ?? '',
    tags: q.tags.join(', '),
  };
}

/** Prochain identifiant libre pour une nouvelle proposition. */
export function nextChoiceId(choices: readonly DraftChoice[]): string {
  const used = new Set(choices.map((c) => c.id));
  for (let i = 0; ; i++) {
    const id = choiceIdAt(i);
    if (!used.has(id)) return id;
  }
}

/** Ajuste le nombre de listes de réponses au nombre de blancs présents dans la phrase. */
export function syncBlankAnswers(text: string, answers: string[][]): string[][] {
  const count = Math.max(1, countBlanks(text));
  const next = answers.slice(0, count);
  while (next.length < count) next.push(['']);
  return next;
}

/** Convertit le brouillon en contenu de question (à valider ensuite). */
export function draftToContent(draft: QuestionDraft) {
  const choices = draft.choices.filter((c) => c.text.trim() !== '' || c.correct);
  return {
    ...(draft.hasMcq
      ? {
          mcq: {
            prompt: draft.prompt,
            choices: choices.map((c) => ({ id: c.id, text: c.text })),
            correctIds: choices.filter((c) => c.correct).map((c) => c.id),
          },
        }
      : {}),
    ...(draft.hasCloze
      ? {
          cloze: {
            text: draft.clozeText,
            blanks: draft.blankAnswers.map((list) => ({ answers: list.filter((a) => a.trim() !== '') })),
          },
        }
      : {}),
    explanation: draft.explanation,
    ...(draft.difficulty ? { difficulty: draft.difficulty } : {}),
    tags: [
      ...new Set(
        draft.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      ),
    ],
  };
}
