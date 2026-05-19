import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useConnectionBannerState } from "./useConnectionBannerState.js";

describe("useConnectionBannerState", () => {
  it("hides banner when connected with no error", () => {
    const { result } = renderHook(() =>
      useConnectionBannerState({ game: "hangman", connected: true }),
    );
    expect(result.current.visible).toBe(false);
    expect(result.current.state).toBe("live");
  });

  it("shows connecting when disconnected without error", () => {
    const { result } = renderHook(() =>
      useConnectionBannerState({ game: "npat", connected: false }),
    );
    expect(result.current.visible).toBe(true);
    expect(result.current.message).toBe("Joining party…");
  });

  it("shows session-ended for SESSION_EXPIRED code", () => {
    const { result } = renderHook(() =>
      useConnectionBannerState({
        game: "cah",
        connected: false,
        socketErrorCode: "SESSION_EXPIRED",
        socketError: "Please sign in again",
      }),
    );
    expect(result.current.state).toBe("session-ended");
    expect(result.current.actions).toContain("sign_in");
  });

  it("shows reconnecting from connectionState", () => {
    const { result } = renderHook(() =>
      useConnectionBannerState({
        game: "taboo",
        connected: false,
        connectionState: "reconnecting",
      }),
    );
    expect(result.current.state).toBe("reconnecting");
    expect(result.current.message).toBe("Back in a sec…");
  });
});
