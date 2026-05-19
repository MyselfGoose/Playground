import { describe, expect, it } from "vitest";
import { computeKeyboardOffset } from "./useVisualViewportKeyboard.js";

describe("computeKeyboardOffset", () => {
  it("returns 0 when visualViewport is missing", () => {
    expect(computeKeyboardOffset(null, 800)).toBe(0);
    expect(computeKeyboardOffset(undefined, 800)).toBe(0);
  });

  it("returns 0 when keyboard is closed (viewport fills window)", () => {
    expect(
      computeKeyboardOffset({ height: 800, offsetTop: 0 }, 800),
    ).toBe(0);
  });

  it("returns positive offset when keyboard reduces visible viewport", () => {
    expect(
      computeKeyboardOffset({ height: 450, offsetTop: 0 }, 800),
    ).toBe(350);
  });

  it("accounts for visualViewport offsetTop", () => {
    expect(
      computeKeyboardOffset({ height: 500, offsetTop: 50 }, 800),
    ).toBe(250);
  });

  it("never returns negative values", () => {
    expect(
      computeKeyboardOffset({ height: 900, offsetTop: 0 }, 800),
    ).toBe(0);
  });
});
