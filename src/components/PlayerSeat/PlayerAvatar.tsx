const portraits: Record<string, { color: string; path: string }> = {
  SP: { color: "sage", path: "M8 15h16a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-3a4 4 0 0 1 4-4Zm1 5h14M11 9v1m7-4v3m6 0v2" },
  MG: { color: "clay", path: "M6 12h17v10a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5Zm17 2h2a4 4 0 0 1 0 8h-2M11 5v3m6-4v4" },
  UM: { color: "blue", path: "M3 17a13 13 0 0 1 26 0H3Zm13-13v21a4 4 0 0 0 8 0M16 5c-5 4-5 8-5 12m5-12c5 4 5 8 5 12" },
  LP: { color: "amber", path: "m11 5-6 13h22L21 5H11Zm5 13v9m-6 0h12M24 18v5" },
  KY: { color: "lilac", path: "M17 14a7 7 0 1 0-4 4l11 11 4-4-4-4-3 1-4-4ZM9 9h.01" },
  CK: { color: "rose", path: "M27 15a7 7 0 0 1-9-10A12 12 0 1 0 27 15ZM10 12h.01M9 21h.01M18 23h.01M17 15h.01" },
  PN: { color: "teal", path: "m7 20-2 8 8-2L28 11l-6-6L7 20Zm0 0 6 6M19 8l6 6" },
  AC: { color: "sand", path: "M26 18a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM16 12v7h5M5 9l5-5m12 0 5 5M9 27l-2 3m16-3 2 3" },
};

export function PlayerAvatar({ code, className = "" }: { code: string; className?: string }) {
  const portrait = portraits[code];
  return <span className={`player-avatar avatar-${portrait?.color ?? "gold"} ${className}`} aria-hidden="true">
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={portrait?.path ?? "M16 3C12 9 5 12 5 18a6 6 0 0 0 10 4l-3 7h8l-3-7a6 6 0 0 0 10-4c0-6-7-9-11-15Z"} />
    </svg>
  </span>;
}
