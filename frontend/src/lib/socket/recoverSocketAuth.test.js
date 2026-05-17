import { describe, it, expect, vi } from "vitest";
import { recoverSocketAuthAfterHandshakeFailure } from "./recoverSocketAuth.js";

describe("recoverSocketAuthAfterHandshakeFailure", () => {
  it("refreshes auth, updates socket.auth, and calls connect when disconnected", async () => {
    const apiFetch = vi.fn().mockResolvedValue({});
    const admission = vi.fn().mockResolvedValue("new-tok");
    const connect = vi.fn();
    const socket = {
      connected: false,
      connect,
      auth: {},
    };
    await recoverSocketAuthAfterHandshakeFailure(socket, apiFetch, admission);
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/auth/refresh", { method: "POST" });
    expect(socket.auth.token).toBe("new-tok");
    expect(connect).toHaveBeenCalled();
  });

  it("disconnects and reconnects when already connected to force a fresh handshake", async () => {
    const apiFetch = vi.fn().mockResolvedValue({});
    const admission = vi.fn().mockResolvedValue("t2");
    const disconnect = vi.fn();
    const connect = vi.fn();
    const socket = { connected: true, disconnect, connect, auth: {} };
    await recoverSocketAuthAfterHandshakeFailure(socket, apiFetch, admission);
    expect(disconnect).toHaveBeenCalled();
    expect(connect).toHaveBeenCalled();
  });
});
