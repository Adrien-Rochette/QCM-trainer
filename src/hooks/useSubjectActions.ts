import { useCallback } from 'react';
import { useConfirm } from '../app/confirm';
import { useToast } from '../app/toast';
import { db } from '../db/database';
import { deleteSubject, duplicateSubject, exportAll, exportSubject } from '../db/repository';
import { exportFileName, serializeExport } from '../io/importExport';
import { downloadText } from '../lib/download';
import { errorMessage } from '../lib/errors';
import { plural } from '../lib/format';
import type { Subject } from '../models/types';

/** Actions courantes sur les sujets, avec confirmations et notifications. */
export function useSubjectActions() {
  const notify = useToast();
  const confirm = useConfirm();

  const exportOne = useCallback(
    async (subject: Subject) => {
      try {
        const file = await exportSubject(db, subject.id);
        downloadText(exportFileName(subject.title), serializeExport(file));
        notify(`Sujet « ${subject.title} » exporté.`);
      } catch (err) {
        notify(errorMessage(err), 'error');
      }
    },
    [notify],
  );

  const exportEverything = useCallback(async () => {
    try {
      const file = await exportAll(db);
      if (file.subjects.length === 0) {
        notify('Aucun sujet à sauvegarder.', 'info');
        return;
      }
      downloadText(exportFileName('sauvegarde-complete'), serializeExport(file));
      notify('Sauvegarde complète téléchargée.');
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }, [notify]);

  const duplicate = useCallback(
    async (subject: Subject): Promise<Subject | undefined> => {
      try {
        const copy = await duplicateSubject(db, subject.id);
        notify(`Sujet dupliqué : « ${copy.title} ».`);
        return copy;
      } catch (err) {
        notify(errorMessage(err), 'error');
        return undefined;
      }
    },
    [notify],
  );

  const remove = useCallback(
    async (subject: Subject): Promise<boolean> => {
      const [questions, sessions] = await Promise.all([
        db.questions.where('subjectId').equals(subject.id).count(),
        db.sessions.where('subjectId').equals(subject.id).count(),
      ]);
      const ok = await confirm({
        title: `Supprimer « ${subject.title} » ?`,
        message: `${plural(questions, 'question')} et ${plural(sessions, 'résultat')} d’historique seront définitivement supprimés. Pensez à exporter le sujet si vous souhaitez le conserver.`,
        confirmLabel: 'Supprimer définitivement',
        danger: true,
      });
      if (!ok) return false;
      try {
        await deleteSubject(db, subject.id);
        notify(`Sujet « ${subject.title} » supprimé.`);
        return true;
      } catch (err) {
        notify(errorMessage(err), 'error');
        return false;
      }
    },
    [confirm, notify],
  );

  return { exportOne, exportEverything, duplicate, remove };
}
