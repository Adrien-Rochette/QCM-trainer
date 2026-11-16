import { Copy, Download, FileQuestion, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useConfirm } from '../app/confirm';
import { href, navigate } from '../app/router';
import { useToast } from '../app/toast';
import { RichText } from '../components/quiz/RichText';
import { SubjectFormModal } from '../components/subjects/SubjectFormModal';
import { Badge, DifficultyBadge, FormatBadge } from '../components/ui/Badge';
import { Button, IconButton, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { BackLink, EmptyState, Loading, PageHeader } from '../components/ui/Feedback';
import { Select, TextInput } from '../components/ui/Field';
import { db } from '../db/database';
import { deleteQuestion, saveQuestion } from '../db/repository';
import { countFormats } from '../engine/sessionBuilder';
import { useQuestions, useSubject } from '../hooks/useData';
import { useSubjectActions } from '../hooks/useSubjectActions';
import { errorMessage } from '../lib/errors';
import { plural } from '../lib/format';
import type { Question } from '../models/types';
import { questionPrompt } from '../stats/statistics';
import { NotFoundPage } from './NotFoundPage';

type FormatFilter = 'all' | 'qcm' | 'trous' | 'both';

export function SubjectQuestionsPage({ id }: { id: string }) {
  const subject = useSubject(id);
  const questions = useQuestions(id);
  const confirm = useConfirm();
  const notify = useToast();
  const { exportOne, remove } = useSubjectActions();
  const [editingSubject, setEditingSubject] = useState(false);
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<FormatFilter>('all');

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    return (questions ?? []).filter((q) => {
      if (format === 'qcm' && !q.mcq) return false;
      if (format === 'trous' && !q.cloze) return false;
      if (format === 'both' && !(q.mcq && q.cloze)) return false;
      if (!term) return true;
      const haystack = [q.mcq?.prompt, q.cloze?.text, ...(q.mcq?.choices.map((c) => c.text) ?? []), ...(q.cloze?.blanks.flatMap((b) => b.answers) ?? []), ...q.tags]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('fr');
      return haystack.includes(term);
    });
  }, [questions, search, format]);

  if (subject === undefined || questions === undefined) return <Loading />;
  if (subject === null) return <NotFoundPage message="Ce sujet n’existe pas ou a été supprimé." />;

  const counts = countFormats(questions);

  async function onDelete(question: Question) {
    const ok = await confirm({
      title: 'Supprimer cette question ?',
      message: `« ${questionPrompt(question)} »`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    await deleteQuestion(db, question.id);
    notify('Question supprimée.');
  }

  async function onDuplicate(question: Question) {
    try {
      const { id: _id, subjectId, createdAt: _c, updatedAt: _u, ...content } = question;
      await saveQuestion(db, subjectId, content);
      notify('Question dupliquée (ajoutée en fin de liste).');
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }

  async function onDeleteSubject() {
    if (subject && (await remove(subject))) navigate({ name: 'manage' });
  }

  return (
    <div>
      <PageHeader
        back={<BackLink href={href({ name: 'manage' })}>Gestion des sujets</BackLink>}
        title={subject.title}
        subtitle={
          <div className="space-y-1.5">
            {subject.description && <p>{subject.description}</p>}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {subject.category && <Badge tone="violet">{subject.category}</Badge>}
              <span>
                {plural(counts.total, 'question')} · {counts.qcm} QCM · {counts.trous} à trous · {counts.both} compatibles avec les deux modes
              </span>
            </div>
          </div>
        }
        actions={
          <>
            <LinkButton variant="primary" href={href({ name: 'editQuestion', subjectId: id })} icon={<Plus className="size-4" />}>
              Ajouter une question
            </LinkButton>
            <IconButton label="Renommer / modifier la description" onClick={() => setEditingSubject(true)}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton label="Lancer un quiz" onClick={() => navigate({ name: 'subject', id })}>
              <Play className="size-4" />
            </IconButton>
            <IconButton label="Exporter en JSON" onClick={() => exportOne(subject)}>
              <Download className="size-4" />
            </IconButton>
            <IconButton label="Supprimer le sujet" tone="danger" onClick={onDeleteSubject}>
              <Trash2 className="size-4" />
            </IconButton>
          </>
        }
      />

      {questions.length === 0 ? (
        <EmptyState
          icon={<FileQuestion className="size-7" />}
          title="Aucune question dans ce sujet"
          description="Ajoutez votre première question avec l’éditeur (sans écrire de code), ou importez un fichier JSON."
          action={
            <>
              <LinkButton variant="primary" href={href({ name: 'editQuestion', subjectId: id })} icon={<Plus className="size-4" />}>
                Ajouter une question
              </LinkButton>
              <LinkButton href={href({ name: 'import' })}>Importer un fichier</LinkButton>
            </>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <TextInput
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher dans les questions, réponses, étiquettes…"
                aria-label="Rechercher une question"
                className="pl-9"
              />
            </div>
            <Select value={format} onChange={(e) => setFormat(e.target.value as FormatFilter)} aria-label="Filtrer par format" className="sm:w-56">
              <option value="all">Tous les formats</option>
              <option value="qcm">Avec version QCM</option>
              <option value="trous">Avec version à trous</option>
              <option value="both">Avec les deux versions</option>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-800">
              Aucune question ne correspond à votre recherche.
            </p>
          ) : (
            <ol className="space-y-2.5">
              {filtered.map((q) => (
                <li key={q.id}>
                  <Card className="flex gap-4 p-4">
                    <span className="mt-0.5 w-7 shrink-0 text-right text-xs font-semibold text-slate-400 tabular-nums">{questions.indexOf(q) + 1}</span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <a href={href({ name: 'editQuestion', subjectId: id, questionId: q.id })} className="block font-medium text-slate-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-300">
                        <RichText text={questionPrompt(q)} />
                      </a>
                      {q.mcq && q.cloze && (
                        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                          À trous : <RichText text={q.cloze.text} />
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {q.mcq && <FormatBadge format="qcm" />}
                        {q.cloze && <FormatBadge format="trous" />}
                        <DifficultyBadge difficulty={q.difficulty} />
                        {q.tags.slice(0, 4).map((t) => (
                          <Badge key={t}>#{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-0.5">
                      <IconButton label="Modifier" onClick={() => navigate({ name: 'editQuestion', subjectId: id, questionId: q.id })}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton label="Dupliquer" onClick={() => onDuplicate(q)}>
                        <Copy className="size-4" />
                      </IconButton>
                      <IconButton label="Supprimer" tone="danger" onClick={() => onDelete(q)}>
                        <Trash2 className="size-4" />
                      </IconButton>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          )}
          <div className="flex justify-center pt-2">
            <Button variant="secondary" onClick={() => navigate({ name: 'editQuestion', subjectId: id })} icon={<Plus className="size-4" />}>
              Ajouter une question
            </Button>
          </div>
        </div>
      )}

      <SubjectFormModal open={editingSubject} onClose={() => setEditingSubject(false)} subject={subject} />
    </div>
  );
}
