"use client";

import { useState } from "react";
import { RefreshCw, Shield } from "lucide-react";
import { useAdminSecurity } from "../../hooks/useAdminSecurity.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../Button.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

export function AdminSecurityView() {
  const {
    oauthAudit,
    tickets,
    abuse,
    settings,
    loading,
    error,
    refresh,
    patchGoogleOAuth,
    purgeExpiredOAuthTickets,
  } = useAdminSecurity();
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    setActionError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  if (loading && !oauthAudit) return <LoadingSkeleton variant="card" />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-foreground">
            <Shield className="h-7 w-7 text-primary" aria-hidden />
            Security
          </h1>
          <p className="mt-1 text-sm text-muted">Sessions, OAuth, and auth abuse monitoring</p>
        </div>
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}
      {actionError ? (
        <p className="rounded-xl bg-error/10 px-4 py-2 text-sm text-error">{actionError}</p>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Google OAuth</h2>
        <p className="mb-4 text-sm text-muted">
          Runtime toggle (also requires env <code className="text-xs">GOOGLE_OAUTH_ENABLED</code>).
        </p>
        <Button
          variant={settings?.googleOAuthEnabled ? "secondary" : "primary"}
          disabled={busy === "oauth"}
          onClick={() =>
            void run("oauth", () =>
              patchGoogleOAuth({ googleOAuthEnabled: !settings?.googleOAuthEnabled }),
            )
          }
        >
          {settings?.googleOAuthEnabled ? "Disable Google sign-in" : "Enable Google sign-in"}
        </Button>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">OAuth audit</h2>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-muted-bright/20 px-4 py-3">
            <p className="text-xs font-bold uppercase text-muted">Google only</p>
            <p className="text-xl font-extrabold">{oauthAudit?.counts?.googleOnly ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-muted-bright/20 px-4 py-3">
            <p className="text-xs font-bold uppercase text-muted">Local only</p>
            <p className="text-xl font-extrabold">{oauthAudit?.counts?.localOnly ?? "—"}</p>
          </div>
          <div className="rounded-xl bg-muted-bright/20 px-4 py-3">
            <p className="text-xs font-bold uppercase text-muted">Both</p>
            <p className="text-xl font-extrabold">{oauthAudit?.counts?.both ?? "—"}</p>
          </div>
        </div>
        {oauthAudit?.recentGoogleLinks?.length ? (
          <ul className="space-y-2 text-sm">
            {oauthAudit.recentGoogleLinks.slice(0, 8).map((u) => (
              <li key={u.id} className="flex flex-wrap justify-between gap-2 border-b border-muted-bright/20 py-2">
                <span className="font-medium">{u.username}</span>
                <span className="text-muted">{u.email}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No recent Google links.</p>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Pending OAuth tickets</h2>
          <Button
            variant="secondary"
            disabled={busy === "purge"}
            onClick={() => void run("purge", purgeExpiredOAuthTickets)}
          >
            Purge expired
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted">
          Completion: {tickets?.counts?.completionPending ?? 0} · Signup:{" "}
          {tickets?.counts?.signupPending ?? 0}
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted">Completion tickets</p>
            <ul className="space-y-1 text-xs">
              {(tickets?.completionTickets ?? []).map((t) => (
                <li key={t.jti} className="truncate font-mono">
                  {t.jti.slice(0, 8)}… → user {t.userId.slice(0, 8)}…
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-muted">Signup tickets</p>
            <ul className="space-y-1 text-xs">
              {(tickets?.signupTickets ?? []).map((t) => (
                <li key={t.jti}>
                  {t.email} <span className="text-muted">({t.name})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">Auth abuse monitor</h2>
        <p className="mb-4 text-xs text-muted">Per-instance in-memory data; resets on deploy.</p>
        <p className="mb-3 text-sm text-muted">
          IP blocklist and password reset flows are not configured yet.
        </p>
        {abuse?.entries?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead>
                <tr className="border-b border-muted-bright/30 text-xs uppercase text-muted">
                  <th className="py-2 pr-4">IP</th>
                  <th className="py-2 pr-4">Login failures</th>
                  <th className="py-2 pr-4">Rate limits</th>
                  <th className="py-2">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {abuse.entries.map((row) => (
                  <tr key={row.ip} className="border-b border-muted-bright/20">
                    <td className="py-2 pr-4 font-mono text-xs">{row.ip}</td>
                    <td className="py-2 pr-4">{row.loginFailures}</td>
                    <td className="py-2 pr-4">{row.rateLimitHits}</td>
                    <td className="py-2 text-xs text-muted">
                      {row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No abusive IPs tracked on this instance.</p>
        )}
      </Card>
    </div>
  );
}
