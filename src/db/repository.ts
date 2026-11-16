import { ValidationError, zodIssues } from '../lib/errors';
import { createId } from '../lib/ids';
import { questionContentSchema, subjectInfoSchema, type QuestionContent, type SubjectInfo } from '../models/schemas';
import type { Question, SessionRecord, Subject } from '../models/types';
import { buildExportFile, type ExistingData, type ImportPlan } from '../io/importExport';
import type { QuizLabDB } from './database';

/* ------------------------------------------------------------------ */
/* Sujets                                                               */
/* ------------------------------------------------------------------ */

export function validateSubjectInfo(input: unknown): SubjectInfo {
  const parsed = subjectInfoSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError('Le sujet contient des erreurs.', zodIssues(parsed.error));
  return parsed.data;
}

export async function listSubjects(db: QuizLabDB): Promise<Subject[]> {
  const subjects = await db.subjects.toArray();
  return subjects.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));
}

export async function createSubject(db: QuizLabDB, input: unknown, now = Date.now()): Promise<Subject> {
  const info = validateSubjectInfo(input);
  const subject: Subject = {
    id: createId(),
    title: info.title,
    description: info.description,
    ...(info.category ? { category: info.category } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await db.subjects.add(subject);
  return subject;
}

export async function updateSubject(db: QuizLabDB, id: string, input: unknown, now = Date.now()): Promise<Subject> {
  const info = validateSubjectInfo(input);
  return db.transaction('rw', db.subjects, async () => {
    const current = await db.subjects.get(id);
    if (!current) throw new Error('Ce sujet n’existe plus.');
    const updated: Subject = {
      id,
      title: info.title,
      description: info.description,
      ...(info.category ? { category: info.category } : {}),
      createdAt: current.createdAt,
      updatedAt: now,
    };
    await db.subjects.put(updated);
    return updated;
  });
}

/** Supprime un sujet, ses questions et son historique. */
export async function deleteSubject(db: QuizLabDB, id: string): Promise<void> {
  await db.transaction('rw', db.subjects, db.questions, db.sessions, async () => {
    await db.questions.where('subjectId').equals(id).delete();
    await db.sessions.where('subjectId').equals(id).delete();
    await db.subjects.delete(id);
  });
}

/** Duplique un sujet et toutes ses questions (nouveaux identifiants, historique non copié). */
export async function duplicateSubject(db: QuizLabDB, id: string, now = Date.now()): Promise<Subject> {
  return db.transaction('rw', db.subjects, db.questions, async () => {
    const source = await db.subjects.get(id);
    if (!source) throw new Error('Ce sujet n’existe plus.');
    const copy: Subject = { ...source, id: createId(), title: `${source.title} (copie)`.slice(0, 120), createdAt: now, updatedAt: now };
    const questions = await db.questions.where('subjectId').equals(id).toArray();
    await db.subjects.add(copy);
    await db.questions.bulkAdd(questions.map((q) => ({ ...structuredClone(q), id: createId(), subjectId: copy.id })));
    return copy;
  });
}

/* ------------------------------------------------------------------ */
/* Questions                                                            */
/* ------------------------------------------------------------------ */

/** Valide le contenu d'une question (lève une ValidationError lisible si invalide). */
export function validateQuestionContent(input: unknown): QuestionContent {
  const parsed = questionContentSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError('La question contient des erreurs.', zodIssues(parsed.error));
  return parsed.data;
}

export async function listQuestions(db: QuizLabDB, subjectId: string): Promise<Question[]> {
  const questions = await db.questions.where('subjectId').equals(subjectId).toArray();
  return questions.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}

/**
 * Crée ou met à jour une question après validation.
 * Si `questionId` est fourni, la question est modifiée (et éventuellement déplacée vers `subjectId`).
 */
export async function saveQuestion(
  db: QuizLabDB,
  subjectId: string,
  content: unknown,
  questionId?: string,
  now = Date.now(),
): Promise<Question> {
  const valid = validateQuestionContent(content);
  return db.transaction('rw', db.subjects, db.questions, async () => {
    const subject = await db.subjects.get(subjectId);
    if (!subject) throw new Error('Le sujet sélectionné n’existe plus.');
    const existing = questionId ? await db.questions.get(questionId) : undefined;
    if (questionId && !existing) throw new Error('Cette question n’existe plus.');
    const question: Question = {
      id: existing?.id ?? createId(),
      subjectId,
      ...(valid.mcq ? { mcq: valid.mcq } : {}),
      ...(valid.cloze ? { cloze: valid.cloze } : {}),
      ...(valid.explanation ? { explanation: valid.explanation } : {}),
      ...(valid.difficulty ? { difficulty: valid.difficulty } : {}),
      tags: valid.tags,
      source: existing?.source ?? valid.source ?? 'manuel',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await db.questions.put(question);
    await db.subjects.update(subjectId, { updatedAt: now });
    if (existing && existing.subjectId !== subjectId) await db.subjects.update(existing.subjectId, { updatedAt: now });
    return question;
  });
}

export async function deleteQuestion(db: QuizLabDB, id: string, now = Date.now()): Promise<void> {
  await db.transaction('rw', db.subjects, db.questions, async () => {
    const question = await db.questions.get(id);
    if (!question) return;
    await db.questions.delete(id);
    await db.subjects.update(question.subjectId, { updatedAt: now });
  });
}

/* ------------------------------------------------------------------ */
/* Historique                                                           */
/* ------------------------------------------------------------------ */

export async function saveSession(db: QuizLabDB, record: SessionRecord): Promise<void> {
  await db.sessions.put(record);
}

export async function listSessions(db: QuizLabDB, subjectId?: string): Promise<SessionRecord[]> {
  const sessions = subjectId ? await db.sessions.where('subjectId').equals(subjectId).toArray() : await db.sessions.toArray();
  return sessions.sort((a, b) => a.finishedAt - b.finishedAt);
}

export async function clearHistory(db: QuizLabDB, subjectId?: string): Promise<void> {
  if (subjectId) await db.sessions.where('subjectId').equals(subjectId).delete();
  else await db.sessions.clear();
}

/* ------------------------------------------------------------------ */
/* Import / export                                                      */
/* ------------------------------------------------------------------ */

export async function loadExistingData(db: QuizLabDB): Promise<ExistingData> {
  const [subjects, questions, sessionIds] = await Promise.all([
    db.subjects.toArray(),
    db.questions.toArray(),
    db.sessions.toCollection().primaryKeys(),
  ]);
  return {
    subjects: new Map(subjects.map((s) => [s.id, s.title])),
    questionSubject: new Map(questions.map((q) => [q.id, q.subjectId])),
    sessionIds: new Set(sessionIds),
  };
}

/** Écrit un import planifié en une seule transaction : tout est importé, ou rien. */
export async function applyImportPlan(db: QuizLabDB, plan: ImportPlan): Promise<void> {
  await db.transaction('rw', db.subjects, db.questions, db.sessions, async () => {
    for (const id of plan.replaceSubjectIds) {
      await db.questions.where('subjectId').equals(id).delete();
    }
    await db.subjects.bulkPut(plan.subjects);
    await db.questions.bulkAdd(plan.questions);
    if (plan.sessions.length) await db.sessions.bulkAdd(plan.sessions);
  });
}

export async function exportSubject(db: QuizLabDB, subjectId: string) {
  const subject = await db.subjects.get(subjectId);
  if (!subject) throw new Error('Ce sujet n’existe plus.');
  const questions = await listQuestions(db, subjectId);
  return buildExportFile([{ subject, questions }]);
}

/** Sauvegarde complète : tous les sujets, toutes les questions et tout l'historique. */
export async function exportAll(db: QuizLabDB) {
  const subjects = await listSubjects(db);
  const questions = await db.questions.toArray();
  const sessions = await listSessions(db);
  const bundles = subjects.map((subject) => ({ subject, questions: questions.filter((q) => q.subjectId === subject.id) }));
  return buildExportFile(bundles, sessions);
}
