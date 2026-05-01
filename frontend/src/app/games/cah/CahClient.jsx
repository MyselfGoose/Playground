"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCah } from "../../../lib/cah/CahSocketContext.jsx";
import { Button } from "../../../components/Button.jsx";

function normalizeCode(code) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

function scoreRows(players) {
  return [...(players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

function BlackCard({ text, pick }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[28px] border border-white/20 bg-black p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/60">Black Card</p>
      <p className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">{text || "Waiting for prompt..."}</p>
      <p className="mt-5 text-sm font-bold text-white/70">Pick {pick ?? 1}</p>
    </motion.div>
  );
}

function WhiteCard({ card, selected, disabled, onClick }) {
  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -6, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[190px] rounded-[22px] border p-4 text-left shadow-[0_18px_35px_rgba(0,0,0,0.15)] transition-all ${
        selected
          ? "border-primary bg-primary/10 ring-2 ring-primary/35"
          : "border-black/10 bg-white text-black hover:border-black/30"
      } ${disabled ? "opacity-55 cursor-not-allowed" : ""}`}
    >
      <p className="text-xs font-black uppercase tracking-[0.12em] text-black/45">White Card</p>
      <p className="mt-3 text-lg font-bold leading-snug text-black">{card?.text}</p>
    </motion.button>
  );
}

export default function CahClient({ view }) {
  const router = useRouter();
  const {
    room,
    connected,
    connectionState,
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
  const [settings, setSettings] = useState({ maxRounds: 10, handSize: 7 });
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");

  const me = useMemo(() => room?.players?.find((p) => p.userId === localUserId) ?? null, [room?.players, localUserId]);
  const game = room?.game ?? null;
  const isJudge = game?.judgeUserId === localUserId;
  const pickCount = Number(game?.blackCard?.pick ?? 1);

  useEffect(() => {
    if (view !== "entry" || !room?.code) return;
    if (room?.game && room.game.status !== "finished") {
      router.replace("/games/cah/play");
      return;
    }
    if (room?.game?.status === "finished") {
      router.replace("/games/cah/result");
      return;
    }
    router.replace("/games/cah/lobby");
  }, [view, room, router]);

  useEffect(() => {
    if (view !== "lobby" || !game) return;
    router.replace(game.status === "finished" ? "/games/cah/result" : "/games/cah/play");
  }, [view, game, router]);

  useEffect(() => {
    if (!room) return;
    if (view === "play" && game?.status === "finished") {
      router.replace("/games/cah/result");
      return;
    }
    if (view === "result" && game && game.status !== "finished") {
      router.replace("/games/cah/play");
    }
  }, [view, room, game, router]);

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
              <label className="rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
                <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Hand Size</p>
                <input
                  className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold"
                  type="number"
                  min={3}
                  max={10}
                  value={settings.handSize}
                  onChange={(e) => setSettings((s) => ({ ...s, handSize: Number(e.target.value) }))}
                />
              </label>
            </div>
            <Button
              variant="primary"
              className="mt-5 w-full"
              disabled={!connected}
              onClick={() => run(async () => {
                const res = await createRoom(settings);
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
        <p className="text-lg font-black text-foreground">Reconnecting to room...</p>
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
    const canStart = Boolean(room.permissions?.canStart) && allReady && (room.players?.length ?? 0) >= 2;
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
            <label className="rounded-xl bg-muted-bright/25 p-3 ring-1 ring-foreground/10">
              <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Hand Size</p>
              <input
                className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold"
                type="number"
                min={3}
                max={10}
                value={room.settings?.handSize ?? settings.handSize}
                disabled={!room.permissions?.canUpdateSettings}
                onChange={(e) => run(() => updateSettings({ handSize: Number(e.target.value) }))}
              />
            </label>
          </div>
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
          <BlackCard text={game?.blackCard?.text} pick={game?.blackCard?.pick} />
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

        <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-lg font-black text-foreground">Scoreboard</h3>
          <div className="mt-3 space-y-2">
            {scoreRows(room.players ?? []).map((p) => (
              <div key={p.userId} className="flex items-center justify-between rounded-lg bg-muted-bright/25 px-3 py-2 ring-1 ring-foreground/10">
                <p className="text-sm font-bold text-foreground">{p.username}</p>
                <p className="text-lg font-black text-primary">{p.score ?? 0}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
        {status === "submitting" ? (
          <>
            {isJudge ? (
              <p className="text-sm font-semibold text-foreground/75">You are the judge this round. Waiting for submissions...</p>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground/80">
                  Select exactly <span className="text-primary font-black">{pickCount}</span> card(s) and submit.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {hand.map((card) => {
                    const selected = selectedCards.includes(card.sourceId);
                    return (
                      <WhiteCard
                        key={card.sourceId}
                        card={card}
                        selected={selected}
                        disabled={!canSubmit}
                        onClick={() => {
                          if (!canSubmit) return;
                          setSelectedCards((prev) => {
                            if (prev.includes(card.sourceId)) return prev.filter((id) => id !== card.sourceId);
                            if (prev.length >= pickCount) return prev;
                            return [...prev, card.sourceId];
                          });
                        }}
                      />
                    );
                  })}
                </div>
                <Button
                  className="mt-4 w-full sm:w-auto"
                  variant="primary"
                  disabled={!canSubmit || selectedCards.length !== pickCount}
                  onClick={() => run(() => submitCards(selectedCards))}
                >
                  Submit Cards
                </Button>
              </>
            )}
          </>
        ) : null}

        {status === "judging" ? (
          <>
            <p className="text-sm font-semibold text-foreground/80">
              {canJudge ? "Pick the funniest anonymous submission." : "Judge is selecting a winner..."}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(game?.submissions ?? []).map((s) => (
                <button
                  key={s.submissionId}
                  type="button"
                  disabled={!canJudge}
                  onClick={() => setSelectedSubmissionId(s.submissionId)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selectedSubmissionId === s.submissionId
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-foreground/10 bg-muted-bright/20 hover:border-foreground/30"
                  }`}
                >
                  <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Submission</p>
                  <div className="mt-2 space-y-2">
                    {s.cards.map((card) => (
                      <div key={card.sourceId} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black">
                        {card.text}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
            {canJudge ? (
              <Button
                className="mt-4"
                variant="primary"
                disabled={!selectedSubmissionId}
                onClick={() => run(() => judgePickWinner(selectedSubmissionId))}
              >
                Confirm Winner
              </Button>
            ) : null}
          </>
        ) : null}

        {status === "revealing" ? (
          <>
            <p className="text-sm font-semibold text-foreground/80">Winner revealed</p>
            <AnimatePresence>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(game?.submissions ?? []).map((s) => {
                  const won = s.submissionId === game?.winnerSubmissionId;
                  return (
                    <motion.div
                      key={s.submissionId}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-xl border p-3 ${won ? "border-success bg-success/10 ring-2 ring-success/30" : "border-foreground/10 bg-muted-bright/20"}`}
                    >
                      <p className="text-xs font-black uppercase tracking-wide text-foreground/60">
                        {s.cpu ? "House Hand" : s.username ?? "Player"}
                      </p>
                      <div className="mt-2 space-y-2">
                        {s.cards.map((card) => (
                          <div key={card.sourceId} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black">
                            {card.text}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
            {canAdvance ? (
              <Button className="mt-4" variant="primary" onClick={() => run(() => nextRound())}>
                {game?.roundIndex >= game?.maxRounds ? "Finish Game" : "Next Round"}
              </Button>
            ) : null}
          </>
        ) : null}
      </section>

      <div className="flex items-center justify-between text-sm text-foreground/60">
        <p>{connectionState === "connected" ? "Live sync active" : "Reconnecting..."}</p>
        <Button variant="tertiary" onClick={() => run(() => leaveRoom().then((res) => { if (res.ok) router.push("/games/cah"); return res; }))}>
          Leave Game
        </Button>
      </div>
    </div>
  );
}
