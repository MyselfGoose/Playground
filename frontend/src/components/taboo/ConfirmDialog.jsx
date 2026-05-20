"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef } from "react";
import { useFocusTrap } from "../../lib/a11y/useFocusTrap.js";
import { cn } from "../../lib/taboo/cn.js";
import { motionPresets } from "../../lib/taboo/motion.js";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  useFocusTrap(open, panelRef, { onEscape: onCancel });

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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          role="presentation"
        >
          <motion.div
            ref={panelRef}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-6"
            {...motionPresets.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
          >
            <h2 id={titleId} className="mb-1 text-lg font-bold text-white">
              {title}
            </h2>
            <p id={descriptionId} className="mb-5 text-sm text-neutral-300">
              {description}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 h-11 rounded-xl bg-white/[0.06] text-white text-sm font-medium hover:bg-white/[0.1] transition-all"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  "flex-1 h-11 rounded-xl text-sm font-medium transition-all",
                  variant === "danger"
                    ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                    : "bg-gradient-to-r from-[#1e3a5f] to-[#2a4d7a] text-white hover:from-[#2a4d7a] hover:to-[#3b6ca8]",
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
