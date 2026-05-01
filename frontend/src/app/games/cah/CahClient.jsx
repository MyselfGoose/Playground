"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCah } from "../../../lib/cah/CahSocketContext.jsx";
import { Button } from "../../../components/Button.jsx";
import { BlackCardStage } from "./components/CardPieces.jsx";
import ScoreboardRail, { scoreRows } from "./components/ScoreboardRail.jsx";
import SubmissionCenter from "./components/SubmissionCenter.jsx";

function normalizeCode(code) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export default function CahClient({ view }) {
  const router = useRouter();
  const {
    room,
    connected,
    connectionState,
    syncState,
    socketError,
    localUserId,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    updateSettings,
    startGame,
    submitCards,
    judgePickWinner,
    nextRound,
  } = useCah();

  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({ maxRounds: 10 });
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const pathname = usePathname();

  const me = useMemo(() => room?.players?.find((p) => p.userId === localUserId) ?? null, [room?.players, localUserId]);
  const game = room?.game ?? null;
  const isJudge = game?.judgeUserId === localUserId;
  const pickCount = Number(game?.blackCard?.pick ?? 1);

  useEffect(() => {
    const targetRoute = !room?.code
      ? view === "entry"
        ? null
        : "/games/cah"
      : game?.status === "finished"
        ? "/games/cah/result"
        : game
          ? "/games/cah/play"
          : "/games/cah/lobby";
    if (!targetRoute || syncState !== "ready") return;
    if (pathname !== targetRoute) router.replace(targetRoute);
  }, [view, room?.code, game?.status, syncState, pathname, router, game]);

  useEffect(() => {
    setSelectedCards([]);
    setSelectedSubmissionId("");
  }, [game?.roundIndex, game?.status]);

  async function run(action) {
    const result = await action();
    if (!result.ok) setError(result.error.message);
    else setError("");
    return result;
  }

  if (view === "entry") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <section className="rounded-[30px] border border-foreground/10 bg-gradient-to-br from-background/95 via-muted-bright/25 to-pastel-lavender/30 p-6 shadow-[var(--shadow-card)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground/60">Party game</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground sm:text-5xl">Cards Against Humanity</h1>
          <p className="mt-3 max-w-2xl text-base font-semibold text-foreground/75">
            Build the funniest answer, pass judgment, and race to the highest score in a polished real-time card room.
          </p>
        </section>

        {(socketError || error) && (
          <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {socketError || error}
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-2xl font-black text-foreground">Create Lobby</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <label className="rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
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
              <div className="rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
                <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Hand Size</p>
                <p className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold">
                  10 cards (fixed)
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              className="mt-5 w-full"
              disabled={!connected}
              onClick={() => run(async () => {
                const res = await createRoom({ maxRounds: settings.maxRounds });
                if (res.ok) router.push("/games/cah/lobby");
                return res;
              })}
            >
              Create Game
            </Button>
          </section>

          <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-2xl font-black text-foreground">Join Lobby</h2>
            <label className="mt-5 block rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
              <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Lobby Code</p>
              <input
                className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-3 text-center text-2xl font-black tracking-[0.3em]"
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                placeholder="XXXX"
              />
            </label>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              disabled={!connected || joinCode.length !== 4}
              onClick={() => run(async () => {
                const res = await joinRoom(joinCode);
                if (res.ok) router.push("/games/cah/lobby");
                return res;
              })}
            >
              Join Game
            </Button>
          </section>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <p className="text-lg font-black text-foreground">Syncing room state...</p>
        <p className="text-sm font-semibold text-foreground/65">
          If this takes too long, return to the lobby and join again.
        </p>
        <Button variant="secondary" onClick={() => router.replace("/games/cah")}>
          Back to CAH Home
        </Button>
      </div>
    );
  }

  if (view === "lobby") {
    const allReady = room.players?.every((p) => p.ready);
    const playerCount = room.players?.length ?? 0;
    const canStart = Boolean(room.permissions?.canStart) && allReady && playerCount >= 3;
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8">
        <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-foreground/55">Lobby Code</p>
              <h2 className="text-4xl font-black tracking-[0.15em] text-foreground">{room.code}</h2>
            </div>
            <div className="flex gap-2">
              <Button variant="tertiary" onClick={() => run(() => leaveRoom().then((res) => { if (res.ok) router.push("/games/cah"); return res; }))}>Leave</Button>
              <Button variant="primary" disabled={!canStart} onClick={() => run(async () => {
                const res = await startGame();
                if (res.ok) router.push("/games/cah/play");
                return res;
              })}>
                Start Game
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="rounded-xl bg-muted-bright/25 p-3 ring-1 ring-foreground/10">
              <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Rounds</p>
              <input
                className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold"
                type="number"
                min={1}
                max={20}
                value={room.settings?.maxRounds ?? settings.maxRounds}
                disabled={!room.permissions?.canUpdateSettings}
                onChange={(e) => run(() => updateSettings({ maxRounds: Number(e.target.value) }))}
              />
            </label>
            <div className="rounded-xl bg-muted-bright/25 p-3 ring-1 ring-foreground/10">
              <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Hand Size</p>
              <p className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold">
                10 cards (fixed)
              </p>
            </div>
          </div>
          {playerCount < 3 ? (
            <p className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm font-semibold text-warning">
              Minimum 3 players required to start
            </p>
          ) : null}
        </section>

        <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
          <h3 className="text-xl font-black text-foreground">Players</h3>
          <div className="mt-3 grid gap-2">
            {(room.players ?? []).map((p) => (
              <div key={p.userId} className="flex items-center justify-between rounded-xl bg-muted-bright/25 px-3 py-2 ring-1 ring-foreground/10">
                <p className="font-bold text-foreground">
                  {p.username}
                  {p.userId === localUserId ? " (You)" : ""}
                  {p.userId === room.hostId ? " • Host" : ""}
                </p>
                <span className={`text-xs font-black uppercase ${p.ready ? "text-success" : "text-warning"}`}>
                  {p.ready ? "Ready" : "Not Ready"}
                </span>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full" variant={me?.ready ? "secondary" : "primary"} onClick={() => run(() => setReady(!me?.ready))}>
            {me?.ready ? "Unready" : "Ready Up"}
          </Button>
        </section>
      </div>
    );
  }

  const status = game?.status ?? "lobby";
  const isFinished = status === "finished";
  if (view === "result" || isFinished) {
    const rows = scoreRows(room.players ?? []);
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-10">
        <section className="rounded-[30px] border border-foreground/10 bg-background/90 p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
          <h2 className="text-4xl font-black text-foreground">Game Finished</h2>
          <p className="mt-2 text-foreground/70">Best score wins. Thanks for playing!</p>
        </section>
        <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)]">
          <h3 className="text-xl font-black text-foreground">Final Standings</h3>
          <div className="mt-3 space-y-2">
            {rows.map((p, idx) => (
              <div key={p.userId} className="flex items-center justify-between rounded-xl bg-muted-bright/25 px-4 py-3 ring-1 ring-foreground/10">
                <p className="font-bold text-foreground">#{idx + 1} {p.username}</p>
                <p className="text-xl font-black text-primary">{p.score ?? 0}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" variant="secondary" onClick={() => run(() => leaveRoom().then((res) => { if (res.ok) router.push("/games/cah"); return res; }))}>Leave</Button>
            <Link className="flex-1" href="/leaderboard"><Button className="w-full" variant="primary">Leaderboard</Button></Link>
          </div>
        </section>
      </div>
    );
  }

  const canSubmit = Boolean(room.permissions?.canSubmitCards);
  const canJudge = Boolean(room.permissions?.canJudgePickWinner);
  const canAdvance = Boolean(room.permissions?.canNextRound);
  const hand = game?.hand ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      {(socketError || error) ? (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
          {socketError || error}
        </p>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.55fr]">
        <section className="space-y-4">
          <BlackCardStage text={game?.blackCard?.text} pick={game?.blackCard?.pick} />
          <div className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black uppercase tracking-wide text-foreground/60">
                Round {game?.roundIndex}/{game?.maxRounds}
              </p>
              <p className="text-sm font-bold text-foreground/70 capitalize">{status}</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground/80">
              Judge: {room.players?.find((p) => p.userId === game?.judgeUserId)?.username ?? "—"}
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              Submissions: {game?.submittedCount ?? 0}/{game?.totalExpectedSubmissions ?? 0}
            </p>
          </div>
        </section>

        <ScoreboardRail players={room.players} />
      </div>

      <SubmissionCenter
        status={status}
        isJudge={isJudge}
        pickCount={pickCount}
        canSubmit={canSubmit}
        canJudge={canJudge}
        canAdvance={canAdvance}
        hand={hand}
        submissions={game?.submissions ?? []}
        winnerSubmissionId={game?.winnerSubmissionId}
        selectedCards={selectedCards}
        setSelectedCards={setSelectedCards}
        selectedSubmissionId={selectedSubmissionId}
        setSelectedSubmissionId={setSelectedSubmissionId}
        submitCards={() => run(() => submitCards(selectedCards))}
        judgePickWinner={() => run(() => judgePickWinner(selectedSubmissionId))}
        nextRound={() => run(() => nextRound())}
        game={game}
      />

      <div className="flex items-center justify-between text-sm text-foreground/60">
        <p>{connectionState === "connected" ? "Live sync active" : "Reconnecting..."}</p>
        <Button variant="tertiary" onClick={() => run(() => leaveRoom().then((res) => { if (res.ok) router.push("/games/cah"); return res; }))}>
          Leave Game
        </Button>
      </div>
    </div>
  );
}
