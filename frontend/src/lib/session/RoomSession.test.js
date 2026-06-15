import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearLastRoomCode,
  findAnyLastRoomCode,
  persistLastRoomCode,
} from "./RoomSession.js";

describe("RoomSession", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("findAnyLastRoomCode returns scoped code without userId", () => {
    persistLastRoomCode("taboo", "ABCD", "user-1");
    expect(findAnyLastRoomCode("taboo")).toBe("ABCD");
  });

  it("findAnyLastRoomCode ignores other games", () => {
    persistLastRoomCode("cah", "WXYZ", "user-1");
    expect(findAnyLastRoomCode("taboo")).toBeNull();
  });

  it("clearLastRoomCode removes scoped entry", () => {
    persistLastRoomCode("taboo", "ABCD", "user-1");
    clearLastRoomCode("taboo", "user-1");
    expect(findAnyLastRoomCode("taboo")).toBeNull();
  });
});
