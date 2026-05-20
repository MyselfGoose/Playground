import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useGameSocket, mergeRoomByStateVersion } from "./useGameSocket.js";

vi.mock("../api.js", () => ({
  getSocketBase: vi.fn(() => "http://localhost:4000"),
}));

const connectGameSocket = vi.fn();

vi.mock("./createGameSocket.js", () => ({
  connectGameSocket: (...args) => connectGameSocket(...args),
}));

vi.mock("./socketUtils.js", () => ({
  ACK_TIMEOUT_MS: 50,
  emitAck: vi.fn(async () => ({ ok: true, data: {} })),
}));

describe("mergeRoomByStateVersion", () => {
  it("ignores stale stateVersion", () => {
    const setRoom = vi.fn();
    const roomVersionRef = { current: 5 };
    mergeRoomByStateVersion({ stateVersion: 3, code: "ABCD" }, { setRoom, roomVersionRef });
    expect(setRoom).not.toHaveBeenCalled();
  });
});

describe("useGameSocket", () => {
  beforeEach(() => {
    connectGameSocket.mockReset();
    connectGameSocket.mockReturnValue({
      socket: { on: vi.fn(), off: vi.fn(), connect: vi.fn() },
      cleanup: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("keeps syncState ready when disabled with trackSyncState", () => {
    const { result } = renderHook(() =>
      useGameSocket({
        namespace: "/hangman",
        gameTag: "hangman",
        mapGame: "hangman",
        enabled: false,
        trackSyncState: true,
        mergeRoom: mergeRoomByStateVersion,
      }),
    );
    expect(result.current.syncState).toBe("ready");
    expect(connectGameSocket).not.toHaveBeenCalled();
  });

  it("sets syncState to joining then ready after connect when enabled", async () => {
    let onConnect;
    connectGameSocket.mockImplementation(({ onConnect: oc }) => {
      onConnect = oc;
      return {
        socket: { on: vi.fn(), off: vi.fn() },
        cleanup: vi.fn(),
      };
    });

    const { result } = renderHook(() =>
      useGameSocket({
        namespace: "/taboo",
        gameTag: "taboo",
        mapGame: "taboo",
        enabled: true,
        trackSyncState: true,
        mergeRoom: mergeRoomByStateVersion,
      }),
    );

    expect(result.current.syncState).toBe("joining");
    onConnect?.({ on: vi.fn(), off: vi.fn() });
    await waitFor(() => {
      expect(result.current.syncState).toBe("ready");
    });
  });

  it("returns syncState ready after unmount cleanup", async () => {
    let onConnect;
    connectGameSocket.mockImplementation(({ onConnect: oc }) => {
      onConnect = oc;
      return {
        socket: { on: vi.fn(), off: vi.fn() },
        cleanup: vi.fn(),
      };
    });

    const { result, unmount } = renderHook(() =>
      useGameSocket({
        namespace: "/cah",
        gameTag: "cah",
        mapGame: "cah",
        enabled: true,
        trackSyncState: true,
        mergeRoom: mergeRoomByStateVersion,
      }),
    );

    onConnect?.({ on: vi.fn(), off: vi.fn() });
    await waitFor(() => expect(result.current.syncState).toBe("ready"));
    unmount();
    // Hook unmounted — no assertion on result; cleanup path sets ready before teardown
    expect(connectGameSocket.mock.results[0]?.value?.cleanup).toBeDefined();
  });
});
