import { describe, expect, it } from "vitest";
import {
  countOnlineFriends,
  friendsForTab,
  removeFriendById,
  setFriendOnlineState,
  upsertFriend,
} from "./friendsStateHelpers.js";

const baseFriends = [
  { userId: "a", username: "alice", avatarUrl: "/a.png", online: true },
  { userId: "b", username: "bob", avatarUrl: "/b.png", online: false },
];

describe("friendsStateHelpers", () => {
  it("setFriendOnlineState toggles online and lastSeenAt", () => {
    const offline = setFriendOnlineState(baseFriends, "a", false, "2026-01-01T00:00:00.000Z");
    expect(offline.find((f) => f.userId === "a")?.online).toBe(false);
    expect(offline.find((f) => f.userId === "a")?.lastSeenAt).toBe("2026-01-01T00:00:00.000Z");

    const online = setFriendOnlineState(offline, "a", true, null);
    expect(online.find((f) => f.userId === "a")?.online).toBe(true);
    expect(online.find((f) => f.userId === "a")?.lastSeenAt).toBeNull();
  });

  it("removeFriendById drops matching friend", () => {
    const next = removeFriendById(baseFriends, "a");
    expect(next).toHaveLength(1);
    expect(next[0].userId).toBe("b");
  });

  it("upsertFriend appends or merges friend entry", () => {
    const added = upsertFriend(baseFriends, {
      userId: "c",
      username: "carol",
      avatarUrl: "/c.png",
      online: false,
    });
    expect(added).toHaveLength(3);

    const merged = upsertFriend(added, {
      userId: "c",
      username: "carol2",
      avatarUrl: "/c2.png",
      online: true,
    });
    expect(merged.find((f) => f.userId === "c")?.username).toBe("carol2");
    expect(merged.find((f) => f.userId === "c")?.online).toBe(true);
  });

  it("countOnlineFriends counts only online entries", () => {
    expect(countOnlineFriends(baseFriends)).toBe(1);
  });

  it("friendsForTab filters by tab", () => {
    const state = { friends: baseFriends, pendingReceived: [{}], pendingSent: [{}] };
    expect(friendsForTab("online", state)).toHaveLength(1);
    expect(friendsForTab("all", state)).toHaveLength(2);
    expect(friendsForTab("pending", state)).toEqual([]);
  });
});
