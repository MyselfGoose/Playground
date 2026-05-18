import { describe, expect, it } from "vitest";
import { mapConnectionError } from "./mapConnectionError.js";

describe("mapConnectionError", () => {
  it("maps ROOM_EXPIRED by error code", () => {
    expect(mapConnectionError("npat", { code: "ROOM_EXPIRED" })).toMatch(
      /no longer available/i,
    );
  });

  it("maps ROOM_NOT_FOUND by nested ack error shape", () => {
    expect(
      mapConnectionError("typing-race", {
        error: { code: "ROOM_NOT_FOUND", message: "Room not found" },
      }),
    ).toMatch(/could not find that room/i);
  });

  it("maps ROOM_EXPIRED on Error with code property", () => {
    const err = new Error("Room not found");
    err.code = "ROOM_EXPIRED";
    expect(mapConnectionError("npat", err)).toMatch(/no longer available/i);
  });
});
