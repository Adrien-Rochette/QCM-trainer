import { ArrowRight, BarChart3, Download, FileQuestion, Pencil, Trophy } from 'lucide-react';
import { href, navigate } from '../app/router';
import { MODE_META } from '../components/quiz/modeMeta';
import { Badge } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { BackLink, EmptyState, Loading, PageHeader, StatTile } from '../components/ui/Feedback';
import { countFormats } from '../engine/sessionBuilder';
import { useQuestions, useSessions, useSubject } from '../hooks/useData';
import { useSubjectActions } from '../hooks/useSubjectActions';
import { cn } from '../lib/cn';
import { plural } from '../lib/format';
import type { QuizMode } from '../models/types';
import { summarizeSessions } from '../stats/statistics';
import { NotFoundPage } from './NotFoundPage';

export function SubjectPage({ id }: { id: string }) {
  const subject = useSubject(id);
  const questions = useQuestions(id);
  const sessions = useSessions(id);
  const { exportOne } = useSubjectActions();

  if (subject === undefined || questions === undefined) return <Loading />;
  if (subject === null) return <NotFoundPage message="Ce sujet n’existe pas ou a été supprimé." />;

  const counts = countFormats(questions);
  const available: Record<QuizMode, number> = { qcm: counts.qcm, trous: counts.trous, mixte: counts.total };
  const summary = summarizeSessions(sessions ?? []);

  return (
    <div>
      <PageHeader
        back={<BackLink href={href({ name: 'home' })}>Tous les sujets</BackLink>}
        title={subject.title}
        subtitle={
          <div className="space-y-2">
            {subject.description && <p>{subject.description}</p>}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {subject.category && <Badge tone="violet">{subject.category}</Badge>}
              <span>{plural(counts.total, 'question')}</span>
            </div>
          </div>
        }
        actions={
          <>
            <LinkButton href={href({ name: 'manageSubject', id })} icon={<Pencil className="size-4" />}>
              Gérer les questions
            </LinkButton>
            <Button variant="ghost" onClick={() => exportOne(subject)} icon={<Download className="size-4" />}>
              Exporter
            </Button>
          </>
        }
      />

      {counts.total === 0 ? (
        <EmptyState
          icon={<FileQuestion className="size-7" />}
          title="Ce sujet ne contient encore aucune question"
          description="Ajoutez des questions QCM ou à trous pour pouvoir lancer un quiz."
          action={
            <LinkButton variant="primary" href={href({ name: 'editQuestion', subjectId: id })}>
              Ajouter une question
            </LinkButton>
          }
        />
      ) : (
        <section aria-labelledby="modes-titre">
          <h2 id="modes-titre" className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
            Choisissez un mode
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(MODE_META) as QuizMode[]).map((mode, i) => {
              const meta = MODE_META[mode];
              const Icon = meta.icon;
              const count = available[mode];
              const disabled = count === 0;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => navigate({ name: 'setup', id, mode })}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={cn(
                    'group flex animate-slide-up flex-col rounded-3xl border-2 border-slate-200/80 bg-white p-6 text-left transition-all dark:border-slate-800 dark:bg-slate-900',
                    disabled ? 'cursor-not-allowed opacity-60' : cn('hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5', meta.ring),
                  )}
                >
                  <span className={cn('mb-5 flex size-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105', meta.accent)}>
                    <Icon className="size-7" aria-hidden="true" />
                  </span>
                  <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">{meta.title}</span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{meta.description}</span>
                  <span className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {disabled ? 'Aucune question compatible' : `${plural(count, 'question')} disponible${count > 1 ? 's' : ''}`}
                    </span>
                    {!disabled && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                        Commencer <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {summary.quizCount > 0 && (
        <section aria-labelledby="resume-titre" className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 id="resume-titre" className="text-lg font-semibold text-slate-900 dark:text-white">
              Vos résultats
            </h2>
            <a href={href({ name: 'stats', subjectId: id })} className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              <BarChart3 className="size-4" aria-hidden="true" /> Statistiques détaillées
            </a>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Quiz réalisés" value={summary.quizCount} />
            <StatTile label="Score moyen" value={`${summary.averagePercent} %`} />
            <StatTile label="Meilleur score" value={`${summary.bestPercent} %`} icon={<Trophy className="size-4 text-amber-500" aria-hidden="true" />} />
            <StatTile label="Taux de réussite" value={`${summary.successRate} %`} hint={`${summary.correctAnswers} / ${summary.totalAnswers} réponses`} />
          </div>
        </section>
      )}
    </div>
  );
}
