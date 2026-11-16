import { useEffect, useState } from 'react';
import { ConfirmProvider } from './app/confirm';
import { QuizSessionProvider } from './app/quizSession';
import { useRoute, type Route } from './app/router';
import { ThemeProvider } from './app/theme';
import { ToastProvider } from './app/toast';
import { Layout } from './components/layout/Layout';
import { Alert, Loading } from './components/ui/Feedback';
import { db } from './db/database';
import { seedDemoData } from './db/seed';
import { errorMessage } from './lib/errors';
import { HomePage } from './pages/HomePage';
import { ImportPage } from './pages/ImportPage';
import { ManagePage } from './pages/ManagePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { QuestionEditorPage } from './pages/QuestionEditorPage';
import { QuizPage } from './pages/QuizPage';
import { ResultsPage } from './pages/ResultsPage';
import { SessionSetupPage } from './pages/SessionSetupPage';
import { StatsPage } from './pages/StatsPage';
import { SubjectPage } from './pages/SubjectPage';
import { SubjectQuestionsPage } from './pages/SubjectQuestionsPage';

const PAGE_TITLES: Partial<Record<Route['name'], string>> = {
  quiz: 'Quiz en cours',
  results: 'Résultats',
  stats: 'Statistiques',
  manage: 'Gestion des sujets',
  manageSubject: 'Questions',
  editQuestion: 'Éditeur de question',
  import: 'Importer',
};

function renderRoute(route: Route) {
  switch (route.name) {
    case 'home':
      return <HomePage />;
    case 'subject':
      return <SubjectPage id={route.id} />;
    case 'setup':
      return <SessionSetupPage id={route.id} mode={route.mode} />;
    case 'quiz':
      return <QuizPage />;
    case 'results':
      return <ResultsPage />;
    case 'stats':
      return <StatsPage key={route.subjectId ?? 'all'} {...(route.subjectId ? { subjectId: route.subjectId } : {})} />;
    case 'manage':
      return <ManagePage />;
    case 'manageSubject':
      return <SubjectQuestionsPage id={route.id} />;
    case 'editQuestion':
      return <QuestionEditorPage subjectId={route.subjectId} {...(route.questionId ? { questionId: route.questionId } : {})} />;
    case 'import':
      return <ImportPage />;
    case 'notFound':
      return <NotFoundPage />;
  }
}

/** Ouvre la base et installe les données de démonstration au premier lancement. */
function useDatabaseReady(): { ready: boolean; error?: string } {
  const [state, setState] = useState<{ ready: boolean; error?: string }>({ ready: false });
  useEffect(() => {
    let cancelled = false;
    db.open()
      .then(() => seedDemoData(db))
      .then(() => !cancelled && setState({ ready: true }))
      .catch((err: unknown) => !cancelled && setState({ ready: false, error: errorMessage(err) }));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

function Shell() {
  const route = useRoute();
  const { ready, error } = useDatabaseReady();

  useEffect(() => {
    const title = PAGE_TITLES[route.name];
    document.title = title ? `${title} · QuizLab` : 'QuizLab';
  }, [route.name]);

  return (
    <Layout route={route} focusMode={route.name === 'quiz'}>
      {error ? (
        <Alert tone="error" title="Impossible d’ouvrir la base de données locale">
          <p>{error}</p>
          <p className="mt-1">
            QuizLab enregistre vos données dans votre navigateur (IndexedDB). Vérifiez que vous n’êtes pas en navigation privée et que le stockage
            des sites n’est pas bloqué, puis rechargez la page.
          </p>
        </Alert>
      ) : ready ? (
        <div key={route.name === 'quiz' ? 'quiz' : JSON.stringify(route)} className="animate-fade-in">
          {renderRoute(route)}
        </div>
      ) : (
        <Loading label="Ouverture de QuizLab…" />
      )}
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <QuizSessionProvider>
            <Shell />
          </QuizSessionProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
