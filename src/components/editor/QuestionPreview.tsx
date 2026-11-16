import { Eye, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { checkClozeAnswer, isClozeAnswerCorrect, isMcqAnswerCorrect } from '../../engine/answerCheck';
import { cn } from '../../lib/cn';
import type { QuestionFormat } from '../../models/types';
import { ClozeQuestionView } from '../quiz/ClozeQuestionView';
import { McqQuestionView } from '../quiz/McqQuestionView';
import { RichText } from '../quiz/RichText';
import { Button } from '../ui/Button';
import { SegmentedControl } from '../ui/SegmentedControl';
import type { QuestionContent } from '../../models/schemas';

/** Aperçu interactif de la question, tel qu'il apparaîtra pendant un quiz. */
export function QuestionPreview({ content, valid }: { content: Partial<QuestionContent>; valid: boolean }) {
  const formats: QuestionFormat[] = [...(content.mcq ? (['qcm'] as const) : []), ...(content.cloze ? (['trous'] as const) : [])];
  const [format, setFormat] = useState<QuestionFormat>(formats[0] ?? 'qcm');
  const [selected, setSelected] = useState<string[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);

  const current = formats.includes(format) ? format : formats[0];

  // Toute modification de la question réinitialise l'essai en cours.
  const signature = JSON.stringify(content);
  useEffect(() => {
    setRevealed(false);
    setSelected([]);
    setValues([]);
  }, [signature, current]);

  if (!current) {
    return <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Activez au moins une version pour voir l’aperçu.</p>;
  }

  const mcq = content.mcq;
  const cloze = content.cloze;
  const result =
    revealed && current === 'qcm' && mcq
      ? isMcqAnswerCorrect(mcq, selected)
      : revealed && current === 'trous' && cloze
        ? isClozeAnswerCorrect(cloze, values)
        : undefined;

  return (
    <div className="space-y-4">
      {formats.length > 1 && (
        <SegmentedControl
          label="Version à prévisualiser"
          hideLabel
          value={current}
          onChange={setFormat}
          options={[
            { value: 'qcm', label: 'QCM' },
            { value: 'trous', label: 'À compléter' },
          ]}
        />
      )}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
        {current === 'qcm' && mcq ? (
          <McqQuestionView
            mcq={mcq}
            order={mcq.choices.map((c) => c.id)}
            selected={selected}
            onChange={setSelected}
            locked={revealed}
            reveal={revealed}
          />
        ) : cloze ? (
          <ClozeQuestionView
            cloze={cloze}
            values={values}
            onChange={setValues}
            locked={revealed}
            {...(revealed ? { results: checkClozeAnswer(cloze, values) } : {})}
            onEnter={() => valid && setRevealed(true)}
          />
        ) : null}
      </div>
      {result !== undefined && (
        <p className={cn('text-sm font-semibold', result ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
          {result ? 'Bonne réponse !' : 'Réponse incorrecte'}
          {!result && current === 'trous' && cloze && (
            <span className="font-normal text-slate-600 dark:text-slate-300"> · Attendu : {cloze.blanks.map((b) => b.answers.join(' ou ')).join(' / ')}</span>
          )}
        </p>
      )}
      {revealed && content.explanation && (
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <RichText text={content.explanation} />
        </p>
      )}
      <div className="flex justify-end">
        {revealed ? (
          <Button size="sm" variant="secondary" onClick={() => setRevealed(false)} icon={<RotateCcw className="size-4" />}>
            Réessayer
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setRevealed(true)} disabled={!valid} icon={<Eye className="size-4" />}>
            Tester la correction
          </Button>
        )}
      </div>
    </div>
  );
}
