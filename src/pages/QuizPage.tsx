import { ArrowRight, Flag, HelpCircle, Hourglass, Timer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfirm } from '../app/confirm';
import { useQuizSession, type ActiveSession } from '../app/quizSession';
import { href, navigate } from '../app/router';
import { ClozeQuestionView } from '../components/quiz/ClozeQuestionView';
import { FeedbackPanel } from '../components/quiz/FeedbackPanel';
import { McqQuestionView } from '../components/quiz/McqQuestionView';
import { DifficultyBadge, FormatBadge } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, ProgressBar } from '../components/ui/Feedback';
import { checkClozeAnswer } from '../engine/answerCheck';
import { formatClock } from '../engine/scoring';
import { cn } from '../lib/cn';
import { MODE_LABELS, type AnswerRecord, type SessionItem, type UserAnswer } from '../models/types';

/** Horloge qui se met à jour plusieurs fois par seconde tant qu'elle est active. */
function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

export function QuizPage() {
  const { active, lastResult, abandon } = useQuizSession();
  const confirm = useConfirm();

  if (!active) {
    return (
      <EmptyState
        icon={<HelpCircle className="size-7" />}
        title="Aucun quiz en cours"
        description="Choisissez un sujet et un mode pour lancer une nouvelle session."
        action={
          <>
            <LinkButton variant="primary" href={href({ name: 'home' })}>
              Choisir un sujet
            </LinkButton>
            {lastResult && <LinkButton href={href({ name: 'results' })}>Voir les derniers résultats</LinkButton>}
          </>
        }
      />
    );
  }

  async function onAbandon() {
    if (!active) return;
    const ok = await confirm({
      title: 'Abandonner le quiz ?',
      message: 'Votre progression dans cette session sera perdue et ne sera pas enregistrée dans les statistiques.',
      confirmLabel: 'Abandonner',
      cancelLabel: 'Continuer le quiz',
      danger: true,
    });
    if (!ok) return;
    const subjectId = active.subjectId;
    abandon();
    navigate({ name: 'subject', id: subjectId });
  }

  return <QuizRunner session={active} onAbandon={onAbandon} />;
}

