import { BarChart3, Clock, Target, Trash2, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { useConfirm } from '../app/confirm';
import { href, navigate } from '../app/router';
import { useToast } from '../app/toast';
import { ScoreHistoryChart } from '../components/stats/ScoreHistoryChart';
import { Badge } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { EmptyState, Loading, PageHeader, StatTile } from '../components/ui/Feedback';
import { Select } from '../components/ui/Field';
import { db } from '../db/database';
import { clearHistory } from '../db/repository';
import { formatDuration } from '../engine/scoring';
import { useAllQuestions, useSessions, useSubjects } from '../hooks/useData';
import { cn } from '../lib/cn';
import { formatDate, formatDateTime } from '../lib/format';
import { MODE_LABELS } from '../models/types';
import { frequentlyMissed, overviewBySubject, recentSessions, summarizeSessions } from '../stats/statistics';

export function StatsPage({ subjectId }: { subjectId?: string }) {
  const subjects = useSubjects();
  const allSessions = useSessions();
  const questions = useAllQuestions();
  const confirm = useConfirm();
  const notify = useToast();

  const subject = subjectId ? subjects?.find((s) => s.id === subjectId) : undefined;
  const sessions = useMemo(
    () => (allSessions ?? []).filter((s) => !subjectId || s.subjectId === subjectId),
    [allSessions, subjectId],
  );
  const summary = useMemo(() => summarizeSessions(sessions), [sessions]);
  const missed = useMemo(
    () => frequentlyMissed(sessions, (questions ?? []).filter((q) => !subjectId || q.subjectId === subjectId), 10),
    [sessions, questions, subjectId],
  );
  const overview = useMemo(
    () => overviewBySubject(allSessions ?? [], subjects ?? []).sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)),
    [allSessions, subjects],
  );

  if (subjects === undefined || allSessions === undefined || questions === undefined) return <Loading />;

  async function onClear() {
    const ok = await confirm({
      title: subject ? `Effacer l’historique de « ${subject.title} » ?` : 'Effacer tout l’historique ?',
      message: 'Les résultats enregistrés seront définitivement supprimés. Les sujets et les questions sont conservés.',
      confirmLabel: 'Effacer',
      danger: true,
    });
    if (!ok) return;
    await clearHistory(db, subjectId);
    notify('Historique effacé.');
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Statistiques"
        subtitle={subject ? `Vos résultats pour « ${subject.title} »` : 'Vos résultats sur l’ensemble des sujets'}
        actions={
          <>
            <label htmlFor="stats-subject" className="sr-only">
              Sujet
            </label>
            <Select
              id="stats-subject"
              value={subjectId ?? ''}
              onChange={(e) => navigate({ name: 'stats', ...(e.target.value ? { subjectId: e.target.value } : {}) }, { replace: true })}
              className="w-60"
            >
              <option value="">Tous les sujets</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
            {sessions.length > 0 && (
              <Button variant="ghost" onClick={onClear} icon={<Trash2 className="size-4" />}>
                Effacer l’historique
              </Button>
            )}
          </>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-7" />}
          title="Aucun résultat enregistré"
          description="Terminez un quiz pour voir apparaître vos statistiques : scores, progression et questions à retravailler."
          action={
            <LinkButton variant="primary" href={subjectId ? href({ name: 'subject', id: subjectId }) : href({ name: 'home' })}>
              Lancer un quiz
            </LinkButton>
          }
        />
      ) : (
        <>
          <section aria-label="Indicateurs" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Quiz réalisés" value={summary.quizCount} icon={<BarChart3 className="size-4" aria-hidden="true" />} />
            <StatTile label="Score moyen" value={`${summary.averagePercent} %`} />
            <StatTile label="Meilleur score" value={`${summary.bestPercent} %`} icon={<Trophy className="size-4 text-amber-500" aria-hidden="true" />} />
            <StatTile
              label="Taux de réussite"
              value={`${summary.successRate} %`}
              hint={`${summary.correctAnswers} / ${summary.totalAnswers} réponses justes`}
              icon={<Target className="size-4" aria-hidden="true" />}
            />
            <StatTile label="Temps total" value={formatDuration(summary.totalDurationMs)} icon={<Clock className="size-4" aria-hidden="true" />} />
          </section>

          <Card className="p-5 sm:p-6">
            <ScoreHistoryChart sessions={sessions} showSubject={!subjectId} />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Questions fréquemment ratées" description="Classées par nombre d’erreurs" />
              {missed.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500 dark:text-slate-400">Aucune erreur enregistrée. Impressionnant !</p>
              ) : (
                <ol className="divide-y divide-slate-100 dark:divide-slate-800">
                  {missed.map((m) => (
                    <li key={m.questionId} className="flex items-start gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm text-slate-800 dark:text-slate-100', !m.stillExists && 'italic opacity-70')}>{m.prompt}</p>
                        {!m.stillExists && <p className="text-xs text-slate-400">Question supprimée depuis</p>}
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-full rounded-full bg-rose-500" style={{ width: `${m.missRate}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-rose-600 tabular-nums dark:text-rose-400">
                          {m.misses} erreur{m.misses > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          sur {m.attempts} · {m.missRate} %
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card>
              <CardHeader title="Résultats récents" />
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentSessions(sessions, 8).map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{subjectId ? `Mode ${MODE_LABELS[s.mode]}` : s.subjectTitle}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(s.finishedAt)}
                        {!subjectId && ` · ${MODE_LABELS[s.mode]}`} · {formatDuration(s.durationMs)}
                      </p>
                    </div>
                    <span className="text-sm text-slate-500 tabular-nums dark:text-slate-400">
                      {s.correctCount}/{s.total}
                    </span>
                    <Badge tone={s.percent >= 75 ? 'emerald' : s.percent >= 50 ? 'amber' : 'rose'} className="tabular-nums">
                      {s.percent} %
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          {!subjectId && (
            <Card>
              <CardHeader title="Par sujet" />
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-slate-500 uppercase dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Sujet</th>
                      <th className="px-3 py-2.5 text-right font-medium">Quiz</th>
                      <th className="px-3 py-2.5 font-medium">Score moyen</th>
                      <th className="px-3 py-2.5 text-right font-medium">Meilleur</th>
                      <th className="px-5 py-2.5 text-right font-medium">Dernier quiz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {overview.map((o) => (
                      <tr key={o.subjectId}>
                        <td className="px-5 py-3">
                          <a href={href({ name: 'stats', subjectId: o.subjectId })} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline dark:text-white dark:hover:text-indigo-300">
                            {o.title}
                          </a>
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 tabular-nums dark:text-slate-300">{o.quizCount}</td>
                        <td className="px-3 py-3">
                          {o.quizCount ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400" style={{ width: `${o.averagePercent}%` }} />
                              </div>
                              <span className="text-slate-900 tabular-nums dark:text-white">{o.averagePercent} %</span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-600 tabular-nums dark:text-slate-300">{o.quizCount ? `${o.bestPercent} %` : '—'}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap text-slate-500 dark:text-slate-400">
                          {o.lastPlayedAt ? formatDate(o.lastPlayedAt) : 'Jamais'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
