"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useUser } from "../../lib/context/UserContext.jsx";
import { useFeedbackSubmit } from "../../hooks/useFeedbackSubmit.js";
import { FeedbackForm } from "./FeedbackForm.jsx";

/**
 * @param {{ open: boolean, onClose: () => void, feedbackSourceRef?: import("react").MutableRefObject<string> }} props
 */
export function FeedbackModal({ open, onClose, feedbackSourceRef }) {
  const titleId = useId();
  const panelRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const lastFocusRef = useRef(/** @type {HTMLElement | null} */ (null));
  const pathname = usePathname();
  const { user } = useUser();
  const { submit, reset, phase, errorMessage, issueUrl, issueNumber } = useFeedbackSubmit();
  const [formKey, setFormKey] = useState(0);
  const [hasScreenshot, setHasScreenshot] = useState(false);

  const busy = phase === "submitting";

  useEffect(() => {
    if (!open) return;
    const ae = document.activeElement;
    lastFocusRef.current = ae instanceof HTMLElement ? ae : null;
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector("#feedback-type");
      if (el instanceof HTMLElement) el.focus();
    }, 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleClose = useCallback(() => {
    if (busy) return;
    reset();
    setFormKey((k) => k + 1);
    setHasScreenshot(false);
    onClose();
    window.setTimeout(() => {
      const src = feedbackSourceRef?.current === "mobile" ? "mobile" : "desktop";
      const byId = document.getElementById(`feedback-trigger-${src}`);
      if (byId instanceof HTMLElement) {
        byId.focus();
        return;
      }
      lastFocusRef.current?.focus?.();
    }, 0);
  }, [busy, feedbackSourceRef, onClose, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        if (!busy) handleClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const root = panelRef.current;
      const focusable = root.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      const list = [...focusable].filter(
        (n) => n instanceof HTMLElement && n.offsetParent !== null && !n.hasAttribute("disabled"),
      );
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const ae = document.activeElement;
      if (e.shiftKey) {
        if (ae === first || !root.contains(ae)) {
          e.preventDefault();
          last.focus();
        }
      } else if (ae === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, busy, handleClose]);

  const onSubmitPayload = useCallback((payload) => submit(payload), [submit]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="feedback-overlay"
          className="fixed inset-0 z-[100]"
          data-feedback-modal
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Close feedback dialog"
            disabled={busy}
            className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            onClick={() => handleClose()}
          />
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="pointer-events-auto w-full max-w-lg max-h-[min(90vh,720px)] overflow-y-auto rounded-3xl border border-muted-bright/60 bg-background/95 p-6 shadow-2xl shadow-ink/15 ring-2 ring-ink/5"
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-ink">
                  Send feedback
                </h2>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleClose()}
                  className="rounded-2xl px-3 py-1.5 text-sm font-bold text-ink-muted transition-colors hover:bg-background/80 hover:text-ink disabled:opacity-40"
                >
                  Close
                </button>
              </div>

              <p className="mb-4 text-sm font-medium leading-relaxed text-ink-muted">
                Tell us what broke, what would help, or what feels off. We turn submissions into GitHub issues for
                triage—no account required.
              </p>

              <div className="mb-5 rounded-2xl border border-ink/8 bg-ink/[0.03] px-4 py-3 text-xs font-medium leading-relaxed text-ink-muted">
                <p className="mb-1 font-bold uppercase tracking-wide text-ink/50">We&apos;ll include</p>
                <ul className="list-inside list-disc space-y-0.5">
                  <li>
                    Page: <span className="font-mono text-ink/80">{pathname || "—"}</span>
                  </li>
                  <li>Time and browser info</li>
                  <li>
                    Account:{" "}
                    <span className="text-ink/80">{user ? `${user.username} (${user.id})` : "anonymous"}</span>
                  </li>
                  {hasScreenshot ? (
                    <li>
                      Optional screenshot — uploaded to the linked GitHub repo and embedded in the issue when the token
                      allows it
                    </li>
                  ) : null}
                </ul>
              </div>

              {phase === "success" && issueUrl ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm font-bold text-ink">Thanks — your feedback was recorded.</p>
                  {issueNumber != null ? (
                    <p className="text-xs font-medium text-ink-muted">Issue #{issueNumber}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={issueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
                    >
                      View on GitHub
                    </a>
                    <button
                      type="button"
                      onClick={() => handleClose()}
                      className="rounded-2xl px-5 py-3 text-sm font-bold text-ink-muted ring-2 ring-ink/10 transition-colors hover:bg-background/80"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {phase === "error" && errorMessage ? (
                    <div
                      className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
                      role="alert"
                    >
                      {errorMessage}
                    </div>
                  ) : null}
                  <FeedbackForm
                    key={formKey}
                    disabled={busy}
                    onSubmit={onSubmitPayload}
                    onScreenshotSelectedChange={setHasScreenshot}
                  />
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
                    <p className="text-[11px] font-medium text-ink-muted">
                      Shortcut: {typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
                        ? "⌘⇧F"
                        : "Ctrl+Shift+F"}
                    </p>
                    <button
                      type="submit"
                      form="feedback-form"
                      disabled={busy}
                      className="inline-flex min-w-[7rem] items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-foreground shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? (
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                            aria-hidden
                          />
                          Sending…
                        </span>
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
