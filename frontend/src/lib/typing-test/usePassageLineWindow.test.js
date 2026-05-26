import assert from "node:assert/strict";
import test from "node:test";
import {
  computeLineWindowOffset,
  computeLineWindowOffsetFromCaretTop,
} from "./usePassageLineWindow.js";

test("computeLineWindowOffsetFromCaretTop keeps line 0 at top with zero offset", () => {
  const result = computeLineWindowOffsetFromCaretTop({
    caretTopPx: 0,
    lineHeightPx: 28,
    visibleLines: 4,
    focusLineIndex: 0,
    contentHeightPx: 500,
  });
  assert.equal(result.offsetY, 0);
  assert.equal(result.lineIndex, 0);
});

test("computeLineWindowOffsetFromCaretTop scrolls line 1 to top", () => {
  const lineHeightPx = 28;
  const result = computeLineWindowOffsetFromCaretTop({
    caretTopPx: lineHeightPx,
    lineHeightPx,
    visibleLines: 4,
    focusLineIndex: 0,
    contentHeightPx: 500,
  });
  assert.equal(result.offsetY, lineHeightPx);
  assert.equal(result.lineIndex, 1);
});

test("computeLineWindowOffsetFromCaretTop scrolls line 5 to top", () => {
  const lineHeightPx = 28;
  const result = computeLineWindowOffsetFromCaretTop({
    caretTopPx: lineHeightPx * 5,
    lineHeightPx,
    visibleLines: 4,
    focusLineIndex: 0,
    contentHeightPx: 500,
  });
  assert.equal(result.offsetY, lineHeightPx * 5);
});

test("computeLineWindowOffset clamps at max scroll", () => {
  const lineHeightPx = 28;
  const visibleLines = 4;
  const contentHeightPx = 400;
  const result = computeLineWindowOffsetFromCaretTop({
    caretTopPx: 350,
    lineHeightPx,
    visibleLines,
    focusLineIndex: 0,
    contentHeightPx,
  });
  const maxScroll = Math.max(0, contentHeightPx - lineHeightPx * visibleLines);
  assert.equal(result.offsetY, maxScroll);
});

test("computeLineWindowOffset returns zero when passage element missing", () => {
  assert.deepEqual(computeLineWindowOffset({ passageEl: null }), {
    offsetY: 0,
    lineHeightPx: 0,
    lineIndex: 0,
  });
});
