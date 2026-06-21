"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAuthAbuseMonitor,
  fetchOAuthAudit,
  fetchOAuthTickets,
  fetchAdminDashboard,
  patchGoogleOAuth,
  purgeExpiredOAuthTickets,
} from "../lib/admin/api.js";

export function useAdminSecurity() {
  const [oauthAudit, setOauthAudit] = useState(null);
  const [tickets, setTickets] = useState(null);
  const [abuse, setAbuse] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [audit, ticketData, abuseData, dash] = await Promise.all([
        fetchOAuthAudit(),
        fetchOAuthTickets(),
        fetchAuthAbuseMonitor({ limit: 30 }),
        fetchAdminDashboard(),
      ]);
      setOauthAudit(audit);
      setTickets(ticketData);
      setAbuse(abuseData);
      setSettings(dash?.platformSettings ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load security data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    oauthAudit,
    tickets,
    abuse,
    settings,
    loading,
    error,
    refresh,
    patchGoogleOAuth,
    purgeExpiredOAuthTickets,
  };
}
