import { CheckCircle2, ClipboardPaste, Download, FileJson, FileUp, Sparkles, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { href, navigate } from '../app/router';
import { useToast } from '../app/toast';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { Alert, IssueList, PageHeader } from '../components/ui/Feedback';
import { TextArea } from '../components/ui/Field';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { db } from '../db/database';
import { applyImportPlan, loadExistingData } from '../db/repository';
import { detectConflicts, parseQuizlabJson, planImport, type ConflictStrategy, type SubjectConflict } from '../io/importExport';
import { cn } from '../lib/cn';
import { readFileAsText } from '../lib/download';
import { errorMessage, type ValidationIssue } from '../lib/errors';
import { plural } from '../lib/format';
import type { QuizlabFile } from '../models/schemas';

const EXAMPLE_URL = './exemples/histoire-de-france.json';
const MAX_SIZE = 15 * 1024 * 1024;

type Analysis =
  | { status: 'idle' }
  | { status: 'error'; source: string; error: string; issues: ValidationIssue[] }
  | { status: 'ready'; source: string; file: QuizlabFile; conflicts: SubjectConflict[] };

export function ImportPage() {
  const notify = useToast();
  const [method, setMethod] = useState<'file' | 'paste'>('file');
  const [pasted, setPasted] = useState('');
  const [analysis, setAnalysis] = useState<Analysis>({ status: 'idle' });
  const [strategy, setStrategy] = useState<ConflictStrategy>('copy');
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function analyse(text: string, source: string) {
    const result = parseQuizlabJson(text);
    if (!result.ok) {
      setAnalysis({ status: 'error', source, error: result.error, issues: result.issues });
      return;
    }
    const conflicts = detectConflicts(result.file, await loadExistingData(db));
    setStrategy('copy');
    setAnalysis({ status: 'ready', source, file: result.file, conflicts });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      setAnalysis({ status: 'error', source: file.name, error: 'Le fichier est trop volumineux (15 Mo maximum).', issues: [] });
      return;
    }
    try {
      await analyse(await readFileAsText(file), file.name);
    } catch (err) {
      setAnalysis({ status: 'error', source: file.name, error: errorMessage(err), issues: [] });
    }
  }

  async function loadExample() {
    try {
      const response = await fetch(EXAMPLE_URL);
      if (!response.ok) throw new Error('Le fichier d’exemple est introuvable.');
      await analyse(await response.text(), 'histoire-de-france.json (exemple)');
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  }

  async function onImport() {
    if (analysis.status !== 'ready') return;
    setImporting(true);
    try {
      const plan = planImport(analysis.file, await loadExistingData(db), strategy);
      await applyImportPlan(db, plan);
      notify(`${plural(plan.subjects.length, 'sujet importé', 'sujets importés')} (${plural(plan.questions.length, 'question')}).`);
      setAnalysis({ status: 'idle' });
      setPasted('');
      const first = plan.subjects[0];
      if (plan.subjects.length === 1 && first) navigate({ name: 'subject', id: first.id });
      else navigate({ name: 'home' });
    } catch (err) {
      notify(`Échec de l’import : ${errorMessage(err)}`, 'error');
    } finally {
      setImporting(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Importer un sujet"
        subtitle="Chargez un fichier JSON au format QuizLab : un sujet exporté, une sauvegarde complète ou une banque de questions produite par un autre outil."
      />

      <Card className="p-5 sm:p-6">
        <div className="mb-5 max-w-sm">
          <SegmentedControl
            label="Méthode d’import"
            hideLabel
            value={method}
            onChange={setMethod}
            options={[
              { value: 'file', label: 'Fichier' },
              { value: 'paste', label: 'Coller du JSON' },
            ]}
          />
        </div>

        {method === 'file' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
              dragging ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-700',
            )}
          >
            <FileUp className="mb-3 size-10 text-indigo-500" aria-hidden="true" />
            <p className="font-medium text-slate-900 dark:text-white">Glissez-déposez un fichier .json ici</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">ou</p>
            <Button className="mt-3" onClick={() => inputRef.current?.click()} icon={<Upload className="size-4" />}>
              Choisir un fichier
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <TextArea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={10}
              className="font-mono text-xs"
              placeholder='{ "format": "quizlab", "version": 1, "subjects": [ … ] }'
              aria-label="Contenu JSON à importer"
            />
            <div className="flex justify-end">
              <Button onClick={() => analyse(pasted, 'texte collé')} disabled={!pasted.trim()} icon={<ClipboardPaste className="size-4" />}>
                Analyser le JSON
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-5 text-sm dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Besoin d’un modèle ?</span>
          <Button size="sm" variant="ghost" onClick={loadExample} icon={<Sparkles className="size-4" />}>
            Essayer avec l’exemple « Histoire de France »
          </Button>
          <a href={EXAMPLE_URL} download="histoire-de-france.json" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            <Download className="size-4" aria-hidden="true" /> Télécharger l’exemple
          </a>
        </div>
      </Card>

      {analysis.status === 'error' && (
        <Alert tone="error" title={`Import impossible — ${analysis.source}`}>
          <p>{analysis.error}</p>
          <IssueList issues={analysis.issues} />
        </Alert>
      )}

      {analysis.status === 'ready' && (
        <Card className="animate-slide-up">
          <CardHeader
            title="Fichier valide"
            description={analysis.source}
            actions={<CheckCircle2 className="size-5 text-emerald-500" aria-hidden="true" />}
          />
          <div className="space-y-5 p-5">
            <ul className="space-y-2">
              {analysis.file.subjects.map((s, i) => {
                const qcm = s.questions.filter((q) => q.mcq).length;
                const trous = s.questions.filter((q) => q.cloze).length;
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950/40">
                    <FileJson className="size-4 text-indigo-500" aria-hidden="true" />
                    <span className="font-medium text-slate-900 dark:text-white">{s.title}</span>
                    {s.category && <Badge tone="violet">{s.category}</Badge>}
                    <span className="ml-auto text-sm text-slate-500 dark:text-slate-400">
                      {plural(s.questions.length, 'question')} · {qcm} QCM · {trous} à trous
                    </span>
                  </li>
                );
              })}
            </ul>
            {analysis.file.sessions && analysis.file.sessions.length > 0 && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Le fichier contient aussi {plural(analysis.file.sessions.length, 'résultat')} d’historique, qui {analysis.file.sessions.length > 1 ? 'seront importés' : 'sera importé'}.
              </p>
            )}

            {analysis.conflicts.length > 0 && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  <strong>{plural(analysis.conflicts.length, 'sujet existe', 'sujets existent')} déjà</strong> dans QuizLab :{' '}
                  {analysis.conflicts.map((c) => `« ${c.existingTitle} »`).join(', ')}. Que souhaitez-vous faire ?
                </p>
                <SegmentedControl
                  label="En cas de sujet déjà présent"
                  hideLabel
                  value={strategy}
                  onChange={setStrategy}
                  options={[
                    { value: 'copy', label: 'Importer comme copie' },
                    { value: 'replace', label: 'Remplacer le sujet existant' },
                  ]}
                />
                <p className="text-xs text-amber-800 dark:text-amber-200/80">
                  {strategy === 'copy'
                    ? 'Le sujet existant est conservé tel quel ; le fichier est ajouté comme un nouveau sujet.'
                    : 'Les questions du sujet existant sont remplacées par celles du fichier. Votre historique est conservé.'}
                </p>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setAnalysis({ status: 'idle' })}>
                Annuler
              </Button>
              <Button onClick={onImport} disabled={importing} icon={<Upload className="size-4" />}>
                Importer
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Format du fichier" description="Format JSON QuizLab, version 1 — documentation complète dans docs/FORMAT-JSON.md" />
        <div className="space-y-3 p-5 text-sm text-slate-600 dark:text-slate-300">
          <p>
            Un fichier contient un ou plusieurs <strong>sujets</strong>, chacun avec ses <strong>questions</strong>. Chaque question possède une version{' '}
            <code>mcq</code> (QCM), une version <code>cloze</code> (phrase à trous), ou les deux. Dans une phrase à trous, le blanc s’écrit <code>___</code>.
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100">{`{
  "format": "quizlab",
  "version": 1,
  "subjects": [{
    "title": "Géographie",
    "description": "Capitales du monde",
    "questions": [{
      "difficulty": "facile",
      "mcq": {
        "prompt": "Quelle est la capitale de la France ?",
        "choices": [
          { "id": "a", "text": "Lyon" },
          { "id": "b", "text": "Paris" }
        ],
        "correctIds": ["b"]
      },
      "cloze": {
        "text": "La capitale de la France est ___.",
        "blanks": [{ "answers": ["Paris"] }]
      },
      "explanation": "Paris est aussi la ville la plus peuplée du pays."
    }]
  }]
}`}</pre>
          <p>
            Les identifiants (<code>id</code>) des sujets et des questions sont facultatifs : QuizLab en crée automatiquement. Vous pouvez
            demander à un outil externe ou à une IA de produire une banque de questions dans ce format, puis l’importer ici.{' '}
            <a href={href({ name: 'manage' })} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Exporter un sujet existant
            </a>{' '}
            est aussi un bon moyen d’obtenir un modèle.
          </p>
        </div>
      </Card>
    </div>
  );
}
