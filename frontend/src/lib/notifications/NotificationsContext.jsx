"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { useSocialSocket } from "../social/SocialSocketContext.jsx";
import { navigateToGameInvite } from "./joinFromInvite.js";
import {
  countUnreadInvites,
  markInvitesRead,
  patchInvite,
  upsertInvite,
} from "./notificationsStateHelpers.js";

/** @typedef {import('./notificationsStateHelpers.js').GameInviteEntry} GameInviteEntry */

/** @typedef {{ id: string, invite: GameInviteEntry, createdAt: number }} ToastItem */

const NotificationsContext = createContext(null);

const TOAST_TTL_MS = 6000;
const MAX_TOASTS = 3;

export function NotificationsProvider({ children }) {
  const router = useRouter();
  const { user, loading } = useUser();
  const { subscribe, enabled } = useSocialSocket();
  const [invites, setInvites] = useState(/** @type {GameInviteEntry[]} */ ([]));
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [invitesError, setInvitesError] = useState(/** @type {string | null} */ (null));
  const [toasts, setToasts] = useState(/** @type {ToastItem[]} */ ([]));
  const toastTimersRef = useRef(/** @type {Map<string, ReturnType<typeof setTimeout>>} */ (new Map()));

  const dismissToast = useCallback((toastId) => {
    const timer = toastTimersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(toastId);
    }
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const enqueueToast = useCallback(
    (invite) => {
      const toastId = `toast-${invite.id}-${Date.now()}`;
      const item = { id: toastId, invite, createdAt: Date.now() };
      setToasts((prev) => [item, ...prev].slice(0, MAX_TOASTS));
      const timer = setTimeout(() => dismissToast(toastId), TOAST_TTL_MS);
      toastTimersRef.current.set(toastId, timer);
    },
    [dismissToast],
  );

  const refreshInvites = useCallback(async () => {
    if (!user?.id) return;
    setLoadingInvites(true);
    setInvitesError(null);
    try {
      const res = await apiFetch("/api/v1/game-invites/summary");
      const list = Array.isArray(res?.data?.invites) ? res.data.invites : [];
      setInvites(list);
      setUnreadCount(res?.data?.counts?.unread ?? countUnreadInvites(list));
    } catch (e) {
      setInvitesError(e instanceof ApiError ? e.user_message || e.message : "Could not load notifications");
    } finally {
      setLoadingInvites(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (loading || !user?.id) {
      setInvites([]);
      setUnreadCount(0);
      setToasts([]);
      return;
    }
    void refreshInvites();
  }, [loading, user?.id, refreshInvites]);

  useEffect(() => {
    if (!enabled) return undefined;

    const unsubs = [
      subscribe("social_connected", () => {
        void refreshInvites();
      }),
      subscribe("social_reconnected", () => {
        void refreshInvites();
      }),
      subscribe("game_invite_received", (payload) => {
        const invite = payload?.invite;
        if (!invite?.id) return;
        setInvites((prev) => upsertInvite(prev, invite));
        setUnreadCount((c) => c + 1);
        enqueueToast(invite);
      }),
      subscribe("game_invite_cancelled", (payload) => {
        const inviteId = String(payload?.inviteId ?? "");
        if (!inviteId) return;
        setInvites((prev) =>
          patchInvite(prev, inviteId, {
            status: payload?.reason === "expired" ? "expired" : "cancelled",
            respondedAt: new Date().toISOString(),
          }),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }),
      subscribe("game_invite_resolved", (payload) => {
        const inviteId = String(payload?.inviteId ?? "");
        const status = String(payload?.status ?? "");
        if (!inviteId || !status) return;
        setInvites((prev) =>
          patchInvite(prev, inviteId, {
            status,
            respondedAt: new Date().toISOString(),
          }),
        );
      }),
    ];

    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [enabled, subscribe, refreshInvites, enqueueToast]);

  useEffect(
    () => () => {
      for (const timer of toastTimersRef.current.values()) clearTimeout(timer);
      toastTimersRef.current.clear();
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    setInvites((prev) => markInvitesRead(prev));
    setUnreadCount(0);
    try {
      await apiFetch("/api/v1/game-invites/mark-read", {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch {
      void refreshInvites();
    }
  }, [refreshInvites]);

  const sendInvite = useCallback(async (recipientId, gameSlug, roomCode) => {
    const res = await apiFetch("/api/v1/game-invites", {
      method: "POST",
      body: JSON.stringify({ recipientId, gameSlug, roomCode }),
    });
    return res?.data?.invite;
  }, []);

  const acceptInvite = useCallback(
    async (inviteId) => {
      const res = await apiFetch(`/api/v1/game-invites/${inviteId}/accept`, { method: "POST" });
      const data = res?.data;
      setInvites((prev) =>
        patchInvite(prev, inviteId, {
          status: "accepted",
          readAt: new Date().toISOString(),
          respondedAt: new Date().toISOString(),
        }),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (data?.gameSlug && data?.roomCode) {
        navigateToGameInvite(
          router,
          {
            gameSlug: data.gameSlug,
            roomCode: data.roomCode,
            joinPath: data.joinPath,
          },
          user?.id,
        );
      }
      return data;
    },
    [router, user?.id],
  );

  const declineInvite = useCallback(async (inviteId) => {
    await apiFetch(`/api/v1/game-invites/${inviteId}/decline`, { method: "POST" });
    setInvites((prev) =>
      patchInvite(prev, inviteId, {
        status: "declined",
        readAt: new Date().toISOString(),
        respondedAt: new Date().toISOString(),
      }),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const cancelInvite = useCallback(async (inviteId) => {
    await apiFetch(`/api/v1/game-invites/${inviteId}`, { method: "DELETE" });
    setInvites((prev) =>
      patchInvite(prev, inviteId, {
        status: "cancelled",
        respondedAt: new Date().toISOString(),
      }),
    );
  }, []);

  const value = useMemo(
    () => ({
      invites,
      unreadCount,
      loadingInvites,
      invitesError,
      toasts,
      refreshInvites,
      markAllRead,
      sendInvite,
      acceptInvite,
      declineInvite,
      cancelInvite,
      dismissToast,
      enabled,
    }),
    [
      invites,
      unreadCount,
      loadingInvites,
      invitesError,
      toasts,
      refreshInvites,
      markAllRead,
      sendInvite,
      acceptInvite,
      declineInvite,
      cancelInvite,
      dismissToast,
      enabled,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
