"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";

export function FibbageEntry() {
  const { createRoom, joinRoom, connected, socketError } = useFibbage();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createRoom({});
      if (!result.ok) {
        setError(result.error?.message ?? "Could not create room");
      }
    } catch {
      setError("Failed to create room. Please try again.");
    } finally {
      setCreating(false);
    }
  }, [createRoom, creating]);

  const handleJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || joining) return;
    setJoining(true);
    setError(null);
    try {
      const result = await joinRoom(code);
      if (!result.ok) {
        setError(result.error?.message ?? "Could not join room");
      }
    } catch {
      setError("Failed to join room. Please try again.");
    } finally {
      setJoining(false);
    }
  }, [joinRoom, joinCode, joining]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") handleJoin();
    },
    [handleJoin],
  );

  const busy = creating || joining;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12">
      <motion.div
        className="w-full max-w-md space-y-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-[var(--fibbage-accent-glow)]">
            Fibbage
          </h1>
          <p className="mt-2 text-sm text-[var(--fibbage-text-muted)]">
            Write lies. Fool your friends. Find the truth.
          </p>
        </header>

        {(error || socketError) && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm font-semibold text-red-400"
          >
            {error || socketError}
          </motion.p>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <motion.div
            className="fibbage-card flex flex-col items-center gap-4 p-6"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <h2 className="text-lg font-bold text-[var(--fibbage-text)]">New Game</h2>
            <p className="text-center text-xs text-[var(--fibbage-text-muted)]">
              Create a room and invite your friends
            </p>
            <button
              className="fibbage-btn w-full"
              onClick={handleCreate}
              disabled={busy || !connected}
            >
              {creating ? "Creating…" : "Create Room"}
            </button>
          </motion.div>

          <motion.div
            className="fibbage-card flex flex-col items-center gap-4 p-6"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <h2 className="text-lg font-bold text-[var(--fibbage-text)]">Join Game</h2>
            <p className="text-center text-xs text-[var(--fibbage-text-muted)]">
              Enter a room code to join
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="ABCD"
              maxLength={4}
              className="w-full rounded-lg border border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas-light)] px-4 py-2.5 text-center text-lg font-bold uppercase tracking-widest text-[var(--fibbage-text)] placeholder:text-[var(--fibbage-text-muted)]/50 focus:border-[var(--fibbage-accent)] focus:outline-none"
              aria-label="Room code"
            />
            <button
              className="fibbage-btn w-full"
              onClick={handleJoin}
              disabled={busy || !connected || !joinCode.trim()}
            >
              {joining ? "Joining…" : "Join Room"}
            </button>
          </motion.div>
        </div>

        {!connected && (
          <p className="text-center text-xs text-[var(--fibbage-text-muted)]">
            Connecting to server…
          </p>
        )}
      </motion.div>
    </div>
  );
}
