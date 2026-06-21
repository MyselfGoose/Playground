"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminUserSessions,
  revokeAdminUserSession,
  revokeAllAdminUserSessions,
} from "../../lib/admin/api.js";
import { Button } from "../Button.jsx";
import { Card } from "../ui/Card.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

/**
 * @param {{ userId: string }} props
 */
export function UserSessionsPanel({ userId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminUserSessions(userId);
      setSessions(data?.sessions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="card" />;
  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-error">{error}</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted">Active sessions</h3>
        {sessions.length > 0 ? (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => void run(() => revokeAllAdminUserSessions(userId))}
          >
            Revoke all
          </Button>
        ) : null}
      </div>

      {sessions.length === 0 ? (
        <p className="text-sm text-muted">No active refresh sessions.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-muted-bright/30 text-xs uppercase text-muted">
                <th className="py-2 pr-4">Device</th>
                <th className="py-2 pr-4">IP</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.jti} className="border-b border-muted-bright/20">
                  <td className="max-w-[12rem] truncate py-3 pr-4 font-medium">
                    {s.userAgent || "Unknown device"}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">{s.createdFromIp || "—"}</td>
                  <td className="py-3 pr-4 tabular-nums">
                    {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-3 pr-4 tabular-nums">
                    {s.expiresAt ? new Date(s.expiresAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void run(() => revokeAdminUserSession(userId, s.jti))}
                    >
                      Revoke
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
