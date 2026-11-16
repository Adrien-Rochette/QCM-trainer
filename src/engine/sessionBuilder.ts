import type { Question, QuestionFormat, QuizMode, SessionItem, SessionSettings } from '../models/types';
import { defaultRng, shuffle, type Rng } from './random';

export function supportsFormat(question: Question, format: QuestionFormat): boolean {
  return format === 'qcm' ? question.mcq !== undefined : question.cloze !== undefined;
}

export function supportsMode(question: Question, mode: QuizMode): boolean {
  if (mode === 'mixte') return supportsFormat(question, 'qcm') || supportsFormat(question, 'trous');
  return supportsFormat(question, mode);
}

/** Ordre « séquentiel » : ordre de création, puis identifiant pour départager. */
export function sequentialOrder(questions: readonly Question[]): Question[] {
  return [...questions].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

export interface FormatCounts {
  total: number;
  qcm: number;
  trous: number;
  both: number;
}

export function countFormats(questions: readonly Question[]): FormatCounts {
  let qcm = 0;
  let trous = 0;
  let both = 0;
  for (const q of questions) {
    if (q.mcq) qcm++;
    if (q.cloze) trous++;
    if (q.mcq && q.cloze) both++;
  }
  return { total: questions.length, qcm, trous, both };
}

type FilterSettings = Pick<SessionSettings, 'mode' | 'difficulty' | 'onlyMistakes'>;

/** Questions compatibles avec les réglages (mode, difficulté, erreurs uniquement), en ordre séquentiel. */
export function compatibleQuestions(
  questions: readonly Question[],
  settings: FilterSettings,
  mistakeIds: ReadonlySet<string> = new Set(),
): Question[] {
  return sequentialOrder(
    questions.filter(
      (q) =>
        supportsMode(q, settings.mode) &&
        (settings.difficulty === 'tous' || q.difficulty === settings.difficulty) &&
        (!settings.onlyMistakes || mistakeIds.has(q.id)),
    ),
  );
}

export function createItem(question: Question, format: QuestionFormat, shuffleChoices: boolean, rng: Rng): SessionItem {
  const ids = format === 'qcm' && question.mcq ? question.mcq.choices.map((c) => c.id) : [];
  return {
    question: structuredClone(question),
    format,
    choiceOrder: shuffleChoices ? shuffle(ids, rng) : ids,
  };
}

/** Nombre de QCM visé pour n questions en mode mixte (50 %, l'éventuelle question impaire est tirée au sort). */
function mcqTarget(n: number, rng: Rng): number {
  return n % 2 === 0 ? n / 2 : rng() < 0.5 ? Math.floor(n / 2) : Math.ceil(n / 2);
}

/**
 * Attribue un format à chaque question sélectionnée en mode mixte.
 * Les questions qui n'ont qu'un format le gardent ; celles qui ont les deux
 * servent à équilibrer vers l'objectif de QCM.
 */
function assignMixedFormats(selected: readonly Question[], qcmTarget: number, rng: Rng): QuestionFormat[] {
  const fixedQcm = selected.filter((q) => q.mcq && !q.cloze).length;
  const bothIndexes = selected.flatMap((q, i) => (q.mcq && q.cloze ? [i] : []));
  const needQcm = Math.max(0, Math.min(qcmTarget - fixedQcm, bothIndexes.length));
  const asQcm = new Set(shuffle(bothIndexes, rng).slice(0, needQcm));
  return selected.map((q, i) => {
    if (q.mcq && q.cloze) return asQcm.has(i) ? 'qcm' : 'trous';
    return q.mcq ? 'qcm' : 'trous';
  });
}

/** Sélection aléatoire en mode mixte : choisit les questions de façon à viser 50 % / 50 %. */
function pickMixedRandom(pool: readonly Question[], n: number, qcmTarget: number, rng: Rng): Question[] {
  const mcqOnly = shuffle(pool.filter((q) => q.mcq && !q.cloze), rng);
  const clozeOnly = shuffle(pool.filter((q) => q.cloze && !q.mcq), rng);
  const both = shuffle(pool.filter((q) => q.mcq && q.cloze), rng);

  let mcqTake = Math.min(mcqOnly.length, qcmTarget);
  let clozeTake = Math.min(clozeOnly.length, n - qcmTarget);
  let remaining = n - mcqTake - clozeTake;
  const bothTake = Math.min(both.length, remaining);
  remaining -= bothTake;
  // Pénurie d'un format : on complète avec les questions compatibles restantes.
  const extraMcq = Math.min(mcqOnly.length - mcqTake, remaining);
  mcqTake += extraMcq;
  remaining -= extraMcq;
  clozeTake += Math.min(clozeOnly.length - clozeTake, remaining);

  return [...mcqOnly.slice(0, mcqTake), ...clozeOnly.slice(0, clozeTake), ...both.slice(0, bothTake)];
}

export interface SessionPlan {
  items: SessionItem[];
  /** Nombre de questions compatibles avec les réglages. */
  available: number;
  /** Nombre de questions demandé (`all` = toutes). */
  requested: number | 'all';
  /** Vrai si la session a été réduite faute de questions suffisantes. */
  adjusted: boolean;
}

export interface BuildSessionInput {
  questions: readonly Question[];
  settings: SessionSettings;
  mistakeIds?: ReadonlySet<string>;
  rng?: Rng;
}

/** Construit la liste des questions d'une session selon les réglages. Aucune question n'est répétée. */
export function buildSession({ questions, settings, mistakeIds, rng = defaultRng }: BuildSessionInput): SessionPlan {
  const pool = compatibleQuestions(questions, settings, mistakeIds);
  const available = pool.length;
  const requested = settings.count;
  const n = requested === 'all' ? available : Math.min(requested, available);
  const random = settings.order === 'aleatoire';

  let selected: Question[];
  let formats: QuestionFormat[];

  if (settings.mode === 'mixte') {
    const target = mcqTarget(n, rng);
    selected = random ? pickMixedRandom(pool, n, target, rng) : pool.slice(0, n);
    formats = assignMixedFormats(selected, target, rng);
  } else {
    selected = random ? shuffle(pool, rng).slice(0, n) : pool.slice(0, n);
    formats = selected.map(() => settings.mode as QuestionFormat);
  }

  let items = selected.map((q, i) => createItem(q, formats[i]!, random, rng));
  if (random) items = shuffle(items, rng);

  return {
    items,
    available,
    requested,
    adjusted: requested !== 'all' && requested > available,
  };
}

/** Prépare une nouvelle session ne reprenant que certaines questions (ex. « Revoir mes erreurs »). */
export function buildRetrySession(items: readonly SessionItem[], random: boolean, rng: Rng = defaultRng): SessionItem[] {
  const fresh = items.map((item) => createItem(item.question, item.format, random, rng));
  return random ? shuffle(fresh, rng) : fresh;
}
