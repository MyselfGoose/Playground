"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useNpat } from "../../../lib/npat/NpatSocketContext.jsx";
import { Button } from "../../../components/Button.jsx";
import { getNpatRoomCodeLength } from "../../../lib/npat/roomCode.js";

export default function NpatEntryPage() {
  const router = useRouter();
  const {
    createRoom,
    joinRoom,
    leaveRoom,
    connected,
    socketError,
    clearSocketError,
    resumedCode,
    clearResumedCode,
  } = useNpat();
  const [mode, setMode] = useState(/** @type {'solo' | 'team'} */ ("solo"));
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [createError, setCreateError] = useState(/** @type {string | null} */ (null));
  const [joinError, setJoinError] = useState(/** @type {string | null} */ (null));
  const codeLen = useMemo(() => getNpatRoomCodeLength(), []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-sm font-bold uppercase tracking-widest bg-gradient-to-r from-primary to-accent-pink bg-clip-text text-transparent">🌍 Live multiplayer</p>
        <h1 className="mt-3 text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-tight">
          Name, Place,<br />Animal, Thing
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-foreground/70 leading-relaxed">
          Fast rounds, silly answers, and a ticking clock. Create a room or join with a code.
        </p>
      </motion.header>

      {!connected ? (
        <p className="text-center text-sm font-bold text-muted">⏳ Connecting to game server…</p>
      ) : null}

      {socketError ? (
        <motion.p 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-[var(--radius-2xl)] border-2 border-error/20 bg-error/5 px-4 py-3 text-center text-sm font-semibold text-error"
        >
          {socketError}
          <button
            type="button"
            className="ml-3 font-bold underline"
            onClick={() => clearSocketError()}
          >
            Dismiss
          </button>
        </motion.p>
      ) : null}

      {connected && resumedCode ? (
        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col gap-4 rounded-[var(--radius-2xl)] border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-accent-pink/5 px-6 py-5 shadow-[var(--shadow-md)] ring-1 ring-primary/20 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm font-semibold text-foreground">
            You still have an active game in room{" "}
            <span className="font-mono font-black tracking-[0.2em] text-primary">{resumedCode}</span>
            . Rejoin to continue?
          </p>
          <div className="flex flex-shrink-0 flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              className="px-4 py-2 text-sm font-bold"
              onClick={() => {
                router.replace(`/games/npat/lobby?code=${resumedCode}`);
                clearResumedCode();
              }}
            >
              Rejoin
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-4 py-2 text-sm font-bold"
              onClick={async () => {
                await leaveRoom();
                clearResumedCode();
              }}
            >
              Leave
            </Button>
          </div>
        </motion.div>
      ) : null}

      {createError ? (
        <motion.p 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="rounded-[var(--radius-2xl)] border-2 border-error/20 bg-error/5 px-4 py-3 text-center text-sm font-semibold text-error"
        >
          {createError}
        </motion.p>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-pastel-mint to-accent-mint/30 p-8 shadow-[var(--shadow-md)] ring-2 ring-accent-mint/40"
        >
          <h2 className="text-2xl font-extrabold text-foreground">🎮 Create Game</h2>
          <p className="mt-2 text-sm font-semibold text-foreground/70">You will be the host.</p>
          <div className="mt-6 flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] bg-background/45 px-4 py-3 ring-2 ring-foreground/10 transition-all hover:bg-background/65">
              <input
                type="radio"
                name="mode"
                checked={mode === "solo"}
                onChange={() => setMode("solo")}
                className="h-5 w-5"
              />
              <span className="font-bold text-foreground">Solo (free-for-all)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] bg-background/45 px-4 py-3 ring-2 ring-foreground/10 transition-all hover:bg-background/65">
              <input
                type="radio"
                name="mode"
                checked={mode === "team"}
                onChange={() => setMode("team")}
                className="h-5 w-5"
              />
              <span className="font-bold text-foreground">Team-based</span>
            </label>
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-8 w-full font-extrabold py-3"
            disabled={!connected || creating}
            onClick={async () => {
              setCreateError(null);
              setCreating(true);
              const result = await createRoom(mode);
              setCreating(false);
              if (!result.ok) {
                setCreateError(result.error?.message ?? "Could not create room");
                return;
              }
              const code = result.data?.room?.code;
              if (code) {
                router.push(`/games/npat/lobby?code=${code}`);
              }
            }}
          >
            {creating ? "Creating…" : "🚀 Create Game"}
          </Button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-pastel-peach to-primary/20 p-8 shadow-[var(--shadow-md)] ring-2 ring-primary/30"
        >
          <h2 className="text-2xl font-extrabold text-foreground">🔗 Join Game</h2>
          <p className="mt-2 text-sm font-semibold text-foreground/70">
            Enter the {codeLen}-digit room code.
          </p>
          <label className="mt-6 block text-left">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted">
              Room code
            </span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={codeLen}
              value={joinCode}
              onChange={(e) => {
                setJoinCode(e.target.value.replace(/\D/g, ""));
                setJoinError(null);
              }}
              className="w-full rounded-[var(--radius-xl)] border-2 border-muted-bright/40 bg-background/65 px-4 py-3 text-center text-3xl font-extrabold tracking-[0.4em] text-foreground shadow-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder={"0".repeat(codeLen)}
            />
            {joinError ? (
              <span className="mt-2 block text-sm font-semibold text-error">{joinError}</span>
            ) : null}
          </label>
          <Button
            type="button"
            variant="secondary"
            className="mt-8 w-full font-extrabold py-3"
            disabled={!connected || joining || joinCode.replace(/\D/g, "").length !== codeLen}
            onClick={async () => {
              setJoinError(null);
              setJoining(true);
              const result = await joinRoom(joinCode);
              setJoining(false);
              if (!result.ok) {
                setJoinError(result.error?.message ?? "Could not join room");
                return;
              }
              const code = result.data?.room?.code;
              if (code) {
                router.push(`/games/npat/lobby?code=${code}`);
              }
            }}
          >
            {joining ? "Joining…" : "✨ Join Game"}
          </Button>
        </motion.section>
      </div>

      <p className="text-center text-sm text-foreground/70">
        <Link href="/games" className="font-bold text-primary underline-offset-2 hover:underline transition-colors">
          ← Back to all games
        </Link>
      </p>
    </div>
  );
}
