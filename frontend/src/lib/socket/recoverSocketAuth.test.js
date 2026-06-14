import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

const mockCoordinatedRefresh = vi.fn().mockResolvedValue(undefined);
vi.mock("../session/coordinatedRefresh.js", () => ({
  coordinatedRefresh: (...args) => mockCoordinatedRefresh(...args),
}));

const { recoverSocketAuthAfterHandshakeFailure } = await import("./recoverSocketAuth.js");

describe("recoverSocketAuthAfterHandshakeFailure", () => {
  beforeEach(() => {
    mockCoordinatedRefresh.mockClear();
  });

  it("refreshes auth, updates socket.auth, and calls connect when disconnected", async () => {
    const apiFetch = vi.fn();
    const admission = vi.fn().mockResolvedValue("new-tok");
    const connect = vi.fn();
    const socket = {
      connected: false,
      connect,
      auth: {},
    };
    await recoverSocketAuthAfterHandshakeFailure(socket, apiFetch, admission);
    expect(mockCoordinatedRefresh).toHaveBeenCalledTimes(1);
    expect(socket.auth.token).toBe("new-tok");
    expect(connect).toHaveBeenCalled();
  });

  it("disconnects and reconnects when already connected to force a fresh handshake", async () => {
    const apiFetch = vi.fn();
    const admission = vi.fn().mockResolvedValue("t2");
    const disconnect = vi.fn();
    const connect = vi.fn();
    const socket = { connected: true, disconnect, connect, auth: {} };
    await recoverSocketAuthAfterHandshakeFailure(socket, apiFetch, admission);
    expect(disconnect).toHaveBeenCalled();
    expect(connect).toHaveBeenCalled();
  });

  describe("debounce window", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("debounces rapid failures and runs a trailing recovery after the window", async () => {
      const apiFetch = vi.fn();
      const admission = vi.fn().mockResolvedValue("tok");
      const socket = { connected: false, connect: vi.fn(), auth: {} };

      const first = recoverSocketAuthAfterHandshakeFailure(socket, apiFetch, admission);
      const second = recoverSocketAuthAfterHandshakeFailure(socket, apiFetch, admission);
      await Promise.all([first, second]);
      expect(mockCoordinatedRefresh).toHaveBeenCalledTimes(1);

      await vi.runAllTimersAsync();
      expect(mockCoordinatedRefresh).toHaveBeenCalledTimes(2);
    });
  });
});
