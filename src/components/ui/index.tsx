import { ReactNode } from "react";
import { statusTone } from "@/lib/constants";

export function Card({
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
    <div className={`rounded-xl border border-line bg-bgCard ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

const TONE_CLASSES: Record<string, string> = {
  default: "bg-muted/15 text-muted",
  gold: "bg-gold/15 text-goldBright",
  green: "bg-green/15 text-green",
  red: "bg-red/15 text-red",
  blue: "bg-blue/15 text-blue",
  orange: "bg-orange/15 text-orange",
};

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase inline-block whitespace-nowrap ${TONE_CLASSES[tone] || TONE_CLASSES.default}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}

export function Field({
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
      <span className="block text-xs font-semibold uppercase tracking-wide mb-1.5 text-muted">
        {label} {required && <span className="text-orange">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[11px] mt-1 text-mutedDim">{hint}</span>}
    </label>
  );
}

export function Button({
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
    orange: "bg-gradient-to-br from-orange to-[#E0521A] text-[#1A0800] shadow-[0_2px_12px_rgba(255,122,61,0.25)]",
    ghost: "bg-transparent text-ink border border-line",
    danger: "bg-red/10 text-red border border-red/30",
    subtle: "bg-bgPanel text-muted border border-line",
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

export function StatCard({ label, value, tone = "gold", sub }: { label: string; value: ReactNode; tone?: string; sub?: string }) {
  const toneClass: Record<string, string> = { gold: "bg-gold", orange: "bg-orange", green: "bg-green", red: "bg-red", blue: "bg-blue" };
  return (
    <Card className="p-4 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-[3px] ${toneClass[tone] || toneClass.gold}`} />
      <div className="text-[11px] uppercase tracking-wider font-semibold mb-1.5 text-muted">{label}</div>
      <div className="text-3xl font-bold font-display text-ink">{value}</div>
      {sub && <div className="text-xs mt-1 text-mutedDim">{sub}</div>}
    </Card>
  );
}

export function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-1 flex items-center gap-2 text-orange">
            <span className="w-4 h-[2px] bg-orange" /> {eyebrow}
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight font-display text-ink">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function SeamDivider() {
  return (
    <div className="flex items-center gap-1 my-2" aria-hidden="true">
      <div className="flex-1 h-px bg-line" />
      {Array.from({ length: 7 }).map((_, i) => (
        <span
          key={i}
          className="block w-1 h-2 rounded-full opacity-60"
          style={{ background: i % 2 === 0 ? "#D4AF37" : "transparent", transform: `rotate(${i % 2 === 0 ? 20 : -20}deg)` }}
        />
      ))}
      <div className="flex-1 h-px bg-line" />
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-bold uppercase tracking-[0.15em] mb-3 pb-2 border-b border-line text-gold">{title}</div>
      {children}
    </div>
  );
}
