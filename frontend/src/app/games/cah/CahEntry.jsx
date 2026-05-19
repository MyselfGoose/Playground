"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCah } from "../../../lib/cah/CahSocketContext.jsx";
import { Button } from "../../../components/Button.jsx";
import { normalizePartyCode } from "../../../lib/party/buildInviteUrl.js";

function normalizeCode(code) {
  return normalizePartyCode(code).slice(0, 4);
}

export function CahEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCodeParam = searchParams.get("code") ?? "";
  const normalizedInvite = inviteCodeParam ? normalizeCode(inviteCodeParam) : "";

  const { connected, socketError, createRoom, joinRoom } = useCah();
  const [joinCode, setJoinCode] = useState(normalizedInvite);
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({ maxRounds: 10 });
  const [entryTab, setEntryTab] = useState(normalizedInvite ? "join" : "create");
  const joinInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  useEffect(() => {
    if (!normalizedInvite) return;
    setJoinCode(normalizedInvite);
    setEntryTab("join");
  }, [normalizedInvite]);

  useEffect(() => {
    if (!normalizedInvite || !joinInputRef.current) return;
    joinInputRef.current.focus();
    joinInputRef.current.select();
  }, [normalizedInvite]);

  async function run(action) {
    const result = await action();
    if (!result.ok) setError(result.error.message);
    else setError("");
    return result;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <section className="rounded-[30px] border border-foreground/10 bg-gradient-to-br from-background/95 via-muted-bright/25 to-pastel-lavender/30 p-6 shadow-[var(--shadow-card)] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground/60">Party game</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground sm:text-5xl">Cards Against Humanity</h1>
        <p className="mt-3 max-w-2xl text-base font-semibold text-foreground/75">
          Build the funniest answer, pass judgment, and race to the highest score in a polished real-time card room.
        </p>
        <p className="mt-3 text-sm font-semibold text-foreground/55">
          Invite friends with a link like{" "}
          <code className="rounded bg-muted-bright/40 px-1.5 py-0.5 text-xs">/games/cah/join?code=XXXX</code>
        </p>
      </section>

      {(socketError || error) && (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
          {socketError || error}
        </p>
      )}

      <div className="flex gap-2 rounded-full bg-muted-bright/30 p-1 ring-1 ring-foreground/10">
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-black ${entryTab === "create" ? "bg-background text-foreground shadow-sm" : "text-foreground/60"}`}
          onClick={() => setEntryTab("create")}
        >
          Create
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-4 py-2 text-sm font-black ${entryTab === "join" ? "bg-background text-foreground shadow-sm" : "text-foreground/60"}`}
          onClick={() => setEntryTab("join")}
        >
          Join
        </button>
      </div>

      {entryTab === "create" ? (
        <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
          <h2 className="text-2xl font-black text-foreground">Create Lobby</h2>
          <p className="mt-2 text-xs font-semibold text-foreground/55">
            Choose packs in the lobby after creating. Up to 10 players by default.
          </p>
          <label className="mt-5 block rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
            <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Rounds</p>
            <input
              className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold"
              type="number"
              min={1}
              max={20}
              value={settings.maxRounds}
              onChange={(e) => setSettings((s) => ({ ...s, maxRounds: Number(e.target.value) }))}
            />
          </label>
          <Button
            variant="primary"
            className="mt-5 w-full"
            disabled={!connected}
            onClick={() =>
              void run(async () => {
                const res = await createRoom({ maxRounds: settings.maxRounds });
                if (res.ok) router.push("/games/cah/lobby");
                return res;
              })
            }
          >
            Create Game
          </Button>
        </section>
      ) : (
        <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
          <h2 className="text-2xl font-black text-foreground">Join Lobby</h2>
          <label className="mt-5 block rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
            <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Lobby Code</p>
            <input
              ref={joinInputRef}
              className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-3 text-center text-2xl font-black tracking-[0.3em]"
              value={joinCode}
              onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
              placeholder="XXXX"
              maxLength={4}
            />
          </label>
          <Button
            variant="secondary"
            className="mt-5 w-full"
            disabled={!connected || joinCode.length !== 4}
            onClick={() =>
              void run(async () => {
                const res = await joinRoom(joinCode);
                if (res.ok) router.push("/games/cah/lobby");
                return res;
              })
            }
          >
            Join Game
          </Button>
        </section>
      )}

      <p className="text-center text-sm font-semibold text-foreground/55">
        <Link href="/games" className="text-primary hover:underline">
          Back to games
        </Link>
      </p>
    </div>
  );
}
