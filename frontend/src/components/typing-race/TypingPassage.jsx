"use client";

import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";
import { TypingChar } from "./TypingChar.jsx";
import { findActiveWordPartIndex, splitPassageWords } from "./typing-passage-build.js";

/**
 * Root causes fixed:
 * - Caret in flow (Framer layout) broke line boxes → overlay caret only.
 * - Words as display:inline → mid-word breaks → inline-block + nowrap per token.
 * - nbsp in chars → bad breaks → normal spaces in space runs.
 *
 * @param {{ passage: string; cursor: number; errorStack: string }} props
 */
function TypingPassageInner({ passage, cursor, errorStack }) {
  const reduce = useReducedMotion();
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const currentCharRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const eofRef = useRef(/** @type {HTMLSpanElement | null} */ (null));

  const [caret, setCaret] = useState(
    /** @type {{ left: number; top: number; height: number; visible: boolean }} */ ({
      left: 0,
      top: 0,
      height: 0,
      visible: false,
    }),
  );

  const setCurrentRef = useCallback((el) => {
    currentCharRef.current = el;
  }, []);

  const content = useMemo(
    () =>
      buildWordNodes(
        passage,
        cursor,
        errorStack,
        setCurrentRef,
        eofRef,
      ),
    [passage, cursor, errorStack, setCurrentRef],
  );

  const updateCaret = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    /** Prefer current-char anchor; after line end use zero-width EOF anchor */
    const anchor =
      cursor < passage.length
        ? currentCharRef.current
        : eofRef.current;
    if (!anchor) {
      setCaret((c) => ({ ...c, visible: false }));
      return;
    }

    const cr = container.getBoundingClientRect();
    const er = anchor.getBoundingClientRect();
    const left = Math.round(er.left - cr.left + container.scrollLeft);
    const top = Math.round(er.top - cr.top + container.scrollTop);
    const height = Math.max(1, er.height);

    setCaret({
      left,
      top,
      height,
      visible: height > 0 && er.width >= 0,
    });
  }, [cursor, passage.length]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => updateCaret());
    return () => cancelAnimationFrame(id);
  }, [updateCaret, passage, cursor, errorStack]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => updateCaret());
    });
    ro.observe(el);
    window.addEventListener("resize", updateCaret);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateCaret);
    };
  }, [updateCaret]);

  return (
    <div className="typing-passage-wrap mx-auto w-full max-w-[min(76ch,100%-1.5rem)] px-3 py-8 sm:px-6">
      <div
        ref={containerRef}
        className="tt-passage-text font-mono"
        aria-live="polite"
        aria-label="Typing passage"
      >
        {content}
        <div
          aria-hidden
          className={`tt-caret-overlay pointer-events-none ${reduce ? "" : "tt-caret-overlay--motion tt-caret-blink"}`}
          style={{
            left: caret.left,
            top: caret.top,
            height: caret.height,
            opacity: caret.visible ? 1 : 0,
            visibility: caret.visible ? "visible" : "hidden",
          }}
        />
      </div>
    </div>
  );
}

/**
 * @param {string} passage
 * @param {number} cursor
 * @param {string} errorStack
 * @param {(el: HTMLSpanElement | null) => void} setCurrentRef
 * @param {React.MutableRefObject<HTMLSpanElement | null>} eofRef
 */
function buildWordNodes(
  passage,
  cursor,
  errorStack,
  setCurrentRef,
  eofRef,
) {
  const parts = splitPassageWords(passage);
  const activeWi = findActiveWordPartIndex(parts, cursor);

  /** @type {React.ReactNode[]} */
  const wordNodes = [];

  let insertedAtCursor = false;

  for (let wi = 0; wi < parts.length; wi++) {
    const { text, globalStart } = parts[wi];
    const isSpace = /^\s+$/.test(text);
    const isActive = wi === activeWi && !isSpace;

    /** @type {React.ReactNode[]} */
    const inner = [];

    for (let o = 0; o < text.length; o++) {
      const gi = globalStart + o;
      const ch = text[o];

      if (gi < cursor) {
        inner.push(
          <TypingChar
            key={`${wi}-${o}-c`}
            ch={ch}
            state="correct"
            id={`c-${gi}`}
          />,
        );
      } else if (gi === cursor) {
        for (let e = 0; e < errorStack.length; e++) {
          inner.push(
            <TypingChar
              key={`${wi}-${o}-e${e}`}
              ch={errorStack[e]}
              state="error"
              id={`err-${e}`}
            />,
          );
        }
        if (gi < passage.length) {
          inner.push(
            <TypingChar
              key={`${wi}-${o}-cur`}
              ref={setCurrentRef}
              ch={ch}
              state="current"
              id={`cur-${gi}`}
            />,
          );
        }
        insertedAtCursor = true;
      } else {
        inner.push(
          <TypingChar key={`${wi}-${o}-p`} ch={ch} state="pending" id={`p-${gi}`} />,
        );
      }
    }

    if (isSpace) {
      wordNodes.push(
        <span key={`sp-${wi}`} className="tt-space-run">
          {inner}
        </span>,
      );
    } else {
      wordNodes.push(
        <span
          key={`w-${wi}`}
          className={`tt-word ${isActive ? "tt-word--active" : ""}`.trim()}
        >
          {inner}
        </span>,
      );
    }
  }

  /** @type {React.ReactNode[]} */
  const tail = [];
  if (cursor >= passage.length && !insertedAtCursor) {
    for (let e = 0; e < errorStack.length; e++) {
      tail.push(
        <TypingChar
          key={`end-e-${e}`}
          ch={errorStack[e]}
          state="error"
          id={`tail-${e}`}
        />,
      );
    }
    tail.push(
      <span
        key="eof-anchor"
        ref={eofRef}
        className="tt-passage-eof-anchor"
        aria-hidden
      />,
    );
  }

  return (
    <>
      {wordNodes}
      {tail}
    </>
  );
}

export const TypingPassage = memo(TypingPassageInner);
