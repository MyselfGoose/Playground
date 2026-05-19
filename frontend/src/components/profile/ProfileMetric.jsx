"use client";

/**
 * @param {{ label: string; value: string; accent?: boolean; className?: string }} props
 */
export function ProfileMetric({ label, value, accent = false, className = "" }) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] px-4 py-3 ring-1 transition-all ${
        accent
          ? "bg-gradient-to-br from-primary/20 to-accent-pink/15 ring-primary/30 shadow-[var(--shadow-play)]"
          : "bg-gradient-to-br from-muted-bright/45 to-background/70 ring-foreground/10"
      } ${className}`}
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-foreground/55">{label}</p>
      <p className={`mt-1.5 text-lg font-black ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
