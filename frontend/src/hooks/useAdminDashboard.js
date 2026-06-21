"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminDashboard } from "../lib/admin/api.js";

/**
 * @param {{ pollMs?: number }} [opts]
 */
export function useAdminDashboard({ pollMs = 30_000 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await fetchAdminDashboard();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => {
      void load();
    }, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { data, loading, error, refresh: load };
}
