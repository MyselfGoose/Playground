"use client";

import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   options: Array<{ value: string, label: string, icon?: import("react").ReactNode }>,
 *   value: string,
 *   onChange: (value: string) => void,
 *   className?: string,
 *   size?: "sm" | "md",
 * }} props
 */
export function TabooSegmentedControl({
  options,
  value,
  onChange,
  className,
  size = "md",
}) {
  const sizeClass = size === "sm" ? "py-2 text-xs" : "py-2.5 text-sm";

  return (
    <div className={cn("flex gap-2", className)} role="tablist">
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200",
              sizeClass,
              isActive ? "taboo-segment-active" : "taboo-segment-idle",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
