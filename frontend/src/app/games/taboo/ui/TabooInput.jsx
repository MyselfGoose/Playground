"use client";

import { forwardRef } from "react";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @type {import("react").ForwardRefRenderFunction<HTMLInputElement, {
 *   label?: string,
 *   error?: string,
 *   className?: string,
 *   inputClassName?: string,
 *   id?: string,
 * } & import("react").InputHTMLAttributes<HTMLInputElement>>}
 */
export const TabooInput = forwardRef(function TabooInput(
  { label, error, className, inputClassName, id, ...props },
  ref,
) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wide text-taboo-text-muted">
          {label}
        </span>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={cn("taboo-input mt-1.5 h-12", error && "ring-2 ring-taboo-danger/40", inputClassName)}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error ? <p className="mt-1 text-xs font-medium text-taboo-danger">{error}</p> : null}
    </label>
  );
});
