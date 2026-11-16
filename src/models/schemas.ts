import { z } from 'zod';
import fr from 'zod/v4/locales/fr.js';
import { countBlanks } from '../lib/cloze';
import { DIFFICULTIES } from './types';

// Messages d'erreur Zod en français, avec un libellé explicite pour les champs absents.
// (Seule la langue française est importée, pour ne pas alourdir l'application.)
z.config({
  ...fr(),
  customError: (issue) => {
    if (issue.code === 'invalid_type' && issue.input === undefined) return 'champ obligatoire manquant';
    return undefined;
  },
});

/** Version actuelle du format de fichier QuizLab. */
export const FILE_FORMAT_VERSION = 1;
export const FILE_FORMAT_NAME = 'quizlab';

const requiredText = (label: string) => z.string().trim().min(1, `${label} ne peut pas être vide`);

/** Chaîne facultative : une valeur vide est considérée comme absente. */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v ? v : undefined))
  .optional();

export const choiceSchema = z.object({
  id: requiredText("L'identifiant de la proposition"),
  text: requiredText('Le texte de la proposition'),
});

export const mcqSchema = z
  .object({
    prompt: requiredText("L'énoncé du QCM"),
    choices: z.array(choiceSchema).min(2, 'Un QCM doit proposer au moins deux réponses'),
    correctIds: z.array(z.string().trim()).min(1, 'Indiquez au moins une bonne réponse'),
  })
  .superRefine((mcq, ctx) => {
    const ids = new Set<string>();
    const texts = new Set<string>();
    mcq.choices.forEach((choice, i) => {
      if (ids.has(choice.id)) {
        ctx.addIssue({ code: 'custom', path: ['choices', i, 'id'], message: `identifiant « ${choice.id} » utilisé deux fois` });
      }
      ids.add(choice.id);
      // Comparaison sensible à la casse : « n » et « N » n'ont pas le même sens (moles / molécules).
      const key = choice.text.replace(/\s+/g, ' ');
      if (texts.has(key)) {
        ctx.addIssue({ code: 'custom', path: ['choices', i, 'text'], message: `la proposition « ${choice.text} » apparaît deux fois` });
      }
      texts.add(key);
    });
    const seen = new Set<string>();
    mcq.correctIds.forEach((id, i) => {
      if (!ids.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['correctIds', i], message: `la bonne réponse « ${id} » ne correspond à aucune proposition` });
      }
      if (seen.has(id)) {
        ctx.addIssue({ code: 'custom', path: ['correctIds', i], message: `la bonne réponse « ${id} » est indiquée deux fois` });
      }
      seen.add(id);
    });
  });

export const blankSchema = z.object({
  answers: z.array(requiredText('Une réponse acceptée')).min(1, 'Indiquez au moins une réponse acceptée'),
});

export const clozeSchema = z
  .object({
    text: requiredText('La phrase à trous'),
    blanks: z.array(blankSchema).min(1, 'La phrase doit comporter au moins un blanc'),
  })
  .superRefine((cloze, ctx) => {
    const markers = countBlanks(cloze.text);
    if (markers === 0) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'la phrase doit contenir un blanc noté « ___ » (trois tirets bas)' });
    } else if (markers !== cloze.blanks.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['blanks'],
        message: `la phrase contient ${markers} blanc(s) mais ${cloze.blanks.length} liste(s) de réponses`,
      });
    }
  });

const questionContentShape = {
  mcq: mcqSchema.optional(),
  cloze: clozeSchema.optional(),
  explanation: optionalText,
  difficulty: z.enum(DIFFICULTIES, { error: 'difficulté attendue : « facile », « moyen » ou « difficile »' }).optional(),
  tags: z.array(z.string().trim().min(1)).default([]),
  source: optionalText,
};

const atLeastOneFormat = {
  check: (q: { mcq?: unknown; cloze?: unknown }) => q.mcq !== undefined || q.cloze !== undefined,
  message: 'Une question doit avoir au moins une version : QCM (« mcq ») ou à trous (« cloze »)',
};

/** Contenu d'une question, tel que saisi dans l'éditeur (sans identifiants ni dates). */
export const questionContentSchema = z
  .object(questionContentShape)
  .refine(atLeastOneFormat.check, { message: atLeastOneFormat.message });

export type QuestionContent = z.output<typeof questionContentSchema>;

/** Question telle qu'elle apparaît dans un fichier d'import. */
export const fileQuestionSchema = z
  .object({
    id: optionalText,
    ...questionContentShape,
  })
  .refine(atLeastOneFormat.check, { message: atLeastOneFormat.message });

export const subjectInfoSchema = z.object({
  title: requiredText('Le titre du sujet').max(120, 'le titre ne doit pas dépasser 120 caractères'),
  description: z.string().trim().max(1000, 'la description ne doit pas dépasser 1000 caractères').default(''),
  category: optionalText,
});

export type SubjectInfo = z.output<typeof subjectInfoSchema>;

export const fileSubjectSchema = z.object({
  id: optionalText,
  ...subjectInfoSchema.shape,
  questions: z.array(fileQuestionSchema).default([]),
});

const answerRecordSchema = z.object({
  questionId: z.string(),
  format: z.enum(['qcm', 'trous']),
  correct: z.boolean(),
  given: z.array(z.string()),
  prompt: z.string(),
  givenLabel: z.string(),
  expectedLabel: z.string(),
  timeMs: z.number().nonnegative(),
  timedOut: z.boolean().optional(),
});

const sessionSettingsSchema = z.object({
  mode: z.enum(['qcm', 'trous', 'mixte']),
  count: z.union([z.literal(5), z.literal(10), z.literal(20), z.literal(50), z.literal('all')]),
  difficulty: z.enum(['tous', ...DIFFICULTIES]),
  order: z.enum(['aleatoire', 'sequentiel']),
  timer: z.enum(['aucun', 'chrono', 'limite']),
  secondsPerQuestion: z.number().int().positive(),
  onlyMistakes: z.boolean(),
  ignoreAccents: z.boolean(),
});

export const sessionRecordSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  subjectTitle: z.string(),
  mode: z.enum(['qcm', 'trous', 'mixte']),
  settings: sessionSettingsSchema,
  startedAt: z.number(),
  finishedAt: z.number(),
  durationMs: z.number().nonnegative(),
  answers: z.array(answerRecordSchema),
  correctCount: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
});

/** Fichier QuizLab complet : un ou plusieurs sujets, et éventuellement l'historique. */
export const quizlabFileSchema = z.object({
  format: z.literal(FILE_FORMAT_NAME, { error: 'le champ « format » doit valoir "quizlab"' }),
  version: z.literal(FILE_FORMAT_VERSION, { error: `le champ « version » doit valoir ${FILE_FORMAT_VERSION}` }),
  exportedAt: z.string().optional(),
  subjects: z.array(fileSubjectSchema).min(1, 'le fichier doit contenir au moins un sujet'),
  sessions: z.array(sessionRecordSchema).optional(),
});

export type QuizlabFile = z.output<typeof quizlabFileSchema>;
export type FileSubject = z.output<typeof fileSubjectSchema>;
export type FileQuestion = z.output<typeof fileQuestionSchema>;
