/**
 * Modèle de données de QuizLab.
 *
 * Une « question » représente une notion. Elle peut exister sous deux formes :
 *  - une version QCM (`mcq`),
 *  - une version à trous (`cloze`),
 * ou les deux. Le moteur de quiz choisit la forme à présenter selon le mode.
 */

export const DIFFICULTIES = ['facile', 'moyen', 'difficile'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Format concret sous lequel une question est posée pendant une session. */
export type QuestionFormat = 'qcm' | 'trous';

/** Mode de jeu choisi par l'utilisateur. */
export type QuizMode = 'qcm' | 'trous' | 'mixte';

export interface Choice {
  /** Identifiant unique au sein de la question (ex. « a », « b »…). */
  id: string;
  text: string;
}

export interface McqPart {
  prompt: string;
  choices: Choice[];
  /** Identifiants des propositions correctes (au moins une). */
  correctIds: string[];
}

export interface Blank {
  /** Formulations acceptées pour ce blanc (au moins une). */
  answers: string[];
}

/**
 * Phrase à trous. Chaque blanc est matérialisé dans `text` par au moins trois
 * tirets bas consécutifs (« ___ »). Le i-ème marqueur correspond à `blanks[i]`.
 * La version 1 de l'éditeur crée un seul blanc, mais le moteur gère déjà N blancs.
 */
export interface ClozePart {
  text: string;
  blanks: Blank[];
}

export interface Question {
  id: string;
  subjectId: string;
  mcq?: McqPart;
  cloze?: ClozePart;
  explanation?: string;
  difficulty?: Difficulty;
  tags: string[];
  /** Origine de la question (saisie manuelle, import, outil externe…). */
  source?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  title: string;
  description: string;
  category?: string;
  createdAt: number;
  updatedAt: number;
}

export type QuestionCountOption = 5 | 10 | 20 | 50 | 'all';
export type TimerMode = 'aucun' | 'chrono' | 'limite';

export interface SessionSettings {
  mode: QuizMode;
  count: QuestionCountOption;
  difficulty: Difficulty | 'tous';
  order: 'aleatoire' | 'sequentiel';
  timer: TimerMode;
  /** Durée par question lorsque `timer === 'limite'`. */
  secondsPerQuestion: number;
  onlyMistakes: boolean;
  ignoreAccents: boolean;
}

/** Élément d'une session : une question figée (instantané) et le format retenu. */
export interface SessionItem {
  question: Question;
  format: QuestionFormat;
  /** Ordre d'affichage des propositions (identifiants), pour le format QCM. */
  choiceOrder: string[];
}

/** Réponse donnée par l'utilisateur. */
export type UserAnswer =
  | { format: 'qcm'; selectedIds: string[] }
  | { format: 'trous'; values: string[] };

export interface AnswerRecord {
  questionId: string;
  format: QuestionFormat;
  correct: boolean;
  /** Identifiants cochés (QCM) ou textes saisis (trous). */
  given: string[];
  /** Instantanés textuels, pour que l'historique reste lisible même si la question change. */
  prompt: string;
  givenLabel: string;
  expectedLabel: string;
  timeMs: number;
  timedOut?: boolean;
}

export interface SessionRecord {
  id: string;
  subjectId: string;
  subjectTitle: string;
  mode: QuizMode;
  settings: SessionSettings;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  answers: AnswerRecord[];
  correctCount: number;
  total: number;
  /** Pourcentage de réussite, de 0 à 100 (arrondi). */
  percent: number;
}

export const MODE_LABELS: Record<QuizMode, string> = {
  qcm: 'QCM',
  trous: 'Compléter',
  mixte: 'Mixte',
};

export const FORMAT_LABELS: Record<QuestionFormat, string> = {
  qcm: 'QCM',
  trous: 'À compléter',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facile: 'Facile',
  moyen: 'Moyen',
  difficile: 'Difficile',
};
