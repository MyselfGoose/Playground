"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminUsers } from "../lib/admin/api.js";

/**
 * @param {{ q?: string, page?: number, limit?: number }} params
 */
export function useAdminUsers({ q = "", page = 1, limit = 20 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchAdminUsers({ q, page, limit });
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [q, page, limit]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return { data, loading, error, refresh: load };
}
