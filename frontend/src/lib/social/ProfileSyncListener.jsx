"use client";

import { useEffect } from "react";
import { useUser } from "../context/UserContext.jsx";
import { useSocialSocket } from "./SocialSocketContext.jsx";

/**
 * Keeps auth user in sync when profile changes over the social socket.
 */
export function ProfileSyncListener() {
  const { user, refreshUser } = useUser();
  const { subscribe, enabled } = useSocialSocket();

  useEffect(() => {
    if (!enabled || !user?.id) return undefined;

    return subscribe("profile:updated", (payload) => {
      const data = /** @type {{ userId?: string }} */ (payload ?? {});
      if (data.userId && String(data.userId) === user.id) {
        void refreshUser();
      }
    });
  }, [enabled, user?.id, subscribe, refreshUser]);

  return null;
}
