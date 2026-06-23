"use client";

/**
 * @param {{
 *   children: import('react').ReactNode;
 *   priority?: 'primary' | 'secondary' | 'optional';
 *   compactClassName?: string;
 *   className?: string;
 *   hideWhenCompact?: boolean;
 *   isCompact?: boolean;
 * }} props
 */
export function ContentTier({
  children,
  priority = "primary",
  compactClassName = "",
  className = "",
  hideWhenCompact = false,
  isCompact = false,
}) {
  if (hideWhenCompact && isCompact && priority === "optional") {
    return null;
  }

  const compactStyles =
    isCompact && priority === "secondary"
      ? compactClassName || "text-sm opacity-90"
      : "";

  return <div className={`${className} ${compactStyles}`.trim()}>{children}</div>;
}
