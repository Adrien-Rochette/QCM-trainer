import { describePath, type ValidationIssue, zodIssues } from '../lib/errors';
import { createId, slugify } from '../lib/ids';
import {
  FILE_FORMAT_NAME,
  FILE_FORMAT_VERSION,
  quizlabFileSchema,
  type FileQuestion,
  type QuizlabFile,
} from '../models/schemas';
import type { Question, SessionRecord, Subject } from '../models/types';

/* ------------------------------------------------------------------ */
/* Lecture et validation d'un fichier                                  */
/* ------------------------------------------------------------------ */

export type ParseResult =
  | { ok: true; file: QuizlabFile }
  | { ok: false; error: string; issues: ValidationIssue[] };

function fail(error: string, issues: ValidationIssue[] = []): ParseResult {
  return { ok: false, error, issues };
}

/** Lit un texte JSON au format QuizLab et le valide entièrement. Aucune donnée n'est écrite. */
export function parseQuizlabJson(text: string): ParseResult {
  if (!text.trim()) return fail('Le fichier est vide.');

  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return fail(`Le fichier n'est pas un JSON valide : ${detail}`);
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return fail('Le fichier doit contenir un objet JSON avec les champs « format », « version » et « subjects ».');
  }

  const obj = raw as Record<string, unknown>;
  if (obj.format !== FILE_FORMAT_NAME) {
    return fail(
      'Ce fichier n’est pas reconnu comme un fichier QuizLab : le champ « format » doit valoir "quizlab". ' +
        'Consultez la documentation du format (docs/FORMAT-JSON.md) ou le fichier d’exemple.',
    );
  }
  if (typeof obj.version === 'number' && obj.version > FILE_FORMAT_VERSION) {
    return fail(
      `Ce fichier utilise la version ${obj.version} du format, plus récente que celle prise en charge (${FILE_FORMAT_VERSION}). Mettez QuizLab à jour.`,
    );
  }

  const parsed = quizlabFileSchema.safeParse(raw);
  if (!parsed.success) {
    return fail('Le fichier contient des erreurs. Aucune donnée n’a été importée.', zodIssues(parsed.error));
  }

  const issues = findDuplicateIds(parsed.data);
  if (issues.length) {
    return fail('Le fichier contient des identifiants en double. Aucune donnée n’a été importée.', issues);
  }
  return { ok: true, file: parsed.data };
}

/** Vérifie l'unicité des identifiants de sujets et de questions à l'intérieur du fichier. */
function findDuplicateIds(file: QuizlabFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const subjectIds = new Map<string, number>();
  const questionIds = new Map<string, string>();
  file.subjects.forEach((subject, s) => {
    if (subject.id) {
      const previous = subjectIds.get(subject.id);
      if (previous !== undefined) {
        issues.push({
          path: describePath(['subjects', s, 'id']),
          message: `l'identifiant « ${subject.id} » est déjà utilisé par le sujet ${previous + 1}`,
        });
      } else subjectIds.set(subject.id, s);
    }
    subject.questions.forEach((question, q) => {
      if (!question.id) return;
      const where = describePath(['subjects', s, 'questions', q]);
      const previous = questionIds.get(question.id);
      if (previous) {
        issues.push({ path: `${where} › identifiant`, message: `l'identifiant « ${question.id} » est déjà utilisé (${previous})` });
      } else questionIds.set(question.id, where);
    });
  });
  return issues;
}

/* ------------------------------------------------------------------ */
/* Planification de l'import (gestion des collisions d'identifiants)    */
/* ------------------------------------------------------------------ */

export interface ExistingData {
  subjects: ReadonlyMap<string, string>; // id → titre
  questionSubject: ReadonlyMap<string, string>; // id de question → id de sujet
  sessionIds: ReadonlySet<string>;
}

export interface SubjectConflict {
  id: string;
  fileTitle: string;
  existingTitle: string;
}

/** Sujets du fichier dont l'identifiant existe déjà dans l'application. */
export function detectConflicts(file: QuizlabFile, existing: ExistingData): SubjectConflict[] {
  return file.subjects.flatMap((subject) => {
    const existingTitle = subject.id ? existing.subjects.get(subject.id) : undefined;
    return subject.id && existingTitle !== undefined ? [{ id: subject.id, fileTitle: subject.title, existingTitle }] : [];
  });
}

/**
 * En cas de collision avec un sujet existant :
 *  - `copy` : le sujet est importé comme un nouveau sujet (nouvel identifiant) ;
 *  - `replace` : le sujet existant et ses questions sont remplacés (l'historique est conservé).
 */
export type ConflictStrategy = 'copy' | 'replace';

export interface ImportPlan {
  subjects: Subject[];
  questions: Question[];
  sessions: SessionRecord[];
  /** Sujets existants à remplacer (leurs anciennes questions seront supprimées). */
  replaceSubjectIds: string[];
}

