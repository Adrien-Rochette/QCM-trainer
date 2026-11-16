import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { ValidationIssue } from '../../lib/errors';

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-14 text-center dark:border-slate-800">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500 dark:text-slate-400" role="status">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      {label}
    </div>
  );
}

export function Alert({ tone = 'info', title, children, className }: { tone?: 'info' | 'warning' | 'error'; title?: string; children?: ReactNode; className?: string }) {
  const Icon = tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-xl px-4 py-3 text-sm',
        tone === 'info' && 'bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-100',
        tone === 'warning' && 'bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-100',
        tone === 'error' && 'bg-rose-50 text-rose-900 dark:bg-rose-500/10 dark:text-rose-100',
        className,
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'info' && 'text-sky-600 dark:text-sky-400',
          tone === 'warning' && 'text-amber-600 dark:text-amber-400',
          tone === 'error' && 'text-rose-600 dark:text-rose-400',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function IssueList({ issues, max = 30 }: { issues: ValidationIssue[]; max?: number }) {
  if (!issues.length) return null;
  return (
    <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
      {issues.slice(0, max).map((issue, i) => (
        <li key={i} className="rounded-lg bg-white/60 px-2.5 py-1.5 dark:bg-slate-950/40">
          {issue.path && <span className="font-medium">{issue.path} : </span>}
          {issue.message}
        </li>
      ))}
      {issues.length > max && <li className="px-2.5 py-1 italic">… et {issues.length - max} autre(s) erreur(s).</li>}
    </ul>
  );
}

export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', className)}
    >
      <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-500 ease-out dark:bg-indigo-400" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-8 space-y-3">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">{title}</h1>
          {subtitle && <div className="mt-1.5 text-slate-500 dark:text-slate-400">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300">
      <span aria-hidden="true">←</span> {children}
    </a>
  );
}

export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</div>}
    </div>
  );
}
