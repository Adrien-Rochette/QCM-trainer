import { BarChart3, Home, Library, Monitor, Moon, Sun, Upload, WifiOff } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { href, type Route } from '../../app/router';
import { useTheme, type ThemePreference } from '../../app/theme';
import { cn } from '../../lib/cn';
import { LogoMark } from './Logo';

const NAV: { label: string; route: Route; icon: typeof Home; match: Route['name'][] }[] = [
  { label: 'Accueil', route: { name: 'home' }, icon: Home, match: ['home', 'subject', 'setup', 'quiz', 'results'] },
  { label: 'Gestion', route: { name: 'manage' }, icon: Library, match: ['manage', 'manageSubject', 'editQuestion'] },
  { label: 'Statistiques', route: { name: 'stats' }, icon: BarChart3, match: ['stats'] },
  { label: 'Importer', route: { name: 'import' }, icon: Upload, match: ['import'] },
];

const THEME_CYCLE: Record<ThemePreference, { next: ThemePreference; icon: typeof Sun; label: string }> = {
  system: { next: 'light', icon: Monitor, label: 'Thème : système' },
  light: { next: 'dark', icon: Sun, label: 'Thème : clair' },
  dark: { next: 'system', icon: Moon, label: 'Thème : sombre' },
};

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function Layout({ route, children, focusMode }: { route: Route; children: ReactNode; focusMode?: boolean }) {
  const { preference, setPreference } = useTheme();
  const online = useOnline();
  const theme = THEME_CYCLE[preference];
  const ThemeIcon = theme.icon;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenu"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('contenu')?.focus();
        }}
        className="sr-only z-50 rounded-lg bg-indigo-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-lg dark:border-slate-800/80 dark:bg-slate-950/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href={href({ name: 'home' })} className="flex items-center gap-2.5 rounded-lg" aria-label="QuizLab, retour à l’accueil">
            <LogoMark className="size-8" />
            <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              Quiz<span className="text-indigo-600 dark:text-indigo-400">Lab</span>
            </span>
          </a>

          {!online && (
            <span className="ml-1 hidden items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 sm:inline-flex dark:bg-amber-500/15 dark:text-amber-300">
              <WifiOff className="size-3" aria-hidden="true" /> Hors ligne
            </span>
          )}

          <nav aria-label="Navigation principale" className={cn('ml-auto flex items-center gap-1', focusMode && 'hidden sm:flex')}>
            {NAV.map((item) => {
              const active = item.match.includes(route.name);
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={href(item.route)}
                  aria-current={active ? 'page' : undefined}
                  title={item.label}
                  className={cn(
                    'flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors sm:px-3',
                    active
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
                  )}
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                  <span className="hidden md:inline">{item.label}</span>
                  <span className="sr-only md:hidden">{item.label}</span>
                </a>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => setPreference(theme.next)}
            className={cn(
              'flex size-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
              focusMode && 'ml-auto sm:ml-0',
            )}
            aria-label={`${theme.label}. Cliquer pour changer.`}
            title={theme.label}
          >
            <ThemeIcon className="size-4.5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="contenu" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-slate-200/70 py-6 text-center text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-500">
        QuizLab — vos données restent sur cet appareil. Fonctionne aussi hors ligne.
      </footer>
    </div>
  );
}
