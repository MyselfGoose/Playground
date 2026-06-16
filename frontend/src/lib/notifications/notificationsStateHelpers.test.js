import { describe, expect, it } from "vitest";
import {
  countUnreadInvites,
  inviteStatusLabel,
  isUnreadInvite,
  markInvitesRead,
  partitionInvites,
} from "./notificationsStateHelpers.js";

describe("notificationsStateHelpers", () => {
  const pendingUnread = {
    id: "1",
    gameSlug: "hangman",
    roomCode: "ABCD",
    status: "pending",
    readAt: null,
    gameTitle: "Hangman",
    gameEmoji: "🪢",
    inviter: { userId: "u1", username: "alice", avatarUrl: "" },
    joinPath: "/games/hangman/join?code=ABCD",
  };

  const pendingRead = {
    ...pendingUnread,
    id: "2",
    readAt: "2026-01-01T00:00:00.000Z",
  };

  const declined = {
    ...pendingUnread,
    id: "3",
    status: "declined",
    readAt: "2026-01-01T00:00:00.000Z",
  };

  it("partitions unread and earlier sections", () => {
    const { unread, earlier } = partitionInvites([pendingUnread, pendingRead, declined]);
    expect(unread).toHaveLength(1);
    expect(unread[0].id).toBe("1");
    expect(earlier).toHaveLength(2);
  });

  it("counts unread pending invites", () => {
    expect(countUnreadInvites([pendingUnread, pendingRead])).toBe(1);
    expect(isUnreadInvite(pendingUnread)).toBe(true);
    expect(isUnreadInvite(pendingRead)).toBe(false);
  });

  it("marks pending invites as read", () => {
    const next = markInvitesRead([pendingUnread, pendingRead]);
    expect(next.every((i) => i.readAt)).toBe(true);
  });

  it("maps status labels", () => {
    expect(inviteStatusLabel("accepted")).toBe("Joined");
    expect(inviteStatusLabel("pending")).toBeNull();
  });
});
