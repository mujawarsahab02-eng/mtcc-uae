// Simple, consistent stroke-icon set — avoids pulling in an icon library
// dependency for a handful of glyphs. All icons share a 24x24 viewBox and
// currentColor stroke so they inherit color/size from their wrapper.

type IconProps = { className?: string };

const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconWallet({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />
      <rect x="14" y="11" width="7" height="5" rx="1" />
      <circle cx="17" cy="13.5" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15 13.2c2.3.4 4 2.4 4 4.8" />
    </svg>
  );
}

export function IconTrophy({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4v1a4 4 0 0 0 4 4" />
      <path d="M17 5h3v1a4 4 0 0 1-4 4" />
      <path d="M10 15h4v3h-4z" />
      <path d="M8 21h8" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
    </svg>
  );
}

export function IconGavel({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13 6l5 5" />
      <path d="M9.5 9.5l-6 6 2 2 6-6" />
      <path d="M11.5 4.5l5 5 2-2-5-5-2 2Z" />
      <path d="M4 21h9" />
    </svg>
  );
}

export function IconShieldCheck({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function IconClipboardCheck({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M9.5 13l2 2 3.5-4" />
    </svg>
  );
}

export function IconHandshake({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 12l4-4h4l3 3" />
      <path d="M22 12l-4-4h-4l-1 1" />
      <path d="M9 11l3 3 1-1 3 3 1-1" />
      <path d="M6 13l2.5 2.5a1.5 1.5 0 0 0 2.1 0" />
    </svg>
  );
}

export function IconList({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

export function IconRefresh({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 4v4h-4" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 20v-4h4" />
    </svg>
  );
}

export function IconCricketBall({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M6 5.5C8 8 8 16 6 18.5" />
      <path d="M18 5.5C16 8 16 16 18 18.5" />
    </svg>
  );
}

export function IconStar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l2.5 5.5 6 .6-4.5 4 1.3 5.9L12 16l-5.3 3 1.3-5.9-4.5-4 6-.6L12 3Z" />
    </svg>
  );
}

export function IconGlobe({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 4 5.9 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.9-4-9s1.5-6.4 4-9Z" />
    </svg>
  );
}
