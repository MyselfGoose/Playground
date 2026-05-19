import { describe, expect, it } from "vitest";
import { buildInviteUrl, normalizePartyCode } from "./buildInviteUrl.js";

describe("normalizePartyCode", () => {
  it("uppercases and strips non-alphanumeric", () => {
    expect(normalizePartyCode(" ab-12 ")).toBe("AB12");
  });
});

describe("buildInviteUrl", () => {
  const origin = "https://play.example.com";

  it("builds join URL with encoded code", () => {
    expect(buildInviteUrl("hangman", "abcd", origin)).toBe(
      "https://play.example.com/games/hangman/join?code=ABCD",
    );
  });

  it("normalizes code in query", () => {
    expect(buildInviteUrl("npat", "12 34 56", origin)).toBe(
      "https://play.example.com/games/npat/join?code=123456",
    );
  });

  it("returns games hub when slug or code missing", () => {
    expect(buildInviteUrl("", "ABCD", origin)).toBe("https://play.example.com/games");
    expect(buildInviteUrl("hangman", "", origin)).toBe("https://play.example.com/games");
  });

  it("uses empty origin when not provided and not in browser", () => {
    expect(buildInviteUrl("taboo", "WXYZ", "")).toBe("/games/taboo/join?code=WXYZ");
  });
});
