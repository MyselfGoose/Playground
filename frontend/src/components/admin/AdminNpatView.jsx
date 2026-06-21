"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchNpatEvalFailures,
  fetchNpatMongoRooms,
  retryNpatEval,
} from "../../lib/admin/api.js";
import { Card } from "../ui/Card.jsx";
import { Button } from "../Button.jsx";
import { LoadingSkeleton } from "../LoadingSkeleton.jsx";

export function AdminNpatView() {
  const [rooms, setRooms] = useState([]);
  const [failures, setFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyCode, setBusyCode] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomData, failData] = await Promise.all([
        fetchNpatMongoRooms({ limit: 50 }),
        fetchNpatEvalFailures({ limit: 50 }),
      ]);
      setRooms(roomData?.rooms ?? []);
      setFailures(failData?.failures ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load NPAT data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (code) => {
    setBusyCode(code);
    try {
      await retryNpatEval(code);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setBusyCode(null);
    }
  };

  if (loading) return <LoadingSkeleton variant="card" />;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">
          <Link href="/admin/live" className="font-bold text-primary hover:underline">
            Live ops
          </Link>{" "}
          / NPAT
        </p>
        <h1 className="mt-1 text-2xl font-extrabold text-foreground">NPAT inspector</h1>
      </div>

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">
          Mongo persisted rooms
        </h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-muted">No active NPAT room documents.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-muted-bright/30 text-xs uppercase text-muted">
                  <th className="py-2 pr-4">Code</th>
                  <th className="py-2 pr-4">State</th>
                  <th className="py-2 pr-4">Players</th>
                  <th className="py-2 pr-4">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.code} className="border-b border-muted-bright/20">
                    <td className="py-2 pr-4 font-mono">{r.code}</td>
                    <td className="py-2 pr-4">{r.engineState}</td>
                    <td className="py-2 pr-4">{r.playerCount}</td>
                    <td className="py-2 pr-4 text-xs text-muted">
                      {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted">Eval failures</h2>
        {failures.length === 0 ? (
          <p className="text-sm text-muted">No failed or fallback evaluations in recent rooms.</p>
        ) : (
          <ul className="space-y-3">
            {failures.map((f) => (
              <li
                key={`${f.roomCode}-${f.roundIndex}`}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-muted-bright/20 pb-3"
              >
                <div className="text-sm">
                  <span className="font-mono font-bold">{f.roomCode}</span> round {f.roundIndex} (
                  {f.letter}) — {f.evaluationStatus}
                  {f.evaluationFailureClass ? ` / ${f.evaluationFailureClass}` : ""}
                </div>
                <Button
                  variant="secondary"
                  disabled={busyCode === f.roomCode}
                  onClick={() => void retry(f.roomCode)}
                >
                  Retry eval
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
