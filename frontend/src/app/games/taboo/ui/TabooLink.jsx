"use client";

import Link from "next/link";
import { cn } from "../../../../lib/taboo/cn.js";

/**
 * @param {{
 *   href: string,
 *   children: import("react").ReactNode,
 *   className?: string,
 * }} props
 */
export function TabooLink({ href, children, className }) {
  return (
    <Link
      href={href}
      className={cn(
        "font-semibold text-taboo-accent-hover transition-colors duration-200 hover:text-taboo-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-taboo-ring focus-visible:ring-offset-2 focus-visible:ring-offset-taboo-canvas",
        className,
      )}
    >
      {children}
    </Link>
  );
}
