import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { listQuestions, listSessions, listSubjects } from '../db/repository';
import type { Question, SessionRecord, Subject } from '../models/types';

/**
 * Accès réactif aux données : les composants sont automatiquement
 * mis à jour à chaque modification de la base.
 * `undefined` = chargement en cours ; `null` = élément introuvable.
 */

export function useSubjects(): Subject[] | undefined {
  return useLiveQuery(() => listSubjects(db), []);
}

export function useSubject(id: string | undefined): Subject | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.subjects.get(id)) ?? null) : null), [id]);
}

export function useQuestions(subjectId: string | undefined): Question[] | undefined {
  return useLiveQuery(async () => (subjectId ? listQuestions(db, subjectId) : []), [subjectId]);
}

export function useAllQuestions(): Question[] | undefined {
  return useLiveQuery(() => db.questions.toArray(), []);
}

export function useSessions(subjectId?: string): SessionRecord[] | undefined {
  return useLiveQuery(() => listSessions(db, subjectId), [subjectId]);
}
