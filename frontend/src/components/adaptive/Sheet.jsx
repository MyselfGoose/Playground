"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFocusTrap } from "../../lib/a11y/useFocusTrap.js";

/**
 * Bottom sheet on mobile, centered dialog on larger screens.
 *
 * @param {{
 *   open: boolean;
 *   onClose: () => void;
 *   title?: string;
 *   description?: string;
 *   children: import('react').ReactNode;
 *   className?: string;
 *   maxWidth?: string;
 * }} props
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  className = "",
  maxWidth = "max-w-md",
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  useFocusTrap(open, panelRef, { onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const titleId = title ? "sheet-title" : undefined;
  const descId = description ? "sheet-description" : undefined;

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4">
          <motion.button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: 24 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
            className={`relative z-[1] flex max-h-[min(85dvh,32rem)] w-full flex-col overflow-hidden rounded-t-[var(--radius-2xl)] bg-background shadow-[var(--shadow-xl)] ring-2 ring-muted-bright/40 sm:max-h-[min(80vh,36rem)] sm:rounded-[var(--radius-2xl)] ${maxWidth} ${className}`}
          >
            {(title || description) ? (
              <div className="shrink-0 border-b border-muted-bright/30 px-5 py-4 sm:px-6">
                {title ? (
                  <h2 id={titleId} className="text-lg font-extrabold text-foreground">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <p id={descId} className="mt-1 text-sm text-foreground/70">
                    {description}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
