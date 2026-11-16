import { BarChart3, Table2 } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime } from '../../lib/format';
import { MODE_LABELS, type SessionRecord } from '../../models/types';
import { IconButton } from '../ui/Button';

/**
 * Évolution des scores (une seule série, une seule teinte) : une barre par session,
 * infobulle au survol et au focus clavier, et vue tableau équivalente.
 */
export function ScoreHistoryChart({ sessions, showSubject }: { sessions: SessionRecord[]; showSubject: boolean }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [active, setActive] = useState<number | null>(null);
  const data = [...sessions].sort((a, b) => a.finishedAt - b.finishedAt).slice(-20);
  const hovered = active !== null ? data[active] : undefined;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Évolution des scores</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {data.length < sessions.length ? `${data.length} dernières sessions` : `${data.length} session${data.length > 1 ? 's' : ''}`}, en % de réussite
          </p>
        </div>
        <div className="flex gap-1">
          <IconButton label="Afficher le graphique" onClick={() => setView('chart')} aria-pressed={view === 'chart'} className={view === 'chart' ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''}>
            <BarChart3 className="size-4" />
          </IconButton>
          <IconButton label="Afficher le tableau" onClick={() => setView('table')} aria-pressed={view === 'table'} className={view === 'table' ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : ''}>
            <Table2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {view === 'chart' ? (
        <div className="relative">
          {/* Info-bulle */}
          <div className="mb-2 h-10 text-sm" aria-live="polite">
            {hovered ? (
              <div className="inline-flex flex-wrap items-baseline gap-x-2 rounded-lg bg-slate-900 px-3 py-1.5 text-white dark:bg-slate-100 dark:text-slate-900">
                <strong className="tabular-nums">{hovered.percent} %</strong>
                <span className="opacity-80">
                  {hovered.correctCount}/{hovered.total} · {MODE_LABELS[hovered.mode]}
                  {showSubject ? ` · ${hovered.subjectTitle}` : ''} · {formatDateTime(hovered.finishedAt)}
                </span>
              </div>
            ) : (
              <span className="text-slate-400 dark:text-slate-500">Survolez une barre pour voir le détail.</span>
            )}
          </div>
          <div className="flex gap-2">
            {/* Axe des ordonnées */}
            <div className="flex h-48 flex-col justify-between pb-px text-right text-[11px] text-slate-400 tabular-nums" aria-hidden="true">
              <span>100</span>
              <span>50</span>
              <span>0</span>
            </div>
            <div className="relative h-48 flex-1">
              <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
                <div className="border-t border-dashed border-slate-200 dark:border-slate-800" />
                <div className="border-t border-dashed border-slate-200 dark:border-slate-800" />
                <div className="border-t border-slate-300 dark:border-slate-700" />
              </div>
              <ul className="relative flex h-full items-end gap-0.5" onMouseLeave={() => setActive(null)} aria-label="Scores des sessions">
                {data.map((s, i) => (
                  <li
                    key={s.id}
                    tabIndex={0}
                    aria-label={`${formatDateTime(s.finishedAt)} : ${s.percent} %, ${s.correctCount} sur ${s.total}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    className="group flex h-full max-w-12 flex-1 cursor-default items-end justify-center rounded-md outline-none focus-visible:bg-indigo-50 dark:focus-visible:bg-indigo-500/10"
                  >
                    <div
                      className={
                        'w-full max-w-7 rounded-t-[4px] transition-all duration-300 ' +
                        (active === i ? 'bg-indigo-700 dark:bg-indigo-300' : 'bg-indigo-500 dark:bg-indigo-400')
                      }
                      style={{ height: `${Math.max(s.percent, 1.5)}%` }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-1 flex justify-between pl-8 text-[11px] text-slate-400" aria-hidden="true">
            <span>{data[0] ? formatDateTime(data[0].finishedAt) : ''}</span>
            <span>{data.length > 1 ? formatDateTime(data[data.length - 1]!.finishedAt) : ''}</span>
          </div>
        </div>
      ) : (
        <div className="max-h-80 overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                {showSubject && <th className="px-3 py-2 font-medium">Sujet</th>}
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 text-right font-medium">Score</th>
                <th className="px-3 py-2 text-right font-medium">Réussite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...data].reverse().map((s) => (
                <tr key={s.id}>
                  <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDateTime(s.finishedAt)}</td>
                  {showSubject && <td className="px-3 py-2 text-slate-900 dark:text-white">{s.subjectTitle}</td>}
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{MODE_LABELS[s.mode]}</td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums dark:text-slate-300">
                    {s.correctCount}/{s.total}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900 tabular-nums dark:text-white">{s.percent} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
