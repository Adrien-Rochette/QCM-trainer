import { cn } from '../../lib/cn';

/** Anneau de score : la couleur suit le niveau de réussite (vert / ambre / rouge), avec le pourcentage au centre. */
export function ScoreRing({ percent, size = 168, label }: { percent: number; size?: number; label: string }) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);
  const tone = percent >= 75 ? 'text-emerald-500' : percent >= 50 ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(tone, 'transition-[stroke-dashoffset] duration-1000 ease-out')}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
        <span className="text-4xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{percent}%</span>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">de réussite</span>
      </div>
    </div>
  );
}
