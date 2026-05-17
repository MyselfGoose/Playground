import { describe, it, expect, vi } from "vitest";
import {
  dispatchSessionInvalidated,
  isSocketAuthErrorMessage,
  registerSocketTeardown,
  socketAuthUserMessage,
} from "./sessionInvalidation.js";

describe("sessionInvalidation", () => {
  it("isSocketAuthErrorMessage recognizes socket auth codes", () => {
    expect(isSocketAuthErrorMessage("UNAUTHENTICATED")).toBe(true);
    expect(isSocketAuthErrorMessage("SESSION_REVOKED")).toBe(true);
    expect(isSocketAuthErrorMessage("CONNECT_ERROR")).toBe(false);
  });

  it("socketAuthUserMessage never returns raw UNAUTHENTICATED", () => {
    expect(socketAuthUserMessage("UNAUTHENTICATED")).toBe("Please sign in to continue.");
    expect(socketAuthUserMessage("SESSION_REVOKED")).toContain("session ended");
  });

  it("dispatchSessionInvalidated runs registered socket teardowns", () => {
    const teardown = vi.fn();
    const unsub = registerSocketTeardown(teardown);
    dispatchSessionInvalidated("test");
    expect(teardown).toHaveBeenCalledWith("test");
    unsub();
  });
});
