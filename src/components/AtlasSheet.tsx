/** Shared water lighting for the match and map previews. */
export function AtlasSea({ prefix }: { prefix: string }) {
  return <g pointerEvents="none" aria-hidden="true">
    <defs>
      <radialGradient id={`${prefix}-wash`} cx="40%" cy="36%" r="85%">
        <stop stopColor="#7fa7ac" />
        <stop offset=".62" stopColor="#628d98" />
        <stop offset="1" stopColor="#416f80" />
      </radialGradient>
    </defs>
    <rect width="900" height="600" fill={`url(#${prefix}-wash)`} />
  </g>;
}
