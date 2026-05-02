"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../../../lib/api.js";
import { Button } from "../../../../components/Button.jsx";
import { HangmanSvg } from "../components/HangmanSvg.jsx";
import { LetterKeyboard } from "../components/LetterKeyboard.jsx";

async function fetchRandomWord() {
  if (!API_BASE) throw new Error("Set NEXT_PUBLIC_API_URL.");
  const res = await fetch(`${API_BASE}/api/v1/hangman/word/random`, { credentials: "omit" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json?.error && typeof json.error.message === "string" ? json.error.message : "Could not load word";
    throw new Error(msg);
  }
  return String(json?.data?.word ?? "");
}

export default function HangmanSoloPage() {
  const [secret, setSecret] = useState("");
  const [guessed, setGuessed] = useState([]);
  const [wrong, setWrong] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("playing");
  const submittedResultRef = useRef(false);

  const maxWrong = 7;
  const guessedSet = useMemo(() => new Set(guessed), [guessed]);

  const masked = useMemo(() => {
    if (!secret) return "";
    return [...secret].map((ch) => (guessedSet.has(ch) ? ch : "_")).join(" ");
  }, [secret, guessedSet]);

  const loadWord = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const w = await fetchRandomWord();
      setSecret(w.toLowerCase());
      setGuessed([]);
      setWrong([]);
      setStatus("playing");
      submittedResultRef.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setSecret("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWord();
  }, [loadWord]);

  useEffect(() => {
    if (!secret || status !== "playing") return;
    const uniq = new Set(secret.split(""));
    let won = true;
    for (const c of uniq) {
      if (!guessedSet.has(c)) {
        won = false;
        break;
      }
    }
    if (won) setStatus("won");
  }, [secret, guessedSet, status]);

  useEffect(() => {
    if (wrong.length >= maxWrong) setStatus("lost");
  }, [wrong.length, maxWrong]);

  useEffect(() => {
    if (!secret || submittedResultRef.current) return;
    if (status !== "won" && status !== "lost") return;
    submittedResultRef.current = true;
    const totalGuesses = guessed.length + wrong.length;
    void fetch(`${API_BASE}/api/v1/hangman/result/solo`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        won: status === "won",
        wrongGuesses: wrong.length,
        correctGuesses: guessed.length,
        totalGuesses,
        wordLength: secret.length,
      }),
    }).catch(() => {});
  }, [status, guessed.length, wrong.length, secret]);

  function onLetter(letter) {
    if (status !== "playing" || !secret) return;
    const ch = letter.toLowerCase();
    if (guessedSet.has(ch) || wrong.includes(ch)) return;
    if (secret.includes(ch)) setGuessed((g) => [...g, ch].sort());
    else setWrong((w) => [...w, ch].sort());
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-foreground/55">Solo Hangman</p>
          <h1 className="text-3xl font-black text-foreground">Practice round</h1>
        </div>
        <Link href="/games/hangman" className="text-sm font-bold text-primary hover:underline">
          Multiplayer →
        </Link>
      </div>

      {error ? (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-6 rounded-[28px] border border-foreground/10 bg-muted-bright/20 p-6">
        <div>
          <p className="font-mono text-2xl font-black tracking-[0.15em] text-foreground sm:text-3xl">{loading ? "…" : masked}</p>
          <p className="mt-2 text-sm font-semibold text-foreground/60">
            Wrong: {wrong.length} / {maxWrong}
          </p>
          {status === "won" ? <p className="mt-4 text-lg font-black text-accent-mint">You won!</p> : null}
          {status === "lost" ? (
            <p className="mt-4 text-lg font-black text-error">
              Out of guesses — word was <span className="font-mono">{secret}</span>
            </p>
          ) : null}
        </div>
        <HangmanSvg stage={wrong.length} maxStage={maxWrong} className="h-40 w-32 text-foreground" />
      </div>

      <LetterKeyboard guessed={guessed} wrong={wrong} disabled={loading || status !== "playing"} onLetter={onLetter} />

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" disabled={loading} onClick={() => void loadWord()}>
          New word
        </Button>
        <Button
          variant="secondary"
          disabled={loading || !secret}
          onClick={() => {
            setGuessed([]);
            setWrong([]);
            setStatus("playing");
            submittedResultRef.current = false;
          }}
        >
          Restart same word
        </Button>
        <Link href="/games">
          <Button variant="ghost">All games</Button>
        </Link>
      </div>
    </div>
  );
}
