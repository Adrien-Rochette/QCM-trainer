import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { db } from '../db/database';
import { saveSession } from '../db/repository';
import { quizRunReducer, startRun, toSessionRecord, type QuizRunState } from '../engine/quizRun';
import { createId } from '../lib/ids';
import type { SessionItem, SessionRecord, SessionSettings, Subject, UserAnswer } from '../models/types';
import { useConfirm } from './confirm';
import { clearNavigationBlocker, navigate, setNavigationBlocker } from './router';
import { useToast } from './toast';

export interface ActiveSession {
  id: string;
  subjectId: string;
  subjectTitle: string;
  settings: SessionSettings;
  /** Message d'information affiché au début (ex. session réduite). */
  notice?: string;
  state: QuizRunState;
}

export interface SessionResult {
  record: SessionRecord;
  items: SessionItem[];
  saved: boolean;
}

interface QuizSessionContextValue {
  active: ActiveSession | null;
  lastResult: SessionResult | null;
  start: (params: { subject: Pick<Subject, 'id' | 'title'>; settings: SessionSettings; items: SessionItem[]; notice?: string }) => void;
  submit: (answer: UserAnswer, timedOut?: boolean) => void;
  next: () => void;
  abandon: () => void;
}

const QuizSessionContext = createContext<QuizSessionContextValue | null>(null);

export function QuizSessionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);
  const confirm = useConfirm();
  const notify = useToast();
  const finishing = useRef<string | null>(null);

  const start = useCallback<QuizSessionContextValue['start']>(({ subject, settings, items, notice }) => {
    const now = Date.now();
    finishing.current = null;
    setActive({
      id: createId(),
      subjectId: subject.id,
      subjectTitle: subject.title,
      settings,
      ...(notice ? { notice } : {}),
      state: startRun(items, now, { ignoreAccents: settings.ignoreAccents }),
    });
    navigate({ name: 'quiz' });
  }, []);

  const submit = useCallback((answer: UserAnswer, timedOut?: boolean) => {
    setActive((current) =>
      current
        ? { ...current, state: quizRunReducer(current.state, { type: 'submit', answer, now: Date.now(), ...(timedOut ? { timedOut } : {}) }) }
        : current,
    );
  }, []);

  const next = useCallback(() => {
    setActive((current) => (current ? { ...current, state: quizRunReducer(current.state, { type: 'next', now: Date.now() }) } : current));
  }, []);

  const abandon = useCallback(() => {
    clearNavigationBlocker();
    setActive(null);
  }, []);

  // Fin de session : enregistrement dans l'historique puis affichage des résultats.
  useEffect(() => {
    if (!active || active.state.phase !== 'finished' || finishing.current === active.id) return;
    finishing.current = active.id;
    const record = toSessionRecord(active.state, {
      id: active.id,
      subjectId: active.subjectId,
      subjectTitle: active.subjectTitle,
      settings: active.settings,
    });
    const items = active.state.items;
    void saveSession(db, record)
      .then(() => true)
      .catch(() => {
        notify('Le résultat n’a pas pu être enregistré dans l’historique.', 'error');
        return false;
      })
      .then((saved) => {
        setLastResult({ record, items, saved });
        setActive(null);
        navigate({ name: 'results' }, { replace: true });
      });
  }, [active, notify]);

  // Quitter la page pendant un quiz : demande de confirmation.
  const inProgress = active !== null && active.state.phase !== 'finished';
  useEffect(() => {
    if (!inProgress) return;
    const remove = setNavigationBlocker(async () => {
      const ok = await confirm({
        title: 'Abandonner le quiz ?',
        message: 'Votre progression dans cette session sera perdue et ne sera pas enregistrée dans les statistiques.',
        confirmLabel: 'Abandonner',
        cancelLabel: 'Continuer le quiz',
        danger: true,
      });
      if (ok) setActive(null);
      return ok;
    });
    const beforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      remove();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [inProgress, confirm]);

  const value = useMemo(() => ({ active, lastResult, start, submit, next, abandon }), [active, lastResult, start, submit, next, abandon]);
  return <QuizSessionContext.Provider value={value}>{children}</QuizSessionContext.Provider>;
}

export function useQuizSession(): QuizSessionContextValue {
  const ctx = useContext(QuizSessionContext);
  if (!ctx) throw new Error('useQuizSession doit être utilisé dans QuizSessionProvider');
  return ctx;
}

/* ---------------- Réglages mémorisés ---------------- */

const SETTINGS_KEY = 'quizlab.settings';

export const DEFAULT_SETTINGS: SessionSettings = {
  mode: 'qcm',
  count: 10,
  difficulty: 'tous',
  order: 'aleatoire',
  timer: 'aucun',
  secondsPerQuestion: 30,
  onlyMistakes: false,
  ignoreAccents: false,
};

export function loadSavedSettings(): Omit<SessionSettings, 'mode'> {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SessionSettings>), onlyMistakes: false };
  } catch {
    /* ignoré */
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: SessionSettings): void {
  try {
    const { mode: _mode, onlyMistakes: _only, ...rest } = settings;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest));
  } catch {
    /* ignoré */
  }
}
