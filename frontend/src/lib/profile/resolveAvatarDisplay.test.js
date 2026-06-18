import { describe, expect, it } from "vitest";
import { resolveAvatarDisplay } from "./resolveAvatarDisplay.js";

describe("resolveAvatarDisplay", () => {
  it("prefers emoji over image URL", () => {
    expect(
      resolveAvatarDisplay({
        avatarUrl: "https://example.com/a.webp",
        avatarEmoji: "🎮",
      }),
    ).toEqual({ src: null, emoji: "🎮" });
  });

  it("returns image when no emoji", () => {
    expect(
      resolveAvatarDisplay({
        avatarUrl: "https://example.com/a.webp",
      }),
    ).toEqual({ src: "https://example.com/a.webp", emoji: null });
  });

  it("returns nulls when empty", () => {
    expect(resolveAvatarDisplay({})).toEqual({ src: null, emoji: null });
  });
});
