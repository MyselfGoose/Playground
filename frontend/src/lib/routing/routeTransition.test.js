import { describe, it, expect } from "vitest";
import { shouldAnimateRouteTransition } from "./routeTransition.js";

describe("shouldAnimateRouteTransition", () => {
  it("animates marketing routes", () => {
    expect(shouldAnimateRouteTransition("/")).toBe(true);
    expect(shouldAnimateRouteTransition("/login")).toBe(true);
    expect(shouldAnimateRouteTransition("/games")).toBe(true);
    expect(shouldAnimateRouteTransition("/profile/user-1")).toBe(true);
  });

  it("skips play, lobby, and multi routes", () => {
    expect(shouldAnimateRouteTransition("/games/npat/play")).toBe(false);
    expect(shouldAnimateRouteTransition("/games/taboo/lobby")).toBe(false);
    expect(shouldAnimateRouteTransition("/games/typing-race/multi")).toBe(false);
    expect(shouldAnimateRouteTransition("/games/typing-race/multi/room/1234")).toBe(false);
  });

  it("skips game entry routes", () => {
    expect(shouldAnimateRouteTransition("/games/npat")).toBe(false);
    expect(shouldAnimateRouteTransition("/feedback")).toBe(false);
  });
});
