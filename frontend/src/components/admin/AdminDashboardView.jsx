"use client";

import Link from "next/link";
import { RefreshCw, Wrench, Database } from "lucide-react";
import { useState } from "react";
import { useAdminDashboard } from "../../hooks/useAdminDashboard.js";
import { patchMaintenance, recomputeLeaderboards } from "../../lib/admin/api.js";
import { Card } from "../ui/Card.jsx";
import { Badge } from "../ui/Badge.jsx";
import { Button } from "../Button.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl bg-muted-bright/20 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function healthTone(ok) {
  if (ok === true) return "success";
  if (ok === false) return "error";
  return "warning";
}

export function AdminDashboardView() {
  const { data, loading, error, refresh } = useAdminDashboard();
  const [actionBusy, setActionBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  const runAction = async (key, fn) => {
    setActionBusy(key);
    setActionError(null);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionBusy(null);
    }
  };

  if (loading && !data) {
    return <LoadingSkeleton variant="card" />;
  }

  if (error && !data) {
    return (
      <Card>
        <p className="text-error">{error}</p>
        <Button className="mt-4" variant="secondary" onClick={() => void refresh()}>
          Retry
        </Button>
      </Card>
    );
  }

  const snapshot = data?.snapshot;
  const health = data?.health;
  const maintenance = data?.maintenance;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Platform overview and quick actions</p>
        </div>
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {actionError ? (
        <p className="rounded-xl bg-error/10 px-4 py-2 text-sm text-error" role="alert">
          {actionError}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">Platform snapshot</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Total users" value={snapshot?.totalUsers} />
          <StatTile label="Signups today" value={snapshot?.signupsToday} />
          <StatTile label="Signups (7d)" value={snapshot?.signups7d} />
          <StatTile label="Signups (30d)" value={snapshot?.signups30d} />
          <StatTile label="Active users (7d)" value={snapshot?.activeUsers7d} />
          <StatTile label="Games today" value={snapshot?.gamesPlayedToday} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Live activity</h2>
          {data?.liveActivity?.perInstance && data.liveActivity.instanceCount > 1 ? (
            <p className="mb-3 text-xs text-warning">
              Counts are per instance ({data.liveActivity.instanceCount} replicas). Totals may be higher globally.
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-muted-bright/40 text-xs uppercase text-muted">
                  <th className="py-2 pr-4">Game</th>
                  <th className="py-2 pr-4">Rooms</th>
                  <th className="py-2">Players</th>
                </tr>
              </thead>
              <tbody>
                {(data?.liveActivity?.byGame ?? []).map((row) => (
                  <tr key={row.game} className="border-b border-muted-bright/20">
                    <td className="py-2 pr-4 font-medium">{row.game}</td>
                    <td className="py-2 pr-4 tabular-nums">{row.rooms}</td>
                    <td className="py-2 tabular-nums">{row.players}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Game popularity</h2>
          <div className="space-y-3">
            {(data?.gamePopularity ?? []).map((g) => (
              <div key={g.game}>
                <div className="mb-1 flex justify-between text-sm font-medium">
                  <span>{g.game}</span>
                  <span className="text-muted tabular-nums">today {g.today} · week {g.week}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted-bright/30">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (g.week / Math.max(1, g.allTime)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Health status</h2>
          <div className="flex flex-wrap gap-2">
            <Badge tone={healthTone(health?.services?.mongodb)}>MongoDB</Badge>
            <Badge tone={healthTone(health?.services?.gemini)}>Gemini AI</Badge>
            <Badge tone={healthTone(health?.services?.redis)}>Redis</Badge>
            <Badge tone={health?.cron?.status === "success" ? "success" : health?.cron?.status === "failed" ? "error" : "neutral"}>
              Cron {health?.cron?.status ?? "never"}
            </Badge>
          </div>
          {health?.cron?.lastRunAt ? (
            <p className="mt-3 text-xs text-muted">Last cron: {new Date(health.cron.lastRunAt).toLocaleString()}</p>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Alerts</h2>
          {(data?.alerts ?? []).length === 0 ? (
            <p className="text-sm text-muted">No active alerts</p>
          ) : (
            <ul className="space-y-2">
              {data.alerts.map((a) => (
                <li key={a.code} className="rounded-lg bg-muted-bright/20 px-3 py-2 text-sm">
                  <Badge tone={a.level === "critical" ? "error" : a.level === "warning" ? "warning" : "neutral"}>
                    {a.level}
                  </Badge>
                  <span className="ml-2">{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={actionBusy === "recompute"}
            onClick={() => void runAction("recompute", recomputeLeaderboards)}
          >
            <Database className="mr-2 h-4 w-4" />
            {actionBusy === "recompute" ? "Running…" : "Recompute leaderboards"}
          </Button>
          <Button
            variant={maintenance?.maintenanceMode ? "primary" : "secondary"}
            disabled={actionBusy === "maintenance"}
            onClick={() =>
              void runAction("maintenance", () =>
                patchMaintenance({
                  maintenanceMode: !maintenance?.maintenanceMode,
                  maintenanceMessage: maintenance?.maintenanceMessage ?? "",
                }),
              )
            }
          >
            <Wrench className="mr-2 h-4 w-4" />
            {maintenance?.maintenanceMode ? "Disable maintenance" : "Enable maintenance"}
          </Button>
          <Link href="/admin/feedback">
            <Button variant="ghost">Open feedback queue</Button>
          </Link>
        </div>
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Recent signups</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-muted-bright/40 text-xs uppercase text-muted">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentSignups ?? []).map((u) => (
                  <tr key={u.id} className="border-b border-muted-bright/20">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/users/${u.id}`} className="font-medium text-primary hover:underline">
                        {u.username}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-muted">{(u.authProviders ?? []).join(", ")}</td>
                    <td className="py-2 text-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Deployment</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Version</dt>
              <dd className="font-mono">{data?.deployment?.version ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Uptime</dt>
              <dd className="tabular-nums">
                {data?.deployment?.uptime != null
                  ? `${Math.floor(data.deployment.uptime / 3600)}h ${Math.floor((data.deployment.uptime % 3600) / 60)}m`
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Instances</dt>
              <dd className="tabular-nums">{data?.deployment?.instanceCount ?? 1}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Environment</dt>
              <dd>{data?.deployment?.nodeEnv ?? "—"}</dd>
            </div>
          </dl>
        </Card>
      </section>
    </div>
  );
}
