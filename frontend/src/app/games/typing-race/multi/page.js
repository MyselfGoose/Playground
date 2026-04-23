"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTypingRace } from "../../../../lib/typing-race/TypingRaceSocketContext.jsx";
import { Button } from "../../../../components/Button.jsx";

export default function TypingMultiHubPage() {
  const router = useRouter();
  const { createRoom, joinRoom, connected, socketError } = useTypingRace();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string | null} */ (null));

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--tt-accent-soft)]">
        Multiplayer
      </p>
      <h1 className="mt-2 text-center font-sans text-2xl font-bold text-[var(--tt-ink-strong)]">
        Typing race
      </h1>
      <p className="mt-2 text-center text-sm text-[var(--tt-ink-muted)]">
        {connected ? "Connected to server" : "Connecting…"}
      </p>
      {(socketError || err) && (
        <p className="mt-2 text-center text-sm text-red-400">{err ?? socketError}</p>
      )}

      <div className="mt-10 space-y-6">
        <Button
          type="button"
          className="w-full"
          disabled={!connected || busy}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            const r = await createRoom();
            setBusy(false);
            if (!r.ok) {
              setErr(r.error?.message ?? "Failed");
              return;
            }
            const c = /** @type {any} */ (r.data)?.roomCode;
            if (c) {
              router.push(`/games/typing-race/multi/room/${c}`);
            }
          }}
        >
          Create room
        </Button>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--tt-ink-muted)]">
            Join code
          </label>
          <input
            className="mt-1 w-full rounded-lg border border-[var(--tt-ink-muted)]/30 bg-[var(--tt-bg-elevated)] px-3 py-2 font-mono text-[var(--tt-ink)]"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={12}
          />
          <Button
            type="button"
            className="mt-3 w-full"
            variant="secondary"
            disabled={!connected || busy || code.replace(/\D/g, "").length < 6}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              const r = await joinRoom(code);
              setBusy(false);
              if (!r.ok) {
                setErr(r.error?.message ?? "Failed");
                return;
              }
              const digits = code.replace(/\D/g, "");
              router.push(`/games/typing-race/multi/room/${digits}`);
            }}
          >
            Join room
          </Button>
        </div>

        <p className="text-center">
          <Link
            href="/games/typing-race"
            className="text-sm text-[var(--tt-accent)] underline-offset-2 hover:underline"
          >
            Solo typing test
          </Link>
        </p>
      </div>
    </div>
  );
}