export function planImport(
  file: QuizlabFile,
  existing: ExistingData,
  strategy: ConflictStrategy = 'copy',
  now: number = Date.now(),
): ImportPlan {
  const replaceSubjectIds = new Set<string>();
  const subjectIdMap = new Map<string, string>();
  const subjects: Subject[] = [];
  const questions: Question[] = [];
  const questionIdMaps = new Map<string, Map<string, string>>(); // id de sujet final → (ancien id → nouvel id)
  let clock = now;

  // Identifiants de questions déjà pris, hors questions des sujets qui vont être remplacés.
  const takenQuestionIds = new Set<string>();
  const replaced = (subjectId: string) => strategy === 'replace' && existing.subjects.has(subjectId);
  for (const [questionId, subjectId] of existing.questionSubject) {
    if (!(file.subjects.some((s) => s.id === subjectId) && replaced(subjectId))) takenQuestionIds.add(questionId);
  }

  for (const fileSubject of file.subjects) {
    let subjectId: string;
    if (fileSubject.id && !existing.subjects.has(fileSubject.id)) {
      subjectId = fileSubject.id;
    } else if (fileSubject.id && strategy === 'replace') {
      subjectId = fileSubject.id;
      replaceSubjectIds.add(subjectId);
    } else {
      subjectId = createId();
    }
    if (fileSubject.id) subjectIdMap.set(fileSubject.id, subjectId);

    subjects.push({
      id: subjectId,
      title: fileSubject.title,
      description: fileSubject.description,
      ...(fileSubject.category ? { category: fileSubject.category } : {}),
      createdAt: now,
      updatedAt: now,
    });

    const idMap = new Map<string, string>();
    questionIdMaps.set(subjectId, idMap);
    for (const fileQuestion of fileSubject.questions) {
      const wanted = fileQuestion.id;
      const id = wanted && !takenQuestionIds.has(wanted) ? wanted : createId();
      takenQuestionIds.add(id);
      if (wanted) idMap.set(wanted, id);
      // Horodatage croissant : l'ordre du fichier est conservé en mode séquentiel.
      clock++;
      questions.push(fromFileQuestion(fileQuestion, id, subjectId, clock));
    }
  }

  const sessions: SessionRecord[] = [];
  for (const session of file.sessions ?? []) {
    const subjectId = subjectIdMap.get(session.subjectId);
    if (!subjectId || existing.sessionIds.has(session.id)) continue;
    const idMap = questionIdMaps.get(subjectId);
    sessions.push({
      ...session,
      subjectId,
      answers: session.answers.map((a) => ({ ...a, questionId: idMap?.get(a.questionId) ?? a.questionId })),
    });
  }

  return { subjects, questions, sessions, replaceSubjectIds: [...replaceSubjectIds] };
}

function fromFileQuestion(q: FileQuestion, id: string, subjectId: string, timestamp: number): Question {
  return {
    id,
    subjectId,
    ...(q.mcq ? { mcq: q.mcq } : {}),
    ...(q.cloze ? { cloze: q.cloze } : {}),
    ...(q.explanation ? { explanation: q.explanation } : {}),
    ...(q.difficulty ? { difficulty: q.difficulty } : {}),
    tags: q.tags,
    source: q.source ?? 'import',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/* ------------------------------------------------------------------ */
/* Exportation                                                          */
/* ------------------------------------------------------------------ */

export interface SubjectBundle {
  subject: Subject;
  questions: Question[];
}

/** Produit l'objet JSON exporté (format QuizLab v1). */
export function buildExportFile(bundles: readonly SubjectBundle[], sessions?: readonly SessionRecord[]): QuizlabFile {
  return {
    format: FILE_FORMAT_NAME,
    version: FILE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    subjects: bundles.map(({ subject, questions }) => ({
      id: subject.id,
      title: subject.title,
      description: subject.description,
      ...(subject.category ? { category: subject.category } : {}),
      questions: [...questions]
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
        .map((q) => ({
          id: q.id,
          ...(q.difficulty ? { difficulty: q.difficulty } : {}),
          ...(q.tags.length ? { tags: q.tags } : { tags: [] }),
          ...(q.mcq ? { mcq: q.mcq } : {}),
          ...(q.cloze ? { cloze: q.cloze } : {}),
          ...(q.explanation ? { explanation: q.explanation } : {}),
          ...(q.source ? { source: q.source } : {}),
        })),
    })),
    ...(sessions ? { sessions: [...sessions] } : {}),
  };
}

export function serializeExport(file: QuizlabFile): string {
  return JSON.stringify(file, null, 2);
}

export function exportFileName(label: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return `quizlab-${slugify(label)}-${day}.json`;
}
