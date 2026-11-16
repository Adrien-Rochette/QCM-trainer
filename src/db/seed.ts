import { DEMO_DATA } from '../data/demoData';
import { planImport } from '../io/importExport';
import { quizlabFileSchema } from '../models/schemas';
import type { QuizLabDB } from './database';
import { applyImportPlan, loadExistingData } from './repository';

const SEED_KEY = 'demoSeeded';

async function installDemo(db: QuizLabDB, now: number): Promise<void> {
  const file = quizlabFileSchema.parse(DEMO_DATA);
  const plan = planImport(file, await loadExistingData(db), 'copy', now);
  plan.questions.forEach((q) => (q.source = 'démonstration'));
  await applyImportPlan(db, plan);
}

/**
 * Installe les sujets de démonstration au tout premier lancement.
 * Si l'utilisateur les supprime ensuite, ils ne sont pas réinstallés.
 * L'opération est atomique : deux appels simultanés n'installent les données qu'une fois.
 * Renvoie `true` si les données ont été installées.
 */
export async function seedDemoData(db: QuizLabDB, now = Date.now()): Promise<boolean> {
  return db.transaction('rw', [db.subjects, db.questions, db.sessions, db.meta], async () => {
    if (await db.meta.get(SEED_KEY)) return false;
    await installDemo(db, now);
    await db.meta.put({ key: SEED_KEY, value: now });
    return true;
  });
}

/** Réinstalle les sujets de démonstration (sous forme de copies s'ils existent déjà). */
export async function reinstallDemoData(db: QuizLabDB, now = Date.now()): Promise<void> {
  await installDemo(db, now);
}
