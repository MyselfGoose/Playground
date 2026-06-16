"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiFetch, getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { connectGameSocket } from "../socket/createGameSocket.js";
import {
  countOnlineFriends,
  removeFriendById,
  setFriendOnlineState,
  upsertFriend,
} from "./friendsStateHelpers.js";

/** @typedef {{ userId: string, username: string, avatarUrl: string, online: boolean, lastSeenAt?: string | null }} FriendEntry */
/** @typedef {{ id: string, from: { userId: string, username: string, avatarUrl: string }, createdAt: string }} PendingReceived */
/** @typedef {{ id: string, to: { userId: string, username: string, avatarUrl: string }, status: 'pending'|'declined', createdAt: string, respondedAt?: string | null }} PendingSent */

const FriendsContext = createContext(null);

const EMPTY_SUMMARY = {
  friends: /** @type {FriendEntry[]} */ ([]),
  pending: {
    received: /** @type {PendingReceived[]} */ ([]),
    sent: /** @type {PendingSent[]} */ ([]),
  },
  counts: { online: 0, pendingReceived: 0 },
};

export function FriendsProvider({ children }) {
  const { user, loading } = useUser();
  const [friends, setFriends] = useState(/** @type {FriendEntry[]} */ ([]));
  const [pendingReceived, setPendingReceived] = useState(/** @type {PendingReceived[]} */ ([]));
  const [pendingSent, setPendingSent] = useState(/** @type {PendingSent[]} */ ([]));
  const [onlineCount, setOnlineCount] = useState(0);
  const [pendingReceivedCount, setPendingReceivedCount] = useState(0);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [friendsError, setFriendsError] = useState(/** @type {string | null} */ (null));
  const socketCleanupRef = useRef(/** @type {(() => void) | null} */ (null));

  const applySummary = useCallback((summary) => {
    setFriends(summary.friends ?? []);
    setPendingReceived(summary.pending?.received ?? []);
    setPendingSent(summary.pending?.sent ?? []);
    setOnlineCount(summary.counts?.online ?? countOnlineFriends(summary.friends ?? []));
    setPendingReceivedCount(summary.counts?.pendingReceived ?? (summary.pending?.received?.length ?? 0));
  }, []);

  const refreshFriends = useCallback(async () => {
    if (!user?.id) return;
    setLoadingFriends(true);
    setFriendsError(null);
    try {
      const res = await apiFetch("/api/v1/friends/summary");
      applySummary(res?.data ?? EMPTY_SUMMARY);
    } catch (e) {
      setFriendsError(e instanceof ApiError ? e.user_message || e.message : "Could not load friends");
    } finally {
      setLoadingFriends(false);
    }
  }, [user?.id, applySummary]);

  useEffect(() => {
    if (loading || !user?.id) {
      setFriends([]);
      setPendingReceived([]);
      setPendingSent([]);
      setOnlineCount(0);
      setPendingReceivedCount(0);
      return;
    }
    void refreshFriends();
  }, [loading, user?.id, refreshFriends]);

  useEffect(() => {
    if (loading || !user?.id || !getSocketBase()) return undefined;

    let cancelled = false;

    const { socket, cleanup } = connectGameSocket({
      namespace: "/social",
      gameTag: "social",
      onConnect: () => {
        if (!cancelled) void refreshFriends();
      },
      onReconnect: () => {
        if (!cancelled) void refreshFriends();
      },
    });

    const onSnapshot = (payload) => {
      const onlineIds = new Set(
        Array.isArray(payload?.onlineFriendIds) ? payload.onlineFriendIds.map(String) : [],
      );
      setFriends((prev) =>
        prev.map((f) => ({
          ...f,
          online: onlineIds.has(f.userId),
          lastSeenAt: onlineIds.has(f.userId) ? null : f.lastSeenAt,
        })),
      );
      setOnlineCount(onlineIds.size);
    };

    const onFriendOnline = (payload) => {
      const userId = String(payload?.userId ?? "");
      if (!userId) return;
      setFriends((prev) => {
        const next = setFriendOnlineState(prev, userId, true, null);
        setOnlineCount(countOnlineFriends(next));
        return next;
      });
    };

    const onFriendOffline = (payload) => {
      const userId = String(payload?.userId ?? "");
      const lastSeenAt = payload?.lastSeenAt ? String(payload.lastSeenAt) : new Date().toISOString();
      if (!userId) return;
      setFriends((prev) => {
        const next = setFriendOnlineState(prev, userId, false, lastSeenAt);
        setOnlineCount(countOnlineFriends(next));
        return next;
      });
    };

    const onRequestReceived = (payload) => {
      const request = payload?.request;
      if (!request?.id) return;
      setPendingReceived((prev) => {
        if (prev.some((r) => r.id === request.id)) return prev;
        return [request, ...prev];
      });
      setPendingReceivedCount((c) => c + 1);
    };

    const onRequestAccepted = (payload) => {
      const friend = payload?.friend;
      if (!friend?.userId) return;
      setPendingReceived((prev) => prev.filter((r) => r.from?.userId !== friend.userId));
      setPendingSent((prev) => prev.filter((s) => s.to?.userId !== friend.userId));
      setFriends((prev) =>
        upsertFriend(prev, {
          userId: friend.userId,
          username: friend.username,
          avatarUrl: friend.avatarUrl,
          online: false,
          lastSeenAt: null,
        }),
      );
      setPendingReceivedCount((c) => Math.max(0, c - 1));
    };

    const onRequestDeclined = (payload) => {
      const requestId = String(payload?.requestId ?? "");
      if (!requestId) return;
      setPendingSent((prev) =>
        prev.map((s) =>
          s.id === requestId ? { ...s, status: "declined", respondedAt: new Date().toISOString() } : s,
        ),
      );
    };

    const onRequestCancelled = (payload) => {
      const requestId = String(payload?.requestId ?? "");
      if (!requestId) return;
      setPendingReceived((prev) => prev.filter((r) => r.id !== requestId));
      setPendingReceivedCount((c) => Math.max(0, c - 1));
    };

    const onFriendRemoved = (payload) => {
      const userId = String(payload?.userId ?? "");
      if (!userId) return;
      setFriends((prev) => {
        const next = removeFriendById(prev, userId);
        setOnlineCount(countOnlineFriends(next));
        return next;
      });
    };

    socket.on("presence_snapshot", onSnapshot);
    socket.on("friend_online", onFriendOnline);
    socket.on("friend_offline", onFriendOffline);
    socket.on("friend_request_received", onRequestReceived);
    socket.on("friend_request_accepted", onRequestAccepted);
    socket.on("friend_request_declined", onRequestDeclined);
    socket.on("friend_request_cancelled", onRequestCancelled);
    socket.on("friend_removed", onFriendRemoved);

    socketCleanupRef.current = () => {
      socket.off("presence_snapshot", onSnapshot);
      socket.off("friend_online", onFriendOnline);
      socket.off("friend_offline", onFriendOffline);
      socket.off("friend_request_received", onRequestReceived);
      socket.off("friend_request_accepted", onRequestAccepted);
      socket.off("friend_request_declined", onRequestDeclined);
      socket.off("friend_request_cancelled", onRequestCancelled);
      socket.off("friend_removed", onFriendRemoved);
      cleanup();
    };

    return () => {
      cancelled = true;
      socketCleanupRef.current?.();
      socketCleanupRef.current = null;
    };
  }, [loading, user?.id, refreshFriends]);

  const sendRequest = useCallback(
    async (username) => {
      const result = await apiFetch("/api/v1/friends/requests", {
        method: "POST",
        body: JSON.stringify({ username }),
      });
      await refreshFriends();
      return result?.data;
    },
    [refreshFriends],
  );

  const acceptRequest = useCallback(
    async (requestId) => {
      await apiFetch(`/api/v1/friends/requests/${requestId}/accept`, { method: "POST" });
      await refreshFriends();
    },
    [refreshFriends],
  );

  const declineRequest = useCallback(
    async (requestId) => {
      await apiFetch(`/api/v1/friends/requests/${requestId}/decline`, { method: "POST" });
      await refreshFriends();
    },
    [refreshFriends],
  );

  const cancelRequest = useCallback(
    async (requestId) => {
      await apiFetch(`/api/v1/friends/requests/${requestId}`, { method: "DELETE" });
      await refreshFriends();
    },
    [refreshFriends],
  );

  const unfriend = useCallback(
    async (userId) => {
      await apiFetch(`/api/v1/friends/${userId}`, { method: "DELETE" });
      await refreshFriends();
    },
    [refreshFriends],
  );

  const lookupUsername = useCallback(async (username) => {
    const res = await apiFetch(`/api/v1/friends/lookup/${encodeURIComponent(username)}`);
    return res?.data;
  }, []);

  const value = useMemo(
    () => ({
      friends,
      pendingReceived,
      pendingSent,
      onlineCount,
      pendingReceivedCount,
      loadingFriends,
      friendsError,
      refreshFriends,
      sendRequest,
      acceptRequest,
      declineRequest,
      cancelRequest,
      unfriend,
      lookupUsername,
      enabled: Boolean(user?.id),
    }),
    [
      friends,
      pendingReceived,
      pendingSent,
      onlineCount,
      pendingReceivedCount,
      loadingFriends,
      friendsError,
      refreshFriends,
      sendRequest,
      acceptRequest,
      declineRequest,
      cancelRequest,
      unfriend,
      lookupUsername,
      user?.id,
    ],
  );

  return <FriendsContext.Provider value={value}>{children}</FriendsContext.Provider>;
}

export function useFriends() {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error("useFriends must be used within FriendsProvider");
  return ctx;
}
