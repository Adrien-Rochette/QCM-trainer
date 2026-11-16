import { describe, expect, it } from 'vitest';
import example from '../../public/exemples/histoire-de-france.json';
import thermo from '../../sujets/thermodynamique-td0-td2.json';
import { DEMO_DATA } from '../data/demoData';
import type { Question, Subject } from '../models/types';
import { buildExportFile, detectConflicts, parseQuizlabJson, planImport, serializeExport, type ExistingData } from './importExport';

const empty: ExistingData = { subjects: new Map(), questionSubject: new Map(), sessionIds: new Set() };

function minimalFile(questions: unknown[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({ format: 'quizlab', version: 1, subjects: [{ title: 'Test', questions, ...extra }] });
}

const validQuestion = {
  mcq: { prompt: 'Q ?', choices: [{ id: 'a', text: 'Oui' }, { id: 'b', text: 'Non' }], correctIds: ['a'] },
};

describe('Importation d’un fichier valide', () => {
  it('accepte le fichier d’exemple (au moins 10 questions)', () => {
    const result = parseQuizlabJson(JSON.stringify(example));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.subjects[0]!.questions.length).toBeGreaterThanOrEqual(10);
  });

  it('accepte la banque de questions de thermodynamique', () => {
    const result = parseQuizlabJson(JSON.stringify(thermo));
    if (!result.ok) throw new Error(`${result.error}\n${result.issues.map((i) => `${i.path} : ${i.message}`).join('\n')}`);
    expect(result.file.subjects[0]!.questions.length).toBeGreaterThanOrEqual(50);
  });

  it('accepte les données de démonstration', () => {
    const result = parseQuizlabJson(JSON.stringify(DEMO_DATA));
    expect(result.ok).toBe(true);
  });

  it('accepte un fichier minimal et applique les valeurs par défaut', () => {
    const result = parseQuizlabJson(minimalFile([validQuestion]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.subjects[0]!.description).toBe('');
    expect(result.file.subjects[0]!.questions[0]!.tags).toEqual([]);
  });

  it('crée de nouveaux identifiants et conserve l’ordre du fichier', () => {
    const result = parseQuizlabJson(JSON.stringify(example));
    if (!result.ok) throw new Error(result.error);
    const plan = planImport(result.file, empty, 'copy', 1000);
    expect(plan.subjects).toHaveLength(1);
    expect(plan.subjects[0]!.id).toBe('exemple-histoire-de-france');
    const times = plan.questions.map((q) => q.createdAt);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(plan.questions.every((q) => q.subjectId === plan.subjects[0]!.id)).toBe(true);
  });

  it('accepte un fichier avec marque d’ordre d’octets (BOM)', () => {
    expect(parseQuizlabJson('﻿' + minimalFile([validQuestion])).ok).toBe(true);
  });
});

describe('Rejet d’un fichier invalide', () => {
  function expectError(text: string, fragment: string) {
    const result = parseQuizlabJson(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const all = [result.error, ...result.issues.map((i) => `${i.path} : ${i.message}`)].join('\n');
    expect(all).toContain(fragment);
  }

  it('rejette un JSON mal formé', () => expectError('{ "format": "quizlab", ', 'pas un JSON valide'));
  it('rejette un fichier vide', () => expectError('   ', 'vide'));
  it('rejette un fichier qui n’est pas au format QuizLab', () => expectError('{"questions": []}', 'format'));
  it('rejette une version plus récente', () => expectError('{"format":"quizlab","version":2,"subjects":[]}', 'version 2'));
  it('rejette un fichier sans sujet', () => expectError('{"format":"quizlab","version":1,"subjects":[]}', 'au moins un sujet'));
  it('détecte un champ manquant', () => expectError(minimalFile([validQuestion]).replace('"title":"Test",', ''), 'Sujet 1 › titre : champ obligatoire manquant'));

  it('rejette une question sans aucune version', () => expectError(minimalFile([{ explanation: 'rien' }]), 'au moins une version'));

  it('rejette une bonne réponse qui ne correspond à aucune proposition', () => {
    const q = { mcq: { ...validQuestion.mcq, correctIds: ['z'] } };
    expectError(minimalFile([q]), 'Sujet 1 › Question 1 › QCM › Bonne réponse 1 : la bonne réponse « z » ne correspond à aucune proposition');
  });

  it('rejette un QCM avec une seule proposition', () => {
    const q = { mcq: { prompt: 'Q', choices: [{ id: 'a', text: 'Oui' }], correctIds: ['a'] } };
    expectError(minimalFile([q]), 'au moins deux réponses');
  });

  it('rejette une phrase à trous sans blanc', () => {
    expectError(minimalFile([{ cloze: { text: 'Pas de blanc ici.', blanks: [{ answers: ['x'] }] } }]), 'blanc');
  });

  it('rejette un nombre de blancs incohérent', () => {
    expectError(minimalFile([{ cloze: { text: '___ et ___', blanks: [{ answers: ['x'] }] } }]), '2 blanc(s) mais 1');
  });

  it('rejette une difficulté inconnue', () => {
    expectError(minimalFile([{ ...validQuestion, difficulty: 'expert' }]), 'difficulté');
  });

  it('rejette des identifiants de questions en double', () => {
    expectError(minimalFile([{ ...validQuestion, id: 'x' }, { ...validQuestion, id: 'x' }]), 'déjà utilisé');
  });
});

describe('Collisions d’identifiants', () => {
  const file = (() => {
    const r = parseQuizlabJson(minimalFile([{ ...validQuestion, id: 'q-1' }], { id: 'sujet-1' }));
    if (!r.ok) throw new Error(r.error);
    return r.file;
  })();
  const existing: ExistingData = {
    subjects: new Map([['sujet-1', 'Sujet existant']]),
    questionSubject: new Map([['q-1', 'sujet-1']]),
    sessionIds: new Set(),
  };

  it('détecte un sujet déjà présent', () => {
    expect(detectConflicts(file, existing)).toEqual([{ id: 'sujet-1', fileTitle: 'Test', existingTitle: 'Sujet existant' }]);
  });

  it('importe une copie avec de nouveaux identifiants', () => {
    const plan = planImport(file, existing, 'copy');
    expect(plan.subjects[0]!.id).not.toBe('sujet-1');
    expect(plan.questions[0]!.id).not.toBe('q-1');
    expect(plan.replaceSubjectIds).toEqual([]);
  });

  it('remplace le sujet existant en conservant ses identifiants', () => {
    const plan = planImport(file, existing, 'replace');
    expect(plan.subjects[0]!.id).toBe('sujet-1');
    expect(plan.questions[0]!.id).toBe('q-1');
    expect(plan.replaceSubjectIds).toEqual(['sujet-1']);
  });

  it('renomme une question dont l’identifiant appartient à un autre sujet', () => {
    const other: ExistingData = { ...existing, subjects: new Map([['autre', 'Autre']]), questionSubject: new Map([['q-1', 'autre']]) };
    const plan = planImport(file, other, 'replace');
    expect(plan.subjects[0]!.id).toBe('sujet-1');
    expect(plan.questions[0]!.id).not.toBe('q-1');
  });
});

describe('Export puis réimport', () => {
  it('produit un fichier relisible identique sur le fond', () => {
    const subject: Subject = { id: 's1', title: 'Sujet', description: 'Desc', category: 'Cat', createdAt: 1, updatedAt: 1 };
    const questions: Question[] = [
      { id: 'q1', subjectId: 's1', ...validQuestion, tags: ['t'], difficulty: 'facile', createdAt: 1, updatedAt: 1, explanation: 'Car.' },
      { id: 'q2', subjectId: 's1', cloze: { text: 'Le ___.', blanks: [{ answers: ['chat', 'chaton'] }] }, tags: [], createdAt: 2, updatedAt: 2 },
    ];
    const text = serializeExport(buildExportFile([{ subject, questions }]));
    const result = parseQuizlabJson(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const plan = planImport(result.file, empty);
    expect(plan.subjects[0]).toMatchObject({ id: 's1', title: 'Sujet', description: 'Desc', category: 'Cat' });
    expect(plan.questions.map((q) => q.id)).toEqual(['q1', 'q2']);
    expect(plan.questions[0]).toMatchObject({ mcq: validQuestion.mcq, difficulty: 'facile', explanation: 'Car.', tags: ['t'] });
    expect(plan.questions[1]!.cloze).toEqual(questions[1]!.cloze);
  });
});
