import type { Blank, ClozePart, McqPart } from '../models/types';

export interface NormalizeOptions {
  /** Considère « é » et « e » comme identiques. Désactivé par défaut. */
  ignoreAccents?: boolean;
}

/**
 * Normalise une réponse libre avant comparaison :
 *  - ignore la casse et les espaces superflus (début, fin, espaces multiples) ;
 *  - unifie les apostrophes et guillemets typographiques (’ → ') ;
 *  - retire éventuellement les accents.
 * Aucune comparaison approximative n'est faite : « Pari » ne vaut pas « Paris ».
 */
export function normalizeAnswer(value: string, options: NormalizeOptions = {}): string {
  let text = value.normalize('NFC');
  if (options.ignoreAccents) {
    text = text.normalize('NFD').replace(/\p{M}/gu, '').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE');
  }
  return text
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fr');
}

/** Un QCM est juste uniquement si l'ensemble exact des bonnes réponses est coché. */
export function isMcqAnswerCorrect(mcq: Pick<McqPart, 'correctIds'>, selectedIds: readonly string[]): boolean {
  const expected = new Set(mcq.correctIds);
  const selected = new Set(selectedIds);
  if (expected.size !== selected.size) return false;
  for (const id of selected) if (!expected.has(id)) return false;
  return true;
}

/** Vérifie la réponse d'un blanc parmi les formulations acceptées. */
export function isBlankAnswerCorrect(blank: Blank, value: string, options: NormalizeOptions = {}): boolean {
  const given = normalizeAnswer(value, options);
  if (!given) return false;
  return blank.answers.some((accepted) => normalizeAnswer(accepted, options) === given);
}

/** Détail de la correction d'une phrase à trous : un booléen par blanc. */
export function checkClozeAnswer(cloze: ClozePart, values: readonly string[], options: NormalizeOptions = {}): boolean[] {
  return cloze.blanks.map((blank, i) => isBlankAnswerCorrect(blank, values[i] ?? '', options));
}

export function isClozeAnswerCorrect(cloze: ClozePart, values: readonly string[], options: NormalizeOptions = {}): boolean {
  return checkClozeAnswer(cloze, values, options).every(Boolean);
}
