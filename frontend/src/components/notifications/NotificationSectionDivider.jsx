"use client";

/**
 * @param {{ label?: string }} props
 */
export function NotificationSectionDivider({ label = "Earlier" }) {
  return (
    <div className="relative py-2">
      <div className="absolute inset-x-0 top-1/2 border-t border-foreground/10" aria-hidden />
      <p className="relative mx-auto w-fit bg-background px-3 text-[10px] font-black uppercase tracking-wider text-muted">
        {label}
      </p>
    </div>
  );
}
