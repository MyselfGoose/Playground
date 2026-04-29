"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">Feedback</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Report bugs, request features, or share UX issues. This creates a GitHub issue for triage.
        </p>
      </header>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-[var(--shadow-card)]">
        <div className="mb-5 rounded-2xl border border-ink/8 bg-ink/[0.03] px-4 py-3 text-xs font-medium leading-relaxed text-ink-muted">
          <p className="mb-1 font-bold uppercase tracking-wide text-ink/50">Submission context</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>Path: <span className="font-mono text-ink/80">{typeof window !== "undefined" ? window.location.pathname : "/feedback"}</span></li>
            <li>Time and browser metadata are attached automatically</li>
            <li>Account: <span className="text-ink/80">{user ? `${user.username} (${user.id})` : "anonymous"}</span></li>
            {hasScreenshot ? <li>Screenshot will be attached if backend integration is enabled</li> : null}
          </ul>
        </div>

        {phase === "success" && issueUrl ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-bold text-ink">Thanks — feedback submitted successfully.</p>
            {issueNumber != null ? <p className="text-xs font-medium text-ink-muted">Issue #{issueNumber}</p> : null}
            <div className="flex flex-wrap gap-2">
              <a
                href={issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02]"
              >
                View on GitHub
              </a>
              <button
                type="button"
                onClick={() => {
                  reset();
                  sourceRef.current = "page";
                  setHasScreenshot(false);
                  setFormKey((v) => v + 1);
                }}
                className="rounded-2xl px-5 py-3 text-sm font-bold text-ink-muted ring-2 ring-ink/10 hover:bg-white"
              >
                Submit another
              </button>
              <Link
                href="/"
                className="rounded-2xl px-5 py-3 text-sm font-bold text-ink-muted ring-2 ring-ink/10 hover:bg-white"
              >
                Back home
              </Link>
            </div>
          </div>
        ) : (
          <>
            {phase === "error" && errorMessage ? (
              <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                {errorMessage}
              </div>
            ) : null}
            <FeedbackForm
              key={formKey}
              disabled={busy}
              onSubmit={submit}
              onScreenshotSelectedChange={setHasScreenshot}
            />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-4">
              <p className="text-[11px] font-medium text-ink-muted">Shortcut: {shortcutLabel}</p>
              <button
                type="submit"
                form="feedback-form"
                disabled={busy}
                className="inline-flex min-w-[7rem] items-center justify-center rounded-2xl bg-accent px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? "Sending..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
