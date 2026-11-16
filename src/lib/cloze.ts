/** Marqueur d'un blanc dans une phrase à trous : au moins trois tirets bas. */
export const BLANK_PATTERN = /_{3,}/g;
export const BLANK_MARKER = '___';

export function countBlanks(text: string): number {
  return (text.match(BLANK_PATTERN) ?? []).length;
}

export type ClozeSegment = { kind: 'text'; value: string } | { kind: 'blank'; index: number };

/** Découpe une phrase à trous en segments de texte et de blancs, dans l'ordre. */
export function splitCloze(text: string): ClozeSegment[] {
  const segments: ClozeSegment[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(BLANK_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: 'text', value: text.slice(last, start) });
    segments.push({ kind: 'blank', index: index++ });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });
  return segments;
}

/** Remplace chaque blanc par la valeur fournie (utile pour afficher la phrase corrigée). */
export function fillCloze(text: string, values: string[]): string {
  let i = 0;
  return text.replace(BLANK_PATTERN, () => values[i++] ?? BLANK_MARKER);
}
