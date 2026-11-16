import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ValidationError } from '../lib/errors';
import { parseQuizlabJson, planImport } from '../io/importExport';
import { sessionRecord } from '../test/factories';
import { QuizLabDB } from './database';
import {
  applyImportPlan,
  createSubject,
  deleteQuestion,
  deleteSubject,
  duplicateSubject,
  exportAll,
  exportSubject,
  listQuestions,
  listSessions,
  listSubjects,
  loadExistingData,
  saveQuestion,
  saveSession,
  updateSubject,
} from './repository';
import { seedDemoData } from './seed';

let dbName: string;
let db: QuizLabDB;
let n = 0;

beforeEach(async () => {
  dbName = `quizlab-test-${++n}`;
  db = new QuizLabDB(dbName);
  await db.open();
});

afterEach(async () => {
  db.close();
  await QuizLabDB.delete(dbName);
});

const question = {
  mcq: { prompt: 'Capitale ?', choices: [{ id: 'a', text: 'Paris' }, { id: 'b', text: 'Lyon' }], correctIds: ['a'] },
  cloze: { text: 'La capitale est ___.', blanks: [{ answers: ['Paris'] }] },
  explanation: '',
  difficulty: 'facile',
  tags: [],
};

describe('Persistance des données', () => {
  it('conserve sujets, questions et historique après fermeture et réouverture de la base', async () => {
    const subject = await createSubject(db, { title: 'Géographie', description: 'Test' });
    const q = await saveQuestion(db, subject.id, question);
    await saveSession(db, sessionRecord([{ questionId: q.id, correct: true }], { subjectId: subject.id }));
    db.close();

    const reopened = new QuizLabDB(dbName);
    await reopened.open();
    expect((await listSubjects(reopened)).map((s) => s.title)).toEqual(['Géographie']);
    const questions = await listQuestions(reopened, subject.id);
    expect(questions).toHaveLength(1);
    expect(questions[0]!.mcq!.prompt).toBe('Capitale ?');
    expect(questions[0]!.explanation).toBeUndefined();
    expect(await listSessions(reopened, subject.id)).toHaveLength(1);
    reopened.close();
    db = new QuizLabDB(dbName); // pour afterEach
  });
});

