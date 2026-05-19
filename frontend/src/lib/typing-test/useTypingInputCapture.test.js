import assert from "node:assert/strict";
import test from "node:test";
import { isTypingCaptureKey } from "./useTypingInputCapture.js";

test("isTypingCaptureKey accepts printable keys and Backspace", () => {
  assert.equal(
    isTypingCaptureKey(/** @type {any} */ ({ key: "a", ctrlKey: false, metaKey: false, altKey: false })),
    true,
  );
  assert.equal(
    isTypingCaptureKey(
      /** @type {any} */ ({ key: "Backspace", ctrlKey: false, metaKey: false, altKey: false }),
    ),
    true,
  );
});

test("isTypingCaptureKey rejects Tab and modified keys", () => {
  assert.equal(
    isTypingCaptureKey(/** @type {any} */ ({ key: "Tab", ctrlKey: false, metaKey: false, altKey: false })),
    false,
  );
  assert.equal(
    isTypingCaptureKey(/** @type {any} */ ({ key: "a", ctrlKey: true, metaKey: false, altKey: false })),
    false,
  );
});
