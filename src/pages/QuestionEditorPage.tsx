import { useLiveQuery } from 'dexie-react-hooks';
import { CheckSquare, Eye, ListChecks, PenLine, Plus, Save, Square, Trash2, X } from 'lucide-react';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useConfirm } from '../app/confirm';
import { href, navigate } from '../app/router';
import { useToast } from '../app/toast';
import { QuestionPreview } from '../components/editor/QuestionPreview';
import {
  draftFromQuestion,
  draftToContent,
  emptyDraft,
  nextChoiceId,
  syncBlankAnswers,
  type QuestionDraft,
} from '../components/editor/questionDraft';
import { Button, IconButton } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert, BackLink, IssueList, Loading, PageHeader } from '../components/ui/Feedback';
import { Field, Select, Switch, TextArea, TextInput } from '../components/ui/Field';
import { db } from '../db/database';
import { saveQuestion } from '../db/repository';
import { useSubjects } from '../hooks/useData';
import { BLANK_MARKER, countBlanks } from '../lib/cloze';
import { cn } from '../lib/cn';
import { errorMessage, ValidationError, zodIssues, type ValidationIssue } from '../lib/errors';
import { questionContentSchema } from '../models/schemas';
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty, type Question } from '../models/types';
import { NotFoundPage } from './NotFoundPage';

export function QuestionEditorPage({ subjectId, questionId }: { subjectId: string; questionId?: string }) {
  const subjects = useSubjects();
  const question = useLiveQuery(async () => (questionId ? ((await db.questions.get(questionId)) ?? null) : null), [questionId]);

  if (subjects === undefined || question === undefined) return <Loading />;
  if (!subjects.some((s) => s.id === subjectId)) return <NotFoundPage message="Ce sujet n’existe pas ou a été supprimé." />;
  if (questionId && question === null) return <NotFoundPage message="Cette question n’existe pas ou a été supprimée." />;

  return <QuestionEditor key={questionId ?? 'nouvelle'} subjectId={subjectId} question={question ?? undefined} />;
}

function Section({ icon, title, description, enabled, onToggle, children }: { icon: ReactNode; title: string; description: string; enabled: boolean; onToggle: (v: boolean) => void; children: ReactNode }) {
  return (
    <Card className={cn('transition-opacity', !enabled && 'opacity-90')}>
      <div className="flex items-start gap-3 px-5 py-4">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', enabled ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800')}>
          {icon}
        </span>
        <div className="flex-1">
          <Switch checked={enabled} onChange={onToggle} label={title} description={description} />
        </div>
      </div>
      {enabled && <div className="animate-fade-in space-y-4 border-t border-slate-100 px-5 py-5 dark:border-slate-800">{children}</div>}
    </Card>
  );
}

