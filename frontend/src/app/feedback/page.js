"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { FeedbackForm } from "../../components/feedback/FeedbackForm.jsx";
import { useFeedbackSubmit } from "../../hooks/useFeedbackSubmit.js";
import { useUser } from "../../lib/context/UserContext.jsx";

export default function FeedbackPage() {
  const { user } = useUser();
  const { submit, reset, phase, errorMessage, issueUrl, issueNumber } = useFeedbackSubmit();
  const [formKey, setFormKey] = useState(0);
  const [hasScreenshot, setHasScreenshot] = useState(false);
  const sourceRef = useRef("page");

  const busy = phase === "submitting";
  const shortcutLabel = useMemo(
    () =>
      typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
        ? "Cmd+Shift+F"
        : "Ctrl+Shift+F",
    [],
  );

  return (
    <div className="w-full min-h-screen flex flex-col">
      {/* Header */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 bg-gradient-to-b from-muted-bright/20 to-transparent">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl sm:text-5xl font-black text-foreground mb-4">We&apos;d love your feedback</h1>
            <p className="text-lg text-foreground/70 max-w-xl mx-auto">
              Found a bug? Have a great idea? Let us know. Your feedback helps us make Playground better for everyone.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Main content */}
      <section className="flex-1 px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          {phase === "success" && issueUrl ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-success/20 to-transparent p-8 sm:p-12 ring-2 ring-success/40 text-center"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
                className="text-6xl mb-6"
              >
                ✨
              </motion.div>
              
              <h2 className="text-3xl font-extrabold text-foreground mb-2">Thank you!</h2>
              <p className="text-lg text-foreground/70 mb-8">
                Your feedback has been submitted and we&apos;ll review it soon.
              </p>
              
              {issueNumber != null && (
                <p className="text-sm font-bold text-foreground/60 mb-8">
                  Issue #<span className="text-success">{issueNumber}</span>
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {issueUrl && (
                  <a
                    href={issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 font-extrabold text-white shadow-[var(--shadow-play)] transition-all hover:scale-105 active:scale-95"
                  >
                    View on GitHub
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    sourceRef.current = "page";
                    setHasScreenshot(false);
                    setFormKey((v) => v + 1);
                  }}
                  className="rounded-full bg-muted-bright/50 px-8 py-4 font-extrabold text-foreground transition-all hover:bg-muted-bright/70"
                >
                  Submit Another
                </button>
                <Link
                  href="/"
                  className="rounded-full bg-muted-bright/50 px-8 py-4 font-extrabold text-foreground transition-all hover:bg-muted-bright/70"
                >
                  Back Home
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-background/80 backdrop-blur-sm rounded-[var(--radius-2xl)] p-8 sm:p-10 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40"
            >
              {/* Context info */}
              <div className="mb-8 rounded-[var(--radius-lg)] bg-muted-bright/20 p-4 ring-1 ring-muted-bright/40">
                <p className="text-xs font-bold uppercase tracking-wide text-foreground/60 mb-3">Context</p>
                <ul className="space-y-2 text-sm text-foreground/70">
                  <li className="flex justify-between">
                    <span>Page:</span>
                    <span className="font-mono text-foreground/60">
                      {typeof window !== "undefined" ? window.location.pathname : "/feedback"}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>Account:</span>
                    <span className="text-foreground/60">
                      {user ? `${user.username}` : "Anonymous"}
                    </span>
                  </li>
                  {hasScreenshot && (
                    <li className="flex justify-between">
                      <span>Screenshot:</span>
                      <span className="text-success">Attached</span>
                    </li>
                  )}
                </ul>
              </div>

              {/* Error message */}
              <AnimatePresence>
                {phase === "error" && errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 rounded-[var(--radius-lg)] bg-error/10 border border-error/40 px-4 py-3 text-sm font-bold text-error"
                  >
                    {errorMessage}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <FeedbackForm
                key={formKey}
                disabled={busy}
                onSubmit={submit}
                onScreenshotSelectedChange={setHasScreenshot}
              />

              {/* Submit button and shortcut hint */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-muted-bright/30">
                <p className="text-xs font-bold text-foreground/60 uppercase tracking-wide">
                  Shortcut: <span className="font-mono text-primary">{shortcutLabel}</span>
                </p>
                <motion.button
                  type="submit"
                  form="feedback-form"
                  disabled={busy}
                  whileHover={!busy ? { scale: 1.05 } : {}}
                  whileTap={!busy ? { scale: 0.95 } : {}}
                  className="w-full sm:w-auto rounded-full bg-primary px-8 py-4 font-extrabold text-white shadow-[var(--shadow-play)] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Sending…
                    </span>
                  ) : (
                    "Send Feedback"
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  );
}
