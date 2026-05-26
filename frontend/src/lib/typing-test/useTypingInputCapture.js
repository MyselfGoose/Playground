"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * @param {EventTarget | null | undefined} target
 */
export function shouldSkipTypingRefocus(target) {
  if (!(target instanceof Element)) {
    return true;
  }
  if (target.closest("[data-no-refocus]")) {
    return true;
  }
  if (target.closest('.typing-hidden-input')) {
    return false;
  }
  if (target.closest('button, a, input, textarea, select, [contenteditable="true"]')) {
    return true;
  }
  return false;
}

/**
 * @param {KeyboardEvent} e
 */
export function isTypingCaptureKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return false;
  }
  if (e.key === "Backspace") {
    return true;
  }
  return e.key.length === 1;
}

/**
 * @param {{
 *   inputRef: import('react').RefObject<HTMLTextAreaElement | null>;
 *   active: boolean;
 *   isComposing: boolean;
 *   onCapturedKey: (e: KeyboardEvent) => void;
 * }} options
 */
export function useTypingInputCapture({ inputRef, active, isComposing, onCapturedKey }) {
  const [inputFocused, setInputFocused] = useState(true);
  const onCapturedKeyRef = useRef(onCapturedKey);
  onCapturedKeyRef.current = onCapturedKey;

  const focusInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) {
      return;
    }
    try {
      el.focus({ preventScroll: true });
    } catch {
      el.focus();
    }
  }, [inputRef]);

  const onPassagePointerDown = useCallback(
    (e) => {
      if (!active) {
        return;
      }
      if (shouldSkipTypingRefocus(e.target)) {
        return;
      }
      e.preventDefault();
      focusInput();
    },
    [active, focusInput],
  );

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      return undefined;
    }

    const onWindowKeyDown = (e) => {
      if (isComposing) {
        return;
      }
      const input = inputRef.current;
      if (!input) {
        return;
      }
      if (document.activeElement === input) {
        return;
      }
      if (shouldSkipTypingRefocus(e.target)) {
        return;
      }
      if (!isTypingCaptureKey(e)) {
        return;
      }

      focusInput();
      onCapturedKeyRef.current(e);
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [active, isComposing, focusInput, inputRef]);

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => focusInput());
    }
  }, [active, focusInput]);

  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return undefined;
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        requestAnimationFrame(() => focusInput());
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, focusInput]);

  const bindInputFocus = useCallback(
    () => ({
      onFocus: () => setInputFocused(true),
      onBlur: () => setInputFocused(false),
    }),
    [],
  );

  const needsResumeHint = active && !inputFocused;

  return {
    focusInput,
    onPassagePointerDown,
    bindInputFocus,
    needsResumeHint,
    passageAreaClassName: active
      ? "typing-passage-capture typing-passage-capture--active"
      : "typing-passage-capture",
  };
}
