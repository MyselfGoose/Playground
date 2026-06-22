"use client";

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { sectionEnter } from "../../../lib/fibbage/motion.js";
import { Avatar } from "../../../components/Avatar.jsx";
import { FIBBAGE_PATHS } from "./fibbage-shared.js";
import { FibbageButton } from "./components/FibbageButton.jsx";

const PODIUM_COLORS = ["var(--fibbage-gold)", "var(--fibbage-accent)", "var(--fibbage-cta)"];
const PODIUM_LABELS = ["1st", "2nd", "3rd"];

export function FibbageResult() {
  const reduce = useReducedMotion();
  const router = useRouter();
  const { room, localUserId, socketError, returnToLobby, leaveRoom } = useFibbage();
  const [returnPending, setReturnPending] = useState(false);
  const [leavePending, setLeavePending] = useState(false);
  const [error, setError] = useState(null);

  const players = room?.players ?? [];
  const isHost = localUserId === room?.hostUserId;
  const displayError = error ?? socketError ?? null;

  const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const podium = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  const pageMotion = sectionEnter(reduce, 0);

  const handleReturnToLobby = useCallback(async () => {
    if (returnPending) return;
    setReturnPending(true);
    setError(null);
    try {
      const result = await returnToLobby();
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not return to lobby.");
        setReturnPending(false);
      }
    } catch {
      setError("Could not return to lobby.");
      setReturnPending(false);
    }
  }, [returnToLobby, returnPending]);

  const handleLeave = useCallback(async () => {
    if (leavePending) return;
    setLeavePending(true);
    setError(null);
    try {
      const result = await leaveRoom();
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not leave room.");
        setLeavePending(false);
        return;
      }
      router.replace(FIBBAGE_PATHS.entry);
    } catch {
      setError("Could not leave room.");
      setLeavePending(false);
    }
  }, [leaveRoom, router, leavePending]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center px-4 py-12">
      <motion.div className="w-full max-w-lg space-y-8" {...pageMotion}>
        <header className="text-center">
          <h1 className="text-3xl font-black text-[var(--fibbage-gold)]">Game Over</h1>
          <p className="mt-1 fibbage-body">
            The champion of deception has been crowned
          </p>
        </header>

        <div className="flex items-end justify-center gap-3 sm:gap-6">
          {podium.map((player, i) => (
            <motion.div
              key={player.userId}
              className="flex flex-col items-center gap-2"
              initial={reduce ? false : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : 0.2 + i * 0.15, duration: 0.5 }}
            >
              <div
                className={`rounded-full p-1 ${i === 0 && !reduce ? "fibbage-winner-glow" : ""}`}
                style={{
                  boxShadow: i === 0 ? `0 0 24px ${PODIUM_COLORS[0]}40` : "none",
                  border: `2px solid ${PODIUM_COLORS[i]}`,
                }}
              >
                <Avatar
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  avatarEmoji={player.avatarEmoji}
                  size={i === 0 ? "lg" : "md"}
                />
              </div>
              <span className="text-sm font-bold text-[var(--fibbage-text)]">
                {player.username}
              </span>
              <span
                className="text-xs font-black uppercase"
                style={{ color: PODIUM_COLORS[i] }}
              >
                {PODIUM_LABELS[i]}
              </span>
              <span className="fibbage-score-pop text-lg">
                {player.score ?? 0}
              </span>
            </motion.div>
          ))}
        </div>

        {rest.length > 0 ? (
          <div className="space-y-2">
            {rest.map((player, i) => (
              <motion.div
                key={player.userId}
                className="flex items-center gap-3 rounded-lg bg-[var(--fibbage-canvas-light)] px-4 py-2.5"
                initial={reduce ? false : { opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: reduce ? 0 : 0.5 + i * 0.08 }}
              >
                <span className="w-6 text-center text-sm font-bold text-[var(--fibbage-text-muted)]">
                  {i + 4}
                </span>
                <Avatar
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  avatarEmoji={player.avatarEmoji}
                  size="sm"
                />
                <span className="flex-1 text-sm font-semibold text-[var(--fibbage-text)]">
                  {player.username}
                </span>
                <span className="text-sm font-bold text-[var(--fibbage-text-muted)]">
                  {player.score ?? 0}
                </span>
              </motion.div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          {isHost ? (
            <FibbageButton pending={returnPending} onClick={handleReturnToLobby}>
              {returnPending ? "Returning…" : "Play Again"}
            </FibbageButton>
          ) : null}
          <FibbageButton variant="secondary" pending={leavePending} onClick={handleLeave}>
            {leavePending ? "Leaving…" : "Leave"}
          </FibbageButton>
        </div>

        {!isHost ? (
          <p className="text-center fibbage-micro">
            Waiting for host to start a new game…
          </p>
        ) : null}

        {displayError ? (
          <p className="text-center text-sm font-semibold text-[var(--fibbage-lie)]">{displayError}</p>
        ) : null}
      </motion.div>
    </div>
  );
}
