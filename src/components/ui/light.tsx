import { ReactNode } from "react";
import { statusTone } from "@/lib/constants";

// Light-theme siblings of src/components/ui/index.tsx, built for the admin
// panel light refresh. Kept as a SEPARATE file rather than modifying the
// originals, so the Auction Control Room and Auction Display — which are
// meant to stay dark/cinematic — are completely unaffected. Same prop
// shapes as the dark versions, so converting a page is a drop-in swap.

export function LightCard({
  children,
  className = "",
  style,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div className={`rounded-xl border border-black/5 bg-white shadow-sm ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

const LIGHT_TONES: Record<string, { bg: string; color: string }> = {
  default: { bg: "#F1F2F4", color: "#566274" },
  gold: { bg: "#FBF1D6", color: "#8A6A0A" },
  green: { bg: "#E4F9EF", color: "#1E9E6B" },
  red: { bg: "#FDE8EA", color: "#C13645" },
  blue: { bg: "#E8F1FF", color: "#2F6FCC" },
  orange: { bg: "#FFEDE1", color: "#C1531C" },
};

export function LightBadge({ children, tone = "default" }: { children: ReactNode; tone?: string }) {
  const t = LIGHT_TONES[tone] || LIGHT_TONES.default;
  return (
    <span
      className="px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase inline-block whitespace-nowrap"
      style={{ background: t.bg, color: t.color }}
    >
      {children}
    </span>
  );
}

export function LightStatusBadge({ status }: { status: string }) {
  return <LightBadge tone={statusTone(status)}>{status}</LightBadge>;
}

export function LightField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-slateText">
        {label} {required && <span className="text-orange">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] mt-1 text-slateText">{hint}</span>}
    </label>
  );
}

export function LightButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: "primary" | "orange" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md" | "lg";
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3.5 text-base" };
  const variants: Record<string, string> = {
    primary: "bg-gradient-to-br from-gold to-[#B8912C] text-[#151005] shadow-[0_2px_12px_rgba(212,175,55,0.25)]",
    orange: "bg-gradient-to-br from-orange to-[#E0521A] text-white shadow-[0_2px_12px_rgba(255,122,61,0.25)]",
    ghost: "bg-white text-navyText border border-black/10",
    danger: "bg-red/5 text-red border border-red/25",
    subtle: "bg-[#F1F2F4] text-slateText border border-black/5",
  };
  return (
    <button
      {...props}
      className={`font-semibold rounded-lg inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function LightStatCard({ label, value, tone = "gold", sub }: { label: string; value: ReactNode; tone?: string; sub?: string }) {
  const toneClass: Record<string, string> = { gold: "bg-gold", orange: "bg-orange", green: "bg-green", red: "bg-red", blue: "bg-blue" };
  return (
    <LightCard className="p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-[3px] ${toneClass[tone] || toneClass.gold}`} />
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5 text-slateText">{label}</div>
      <div className="text-3xl font-bold font-display text-navyText">{value}</div>
      {sub && <div className="text-xs mt-1 text-slateText">{sub}</div>}
    </LightCard>
  );
}

export function LightSectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-1 flex items-center gap-2 text-orange">
            <span className="w-4 h-[2px] bg-orange" /> {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight font-display text-navyText">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function LightSeamDivider() {
  return (
    <div className="flex items-center gap-1 my-2" aria-hidden="true">
      <div className="flex-1 h-px bg-black/10" />
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className="block w-1 h-2 rounded-full opacity-70"
          style={{ background: i % 2 === 0 ? "#D4AF37" : "transparent", transform: `rotate(${i % 2 === 0 ? 20 : -20}deg)` }}
        />
      ))}
      <div className="flex-1 h-px bg-black/10" />
    </div>
  );
}

export function LightFormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-bold uppercase tracking-[0.15em] mb-3 pb-2 border-b border-black/10 text-orange">{title}</div>
      {children}
    </div>
  );
}
