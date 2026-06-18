"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "../../../../lib/a11y/useFocusTrap.js";
import { cn } from "../../../../lib/taboo/cn.js";
import { motionPresets } from "../../../../lib/taboo/motion.js";

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
 * }} props
 */
export function TabooModal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  panelClassName,
  closeOnBackdrop = true,
}) {
  const titleId = useId();
  const descriptionId = useId();
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

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={cn(
            "fixed inset-0 z-50 flex items-center justify-center bg-taboo-canvas-overlay p-4 backdrop-blur-md",
            className,
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeOnBackdrop ? onClose : undefined}
          role="presentation"
        >
          <motion.div
            ref={panelRef}
            className={cn("w-full max-w-sm outline-none", panelClassName)}
            {...motionPresets.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
          >
            {title ? (
              <h2 id={titleId} className="sr-only">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p id={descriptionId} className="sr-only">
                {description}
              </p>
            ) : null}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
