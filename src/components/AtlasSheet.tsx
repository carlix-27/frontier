import sheetUrl from "../assets/atlas-paper.svg";

/** One static printed sheet shared by the match and both previews. */
export function AtlasSea({ prefix }: { prefix: string }) {
  return <g pointerEvents="none" aria-hidden="true">
    <defs>
      <radialGradient id={`${prefix}-wash`} cx="40%" cy="36%" r="85%">
        <stop stopColor="#cedcd0" />
        <stop offset=".62" stopColor="#b3ccc1" />
        <stop offset="1" stopColor="#93b3ac" />
      </radialGradient>
      <pattern id={`${prefix}-graticule`} width="112.5" height="100" patternUnits="userSpaceOnUse">
        <path d="M0,100 V0 H112.5" fill="none" stroke="#546b5e" strokeOpacity=".23" strokeWidth=".9" strokeDasharray="3 3" />
      </pattern>
    </defs>
    <rect width="900" height="600" fill={`url(#${prefix}-wash)`} />
    <rect width="900" height="600" fill={`url(#${prefix}-graticule)`} />
  </g>;
}

export function AtlasPaper() {
  return <image href={sheetUrl} width="900" height="600" pointerEvents="none" aria-hidden="true" />;
}