function QuizRunner({ session, onAbandon }: { session: ActiveSession; onAbandon: () => void }) {
  const { state, settings } = session;
  const total = state.items.length;
  const item = state.items[state.index];
  const answered = state.answers.length;
  const correctSoFar = state.answers.filter((a) => a.correct).length;
  const now = useNow(settings.timer === 'chrono' && state.phase !== 'finished', 500);

  if (!item) return null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">
              {session.subjectTitle} · Mode {MODE_LABELS[session.settings.mode]}
            </p>
            <p className="text-lg font-bold text-slate-900 tabular-nums dark:text-white">
              Question {state.index + 1} <span className="font-medium text-slate-400">/ {total}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {settings.timer === 'chrono' && (
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700 tabular-nums dark:bg-slate-800 dark:text-slate-200" aria-label="Temps écoulé">
                <Timer className="size-4" aria-hidden="true" />
                {formatClock(now - state.startedAt)}
              </span>
            )}
            {answered > 0 && (
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-sm font-semibold text-emerald-700 tabular-nums dark:bg-emerald-500/10 dark:text-emerald-300">
                {correctSoFar} / {answered} juste{correctSoFar > 1 ? 's' : ''}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={onAbandon} icon={<Flag className="size-4" />}>
              Abandonner
            </Button>
          </div>
        </div>
        <ProgressBar value={answered} max={total} label={`Progression : ${answered} questions répondues sur ${total}`} />
      </div>

      {session.notice && state.index === 0 && (
        <Alert tone="info" className="mb-4">
          {session.notice}
        </Alert>
      )}

      <QuestionStep key={`${session.id}-${state.index}`} item={item} isLast={state.index === total - 1} session={session} />
    </div>
  );
}

function emptyAnswer(item: SessionItem): UserAnswer {
  return item.format === 'qcm' ? { format: 'qcm', selectedIds: [] } : { format: 'trous', values: item.question.cloze!.blanks.map(() => '') };
}

function hasContent(answer: UserAnswer): boolean {
  return answer.format === 'qcm' ? answer.selectedIds.length > 0 : answer.values.some((v) => v.trim() !== '');
}

function QuestionStep({ item, isLast, session }: { item: SessionItem; isLast: boolean; session: ActiveSession }) {
  const { submit, next } = useQuizSession();
  const { state, settings } = session;
  const [answer, setAnswer] = useState<UserAnswer>(() => emptyAnswer(item));
  const record: AnswerRecord | undefined = state.phase === 'feedback' ? state.answers[state.index] : undefined;
  const locked = record !== undefined;
  const nextRef = useRef<HTMLButtonElement>(null);

  const limit = settings.timer === 'limite' ? settings.secondsPerQuestion * 1000 : null;
  const now = useNow(limit !== null && !locked);
  const remaining = limit !== null ? Math.max(0, limit - (now - state.questionStartedAt)) : null;

  const doSubmit = useCallback(
    (timedOut = false) => {
      if (locked) return;
      if (!timedOut && !hasContent(answer)) return;
      submit(answer, timedOut);
    },
    [answer, locked, submit],
  );

  // Temps écoulé : la réponse en cours est validée automatiquement.
  useEffect(() => {
    if (remaining === 0 && !locked) doSubmit(true);
  }, [remaining, locked, doSubmit]);

  // Après validation, le focus passe sur « Question suivante » (Entrée pour continuer).
  useEffect(() => {
    if (locked) nextRef.current?.focus();
  }, [locked]);

  // Raccourcis clavier pour les QCM : 1 à 9 pour cocher, Entrée pour valider.
  useEffect(() => {
    if (item.format !== 'qcm' || locked) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text'))) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= item.choiceOrder.length) {
        const id = item.choiceOrder[digit - 1]!;
        const multiple = (item.question.mcq?.correctIds.length ?? 0) > 1;
        setAnswer((current) => {
          const selected = current.format === 'qcm' ? current.selectedIds : [];
          const nextSelected = multiple ? (selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]) : [id];
          return { format: 'qcm', selectedIds: nextSelected };
        });
        e.preventDefault();
      } else if (e.key === 'Enter' && (target?.tagName !== 'BUTTON' || (target as HTMLButtonElement).type !== 'button')) {
        e.preventDefault();
        doSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, locked, doSubmit]);

  const clozeResults =
    record && item.format === 'trous' && item.question.cloze && answer.format === 'trous'
      ? checkClozeAnswer(item.question.cloze, answer.values, { ignoreAccents: settings.ignoreAccents })
      : undefined;

  return (
    <div className="animate-slide-up space-y-4">
      <Card className="p-5 sm:p-7">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <FormatBadge format={item.format} />
          <DifficultyBadge difficulty={item.question.difficulty} />
          {remaining !== null && !locked && (
            <span
              className={cn(
                'ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums',
                remaining <= 5000 ? 'animate-pulse bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
              )}
              role="timer"
              aria-label={`Temps restant : ${Math.ceil(remaining / 1000)} secondes`}
            >
              <Hourglass className="size-4" aria-hidden="true" />
              {formatClock(remaining + 999)}
            </span>
          )}
        </div>

        {item.format === 'qcm' && item.question.mcq ? (
          <McqQuestionView
            mcq={item.question.mcq}
            order={item.choiceOrder}
            selected={answer.format === 'qcm' ? answer.selectedIds : []}
            onChange={(selectedIds) => setAnswer({ format: 'qcm', selectedIds })}
            locked={locked}
            reveal={locked}
          />
        ) : item.question.cloze ? (
          <ClozeQuestionView
            cloze={item.question.cloze}
            values={answer.format === 'trous' ? answer.values : []}
            onChange={(values) => setAnswer({ format: 'trous', values })}
            locked={locked}
            {...(clozeResults ? { results: clozeResults } : {})}
            onEnter={() => doSubmit()}
            autoFocus
          />
        ) : null}
      </Card>

      {record && <FeedbackPanel answer={record} question={item.question} />}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
          {locked
            ? 'Entrée : continuer'
            : item.format === 'qcm'
              ? `Raccourcis : touches 1 à ${item.choiceOrder.length} pour sélectionner, Entrée pour valider`
              : 'Entrée : valider'}
        </p>
        <div className="ml-auto flex gap-2">
          {!locked ? (
            <>
              <Button variant="ghost" onClick={() => submit(emptyAnswer(item))}>
                Je ne sais pas
              </Button>
              <Button size="lg" onClick={() => doSubmit()} disabled={!hasContent(answer)}>
                Valider
              </Button>
            </>
          ) : (
            <Button ref={nextRef} size="lg" onClick={next} iconRight={<ArrowRight className="size-5" />}>
              {isLast ? 'Voir les résultats' : 'Question suivante'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
