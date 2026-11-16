import type { z } from 'zod';

export interface ValidationIssue {
  /** Emplacement lisible de l'erreur (ex. « Question 3 › QCM › bonne réponse 1 »). */
  path: string;
  message: string;
}

/** Erreur de validation métier, porteuse d'une liste d'erreurs lisibles. */
export class ValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

const FIELD_LABELS: Record<string, string> = {
  format: 'format',
  version: 'version',
  subjects: 'sujets',
  sessions: 'historique',
  title: 'titre',
  description: 'description',
  category: 'catégorie',
  questions: 'questions',
  mcq: 'QCM',
  prompt: 'énoncé',
  choices: 'propositions',
  correctIds: 'bonnes réponses',
  cloze: 'phrase à trous',
  text: 'texte',
  blanks: 'blancs',
  answers: 'réponses acceptées',
  explanation: 'explication',
  difficulty: 'difficulté',
  tags: 'étiquettes',
  id: 'identifiant',
};

const ITEM_LABELS: Record<string, string> = {
  subjects: 'Sujet',
  questions: 'Question',
  choices: 'Proposition',
  correctIds: 'Bonne réponse',
  blanks: 'Blanc',
  answers: 'Réponse',
  sessions: 'Session',
  tags: 'Étiquette',
};

/** Convertit un chemin Zod (`['subjects', 0, 'questions', 2, 'mcq']`) en libellé français lisible. */
export function describePath(path: readonly PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (typeof key === 'string' && typeof next === 'number') {
      parts.push(`${ITEM_LABELS[key] ?? FIELD_LABELS[key] ?? key} ${next + 1}`);
      i++;
    } else if (typeof key === 'string') {
      parts.push(FIELD_LABELS[key] ?? key);
    } else if (typeof key === 'number') {
      parts.push(`n° ${key + 1}`);
    }
  }
  return parts.join(' › ');
}

export function zodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({ path: describePath(issue.path), message: issue.message }));
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
