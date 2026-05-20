import { describe, expect, it } from "vitest";
import {
  mapConnectionError,
  mapConnectionErrorMessage,
  resolveConnectionError,
} from "./mapConnectionError.js";

describe("resolveConnectionError", () => {
  it("maps ROOM_EXPIRED with create_room and leave actions", () => {
    const r = resolveConnectionError("npat", { code: "ROOM_EXPIRED" });
    expect(r.code).toBe("ROOM_EXPIRED");
    expect(r.message).toMatch(/party ended/i);
    expect(r.recoverable).toBe(true);
    expect(r.actions).toEqual(["create_room", "leave"]);
  });

  it("maps ROOM_NOT_FOUND by nested ack error shape", () => {
    const r = resolveConnectionError("typing-race", {
      error: { code: "ROOM_NOT_FOUND", message: "Room not found" },
    });
    expect(r.code).toBe("ROOM_NOT_FOUND");
    expect(r.message).toMatch(/party code/i);
    expect(r.actions).toContain("create_room");
  });

  it("maps session errors to sign_in action", () => {
    const err = new Error("Session revoked");
    err.code = "SESSION_REVOKED";
    const r = resolveConnectionError("npat", err);
    expect(r.actions).toEqual(["sign_in"]);
    expect(r.message).toMatch(/sign in/i);
  });

  it("maps timeout phase with retry", () => {
    const r = resolveConnectionError("hangman", null, { phase: "timeout" });
    expect(r.code).toBe("TIMEOUT");
    expect(r.actions).toEqual(["retry"]);
  });
});

describe("mapConnectionErrorMessage", () => {
  it("returns message string only", () => {
    expect(mapConnectionErrorMessage("npat", { code: "ROOM_EXPIRED" })).toMatch(
      /party ended/i,
    );
  });
});

describe("mapConnectionError", () => {
  it("returns structured result", () => {
    const r = mapConnectionError("cah", "connection refused");
    expect(r).toHaveProperty("message");
    expect(r).toHaveProperty("code");
    expect(Array.isArray(r.actions)).toBe(true);
  });

  it("maps xhr poll and websocket transport errors to friendly copy", () => {
    const r = mapConnectionError("npat", "xhr poll error");
    expect(r.code).toBe("CONNECT_FAILED");
    expect(r.message).toMatch(/lost the connection/i);
    expect(r.message).not.toMatch(/xhr poll/i);
  });
});
