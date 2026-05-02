"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useHangman } from "../../../lib/hangman/HangmanSocketContext.jsx";
import { Button } from "../../../components/Button.jsx";
import { HangmanSvg } from "./components/HangmanSvg.jsx";
import { LetterKeyboard } from "./components/LetterKeyboard.jsx";

function normalizeCode(code) {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}

export default function HangmanClient({ view }) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    room,
    connected,
    syncState,
    socketError,
    localUserId,
    createRoom,
    joinRoom,
    leaveRoom,
    send,
  } = useHangman();

  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [setterWord, setSetterWord] = useState("");
  const [settings, setSettings] = useState({ maxWrongGuesses: 7 });

  const game = room?.game ?? null;
  const phase = game?.phase ?? (game ? "lobby" : null);
  const permissions = room?.permissions ?? {};

  const scoreRows = useMemo(() => {
    const entries = Object.entries(game?.scores ?? {}).sort((a, b) => b[1] - a[1]);
    return entries.map(([uid, score]) => ({
      uid,
      score,
      name: room?.players?.find((p) => p.userId === uid)?.username ?? uid,
    }));
  }, [game?.scores, room?.players]);

  useEffect(() => {
    if (syncState === "ready" && !room?.code && view !== "entry") {
      router.replace("/games/hangman");
    }
  }, [syncState, room?.code, view, router]);

  useEffect(() => {
    const inLobby = !game;
    const targetRoute = !room?.code
      ? view === "entry"
        ? null
        : "/games/hangman"
      : phase === "game_end"
        ? "/games/hangman/play"
        : inLobby
          ? "/games/hangman/lobby"
          : "/games/hangman/play";
    if (!targetRoute || syncState !== "ready") return;
    if (pathname !== targetRoute) router.replace(targetRoute);
  }, [view, room?.code, phase, syncState, pathname, router, game]);

  async function run(action) {
    const result = await action();
    if (!result.ok) setError(result.error.message);
    else setError("");
    return result;
  }

  if (view === "entry") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <section className="rounded-[30px] border border-foreground/10 bg-gradient-to-br from-background/95 via-muted-bright/25 to-pastel-sky/25 p-6 shadow-[var(--shadow-card)] sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-foreground/60">Word game</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-foreground sm:text-5xl">Hangman</h1>
          <p className="mt-3 max-w-2xl text-base font-semibold text-foreground/75">
            Solo practice or multiplayer rooms: take turns setting the word, then race to guess letters in real time.
          </p>
        </section>

        {(socketError || error) && (
          <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {socketError || error}
          </p>
        )}

        <div className="flex flex-wrap gap-4">
          <Link href="/games/hangman/solo">
            <Button variant="primary" className="rounded-full px-8">
              Solo mode
            </Button>
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-2xl font-black text-foreground">Create room</h2>
            <label className="mt-4 block rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
              <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Max wrong guesses</p>
              <input
                className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold"
                type="number"
                min={4}
                max={12}
                value={settings.maxWrongGuesses}
                onChange={(e) => setSettings((s) => ({ ...s, maxWrongGuesses: Number(e.target.value) }))}
              />
            </label>
            <Button
              variant="primary"
              className="mt-5 w-full"
              disabled={!connected}
              onClick={() =>
                run(async () => {
                  const res = await createRoom({ maxWrongGuesses: settings.maxWrongGuesses });
                  if (res.ok) router.push("/games/hangman/lobby");
                  return res;
                })
              }
            >
              Create lobby
            </Button>
          </section>

          <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)] sm:p-6">
            <h2 className="text-2xl font-black text-foreground">Join room</h2>
            <label className="mt-4 block rounded-xl bg-muted-bright/30 p-3 ring-1 ring-foreground/10">
              <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Room code</p>
              <input
                className="mt-2 w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 font-bold uppercase tracking-widest"
                maxLength={4}
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeCode(e.target.value))}
                placeholder="ABCD"
              />
            </label>
            <Button
              variant="secondary"
              className="mt-5 w-full"
              disabled={!connected || joinCode.length !== 4}
              onClick={() =>
                run(async () => {
                  const res = await joinRoom(joinCode);
                  if (res.ok) router.push("/games/hangman/lobby");
                  return res;
                })
              }
            >
              Join
            </Button>
          </section>
        </div>

        <Link href="/games" className="text-sm font-bold text-foreground/60 hover:text-primary">
          ← All games
        </Link>
      </div>
    );
  }

  if (view === "lobby") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-foreground/55">Room</p>
            <p className="text-3xl font-black tracking-widest text-primary">{room?.code}</p>
          </div>
          <Button
            variant="ghost"
            onClick={() =>
              run(async () => {
                const res = await leaveRoom();
                if (res.ok) router.push("/games/hangman");
                return res;
              })
            }
          >
            Leave
          </Button>
        </header>
        {error ? (
          <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>
        ) : null}
        <ul className="space-y-2 rounded-2xl border border-foreground/10 bg-muted-bright/20 p-4">
          {(room?.players ?? []).map((p) => (
            <li key={p.userId} className="flex justify-between font-bold text-foreground">
              <span>{p.username}</span>
              <span className="text-foreground/55">{p.ready ? "Ready" : "Not ready"}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => run(() => send("set_ready", { ready: !(room?.players ?? []).find((p) => p.userId === localUserId)?.ready }))}
          >
            Toggle ready
          </Button>
          {permissions.canStart ? (
            <Button
              variant="primary"
              onClick={() =>
                run(async () => {
                  const res = await send("start_game", {});
                  if (res.ok) router.push("/games/hangman/play");
                  return res;
                })
              }
            >
              Start game
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  /* play */
  const masked = game?.maskedWord ?? "";
  const maxWrong = game?.maxWrongGuesses ?? 7;
  const wrongCt = game?.wrongGuessCount ?? 0;
  const guessersBlocked = !permissions.canGuess;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_240px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase text-foreground/55">
              Round {game?.roundNumber ?? 1} · {phase?.replace("_", " ")}
            </p>
            <p className="mt-1 font-mono text-2xl font-black tracking-[0.2em] text-foreground sm:text-3xl">{masked}</p>
          </div>
          <HangmanSvg stage={wrongCt} maxStage={maxWrong} className="h-36 w-28 shrink-0 text-foreground sm:h-44 sm:w-36" />
        </div>

        {phase === "setter_pick" && permissions.canSubmitWord ? (
          <div className="rounded-2xl border border-accent-sky/40 bg-accent-sky/10 p-4 ring-1 ring-accent-sky/30">
            <p className="text-sm font-black text-foreground">You are the word setter</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="text-xs font-bold text-foreground/55">Your word (letters only)</span>
                <input
                  className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 font-bold"
                  value={setterWord}
                  onChange={(e) => setSetterWord(e.target.value)}
                  placeholder="mystery"
                  autoComplete="off"
                />
              </label>
              <Button
                variant="secondary"
                onClick={() =>
                  run(async () => {
                    const res = await send("setter_request_random_word", {});
                    if (res.ok) setSetterWord("");
                    return res;
                  })
                }
              >
                Random word
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  run(async () => {
                    const res = await send("setter_submit_word", { word: setterWord });
                    if (res.ok) setSetterWord("");
                    return res;
                  })
                }
              >
                Submit word
              </Button>
            </div>
          </div>
        ) : null}

        {phase === "setter_pick" && !permissions.canSubmitWord ? (
          <p className="rounded-xl bg-muted-bright/30 px-4 py-3 text-sm font-bold text-foreground/75">
            Waiting for <span className="text-primary">{room?.players?.find((p) => p.userId === game?.setterUserId)?.username ?? "setter"}</span> to choose a word…
          </p>
        ) : null}

        {(phase === "guessing" || phase === "round_end") && (
          <div className="rounded-2xl border border-foreground/10 bg-muted-bright/15 p-4">
            <p className="mb-3 text-xs font-black uppercase text-foreground/55">Guessed</p>
            <div className="flex flex-wrap gap-2 text-sm font-bold">
              <span className="text-accent-mint">✓ {(game?.guessedLetters ?? []).join(", ") || "—"}</span>
              <span className="text-error">✗ {(game?.wrongLetters ?? []).join(", ") || "—"}</span>
            </div>
          </div>
        )}

        {phase === "guessing" && game?.secretPreviewForSetter ? (
          <p className="rounded-xl bg-muted-bright/25 px-4 py-2 text-sm font-semibold text-foreground/80">
            Your word: <span className="font-mono font-black text-primary">{game.secretPreviewForSetter}</span>
          </p>
        ) : null}

        {phase === "guessing" ? (
          <LetterKeyboard
            guessed={game?.guessedLetters}
            wrong={game?.wrongLetters}
            disabled={guessersBlocked}
            onLetter={(letter) => run(() => send("guess_letter", { letter }))}
          />
        ) : null}

        {phase === "round_end" ? (
          <div className="rounded-2xl border border-foreground/10 bg-background/90 p-5">
            <p className="text-lg font-black text-foreground">
              Round over — <span className="text-primary">{game?.lastOutcome}</span>
            </p>
            <p className="mt-2 font-mono text-xl font-bold text-foreground">Word: {game?.revealedWord ?? "—"}</p>
            {permissions.canNextRound ? (
              <Button className="mt-4" variant="primary" onClick={() => run(() => send("next_round", {}))}>
                Next round
              </Button>
            ) : (
              <p className="mt-3 text-sm font-semibold text-foreground/60">Waiting for host to advance…</p>
            )}
          </div>
        ) : null}

        {phase === "game_end" ? (
          <div className="rounded-2xl border border-primary/40 bg-primary/10 p-6 ring-2 ring-primary/25">
            <p className="text-2xl font-black text-foreground">Game finished</p>
            <p className="mt-2 text-sm font-semibold text-foreground/70">Highest score wins.</p>
            <ul className="mt-4 space-y-2">
              {scoreRows.map((row, i) => (
                <li key={row.uid} className="flex justify-between rounded-xl bg-background/80 px-4 py-2 font-bold">
                  <span>
                    #{i + 1} {row.name}
                  </span>
                  <span className="text-primary">{row.score.toFixed(0)}</span>
                </li>
              ))}
            </ul>
            <Button
              className="mt-6"
              variant="secondary"
              onClick={() =>
                run(async () => {
                  const res = await leaveRoom();
                  if (res.ok) router.push("/games/hangman");
                  return res;
                })
              }
            >
              Back to menu
            </Button>
          </div>
        ) : null}
      </div>

      <aside className="rounded-2xl border border-foreground/10 bg-muted-bright/20 p-4 lg:sticky lg:top-24 lg:self-start">
        <p className="text-xs font-black uppercase text-foreground/55">Scores</p>
        <ul className="mt-3 space-y-2 text-sm font-bold">
          {scoreRows.map((row) => (
            <li key={row.uid} className="flex justify-between gap-2">
              <span className="truncate">{row.name}</span>
              <span className="text-primary">{row.score.toFixed(0)}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
