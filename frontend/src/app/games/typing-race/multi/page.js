"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTypingRace } from "../../../../lib/typing-race/TypingRaceSocketContext.jsx";
import { Button } from "../../../../components/Button.jsx";

export default function TypingMultiHubPage() {
  const router = useRouter();
  const { createRoom, joinRoom, connected, socketError, typingRaceUserFacingError } =
    useTypingRace();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string | null} */ (null));

  return (
    <div className="multi-phase-enter mx-auto w-full max-w-2xl flex-1 px-4 py-12">
      <p className="text-center text-xs font-bold uppercase tracking-widest text-[var(--tt-accent-soft)]">
        Multiplayer
      </p>
      <h1 className="mt-2 text-center font-sans text-2xl font-bold text-[var(--tt-ink-strong)]">
        Typing race
      </h1>
      <div className="mt-3 flex items-center justify-center gap-2">
        {!connected && !socketError && <div className="multi-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />}
        <p className="text-center text-sm text-[var(--tt-ink-muted)]">
          {connected ? "Connected to server" : "Connecting\u2026"}
        </p>
      </div>
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
              setErr(typingRaceUserFacingError(r.error));
              return;
            }
            const data = /** @type {any} */ (r.data);
            const c = data?.roomCode ?? data?.room?.roomCode;
            if (typeof c === "string" && c.replace(/\D/g, "").length >= 6) {
              router.push(`/games/typing-race/multi/room/${c.replace(/\D/g, "")}`);
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
                setErr(typingRaceUserFacingError(r.error));
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
