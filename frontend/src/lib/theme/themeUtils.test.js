import { describe, it, expect } from "vitest";
import { resolveTheme } from "./themeUtils.js";

describe("resolveTheme", () => {
  it("prefers explicit stored theme", () => {
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
  });

  it("falls back to system preference when stored is null", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
  });
});
