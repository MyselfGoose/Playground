import { describe, expect, it } from "vitest";
import { BOARD_PATHS } from "./useLeaderboard.js";

describe("useLeaderboard board mapping", () => {
  it("includes taboo board endpoint mapping", () => {
    expect(BOARD_PATHS.taboo).toBe("/api/v1/leaderboard/taboo");
  });

  it("includes CAH board endpoint mapping", () => {
    expect(BOARD_PATHS.cah).toBe("/api/v1/leaderboard/cah");
  });
});
