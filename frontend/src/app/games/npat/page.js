"use client";

import { useEffect, useMemo, useState } from "react";
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

  // If the server resumed an active session, bounce the user into the right route automatically.
  useEffect(() => {
    if (!resumedCode) return;
    router.replace(`/games/npat/lobby?code=${resumedCode}`);
    clearResumedCode();
  }, [resumedCode, router, clearResumedCode]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 sm:py-16">
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-sm font-bold uppercase tracking-widest text-accent">Live multiplayer</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
          Name, Place, Animal, Thing
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-ink-muted">
          Fast rounds, silly answers, and a ticking clock. Create a room or join with a code.
        </p>
      </motion.header>

      {!connected ? (
        <p className="text-center text-sm font-bold text-ink-muted">Connecting to game server…</p>
      ) : null}

      {socketError ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-800">
          {socketError}
          <button
            type="button"
            className="ml-3 font-bold underline"
            onClick={() => clearSocketError()}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {createError ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-800">
          {createError}
        </p>
      ) : null}

      <div className="grid gap-8 md:grid-cols-2">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-mint/90 to-sky/50 p-8 shadow-[var(--shadow-card)] ring-2 ring-white/80"
        >
          <h2 className="text-2xl font-extrabold text-ink">Create game</h2>
          <p className="mt-2 text-sm font-semibold text-ink-muted">You will be the host.</p>
          <div className="mt-6 flex flex-col gap-3">
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-2 ring-ink/5">
              <input
                type="radio"
                name="mode"
                checked={mode === "solo"}
                onChange={() => setMode("solo")}
                className="h-4 w-4 accent-accent"
              />
              <span className="font-bold text-ink">Solo (free-for-all)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 ring-2 ring-ink/5">
              <input
                type="radio"
                name="mode"
                checked={mode === "team"}
                onChange={() => setMode("team")}
                className="h-4 w-4 accent-accent"
              />
              <span className="font-bold text-ink">Team-based</span>
            </label>
          </div>
          <Button
            type="button"
            variant="primary"
            className="mt-8 w-full"
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
            {creating ? "Creating…" : "Create room"}
          </Button>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-[var(--radius-2xl)] bg-gradient-to-br from-peach/90 to-lavender/50 p-8 shadow-[var(--shadow-card)] ring-2 ring-white/80"
        >
          <h2 className="text-2xl font-extrabold text-ink">Join game</h2>
          <p className="mt-2 text-sm font-semibold text-ink-muted">
            Enter the {codeLen}-digit room code.
          </p>
          <label className="mt-6 block text-left">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink-muted">
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
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-4 py-3 text-center text-2xl font-extrabold tracking-[0.3em] text-ink shadow-sm outline-none focus:border-accent/40"
              placeholder={"0".repeat(codeLen)}
            />
            {joinError ? (
              <span className="mt-2 block text-sm font-semibold text-red-700">{joinError}</span>
            ) : null}
          </label>
          <Button
            type="button"
            variant="secondary"
            className="mt-8 w-full"
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
            {joining ? "Joining…" : "Join room"}
          </Button>
        </motion.section>
      </div>

      <p className="text-center text-sm text-ink-muted">
        <Link href="/games" className="font-bold text-accent underline-offset-2 hover:underline">
          All games
        </Link>
      </p>
    </div>
  );
}
