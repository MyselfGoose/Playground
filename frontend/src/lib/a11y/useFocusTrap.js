"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * @param {boolean} active
 * @param {React.RefObject<HTMLElement | null>} containerRef
 * @param {{ onEscape?: () => void }} [options]
 */
export function useFocusTrap(active, containerRef, options = {}) {
  const { onEscape } = options;
  const previousFocusRef = useRef(/** @type {HTMLElement | null} */ (null));

  useEffect(() => {
    if (!active || typeof document === "undefined") return undefined;

    const container = containerRef.current;
    if (!container) return undefined;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(container.querySelectorAll(FOCUSABLE)).filter(
        (el) => el instanceof HTMLElement && !el.hasAttribute("disabled"),
      );

    const focusFirst = () => {
      const list = focusables();
      const target = list[0];
      if (target instanceof HTMLElement) {
        target.focus();
      } else {
        container.focus();
      }
    };

    const raf = requestAnimationFrame(focusFirst);

    /** @param {KeyboardEvent} event */
    const onKeyDown = (event) => {
      if (event.key === "Escape" && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }
      if (event.key !== "Tab") return;

      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        return;
      }

      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !container.contains(activeEl)) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", onKeyDown);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener("keydown", onKeyDown);
      const prev = previousFocusRef.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
      previousFocusRef.current = null;
    };
  }, [active, containerRef, onEscape]);
}
