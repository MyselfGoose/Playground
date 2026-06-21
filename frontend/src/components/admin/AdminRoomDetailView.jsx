"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  fetchAdminRoom,
  forceCloseAdminRoom,
  kickAdminRoomPlayer,
} from "../../lib/admin/api.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../Button.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

export function AdminRoomDetailView() {
  const params = useParams();
  const router = useRouter();
  const game = typeof params?.game === "string" ? params.game : "";
  const code = typeof params?.code === "string" ? params.code : "";

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!game || !code) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminRoom(game, code);
      setRoom(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load room");
    } finally {
      setLoading(false);
    }
  }, [game, code]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeRoom = async () => {
    setBusy(true);
    try {
      await forceCloseAdminRoom(game, code);
      router.push("/admin/live");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close room");
    } finally {
      setBusy(false);
    }
  };

  const kick = async (userId) => {
    setBusy(true);
    try {
      await kickAdminRoomPlayer(game, code, userId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to kick player");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSkeleton variant="card" />;
  if (error && !room) {
    return (
      <Card className="p-6">
        <p className="text-error">{error}</p>
        <Link href="/admin/live" className="mt-4 inline-block text-sm font-bold text-primary">
          ← Back to live ops
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            <Link href="/admin/live" className="font-bold text-primary hover:underline">
              Live ops
            </Link>{" "}
            / {game} / {code}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold text-foreground">Room {code}</h1>
          <p className="text-sm text-muted">Phase: {room?.phase}</p>
        </div>
        <Button variant="primary" disabled={busy} onClick={() => void closeRoom()}>
          Force close room
        </Button>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Players</h2>
        <ul className="space-y-3">
          {(room?.players ?? []).map((p) => (
            <li
              key={p.userId}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-muted-bright/20 pb-3"
            >
              <div>
                <p className="font-bold">{p.username}</p>
                <p className="font-mono text-xs text-muted">{p.userId}</p>
              </div>
              <Button variant="secondary" disabled={busy} onClick={() => void kick(p.userId)}>
                Kick
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      {room?.meta && Object.keys(room.meta).length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Metadata</h2>
          <pre className="overflow-x-auto rounded-xl bg-muted-bright/20 p-4 text-xs">
            {JSON.stringify(room.meta, null, 2)}
          </pre>
        </Card>
      ) : null}
    </div>
  );
}
