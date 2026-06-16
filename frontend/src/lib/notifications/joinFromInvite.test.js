import { describe, expect, it } from "vitest";
import { buildInviteJoinPath } from "../party/gameSlugMeta.js";

describe("joinFromInvite paths", () => {
  it("builds standard join paths", () => {
    expect(buildInviteJoinPath("hangman", "abcd")).toBe("/games/hangman/join?code=ABCD");
    expect(buildInviteJoinPath("cah", "1234")).toBe("/games/cah/join?code=1234");
  });

  it("builds npat lobby path", () => {
    expect(buildInviteJoinPath("npat", "1234")).toBe("/games/npat/lobby?code=1234");
  });

  it("builds typing race join redirect path", () => {
    expect(buildInviteJoinPath("typing-race", "123456")).toBe(
      "/games/typing-race/join?code=123456",
    );
  });
});
