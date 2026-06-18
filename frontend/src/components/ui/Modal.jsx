"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "../../lib/a11y/useFocusTrap.js";

/**
 * @param {{
 *   open: boolean,
 *   onClose?: () => void,
 *   title?: string,
 *   description?: string,
 *   children: import("react").ReactNode,
 *   className?: string,
 *   panelClassName?: string,
 *   closeOnBackdrop?: boolean,
 *   showCloseButton?: boolean,
 *   size?: 'sm' | 'md' | 'lg' | 'xl',
 * }} props
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className = "",
  panelClassName = "",
  closeOnBackdrop = true,
  showCloseButton = true,
  size = "md",
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  }[size];

  useFocusTrap(open, panelRef, { onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeOnBackdrop ? onClose : undefined}
          role="presentation"
        >
          <motion.div
            ref={panelRef}
            className={`relative w-full ${sizeClass} overflow-hidden rounded-[var(--radius-2xl)] border border-muted-bright/30 bg-background shadow-[var(--shadow-lg)] outline-none ${panelClassName}`}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
          >
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between gap-4 border-b border-muted-bright/20 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  {title ? (
                    <h2 id={titleId} className="text-lg font-extrabold text-foreground">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p id={descriptionId} className="mt-1 text-sm text-foreground/60">
                      {description}
                    </p>
                  ) : null}
                </div>
                {showCloseButton && onClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-[var(--radius-lg)] p-2 text-foreground/60 transition-colors hover:bg-muted-bright/30 hover:text-foreground"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                ) : null}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
