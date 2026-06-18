"use client";

import { useCallback, useState } from "react";

/**
 * Shared leave-lobby flow: confirm dialog → async leave → optional navigation.
 *
 * @param {{
 *   leaveRoom: () => Promise<{ ok?: boolean } | void>,
 *   onLeft?: () => void | Promise<void>,
 *   onError?: (message: string) => void,
 * }} options
 */
export function useLeaveLobby({ leaveRoom, onLeft, onError }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const requestLeave = useCallback(() => {
    if (leaving) return;
    setConfirmOpen(true);
  }, [leaving]);

  const cancelLeave = useCallback(() => {
    if (leaving) return;
    setConfirmOpen(false);
  }, [leaving]);

  const confirmLeave = useCallback(async () => {
    if (leaving) return;
    setLeaving(true);
    try {
      await leaveRoom();
      setConfirmOpen(false);
      await onLeft?.();
    } catch {
      onError?.("Could not leave the room. Please try again.");
    } finally {
      setLeaving(false);
    }
  }, [leaveRoom, leaving, onError, onLeft]);

  return {
    confirmOpen,
    leaving,
    requestLeave,
    cancelLeave,
    confirmLeave,
  };
}
