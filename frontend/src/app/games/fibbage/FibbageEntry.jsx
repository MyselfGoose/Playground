"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { sectionEnter } from "../../../lib/fibbage/motion.js";
import { FibbageButton } from "./components/FibbageButton.jsx";

export function FibbageEntry() {
  const reduce = useReducedMotion();
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
  const displayError = error || socketError;
  const pageMotion = sectionEnter(reduce, 0);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-12">
      <motion.div className="w-full max-w-md space-y-8" {...pageMotion}>
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight text-[var(--fibbage-accent-glow)]">
            Fibbage
          </h1>
          <p className="mt-2 fibbage-body">
            Write lies. Fool your friends. Find the truth.
          </p>
        </header>

        <AnimatePresence>
          {displayError ? (
            <motion.p
              initial={reduce ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -4 }}
              className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-center text-sm font-semibold text-error"
            >
              {displayError}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="grid gap-6 sm:grid-cols-2">
          <motion.div
            className="fibbage-card flex flex-col items-center gap-4 p-6"
            whileHover={reduce ? undefined : { scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <h2 className="text-lg font-bold text-[var(--fibbage-text)]">New Game</h2>
            <p className="text-center fibbage-micro">
              Create a room and invite your friends
            </p>
            <FibbageButton className="w-full" disabled={busy || !connected} pending={creating} onClick={handleCreate}>
              {creating ? "Creating…" : "Create Room"}
            </FibbageButton>
          </motion.div>

          <motion.div
            className="fibbage-card flex flex-col items-center gap-4 p-6"
            whileHover={reduce ? undefined : { scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <h2 className="text-lg font-bold text-[var(--fibbage-text)]">Join Game</h2>
            <p className="text-center fibbage-micro">
              Enter a room code to join
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="ABCD"
              maxLength={4}
              className="fibbage-input text-center text-lg font-bold uppercase tracking-widest placeholder:text-[var(--fibbage-text-muted)]/50"
              aria-label="Room code"
            />
            <FibbageButton
              className="w-full"
              disabled={busy || !connected || !joinCode.trim()}
              pending={joining}
              onClick={handleJoin}
            >
              {joining ? "Joining…" : "Join Room"}
            </FibbageButton>
          </motion.div>
        </div>

        {!connected ? (
          <motion.p
            className="text-center fibbage-micro"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Connecting to server…
          </motion.p>
        ) : null}
      </motion.div>
    </div>
  );
}
