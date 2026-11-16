import { Copy, Download, FolderPlus, HardDriveDownload, Library, ListTree, Pencil, Play, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { href, navigate } from '../app/router';
import { SubjectFormModal } from '../components/subjects/SubjectFormModal';
import { Badge } from '../components/ui/Badge';
import { Button, IconButton, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState, Loading, PageHeader } from '../components/ui/Feedback';
import { countFormats } from '../engine/sessionBuilder';
import { useAllQuestions, useSubjects } from '../hooks/useData';
import { useSubjectActions } from '../hooks/useSubjectActions';
import { formatDate, plural } from '../lib/format';
import type { Question, Subject } from '../models/types';

export function ManagePage() {
  const subjects = useSubjects();
  const questions = useAllQuestions();
  const { exportOne, exportEverything, duplicate, remove } = useSubjectActions();
  const [editing, setEditing] = useState<Subject | null>(null);
  const [creating, setCreating] = useState(false);

  const bySubject = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const q of questions ?? []) map.set(q.subjectId, [...(map.get(q.subjectId) ?? []), q]);
    return map;
  }, [questions]);

  if (subjects === undefined || questions === undefined) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Gestion des sujets"
        subtitle="Créez, modifiez, dupliquez ou exportez vos banques de questions."
        actions={
          <>
            <Button onClick={() => setCreating(true)} icon={<FolderPlus className="size-4" />}>
              Nouveau sujet
            </Button>
            <LinkButton href={href({ name: 'import' })} icon={<Upload className="size-4" />}>
              Importer
            </LinkButton>
            <Button variant="secondary" onClick={exportEverything} disabled={subjects.length === 0} icon={<HardDriveDownload className="size-4" />}>
              Sauvegarde complète
            </Button>
          </>
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={<Library className="size-7" />}
          title="Aucun sujet"
          description="Commencez par créer un sujet, puis ajoutez-y vos questions."
          action={
            <Button onClick={() => setCreating(true)} icon={<FolderPlus className="size-4" />}>
              Créer un sujet
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {subjects.map((subject) => {
            const counts = countFormats(bySubject.get(subject.id) ?? []);
            return (
              <li key={subject.id}>
                <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={href({ name: 'manageSubject', id: subject.id })} className="text-base font-semibold text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">
                        {subject.title}
                      </a>
                      {subject.category && <Badge tone="violet">{subject.category}</Badge>}
                    </div>
                    {subject.description && <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{subject.description}</p>}
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {plural(counts.total, 'question')} · {counts.qcm} QCM · {counts.trous} à trous · modifié le {formatDate(subject.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <LinkButton href={href({ name: 'manageSubject', id: subject.id })} size="sm" icon={<ListTree className="size-4" />}>
                      Questions
                    </LinkButton>
                    <IconButton label="Lancer un quiz" onClick={() => navigate({ name: 'subject', id: subject.id })}>
                      <Play className="size-4" />
                    </IconButton>
                    <IconButton label="Renommer / modifier la description" onClick={() => setEditing(subject)}>
                      <Pencil className="size-4" />
                    </IconButton>
                    <IconButton label="Dupliquer" onClick={() => duplicate(subject)}>
                      <Copy className="size-4" />
                    </IconButton>
                    <IconButton label="Exporter en JSON" onClick={() => exportOne(subject)}>
                      <Download className="size-4" />
                    </IconButton>
                    <IconButton label="Supprimer" tone="danger" onClick={() => remove(subject)}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <SubjectFormModal open={creating} onClose={() => setCreating(false)} onSaved={(s) => navigate({ name: 'manageSubject', id: s.id })} />
      <SubjectFormModal open={editing !== null} onClose={() => setEditing(null)} {...(editing ? { subject: editing } : {})} />
    </div>
  );
}
