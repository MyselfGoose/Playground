"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  computeLineWindowOffset,
  measurePassageLineHeightPx,
} from "../../lib/typing-test/usePassageLineWindow.js";
import { useViewportLineConfig } from "../../lib/typing-test/useViewportLineConfig.js";

/**
 * @typedef {{ top: number; height: number; lineHeightPx: number }} CaretLayoutSnapshot
 */

/**
 * Fixed-height typing window with inner line scroll (Monkeytype-style).
 *
 * @param {{
 *   children: import('react').ReactNode;
 *   cursor: number;
 *   active?: boolean;
 *   caretAnchorRef?: React.RefObject<HTMLElement | null>;
 *   passageContainerRef?: React.RefObject<HTMLElement | null>;
 *   caretLayoutRef?: React.MutableRefObject<CaretLayoutSnapshot | null>;
 *   visibleLines?: number;
 *   focusLineIndex?: number;
 *   className?: string;
 *   onOffsetChange?: (offsetY: number) => void;
 * }} props
 */
export function TypingViewport({
  children,
  cursor,
  active = true,
  caretAnchorRef,
  passageContainerRef,
  caretLayoutRef,
  visibleLines: visibleLinesProp,
  focusLineIndex: focusLineIndexProp,
  className = "",
  onOffsetChange,
}) {
  const responsive = useViewportLineConfig();
  const visibleLines = visibleLinesProp ?? responsive.visibleLines;
  const focusLineIndex = focusLineIndexProp ?? responsive.focusLineIndex;

  const reduce = useReducedMotion();
  const viewportRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const innerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [offsetY, setOffsetY] = useState(0);
  const [showFade, setShowFade] = useState(false);
  const lastOffsetRef = useRef(0);

  useLayoutEffect(() => {
    if (!active) {
      setOffsetY(0);
      setShowFade(false);
      return;
    }

    const passageEl = passageContainerRef?.current;
    const anchorEl = caretAnchorRef?.current;
    const caretTopPx = caretLayoutRef?.current?.top;

    const measure = () => {
      const { offsetY: next, lineHeightPx } = computeLineWindowOffset({
        passageEl,
        anchorEl,
        caretTopPx: caretTopPx ?? null,
        visibleLines,
        focusLineIndex,
      });

      setOffsetY(next);
      if (next !== lastOffsetRef.current) {
        lastOffsetRef.current = next;
        onOffsetChange?.(next);
      }

      if (viewportRef.current && passageEl && lineHeightPx > 0) {
        const viewportHeight = lineHeightPx * visibleLines;
        viewportRef.current.style.setProperty(
          "--tt-line-height-px",
          `${lineHeightPx}px`,
        );
        viewportRef.current.style.setProperty(
          "--tt-visible-lines",
          String(visibleLines),
        );
        setShowFade(passageEl.scrollHeight > viewportHeight + 2);
      }
    };

    measure();
    const id = requestAnimationFrame(measure);

    const passage = passageEl;
    if (passage && typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => measure());
      ro.observe(passage);
      return () => {
        cancelAnimationFrame(id);
        ro.disconnect();
      };
    }

    return () => cancelAnimationFrame(id);
  }, [
    active,
    cursor,
    caretAnchorRef,
    passageContainerRef,
    caretLayoutRef,
    visibleLines,
    focusLineIndex,
    onOffsetChange,
  ]);

  return (
    <div
      ref={viewportRef}
      className={`tt-viewport ${active ? "tt-viewport--active" : ""} ${className}`.trim()}
      data-typing-viewport={active ? "true" : "false"}
      style={{
        // @ts-expect-error CSS variables
        "--tt-visible-lines": visibleLines,
      }}
    >
      <div
        ref={innerRef}
        className={`tt-viewport-inner ${reduce ? "" : "tt-viewport-inner--motion"}`}
        style={{ transform: `translateY(${-offsetY}px)` }}
      >
        {children}
      </div>
      {showFade ? <div className="tt-viewport-fade" aria-hidden /> : null}
    </div>
  );
}

export { measurePassageLineHeightPx };