describe('Sujets', () => {
  it('valide les informations du sujet', async () => {
    await expect(createSubject(db, { title: '   ' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('renomme et modifie la description', async () => {
    const subject = await createSubject(db, { title: 'Ancien', description: '' }, 1);
    const updated = await updateSubject(db, subject.id, { title: 'Nouveau', description: 'Desc', category: 'Cat' }, 2);
    expect(updated).toMatchObject({ title: 'Nouveau', description: 'Desc', category: 'Cat', createdAt: 1, updatedAt: 2 });
  });

  it('duplique un sujet avec ses questions, sous de nouveaux identifiants', async () => {
    const subject = await createSubject(db, { title: 'Original' });
    const q = await saveQuestion(db, subject.id, question);
    const copy = await duplicateSubject(db, subject.id);
    expect(copy.title).toBe('Original (copie)');
    const copied = await listQuestions(db, copy.id);
    expect(copied).toHaveLength(1);
    expect(copied[0]!.id).not.toBe(q.id);
    expect(await listQuestions(db, subject.id)).toHaveLength(1);
  });

  it('supprime un sujet avec ses questions et son historique', async () => {
    const subject = await createSubject(db, { title: 'À supprimer' });
    await saveQuestion(db, subject.id, question);
    await saveSession(db, sessionRecord([], { subjectId: subject.id }));
    await deleteSubject(db, subject.id);
    expect(await db.subjects.count()).toBe(0);
    expect(await db.questions.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
  });
});

describe('Questions', () => {
  it('refuse une question invalide avant enregistrement', async () => {
    const subject = await createSubject(db, { title: 'S' });
    const invalid = { mcq: { ...question.mcq, correctIds: [] } };
    await expect(saveQuestion(db, subject.id, invalid)).rejects.toBeInstanceOf(ValidationError);
    expect(await db.questions.count()).toBe(0);
  });

  it('modifie une question existante en conservant sa date de création', async () => {
    const subject = await createSubject(db, { title: 'S' });
    const q = await saveQuestion(db, subject.id, question, undefined, 10);
    const edited = await saveQuestion(db, subject.id, { ...question, mcq: { ...question.mcq, prompt: 'Nouvelle ?' } }, q.id, 20);
    expect(edited).toMatchObject({ id: q.id, createdAt: 10, updatedAt: 20 });
    expect((await db.questions.get(q.id))!.mcq!.prompt).toBe('Nouvelle ?');
  });

  it('déplace une question vers un autre sujet', async () => {
    const a = await createSubject(db, { title: 'A' });
    const b = await createSubject(db, { title: 'B' });
    const q = await saveQuestion(db, a.id, question);
    await saveQuestion(db, b.id, question, q.id);
    expect(await listQuestions(db, a.id)).toHaveLength(0);
    expect(await listQuestions(db, b.id)).toHaveLength(1);
  });

  it('supprime une question', async () => {
    const subject = await createSubject(db, { title: 'S' });
    const q = await saveQuestion(db, subject.id, question);
    await deleteQuestion(db, q.id);
    expect(await db.questions.count()).toBe(0);
  });
});

describe('Import / export avec la base', () => {
  it('exporte un sujet puis le réimporte comme copie', async () => {
    const subject = await createSubject(db, { title: 'Export' });
    await saveQuestion(db, subject.id, question);
    const exported = await exportSubject(db, subject.id);
    const parsed = parseQuizlabJson(JSON.stringify(exported));
    if (!parsed.ok) throw new Error(parsed.error);
    const plan = planImport(parsed.file, await loadExistingData(db), 'copy');
    await applyImportPlan(db, plan);
    expect(await db.subjects.count()).toBe(2);
    expect(await db.questions.count()).toBe(2);
  });

  it('remplace un sujet existant sans doublon', async () => {
    const subject = await createSubject(db, { title: 'Original' });
    await saveQuestion(db, subject.id, question);
    await saveQuestion(db, subject.id, question);
    const exported = await exportSubject(db, subject.id);
    exported.subjects[0]!.title = 'Remplacé';
    exported.subjects[0]!.questions = exported.subjects[0]!.questions.slice(0, 1);
    const parsed = parseQuizlabJson(JSON.stringify(exported));
    if (!parsed.ok) throw new Error(parsed.error);
    await applyImportPlan(db, planImport(parsed.file, await loadExistingData(db), 'replace'));
    expect((await listSubjects(db)).map((s) => s.title)).toEqual(['Remplacé']);
    expect(await db.questions.count()).toBe(1);
  });

  it('restaure une sauvegarde complète, historique compris', async () => {
    const subject = await createSubject(db, { title: 'Sauvegarde' });
    const q = await saveQuestion(db, subject.id, question);
    await saveSession(db, sessionRecord([{ questionId: q.id, correct: false }], { subjectId: subject.id }));
    const backup = JSON.stringify(await exportAll(db));

    const other = new QuizLabDB(`${dbName}-restore`);
    await other.open();
    const parsed = parseQuizlabJson(backup);
    if (!parsed.ok) throw new Error(parsed.error);
    await applyImportPlan(other, planImport(parsed.file, await loadExistingData(other)));
    expect(await other.subjects.count()).toBe(1);
    expect(await other.questions.count()).toBe(1);
    expect(await other.sessions.count()).toBe(1);
    other.close();
    await QuizLabDB.delete(`${dbName}-restore`);
  });
});

describe('Données de démonstration', () => {
  it('installe deux sujets une seule fois, même en cas d’appels simultanés', async () => {
    const results = await Promise.all([seedDemoData(db), seedDemoData(db)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await db.subjects.count()).toBe(2);
    expect(await db.questions.count()).toBeGreaterThanOrEqual(20);
  });

  it('ne réinstalle pas les sujets supprimés par l’utilisateur', async () => {
    await seedDemoData(db);
    for (const s of await listSubjects(db)) await deleteSubject(db, s.id);
    expect(await seedDemoData(db)).toBe(false);
    expect(await db.subjects.count()).toBe(0);
  });
});
