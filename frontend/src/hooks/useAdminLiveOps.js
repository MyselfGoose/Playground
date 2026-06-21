"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminDashboard,
  fetchAdminRooms,
  fetchSocketCounts,
  patchBlockNewRooms,
  patchDisabledGames,
} from "../lib/admin/api.js";

export function useAdminLiveOps() {
  const [rooms, setRooms] = useState(null);
  const [sockets, setSockets] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (game) => {
    setLoading(true);
    setError(null);
    try {
      const [roomData, socketData, dash] = await Promise.all([
        fetchAdminRooms(game ? { game } : undefined),
        fetchSocketCounts(),
        fetchAdminDashboard(),
      ]);
      setRooms(roomData);
      setSockets(socketData);
      setSettings(dash?.platformSettings ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load live ops");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    rooms,
    sockets,
    settings,
    loading,
    error,
    refresh,
    patchDisabledGames,
    patchBlockNewRooms,
  };
}
