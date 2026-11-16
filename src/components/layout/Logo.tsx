/** Logo QuizLab : une bulle de question avec une coche. */
export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ql-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ql-grad)" />
      <path
        d="M32 14c-10.5 0-19 7.6-19 17 0 4.6 2 8.8 5.4 11.9L17 51l8.6-3.9c2 .6 4.2.9 6.4.9 10.5 0 19-7.6 19-17s-8.5-17-19-17Z"
        fill="#fff"
      />
      <path d="m24 31.5 5.5 5.5L41 25.5" fill="none" stroke="#6366f1" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
