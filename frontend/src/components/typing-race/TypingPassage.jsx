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
 * @param {{
 *   passage: string;
 *   cursor: number;
 *   errorStack: string;
 *   peerCursors?: Array<{ userId: string; displayName: string; color?: string; cursorDisplay?: number; finishedAtMs?: number | null }>;
 * }} props
 */
function TypingPassageInner({ passage, cursor, errorStack, peerCursors }) {
  const reduce = useReducedMotion();
  const containerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const currentCharRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const eofRef = useRef(/** @type {HTMLSpanElement | null} */ (null));
  const charRefsMap = useRef(/** @type {Map<number, HTMLSpanElement>} */ (new Map()));

  const [caret, setCaret] = useState(
    /** @type {{ left: number; top: number; height: number; visible: boolean }} */ ({
      left: 0,
      top: 0,
      height: 0,
      visible: false,
    }),
  );

  const [peerCarets, setPeerCarets] = useState(
    /** @type {Array<{ userId: string; displayName: string; color: string; left: number; top: number; height: number; visible: boolean }>} */ ([]),
  );

  const setCurrentRef = useCallback((el) => {
    currentCharRef.current = el;
  }, []);

  const registerCharRef = useCallback((gi, el) => {
    if (el) {
      charRefsMap.current.set(gi, el);
    } else {
      charRefsMap.current.delete(gi);
    }
  }, []);

  const hasPeers = Array.isArray(peerCursors) && peerCursors.length > 0;

  const content = useMemo(
    () =>
      buildWordNodes(
        passage,
        cursor,
        errorStack,
        setCurrentRef,
        eofRef,
        hasPeers ? registerCharRef : null,
      ),
    [passage, cursor, errorStack, setCurrentRef, hasPeers, registerCharRef],
  );

  const updateCaret = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
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

  const updatePeerCarets = useCallback(() => {
    const container = containerRef.current;
    if (!container || !hasPeers) {
      setPeerCarets([]);
      return;
    }
    const cr = container.getBoundingClientRect();
    const result = [];
    for (const peer of peerCursors) {
      if (peer.finishedAtMs != null) continue;
      const gi = peer.cursorDisplay ?? 0;
      const el = charRefsMap.current.get(gi) ?? charRefsMap.current.get(gi - 1);
      if (!el) continue;
      const er = el.getBoundingClientRect();
      const left = Math.round(er.left - cr.left + container.scrollLeft);
      const top = Math.round(er.top - cr.top + container.scrollTop);
      const height = Math.max(1, er.height);
      result.push({
        userId: peer.userId,
        displayName: peer.displayName,
        color: peer.color ?? "var(--tt-accent-soft)",
        left,
        top,
        height,
        visible: height > 0,
      });
    }
    setPeerCarets(result);
  }, [hasPeers, peerCursors]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      updateCaret();
      updatePeerCarets();
    });
    return () => cancelAnimationFrame(id);
  }, [updateCaret, updatePeerCarets, passage, cursor, errorStack, peerCursors]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        updateCaret();
        updatePeerCarets();
      });
    });
    ro.observe(el);
    const onResize = () => {
      updateCaret();
      updatePeerCarets();
    };
    window.addEventListener("resize", onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [updateCaret, updatePeerCarets]);

  return (
    <div className="typing-passage-wrap mx-auto w-full max-w-[min(76ch,100%-1.5rem)] px-3 py-8 sm:px-6">
      <div
        ref={containerRef}
        className="tt-passage-text font-mono"
        aria-live="polite"
        aria-label="Typing passage"
      >
        {content}
        {/* Self caret */}
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
        {/* Peer carets */}
        {peerCarets.map((pc) => (
          <div
            key={pc.userId}
            aria-hidden
            className="tt-peer-caret pointer-events-none"
            style={{
              left: pc.left,
              top: pc.top,
              height: pc.height,
              opacity: pc.visible ? 1 : 0,
              visibility: pc.visible ? "visible" : "hidden",
              "--peer-color": pc.color,
            }}
          >
            <span className="tt-peer-caret-label">{pc.displayName}</span>
          </div>
        ))}
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
 * @param {((gi: number, el: HTMLSpanElement | null) => void) | null} registerCharRef
 */
function buildWordNodes(
  passage,
  cursor,
  errorStack,
  setCurrentRef,
  eofRef,
  registerCharRef,
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

      const charRef = registerCharRef
        ? (el) => registerCharRef(gi, el)
        : undefined;

      if (gi < cursor) {
        inner.push(
          <TypingChar
            key={`${wi}-${o}-c`}
            ref={charRef}
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
              ref={(el) => {
                setCurrentRef(el);
                if (registerCharRef) registerCharRef(gi, el);
              }}
              ch={ch}
              state="current"
              id={`cur-${gi}`}
            />,
          );
        }
        insertedAtCursor = true;
      } else {
        inner.push(
          <TypingChar
            key={`${wi}-${o}-p`}
            ref={charRef}
            ch={ch}
            state="pending"
            id={`p-${gi}`}
          />,
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