function QuestionEditor({ subjectId, question }: { subjectId: string; question?: Question }) {
  const subjects = useSubjects() ?? [];
  const notify = useToast();
  const confirm = useConfirm();
  const initial = useMemo(() => (question ? draftFromQuestion(question) : emptyDraft(subjectId)), [question, subjectId]);
  const [draft, setDraft] = useState<QuestionDraft>(initial);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const clozeRef = useRef<HTMLTextAreaElement>(null);

  const content = useMemo(() => draftToContent(draft), [draft]);
  const validation = useMemo(() => questionContentSchema.safeParse(content), [content]);
  const issues: ValidationIssue[] = validation.success ? [] : zodIssues(validation.error);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const showErrors = submitted && issues.length > 0;
  const issuesFor = (prefix: string) => (showErrors ? issues.filter((i) => i.path.startsWith(prefix)) : []);
  const generalIssues = showErrors ? issues.filter((i) => !i.path.startsWith('QCM') && !i.path.startsWith('phrase à trous')) : [];

  const set = <K extends keyof QuestionDraft>(key: K, value: QuestionDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const multipleCorrect = draft.choices.filter((c) => c.correct).length > 1;

  function updateChoice(index: number, patch: Partial<QuestionDraft['choices'][number]>) {
    setDraft((d) => ({ ...d, choices: d.choices.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));
  }

  function setClozeText(text: string) {
    setDraft((d) => ({ ...d, clozeText: text, blankAnswers: syncBlankAnswers(text, d.blankAnswers) }));
  }

  function insertBlank() {
    const el = clozeRef.current;
    const text = draft.clozeText;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const selectedWord = text.slice(start, end).trim();
    const before = text.slice(0, start);
    const after = text.slice(end);
    const needsSpaceBefore = before.length > 0 && !/\s$/.test(before) && !/['’]$/.test(before);
    const needsSpaceAfter = after.length > 0 && !/^[\s.,;:!?)]/.test(after);
    const next = `${before}${needsSpaceBefore ? ' ' : ''}${BLANK_MARKER}${needsSpaceAfter ? ' ' : ''}${after}`;
    setDraft((d) => {
      const blankAnswers = syncBlankAnswers(next, d.blankAnswers);
      // Le mot sélectionné devient automatiquement la réponse attendue.
      if (selectedWord && countBlanks(next) === 1 && !blankAnswers[0]!.some((a) => a.trim())) blankAnswers[0] = [selectedWord];
      return { ...d, clozeText: next, blankAnswers };
    });
    requestAnimationFrame(() => {
      const pos = before.length + (needsSpaceBefore ? 1 : 0) + BLANK_MARKER.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function updateAnswer(blank: number, index: number, value: string) {
    setDraft((d) => ({
      ...d,
      blankAnswers: d.blankAnswers.map((list, b) => (b === blank ? list.map((a, i) => (i === index ? value : a)) : list)),
    }));
  }

  async function onSave(addAnother: boolean) {
    setSubmitted(true);
    if (!validation.success) {
      notify('La question contient des erreurs : corrigez les champs signalés.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveQuestion(db, draft.subjectId, content, question?.id);
      notify(question ? 'Question mise à jour.' : 'Question enregistrée.');
      if (addAnother) {
        setDraft(emptyDraft(draft.subjectId, draft));
        setSubmitted(false);
        if (question) navigate({ name: 'editQuestion', subjectId: draft.subjectId });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate({ name: 'manageSubject', id: draft.subjectId });
      }
    } catch (err) {
      if (err instanceof ValidationError) notify(err.message, 'error');
      else notify(errorMessage(err), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function onCancel() {
    if (dirty) {
      const ok = await confirm({
        title: 'Quitter sans enregistrer ?',
        message: 'Les modifications apportées à cette question seront perdues.',
        confirmLabel: 'Quitter',
        cancelLabel: 'Continuer l’édition',
        danger: true,
      });
      if (!ok) return;
    }
    navigate({ name: 'manageSubject', id: subjectId });
  }

  const blankCount = countBlanks(draft.clozeText);

  return (
    <div>
      <PageHeader
        back={<BackLink href={href({ name: 'manageSubject', id: subjectId })}>Questions du sujet</BackLink>}
        title={question ? 'Modifier la question' : 'Nouvelle question'}
        subtitle="Une question peut avoir une version QCM, une version à trous, ou les deux."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSave(false);
        }}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
        noValidate
      >
        <div className="space-y-5">
          <Card className="p-5">
            <Field label="Sujet" hint="Vous pouvez déplacer la question vers un autre sujet.">
              {(p) => (
                <Select {...p} value={draft.subjectId} onChange={(e) => set('subjectId', e.target.value)}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </Card>

          {generalIssues.length > 0 && (
            <Alert tone="error" title="Question incomplète">
              <IssueList issues={generalIssues} />
            </Alert>
          )}

          <Section
            icon={<ListChecks className="size-5" />}
            title="Version QCM"
            description="Une question avec plusieurs propositions et une ou plusieurs bonnes réponses."
            enabled={draft.hasMcq}
            onToggle={(v) => set('hasMcq', v)}
          >
            <Field label="Énoncé de la question" required>
              {(p) => (
                <TextArea
                  {...p}
                  rows={2}
                  value={draft.prompt}
                  onChange={(e) => set('prompt', e.target.value)}
                  placeholder="Ex. : Quelle est la capitale de la France ?"
                  invalid={issuesFor('QCM › énoncé').length > 0}
                />
              )}
            </Field>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                Propositions <span className="font-normal text-slate-500 dark:text-slate-400">— cochez la ou les bonnes réponses</span>
              </legend>
              {draft.choices.map((choice, i) => (
                <div key={choice.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={choice.correct}
                    aria-label={`Proposition ${String.fromCharCode(65 + i)} : ${choice.correct ? 'bonne réponse' : 'mauvaise réponse'}`}
                    onClick={() => updateChoice(i, { correct: !choice.correct })}
                    className={cn(
                      'flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-colors',
                      choice.correct
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700',
                    )}
                  >
                    {choice.correct ? <CheckSquare className="size-4" aria-hidden="true" /> : <Square className="size-4" aria-hidden="true" />}
                    <span className="w-4 text-center">{String.fromCharCode(65 + i)}</span>
                  </button>
                  <TextInput
                    value={choice.text}
                    onChange={(e) => updateChoice(i, { text: e.target.value })}
                    placeholder={`Proposition ${String.fromCharCode(65 + i)}`}
                    aria-label={`Texte de la proposition ${String.fromCharCode(65 + i)}`}
                    invalid={issuesFor(`QCM › Proposition ${i + 1}`).length > 0}
                  />
                  <IconButton
                    label={`Supprimer la proposition ${String.fromCharCode(65 + i)}`}
                    tone="danger"
                    disabled={draft.choices.length <= 2}
                    onClick={() => set('choices', draft.choices.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => set('choices', [...draft.choices, { id: nextChoiceId(draft.choices), text: '', correct: false }])}
                  disabled={draft.choices.length >= 12}
                  icon={<Plus className="size-4" />}
                >
                  Ajouter une proposition
                </Button>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {multipleCorrect ? 'Plusieurs bonnes réponses : cases à cocher pendant le quiz.' : 'Une seule bonne réponse : boutons radio pendant le quiz.'}
                </span>
              </div>
            </fieldset>
            {issuesFor('QCM').length > 0 && (
              <Alert tone="error">
                <IssueList issues={issuesFor('QCM')} />
              </Alert>
            )}
          </Section>

          <Section
            icon={<PenLine className="size-5" />}
            title="Version à trous"
            description="Une phrase dont un mot ou une expression est à retrouver."
            enabled={draft.hasCloze}
            onToggle={(v) => set('hasCloze', v)}
          >
            <Field
              label="Phrase à trous"
              required
              hint={
                <>
                  Le blanc s’écrit avec trois tirets bas « {BLANK_MARKER} ». Astuce : sélectionnez un mot puis cliquez sur « Transformer en blanc ».
                </>
              }
            >
              {(p) => (
                <TextArea
                  {...p}
                  ref={clozeRef}
                  rows={2}
                  value={draft.clozeText}
                  onChange={(e) => setClozeText(e.target.value)}
                  placeholder="Ex. : La capitale de la France est ___."
                  invalid={issuesFor('phrase à trous › texte').length > 0}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={insertBlank} onMouseDown={(e) => e.preventDefault()}>
                {blankCount === 0 ? 'Transformer en blanc / insérer un blanc' : 'Insérer un autre blanc'}
              </Button>
              <span className={cn('text-xs', blankCount === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400')}>
                {blankCount === 0 ? 'Aucun blanc dans la phrase.' : blankCount === 1 ? '1 blanc.' : `${blankCount} blancs.`}
              </span>
            </div>

            {draft.blankAnswers.map((answers, b) => (
              <fieldset key={b} className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {draft.blankAnswers.length > 1 ? `Réponses acceptées pour le blanc ${b + 1}` : 'Réponses acceptées'}
                  <span className="font-normal text-slate-500 dark:text-slate-400"> — la première est la réponse principale</span>
                </legend>
                {answers.map((answer, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TextInput
                      value={answer}
                      onChange={(e) => updateAnswer(b, i, e.target.value)}
                      placeholder={i === 0 ? 'Ex. : Paris' : 'Autre formulation acceptée'}
                      aria-label={i === 0 ? 'Réponse principale' : `Formulation alternative ${i}`}
                      invalid={i === 0 && issuesFor('phrase à trous › Blanc').length > 0}
                    />
                    <IconButton
                      label="Retirer cette réponse"
                      tone="danger"
                      disabled={answers.length <= 1}
                      onClick={() => setDraft((d) => ({ ...d, blankAnswers: d.blankAnswers.map((l, j) => (j === b ? l.filter((_, k) => k !== i) : l)) }))}
                    >
                      <X className="size-4" />
                    </IconButton>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Plus className="size-4" />}
                  onClick={() => setDraft((d) => ({ ...d, blankAnswers: d.blankAnswers.map((l, j) => (j === b ? [...l, ''] : l)) }))}
                >
                  Ajouter une formulation acceptée
                </Button>
              </fieldset>
            ))}
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Les majuscules et les espaces en trop sont ignorés. Ajoutez les variantes d’orthographe acceptables (ex. « Oulan-Bator », « Ulaanbaatar »).
            </p>
            {issuesFor('phrase à trous').length > 0 && (
              <Alert tone="error">
                <IssueList issues={issuesFor('phrase à trous')} />
              </Alert>
            )}
          </Section>

          <Card className="space-y-4 p-5">
            <Field label="Explication" hint="Facultative. Affichée après la réponse. Utilisez `accents graves` pour du code.">
              {(p) => (
                <TextArea {...p} rows={3} value={draft.explanation} onChange={(e) => set('explanation', e.target.value)} placeholder="Pourquoi cette réponse est-elle la bonne ?" />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Difficulté">
                {(p) => (
                  <Select {...p} value={draft.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty | '')}>
                    <option value="">Non précisée</option>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {DIFFICULTY_LABELS[d]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Étiquettes" hint="Séparées par des virgules. Ex. : capitales, Europe">
                {(p) => <TextInput {...p} value={draft.tags} onChange={(e) => set('tags', e.target.value)} />}
              </Field>
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border dark:border-slate-800 dark:bg-slate-950/90">
            {showErrors && <p className="mr-auto text-sm font-medium text-rose-600 dark:text-rose-400">{issues.length} erreur(s) à corriger</p>}
            <Button variant="ghost" onClick={onCancel}>
              Annuler
            </Button>
            <Button variant="secondary" onClick={() => onSave(true)} disabled={saving}>
              Enregistrer et ajouter une autre
            </Button>
            <Button type="submit" disabled={saving} icon={<Save className="size-4" />}>
              Enregistrer
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <CardHeader title="Aperçu" description="Testez la question avant de l’enregistrer." actions={<Eye className="size-4 text-slate-400" aria-hidden="true" />} />
            <div className="p-5">
              <QuestionPreview content={content} valid={validation.success} />
            </div>
          </Card>
        </aside>
      </form>
    </div>
  );
}
