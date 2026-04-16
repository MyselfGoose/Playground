"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";

function NpatResultInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const { room, connected, joinRoom } = useNpat();
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!code || !connected || joinedRef.current) return;
    joinedRef.current = true;
    joinRoom(code);
  }, [code, connected, joinRoom]);

  useEffect(() => {
    if (room?.state && room.state !== "FINISHED") {
      router.replace(`/games/npat/play?code=${room.code ?? code}`);
    }
  }, [room?.state, room?.code, code, router]);

  const rounds = room?.results?.rounds;
  const list = Array.isArray(rounds) ? rounds : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">Game over</h1>
        <p className="mt-2 text-lg text-ink-muted">Here is every round you just played.</p>
      </motion.header>

      <div className="flex flex-col gap-6">
        {list.map((r, i) => (
          <motion.article
            key={`${r.roundIndex}-${r.letter}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-[var(--radius-2xl)] bg-white/85 p-6 shadow-[var(--shadow-card)] ring-2 ring-white/80"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-2xl font-black text-accent">
                Round {r.roundIndex + 1}{" "}
                <span className="text-ink">· {r.letter}</span>
              </h2>
              <span className="text-xs font-bold text-ink-muted">{String(r.endedAt)}</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {Object.entries(r.submissions ?? {}).map(([uid, row]) => {
                const name =
                  room?.players?.find((p) => p.userId === uid)?.username ?? `Player ${uid.slice(-4)}`;
                return (
                  <div key={uid} className="rounded-2xl bg-mint/20 p-4 ring-1 ring-mint/40">
                    <p className="font-extrabold text-ink">{name}</p>
                    <dl className="mt-2 space-y-1 text-sm">
                      {["name", "place", "animal", "thing"].map((k) => (
                        <div key={k} className="flex gap-2">
                          <dt className="w-16 shrink-0 font-bold capitalize text-ink-muted">{k}</dt>
                          <dd className="font-semibold text-ink">{row[k] ?? "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>
          </motion.article>
        ))}
        {list.length === 0 ? (
          <p className="text-center text-ink-muted">No round data yet — try refreshing.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/games/npat"
          className="rounded-2xl bg-accent px-6 py-3 text-sm font-extrabold text-white shadow-[var(--shadow-soft)]"
        >
          Play again
        </Link>
        <Link href="/games" className="rounded-2xl px-6 py-3 text-sm font-extrabold text-ink-muted ring-2 ring-ink/10">
          All games
        </Link>
      </div>
    </div>
  );
}

export default function NpatResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading results…</div>
      }
    >
      <NpatResultInner />
    </Suspense>
  );
}
