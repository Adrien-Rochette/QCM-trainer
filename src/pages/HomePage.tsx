import { BarChart3, BookOpen, ChevronRight, FolderPlus, Library, Search, Sparkles, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { href, navigate } from '../app/router';
import { useToast } from '../app/toast';
import { SubjectFormModal } from '../components/subjects/SubjectFormModal';
import { LogoMark } from '../components/layout/Logo';
import { Badge } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { EmptyState, Loading } from '../components/ui/Feedback';
import { TextInput } from '../components/ui/Field';
import { db } from '../db/database';
import { reinstallDemoData } from '../db/seed';
import { countFormats } from '../engine/sessionBuilder';
import { useAllQuestions, useSessions, useSubjects } from '../hooks/useData';
import { cn } from '../lib/cn';
import { formatDate, plural } from '../lib/format';
import type { Question, SessionRecord, Subject } from '../models/types';

export function HomePage() {
  const subjects = useSubjects();
  const questions = useAllQuestions();
  const sessions = useSessions();
  const notify = useToast();
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');

  const bySubject = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const q of questions ?? []) map.set(q.subjectId, [...(map.get(q.subjectId) ?? []), q]);
    return map;
  }, [questions]);

  const lastSession = useMemo(() => {
    const map = new Map<string, SessionRecord>();
    for (const s of sessions ?? []) {
      const current = map.get(s.subjectId);
      if (!current || s.finishedAt > current.finishedAt) map.set(s.subjectId, s);
    }
    return map;
  }, [sessions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('fr');
    if (!term) return subjects ?? [];
    return (subjects ?? []).filter((s) => [s.title, s.description, s.category ?? ''].some((t) => t.toLocaleLowerCase('fr').includes(term)));
  }, [subjects, search]);

  async function restoreDemo() {
    await reinstallDemoData(db);
    notify('Sujets de démonstration réinstallés.');
  }

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 px-6 py-10 text-white shadow-xl shadow-indigo-600/20 sm:px-10 sm:py-12 dark:shadow-none">
        <div aria-hidden="true" className="absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden="true" className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <div className="mb-4 flex items-center gap-3">
              <LogoMark className="size-11 rounded-xl ring-2 ring-white/30" />
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">QuizLab</h1>
            </div>
            <p className="text-lg text-indigo-100">
              Révisez n’importe quel sujet avec des QCM et des textes à trous. Créez vos propres banques de questions, suivez vos progrès, même
              hors ligne.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={() => setCreating(true)} icon={<FolderPlus className="size-5" />} className="bg-white text-indigo-700 shadow-none hover:bg-indigo-50 active:bg-indigo-100 dark:bg-white dark:text-indigo-700 dark:hover:bg-indigo-50">
              Créer un sujet
            </Button>
            <LinkButton size="lg" href={href({ name: 'import' })} icon={<Upload className="size-5" />} className="bg-white/15 text-white ring-white/25 hover:bg-white/25 dark:bg-white/15 dark:text-white dark:ring-white/25 dark:hover:bg-white/25">
              Importer un sujet
            </LinkButton>
          </div>
        </div>
      </section>

      <nav aria-label="Accès rapides" className="grid gap-3 sm:grid-cols-3">
        <QuickLink href={href({ name: 'manage' })} icon={<Library className="size-5" />} title="Gestion des questions" text="Créer, modifier, exporter vos sujets" />
        <QuickLink href={href({ name: 'stats' })} icon={<BarChart3 className="size-5" />} title="Statistiques" text="Scores, progression, erreurs fréquentes" />
        <QuickLink href={href({ name: 'import' })} icon={<Upload className="size-5" />} title="Importer un fichier" text="Charger un sujet au format JSON" />
      </nav>

      <section aria-labelledby="sujets-titre" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="sujets-titre" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Vos sujets
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Choisissez un sujet pour lancer un quiz.</p>
          </div>
          {(subjects?.length ?? 0) > 3 && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <TextInput
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un sujet…"
                aria-label="Rechercher un sujet"
                className="pl-9"
              />
            </div>
          )}
        </div>

        {subjects === undefined ? (
          <Loading />
        ) : subjects.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="size-7" />}
            title="Aucun sujet pour le moment"
            description="Créez votre premier sujet, importez un fichier JSON ou réinstallez les sujets de démonstration pour essayer l’application."
            action={
              <>
                <Button onClick={() => setCreating(true)} icon={<FolderPlus className="size-4" />}>
                  Créer un sujet
                </Button>
                <LinkButton href={href({ name: 'import' })} icon={<Upload className="size-4" />}>
                  Importer
                </LinkButton>
                <Button variant="ghost" onClick={restoreDemo} icon={<Sparkles className="size-4" />}>
                  Sujets de démonstration
                </Button>
              </>
            }
          />
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-800">
            Aucun sujet ne correspond à « {search} ».
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((subject, i) => (
              <li key={subject.id} className="animate-slide-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <SubjectCard subject={subject} questions={bySubject.get(subject.id) ?? []} last={lastSession.get(subject.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <SubjectFormModal open={creating} onClose={() => setCreating(false)} onSaved={(s) => navigate({ name: 'manageSubject', id: s.id })} />
    </div>
  );
}

function QuickLink({ href: to, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <a
      href={to}
      className="group flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-indigo-500/20 dark:group-hover:text-indigo-300">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{title}</span>
        <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{text}</span>
      </span>
      <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </a>
  );
}

function SubjectCard({ subject, questions, last }: { subject: Subject; questions: Question[]; last?: SessionRecord }) {
  const counts = countFormats(questions);
  return (
    <a
      href={href({ name: 'subject', id: subject.id })}
      className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-600/5 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/40"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        {subject.category ? <Badge tone="violet">{subject.category}</Badge> : <span />}
        <ChevronRight className="size-5 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:text-slate-600" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-white dark:group-hover:text-indigo-300">{subject.title}</h3>
      {subject.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{subject.description}</p>}
      <div className="mt-auto pt-4">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {plural(counts.total, 'question')}
          {counts.total > 0 && (
            <>
              {' '}
              · {counts.qcm} QCM · {counts.trous} à trous
            </>
          )}
        </p>
        {last ? (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn('h-full rounded-full', last.percent >= 75 ? 'bg-emerald-500' : last.percent >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                style={{ width: `${last.percent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-slate-600 tabular-nums dark:text-slate-300" title={`Dernier quiz le ${formatDate(last.finishedAt)}`}>
              Dernier score : {last.percent} %
            </span>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Pas encore de quiz réalisé</p>
        )}
      </div>
    </a>
  );
}
