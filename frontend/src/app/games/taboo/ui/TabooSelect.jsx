"use client";

import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   label?: string,
 *   className?: string,
 *   selectClassName?: string,
 *   id?: string,
 *   children: import("react").ReactNode,
 * } & import("react").SelectHTMLAttributes<HTMLSelectElement>} props
 */
export function TabooSelect({
  label,
  className,
  selectClassName,
  id,
  children,
  ...props
}) {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wide text-taboo-text-muted">
          {label}
        </span>
      ) : null}
      <select id={selectId} className={cn("taboo-input mt-1.5 h-12", selectClassName)} {...props}>
        {children}
      </select>
    </label>
  );
}
