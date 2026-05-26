/**
 * Monkeytype-style line window: keep the caret on a fixed row inside a clipped viewport.
 */

/** @typedef {{ offsetY: number; lineHeightPx: number; lineIndex: number }} LineWindowSnapshot */

/**
 * @param {HTMLElement} passageEl
 * @returns {number}
 */
export function measurePassageLineHeightPx(passageEl) {
  const style = getComputedStyle(passageEl);
  const fontSize = parseFloat(style.fontSize) || 16;
  const lh = style.lineHeight;
  if (lh.endsWith("px")) {
    return parseFloat(lh) || fontSize * 1.75;
  }
  const ratio = parseFloat(lh);
  return Number.isFinite(ratio) ? fontSize * ratio : fontSize * 1.75;
}

/**
 * @param {{
 *   caretTopPx: number;
 *   lineHeightPx: number;
 *   visibleLines?: number;
 *   focusLineIndex?: number;
 *   contentHeightPx: number;
 * }} params
 * @returns {LineWindowSnapshot}
 */
export function computeLineWindowOffsetFromCaretTop({
  caretTopPx,
  lineHeightPx,
  visibleLines = 4,
  focusLineIndex = 0,
  contentHeightPx,
}) {
  if (lineHeightPx <= 0) {
    return { offsetY: 0, lineHeightPx: 0, lineIndex: 0 };
  }

  const lineIndex = Math.max(0, Math.round(caretTopPx / lineHeightPx));
  const viewportHeight = lineHeightPx * visibleLines;
  const rawOffset = Math.max(0, caretTopPx - focusLineIndex * lineHeightPx);
  const maxScroll = Math.max(0, contentHeightPx - viewportHeight);
  const offsetY = Math.min(maxScroll, rawOffset);

  return { offsetY, lineHeightPx, lineIndex };
}

/**
 * @param {{
 *   passageEl: HTMLElement | null;
 *   anchorEl?: HTMLElement | null;
 *   caretTopPx?: number | null;
 *   visibleLines?: number;
 *   focusLineIndex?: number;
 * }} params
 * @returns {LineWindowSnapshot}
 */
export function computeLineWindowOffset({
  passageEl,
  anchorEl = null,
  caretTopPx = null,
  visibleLines = 4,
  focusLineIndex = 0,
}) {
  if (!passageEl) {
    return { offsetY: 0, lineHeightPx: 0, lineIndex: 0 };
  }

  const lineHeightPx = measurePassageLineHeightPx(passageEl);
  const contentHeightPx = passageEl.scrollHeight;

  let topPx = caretTopPx;
  if (topPx == null && anchorEl) {
    const passageRect = passageEl.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    topPx = anchorRect.top - passageRect.top + passageEl.scrollTop;
  }

  if (topPx == null || lineHeightPx <= 0) {
    return { offsetY: 0, lineHeightPx, lineIndex: 0 };
  }

  return computeLineWindowOffsetFromCaretTop({
    caretTopPx: topPx,
    lineHeightPx,
    visibleLines,
    focusLineIndex,
    contentHeightPx,
  });
}
