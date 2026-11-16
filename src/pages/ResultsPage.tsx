import { CheckCircle2, Clock, Home, Lightbulb, RotateCcw, Target, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useQuizSession } from '../app/quizSession';
import { href, navigate } from '../app/router';
import { useToast } from '../app/toast';
import { RichText } from '../components/quiz/RichText';
import { FormatBadge } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, StatTile } from '../components/ui/Feedback';
import { ScoreRing } from '../components/ui/ScoreRing';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { db } from '../db/database';
import { listQuestions, listSessions } from '../db/repository';
import { computeScore, formatDuration } from '../engine/scoring';
import { buildRetrySession, buildSession } from '../engine/sessionBuilder';
import { fillCloze } from '../lib/cloze';
import { cn } from '../lib/cn';
import { errorMessage } from '../lib/errors';
import { MODE_LABELS, type AnswerRecord, type SessionItem } from '../models/types';
import { mistakeQuestionIds } from '../stats/statistics';

function verdict(percent: number): { title: string; text: string } {
  if (percent === 100) return { title: 'Parfait !', text: 'Un sans-faute, bravo.' };
  if (percent >= 75) return { title: 'Excellent travail !', text: 'Vous maîtrisez bien ce sujet.' };
  if (percent >= 50) return { title: 'Bien joué !', text: 'Encore un petit effort sur les questions ratées.' };
  return { title: 'Continuez vos efforts', text: 'Revoyez vos erreurs pour progresser rapidement.' };
}

type Filter = 'all' | 'wrong' | 'right';

