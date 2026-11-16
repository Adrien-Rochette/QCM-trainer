import { Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DEFAULT_SETTINGS, loadSavedSettings, saveSettings, useQuizSession } from '../app/quizSession';
import { href, navigate } from '../app/router';
import { MODE_META } from '../components/quiz/modeMeta';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, BackLink, Loading, PageHeader } from '../components/ui/Feedback';
import { Select, Switch } from '../components/ui/Field';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { buildSession, compatibleQuestions } from '../engine/sessionBuilder';
import { useQuestions, useSessions, useSubject } from '../hooks/useData';
import { cn } from '../lib/cn';
import { plural } from '../lib/format';
import { DIFFICULTIES, DIFFICULTY_LABELS, MODE_LABELS, type QuestionCountOption, type QuizMode, type SessionSettings } from '../models/types';
import { mistakeQuestionIds } from '../stats/statistics';
import { NotFoundPage } from './NotFoundPage';

const COUNT_OPTIONS: QuestionCountOption[] = [5, 10, 20, 50, 'all'];
const SECONDS_OPTIONS = [15, 30, 45, 60, 90, 120];

export function SessionSetupPage({ id, mode }: { id: string; mode: QuizMode }) {
  const subject = useSubject(id);
  const questions = useQuestions(id);
  const sessions = useSessions(id);
  const { start } = useQuizSession();
  const [draft, setDraft] = useState<Omit<SessionSettings, 'mode'>>(() => loadSavedSettings());
  const settings: SessionSettings = { ...DEFAULT_SETTINGS, ...draft, mode };

  const mistakes = useMemo(() => mistakeQuestionIds(sessions ?? []), [sessions]);

  // Nombre de questions compatibles pour chaque option, afin de désactiver les choix impossibles.
  const counts = useMemo(() => {
    const qs = questions ?? [];
    const base = { ...settings };
    const forMode = (m: QuizMode) => compatibleQuestions(qs, { ...base, mode: m, difficulty: 'tous', onlyMistakes: false }).length;
    const forDifficulty = (d: SessionSettings['difficulty']) => compatibleQuestions(qs, { ...base, difficulty: d }, mistakes).length;
    return {
      mode: { qcm: forMode('qcm'), trous: forMode('trous'), mixte: forMode('mixte') } as Record<QuizMode, number>,
      difficulty: Object.fromEntries((['tous', ...DIFFICULTIES] as const).map((d) => [d, forDifficulty(d)])) as Record<SessionSettings['difficulty'], number>,
      mistakes: compatibleQuestions(qs, { ...base, onlyMistakes: true }, mistakes).length,
      available: compatibleQuestions(qs, base, mistakes).length,
    };
    // Seuls le mode, la difficulté et le filtre « erreurs » influencent la sélection.
  }, [questions, mistakes, mode, draft.difficulty, draft.onlyMistakes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (subject === undefined || questions === undefined || sessions === undefined) return <Loading />;
  if (subject === null) return <NotFoundPage message="Ce sujet n’existe pas ou a été supprimé." />;

  const update = <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const requested = settings.count;
  const sessionSize = requested === 'all' ? counts.available : Math.min(requested, counts.available);
  const adjusted = requested !== 'all' && requested > counts.available && counts.available > 0;
  const meta = MODE_META[mode];
  const Icon = meta.icon;

  function onStart() {
    if (!subject) return;
    const plan = buildSession({ questions: questions ?? [], settings, mistakeIds: mistakes });
    if (plan.items.length === 0) return;
    saveSettings(settings);
    start({
      subject,
      settings,
      items: plan.items,
      ...(plan.adjusted
        ? { notice: `Seules ${plan.available} questions correspondent à vos réglages : la session en comporte ${plan.items.length}.` }
        : {}),
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackLink href={href({ name: 'subject', id })}>{subject.title}</BackLink>}
        title={
          <span className="flex items-center gap-3">
            <span className={cn('flex size-11 items-center justify-center rounded-xl', meta.accent)}>
              <Icon className="size-6" aria-hidden="true" />
            </span>
            Préparer la session
          </span>
        }
        subtitle="Choisissez vos réglages, puis lancez le quiz."
      />

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        <div className="space-y-5 p-5 sm:p-6">
          <SegmentedControl
            label="Mode"
            value={mode}
            onChange={(m) => navigate({ name: 'setup', id, mode: m }, { replace: true })}
            options={(['qcm', 'trous', 'mixte'] as QuizMode[]).map((m) => ({
              value: m,
              label: `${MODE_LABELS[m]} (${counts.mode[m]})`,
              disabled: counts.mode[m] === 0,
            }))}
          />
          <SegmentedControl
            label="Nombre de questions"
            value={settings.count}
            onChange={(v) => update('count', v)}
            options={COUNT_OPTIONS.map((c) => ({ value: c, label: c === 'all' ? 'Toutes' : String(c) }))}
          />
          <SegmentedControl
            label="Difficulté"
            value={settings.difficulty}
            onChange={(v) => update('difficulty', v)}
            options={(['tous', ...DIFFICULTIES] as const).map((d) => ({
              value: d,
              label: `${d === 'tous' ? 'Toutes' : DIFFICULTY_LABELS[d]} (${counts.difficulty[d]})`,
              disabled: d !== 'tous' && counts.difficulty[d] === 0 && settings.difficulty !== d,
            }))}
          />
          <SegmentedControl
            label="Ordre des questions"
            value={settings.order}
            onChange={(v) => update('order', v)}
            options={[
              { value: 'aleatoire', label: 'Aléatoire' },
              { value: 'sequentiel', label: 'Séquentiel' },
            ]}
          />
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          <SegmentedControl
            label="Chronomètre"
            value={settings.timer}
            onChange={(v) => update('timer', v)}
            options={[
              { value: 'aucun', label: 'Aucun' },
              { value: 'chrono', label: 'Temps écoulé' },
              { value: 'limite', label: 'Temps limité' },
            ]}
          />
          {settings.timer === 'limite' && (
            <div className="flex flex-wrap items-center gap-3 animate-fade-in">
              <label htmlFor="seconds" className="text-sm text-slate-600 dark:text-slate-300">
                Temps par question :
              </label>
              <Select
                id="seconds"
                value={settings.secondsPerQuestion}
                onChange={(e) => update('secondsPerQuestion', Number(e.target.value))}
                className="w-36"
              >
                {SECONDS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s < 60 ? `${s} secondes` : `${s / 60} minute${s >= 120 ? 's' : ''}`}
                  </option>
                ))}
              </Select>
              <p className="w-full text-xs text-slate-500 dark:text-slate-400">À la fin du temps, la réponse en cours est validée automatiquement.</p>
            </div>
          )}
          <Switch
            checked={settings.onlyMistakes}
            onChange={(v) => update('onlyMistakes', v)}
            disabled={mistakes.size === 0 && !settings.onlyMistakes}
            label="Réviser uniquement mes erreurs"
            description={
              mistakes.size === 0
                ? 'Aucune erreur enregistrée pour ce sujet pour l’instant.'
                : `${plural(mistakes.size, 'question ratée', 'questions ratées')} lors de votre dernière tentative (${counts.mistakes} compatible${counts.mistakes > 1 ? 's' : ''} avec ce mode).`
            }
          />
          {mode !== 'qcm' && (
            <Switch
              checked={settings.ignoreAccents}
              onChange={(v) => update('ignoreAccents', v)}
              label="Ignorer les accents"
              description="Pour les phrases à trous : « Mediterranee » sera accepté pour « Méditerranée »."
            />
          )}
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {counts.available === 0 ? (
            <Alert tone="warning" title="Aucune question ne correspond à ces réglages">
              Modifiez la difficulté ou désactivez « Réviser uniquement mes erreurs ».
            </Alert>
          ) : adjusted ? (
            <Alert tone="info">
              Vous avez demandé {requested} questions, mais seules {counts.available} correspondent à vos réglages : la session en comportera{' '}
              {counts.available}.
            </Alert>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {counts.available > 0 && (
                <>
                  La session comportera <strong className="text-slate-900 dark:text-white">{plural(sessionSize, 'question')}</strong>
                  {mode === 'mixte' && ' (QCM et phrases à compléter)'}.
                </>
              )}
            </p>
            <Button size="lg" onClick={onStart} disabled={counts.available === 0} icon={<Play className="size-5" />}>
              Commencer le quiz
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
