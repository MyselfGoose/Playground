"use client";

import { useCallback, useRef, useState } from "react";
import { Navbar } from "./Navbar.jsx";
import { FeedbackModal } from "./feedback/FeedbackModal.jsx";
import { useFeedbackKeyboardShortcut } from "../hooks/useFeedbackKeyboardShortcut.js";

export function Shell({ children }) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackSourceRef = useRef("desktop");

  const openFeedback = useCallback((source = "desktop") => {
    feedbackSourceRef.current = source;
    setFeedbackOpen(true);
  }, []);

  useFeedbackKeyboardShortcut(() => openFeedback("desktop"), { modalOpen: feedbackOpen });

  return (
    <>
      <Navbar onOpenFeedback={openFeedback} />
      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        feedbackSourceRef={feedbackSourceRef}
      />
      <main className="relative flex flex-1 flex-col">{children}</main>
    </>
  );
}
