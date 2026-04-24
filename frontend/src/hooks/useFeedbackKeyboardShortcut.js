"use client";

import { useEffect } from "react";

function isTypingTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  return false;
}

/**
 * Opens feedback when the user presses Ctrl+Shift+F (Windows/Linux) or Cmd+Shift+F (macOS).
 * Ignored while the modal is already open, or while focus is in a typical text field / contenteditable.
 *
 * @param {() => void} onOpen
 * @param {{ modalOpen?: boolean }} [opts]
 */
export function useFeedbackKeyboardShortcut(onOpen, opts = {}) {
  const { modalOpen = false } = opts;

  useEffect(() => {
    const handler = (e) => {
      if (modalOpen) return;

      const key = e.key?.toLowerCase();
      if (key !== "f") return;
      const meta = e.metaKey;
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;
      if (!shift || (!meta && !ctrl) || (meta && ctrl)) return;

      const ae = document.activeElement;
      if (isTypingTarget(ae)) return;

      e.preventDefault();
      onOpen();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpen, modalOpen]);
}
