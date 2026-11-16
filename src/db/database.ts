import Dexie, { type Table } from 'dexie';
import type { Question, SessionRecord, Subject } from '../models/types';

export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * Base IndexedDB de QuizLab.
 *  - subjects : sujets (banques de questions)
 *  - questions : questions, indexées par sujet
 *  - sessions : historique des quiz terminés
 *  - meta : informations techniques (ex. données de démonstration déjà installées)
 */
export class QuizLabDB extends Dexie {
  declare subjects: Table<Subject, string>;
  declare questions: Table<Question, string>;
  declare sessions: Table<SessionRecord, string>;
  declare meta: Table<MetaEntry, string>;

  constructor(name = 'quizlab') {
    super(name);
    this.version(1).stores({
      subjects: 'id, title, updatedAt',
      questions: 'id, subjectId, createdAt',
      sessions: 'id, subjectId, finishedAt',
      meta: 'key',
    });
  }
}

/** Instance utilisée par l'application. Les tests créent leurs propres instances. */
export const db = new QuizLabDB();
