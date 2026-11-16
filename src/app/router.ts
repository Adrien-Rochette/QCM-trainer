import { useSyncExternalStore } from 'react';
import type { QuizMode } from '../models/types';

/**
 * Routeur minimal basé sur le fragment d'URL (#/…).
 * Il fonctionne sans serveur, hors ligne et depuis n'importe quel dossier de déploiement.
 */

export type Route =
  | { name: 'home' }
  | { name: 'subject'; id: string }
  | { name: 'setup'; id: string; mode: QuizMode }
  | { name: 'quiz' }
  | { name: 'results' }
  | { name: 'stats'; subjectId?: string }
  | { name: 'manage' }
  | { name: 'manageSubject'; id: string }
  | { name: 'editQuestion'; subjectId: string; questionId?: string }
  | { name: 'import' }
  | { name: 'notFound' };

const MODES: readonly QuizMode[] = ['qcm', 'trous', 'mixte'];

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '').replace(/^\/+|\/+$/g, '');
  const parts = path ? path.split('/').map(decodeURIComponent) : [];
  const [a, b, c, d] = parts;

  if (parts.length === 0) return { name: 'home' };
  if (a === 'sujet' && b && parts.length === 2) return { name: 'subject', id: b };
  if (a === 'sujet' && b && c === 'jouer' && d && (MODES as string[]).includes(d)) return { name: 'setup', id: b, mode: d as QuizMode };
  if (a === 'quiz' && parts.length === 1) return { name: 'quiz' };
  if (a === 'resultats' && parts.length === 1) return { name: 'results' };
  if (a === 'statistiques') return b ? { name: 'stats', subjectId: b } : { name: 'stats' };
  if (a === 'gestion' && parts.length === 1) return { name: 'manage' };
  if (a === 'gestion' && b && parts.length === 2) return { name: 'manageSubject', id: b };
  if (a === 'gestion' && b && c === 'question' && d) {
    return d === 'nouvelle' ? { name: 'editQuestion', subjectId: b } : { name: 'editQuestion', subjectId: b, questionId: d };
  }
  if (a === 'importer' && parts.length === 1) return { name: 'import' };
  return { name: 'notFound' };
}

const enc = encodeURIComponent;

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
    case 'notFound':
      return '#/';
    case 'subject':
      return `#/sujet/${enc(route.id)}`;
    case 'setup':
      return `#/sujet/${enc(route.id)}/jouer/${route.mode}`;
    case 'quiz':
      return '#/quiz';
    case 'results':
      return '#/resultats';
    case 'stats':
      return route.subjectId ? `#/statistiques/${enc(route.subjectId)}` : '#/statistiques';
    case 'manage':
      return '#/gestion';
    case 'manageSubject':
      return `#/gestion/${enc(route.id)}`;
    case 'editQuestion':
      return `#/gestion/${enc(route.subjectId)}/question/${route.questionId ? enc(route.questionId) : 'nouvelle'}`;
    case 'import':
      return '#/importer';
  }
}

/* ---------------- Abonnement au fragment d'URL ---------------- */

type Blocker = () => Promise<boolean>;

let currentHash = typeof window !== 'undefined' ? window.location.hash : '';
let blocker: Blocker | null = null;
let restoring = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const target = window.location.hash;
    if (restoring) {
      restoring = false;
      return;
    }
    if (blocker && target !== currentHash) {
      const previous = currentHash;
      const check = blocker;
      // On revient temporairement à l'adresse précédente le temps de demander confirmation.
      restoring = true;
      window.location.hash = previous;
      void check().then((ok) => {
        if (!ok) return;
        blocker = null;
        currentHash = target;
        window.location.hash = target;
        emit();
      });
      return;
    }
    currentHash = target;
    window.scrollTo({ top: 0 });
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => currentHash, () => '');
  return parseHash(hash);
}

/** Navigue vers une route (les éventuels bloqueurs sont respectés). */
export function navigate(route: Route | string, options: { replace?: boolean } = {}): void {
  const target = typeof route === 'string' ? route : href(route);
  if (options.replace) {
    const url = new URL(window.location.href);
    url.hash = target;
    window.history.replaceState(null, '', url);
    if (blocker) blocker = null;
    currentHash = url.hash;
    window.scrollTo({ top: 0 });
    emit();
    return;
  }
  if (target === currentHash) return;
  // Navigation interne voulue par l'application : on enregistre la cible tout de suite,
  // pour qu'un bloqueur installé entre-temps (ex. démarrage d'un quiz) ne l'intercepte pas.
  currentHash = target;
  window.location.hash = target;
}

/** Installe un bloqueur de navigation (ex. quiz en cours). Renvoie la fonction de retrait. */
export function setNavigationBlocker(fn: Blocker | null): () => void {
  blocker = fn;
  return () => {
    if (blocker === fn) blocker = null;
  };
}

/** Retire le bloqueur courant (navigation volontaire déjà confirmée). */
export function clearNavigationBlocker(): void {
  blocker = null;
}
