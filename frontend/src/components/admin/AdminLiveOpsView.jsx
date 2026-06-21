"use client";

import Link from "next/link";
import { useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import { useAdminLiveOps } from "../../hooks/useAdminLiveOps.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../Button.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";
import { Badge } from "../ui/Badge.jsx";

const GAMES = ["npat", "typing-race", "taboo", "cah", "hangman"];

export function AdminLiveOpsView() {
  const { rooms, sockets, settings, loading, error, refresh, patchDisabledGames, patchBlockNewRooms } =
    useAdminLiveOps();
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

  const toggleGame = (slug) => {
    const disabled = new Set(settings?.disabledGames ?? []);
    if (disabled.has(slug)) disabled.delete(slug);
    else disabled.add(slug);
    return patchDisabledGames({ disabledGames: [...disabled] });
  };

  if (loading && !rooms) return <LoadingSkeleton variant="card" />;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-foreground">
            <Activity className="h-7 w-7 text-primary" aria-hidden />
            Live ops
          </h1>
          <p className="mt-1 text-sm text-muted">Rooms, sockets, and game availability</p>
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

      {rooms?.perInstance ? (
        <p className="text-xs text-warning">
          Data is per server instance ({rooms.instanceCount ?? 1} reported). Multi-instance deployments
          show only local rooms.
        </p>
      ) : null}

      {rooms?.survivedRestart ? (
        <p className="rounded-xl bg-warning/10 px-4 py-2 text-sm text-warning">
          Rooms detected that predate this boot — review NPAT hydration or unexpected persistence.
        </p>
      ) : null}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Socket connections</h2>
        <p className="mb-3 text-sm text-muted">
          Social presence online: {sockets?.presenceOnline ?? 0}
        </p>
        <div className="flex flex-wrap gap-2">
          {(sockets?.namespaces ?? []).map((ns) => (
            <Badge key={ns.namespace} variant="default">
              {ns.namespace}: {ns.connections}
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Game controls</h2>
        <Button
          className="mb-4"
          variant={settings?.blockNewRooms ? "primary" : "secondary"}
          disabled={busy === "block"}
          onClick={() =>
            void run("block", () => patchBlockNewRooms({ blockNewRooms: !settings?.blockNewRooms }))
          }
        >
          {settings?.blockNewRooms ? "Allow new rooms" : "Block new room creation"}
        </Button>
        <div className="flex flex-wrap gap-2">
          {GAMES.map((g) => {
            const off = (settings?.disabledGames ?? []).includes(g);
            return (
              <Button
                key={g}
                variant={off ? "primary" : "secondary"}
                disabled={busy === `game-${g}`}
                onClick={() => void run(`game-${g}`, () => toggleGame(g))}
              >
                {off ? `Enable ${g}` : `Disable ${g}`}
              </Button>
            );
          })}
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Active rooms</h2>
          <Link href="/admin/npat" className="text-sm font-bold text-primary hover:underline">
            NPAT inspector →
          </Link>
        </div>
        {(rooms?.rooms ?? []).length === 0 ? (
          <p className="text-sm text-muted">No active rooms on this instance.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-muted-bright/30 text-xs uppercase text-muted">
                  <th className="py-2 pr-4">Game</th>
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">Host</th>
                  <th className="py-2 pr-4">Players</th>
                  <th className="py-2 pr-4">Phase</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {rooms.rooms.map((r) => (
                  <tr key={`${r.game}-${r.code}`} className="border-b border-muted-bright/20">
                    <td className="py-2 pr-4">{r.game}</td>
                    <td className="py-2 pr-4 font-mono">{r.code}</td>
                    <td className="py-2 pr-4">{r.hostUsername || r.hostId}</td>
                    <td className="py-2 pr-4">{r.playerCount}</td>
                    <td className="py-2 pr-4">{r.phase}</td>
                    <td className="py-2 text-right">
                      <Link
                        href={`/admin/live/${r.game}/${r.code}`}
                        className="font-bold text-primary hover:underline"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