export function ResultsPage() {
  const { lastResult, start } = useQuizSession();
  const notify = useToast();
  const [filter, setFilter] = useState<Filter>('all');

  const score = useMemo(() => (lastResult ? computeScore(lastResult.record.answers) : null), [lastResult]);

  if (!lastResult || !score) {
    return (
      <EmptyState
        icon={<Target className="size-7" />}
        title="Aucun résultat à afficher"
        description="Terminez un quiz pour voir votre bilan ici. Vos résultats passés sont disponibles dans les statistiques."
        action={
          <>
            <LinkButton variant="primary" href={href({ name: 'home' })}>
              Choisir un sujet
            </LinkButton>
            <LinkButton href={href({ name: 'stats' })}>Statistiques</LinkButton>
          </>
        }
      />
    );
  }

  const { record, items } = lastResult;
  const wrongItems = items.filter((_, i) => record.answers[i] && !record.answers[i].correct);
  const v = verdict(score.percent);
  const average = record.total ? record.durationMs / record.total : 0;

  async function restart() {
    try {
      const subject = await db.subjects.get(record.subjectId);
      if (!subject) throw new Error('Ce sujet n’existe plus.');
      const [questions, sessions] = await Promise.all([listQuestions(db, subject.id), listSessions(db, subject.id)]);
      const plan = buildSession({ questions, settings: record.settings, mistakeIds: mistakeQuestionIds(sessions) });
      if (plan.items.length === 0) {
        notify('Aucune question ne correspond plus à ces réglages.', 'info');
        navigate({ name: 'setup', id: subject.id, mode: record.mode });
        return;
      }
      start({ subject, settings: record.settings, items: plan.items });
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }

  function reviewMistakes() {
    if (!wrongItems.length) return;
    start({
      subject: { id: record.subjectId, title: record.subjectTitle },
      settings: { ...record.settings, onlyMistakes: true },
      items: buildRetrySession(wrongItems, record.settings.order === 'aleatoire'),
      notice: `Session de révision : ${wrongItems.length} question${wrongItems.length > 1 ? 's' : ''} ratée${wrongItems.length > 1 ? 's' : ''}.`,
    });
  }

  const rows = items
    .map((item, i) => ({ item, answer: record.answers[i] }))
    .filter((r): r is { item: SessionItem; answer: AnswerRecord } => r.answer !== undefined)
    .filter((r) => filter === 'all' || (filter === 'wrong' ? !r.answer.correct : r.answer.correct));

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {!lastResult.saved && (
        <Alert tone="warning" title="Résultat non enregistré">
          Ce résultat n’a pas pu être sauvegardé dans l’historique.
        </Alert>
      )}

      <Card className="animate-pop overflow-hidden">
        <div className="flex flex-col items-center gap-8 p-6 sm:p-8 md:flex-row">
          <ScoreRing percent={score.percent} label={`Score : ${score.percent} % de réussite`} />
          <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {record.subjectTitle} · Mode {MODE_LABELS[record.mode]}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{v.title}</h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{v.text}</p>
            <p className="mt-4 text-4xl font-bold text-slate-900 tabular-nums dark:text-white">
              {score.correct} <span className="text-2xl font-medium text-slate-400">/ {score.total}</span>
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Score total</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4 md:justify-end dark:border-slate-800 dark:bg-slate-950/30">
          <Button variant="secondary" onClick={restart} icon={<RotateCcw className="size-4" />}>
            Recommencer
          </Button>
          <Button variant={wrongItems.length ? 'primary' : 'secondary'} onClick={reviewMistakes} disabled={!wrongItems.length} icon={<Target className="size-4" />}>
            Revoir mes erreurs{wrongItems.length ? ` (${wrongItems.length})` : ''}
          </Button>
          <LinkButton href={href({ name: 'home' })} variant="ghost" icon={<Home className="size-4" />}>
            Retour à l’accueil
          </LinkButton>
        </div>
      </Card>

      <section aria-label="Détail du score" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Bonnes réponses" value={score.correct} icon={<CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />} />
        <StatTile label="Mauvaises réponses" value={score.incorrect} icon={<XCircle className="size-4 text-rose-500" aria-hidden="true" />} />
        <StatTile label="Temps passé" value={formatDuration(record.durationMs)} icon={<Clock className="size-4" aria-hidden="true" />} />
        <StatTile label="Temps moyen" value={formatDuration(average)} hint="par question" />
      </section>

      {record.mode === 'mixte' && (
        <section aria-labelledby="par-type" className="space-y-3">
          <h2 id="par-type" className="text-lg font-semibold text-slate-900 dark:text-white">
            Résultats par type de question
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['qcm', 'trous'] as const).map((format) => {
              const s = score.byFormat[format];
              return (
                <Card key={format} className="p-4">
                  <div className="flex items-center justify-between">
                    <FormatBadge format={format} />
                    <span className="text-sm font-semibold text-slate-900 tabular-nums dark:text-white">
                      {s.total ? `${s.correct} / ${s.total} · ${s.percent} %` : 'Aucune question'}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn('h-full rounded-full', format === 'qcm' ? 'bg-indigo-500' : 'bg-sky-500')} style={{ width: `${s.percent}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <section aria-labelledby="recap" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="recap" className="text-lg font-semibold text-slate-900 dark:text-white">
            Récapitulatif des questions
          </h2>
          <div className="w-full sm:w-auto">
            <SegmentedControl
              label="Filtrer les questions"
              hideLabel
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `Toutes (${score.total})` },
                { value: 'wrong', label: `Erreurs (${score.incorrect})` },
                { value: 'right', label: `Réussies (${score.correct})` },
              ]}
            />
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
            {filter === 'wrong' ? 'Aucune erreur, bravo !' : 'Aucune question dans cette catégorie.'}
          </p>
        ) : (
          <ol className="space-y-3">
            {rows.map(({ item, answer }) => (
              <RecapRow key={item.question.id} item={item} answer={answer} number={items.indexOf(item) + 1} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function RecapRow({ item, answer, number }: { item: SessionItem; answer: AnswerRecord; number: number }) {
  const prompt = item.format === 'trous' && item.question.cloze ? fillCloze(item.question.cloze.text, item.question.cloze.blanks.map(() => '_____')) : answer.prompt;
  return (
    <li className={cn('rounded-2xl border bg-white p-4 sm:p-5 dark:bg-slate-900', answer.correct ? 'border-slate-200/80 dark:border-slate-800' : 'border-rose-200 dark:border-rose-500/30')}>
      <div className="flex gap-3">
        {answer.correct ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" aria-label="Réponse juste" />
        ) : (
          <XCircle className="mt-0.5 size-5 shrink-0 text-rose-500" aria-label="Réponse fausse" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 tabular-nums">Q{number}</span>
            <FormatBadge format={item.format} />
            {answer.timedOut && <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Temps écoulé</span>}
          </div>
          <p className="font-medium text-slate-900 dark:text-white">
            <RichText text={prompt} />
          </p>
          <dl className="grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
            <dt className="text-slate-500 dark:text-slate-400">Votre réponse</dt>
            <dd className={cn('font-medium', answer.correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
              <RichText text={answer.givenLabel} />
            </dd>
            {!answer.correct && (
              <>
                <dt className="text-slate-500 dark:text-slate-400">Bonne réponse</dt>
                <dd className="font-medium text-slate-900 dark:text-white">
                  <RichText text={answer.expectedLabel} />
                </dd>
              </>
            )}
          </dl>
          {item.question.explanation && (
            <p className="flex gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span>
                <RichText text={item.question.explanation} />
              </span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}
