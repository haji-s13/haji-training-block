/** The logo mark: a forward-leaning barbell (it reads as an H for Haji) with motion streaks: run fast, lift heavy. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden fill="currentColor">
      <rect x="2" y="17" width="9" height="3.5" rx="1.75" opacity="0.55" />
      <rect x="0" y="23" width="11" height="3.5" rx="1.75" opacity="0.8" />
      <rect x="4" y="29" width="7" height="3.5" rx="1.75" opacity="0.55" />
      <g transform="skewX(-16) translate(7 0)">
        <rect x="13" y="10" width="7" height="30" rx="2.5" />
        <rect x="21" y="15" width="4" height="20" rx="1.5" />
        <rect x="35" y="10" width="7" height="30" rx="2.5" />
        <rect x="31" y="15" width="4" height="20" rx="1.5" />
        <rect x="24" y="23" width="8" height="4" rx="2" />
        <rect x="41" y="23" width="6" height="4" rx="2" />
      </g>
    </svg>
  );
}
