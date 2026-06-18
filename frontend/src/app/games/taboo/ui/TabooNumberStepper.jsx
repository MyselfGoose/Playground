"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";
import { TabooIconButton } from "../ui/index.js";

/**
 * @param {{
 *   label?: string,
 *   value: number,
 *   onChange: (value: number) => void,
 *   min?: number,
 *   max?: number,
 *   className?: string,
 * }} props
 */
export function TabooNumberStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  className,
}) {
  const decrement = () => onChange(Math.max(min, value - 1));
  const increment = () => onChange(Math.min(max, value + 1));

  return (
    <div className={cn("block", className)}>
      {label ? (
        <span className="text-xs font-bold uppercase tracking-wide text-taboo-text-muted">
          {label}
        </span>
      ) : null}
      <div className="mt-1.5 flex h-12 items-center gap-2 taboo-surface-inset rounded-xl px-2">
        <TabooIconButton
          aria-label={`Decrease ${label || "value"}`}
          onClick={decrement}
          disabled={value <= min}
          className="h-8 w-8 shrink-0"
        >
          <Minus className="h-4 w-4" />
        </TabooIconButton>
        <span className="flex-1 text-center font-display text-lg font-bold tabular-nums text-taboo-text">
          {value}
        </span>
        <TabooIconButton
          aria-label={`Increase ${label || "value"}`}
          onClick={increment}
          disabled={value >= max}
          className="h-8 w-8 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </TabooIconButton>
      </div>
    </div>
  );
}
