"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { useLeaveLobby } from "../../../lib/party/useLeaveLobby.js";
import { mapPartyPlayer } from "../../../lib/party/mapPartyPlayer.js";
import { PartyLobby } from "../../../components/party/PartyLobby.jsx";
import { LobbyInviteFriends } from "../../../components/party/LobbyInviteFriends.jsx";
import { FIBBAGE_PATHS } from "./fibbage-shared.js";

const MIN_PLAYERS = 3;
const DEFAULT_WRITING_SECONDS = 90;
const DEFAULT_VOTING_SECONDS = 45;

export function FibbageLobby() {
  const router = useRouter();
  const {
    room,
    localUserId,
    connected,
    socketError,
    leaveRoom,
    setReady,
    updateSettings,
    startGame,
  } = useFibbage();

  const [startPending, setStartPending] = useState(false);
  const [readyPending, setReadyPending] = useState(false);
  const [error, setError] = useState(null);

  const partyPlayers = useMemo(
    () => (room?.players ?? []).map((p) => mapPartyPlayer(p, { hostId: room?.hostUserId })),
    [room?.players, room?.hostUserId],
  );

  const settings = room?.settings ?? {};
  const isHost = localUserId === room?.hostUserId;
  const localPlayer = room?.players?.find((p) => p.userId === localUserId);
  const ready = localPlayer?.ready ?? false;

  const connectedCount = partyPlayers.filter((p) => p.connected).length;
  const readyCount = partyPlayers.filter((p) => p.ready).length;
  const canStart = isHost && connectedCount >= MIN_PLAYERS && readyCount === connectedCount;

  const displayError = error ?? socketError ?? null;

  const { requestLeave } = useLeaveLobby({
    leaveRoom,
    onLeft: () => router.replace(FIBBAGE_PATHS.entry),
    onError: (msg) => setError(msg),
  });

  const handleReadyToggle = useCallback(async () => {
    setReadyPending(true);
    setError(null);
    try {
      const result = await setReady(!ready);
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not update ready state.");
      }
    } catch {
      setError("Could not update ready state.");
    } finally {
      setReadyPending(false);
    }
  }, [setReady, ready]);

  const handleStart = useCallback(async () => {
    setStartPending(true);
    setError(null);
    try {
      const result = await startGame();
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not start game");
      }
    } catch {
      setError("Failed to start game.");
    } finally {
      setStartPending(false);
    }
  }, [startGame]);

  const handleSettingsChange = useCallback(
    async (key, value) => {
      setError(null);
      try {
        const result = await updateSettings({ [key]: value });
        if (result && !result.ok) {
          setError(result.error?.message ?? "Could not update settings.");
        }
      } catch {
        setError("Could not update settings.");
      }
    },
    [updateSettings],
  );

  const settingsPanel = (
    <>
      {isHost ? (
        <FibbageSettingsPanel settings={settings} onChange={handleSettingsChange} />
      ) : (
        <FibbageSettingsDisplay settings={settings} />
      )}
      {room?.code && room?.hostUserId ? (
        <LobbyInviteFriends
          gameSlug="fibbage"
          roomCode={room.code}
          hostId={room.hostUserId}
          localUserId={localUserId ?? ""}
          playerUserIds={partyPlayers.map((p) => p.id)}
        />
      ) : null}
    </>
  );

  return (
    <div className="min-h-[100dvh]">
      <PartyLobby
        gameSlug="fibbage"
        code={room?.code}
        players={partyPlayers}
        localUserId={localUserId}
        startPolicy="host"
        startRules={
          connectedCount < MIN_PLAYERS
            ? `Need at least ${MIN_PLAYERS} players to start`
            : "Host can start when all players are ready"
        }
        minPlayers={MIN_PLAYERS}
        connectedCount={connectedCount}
        readyCount={readyCount}
        header={{
          gameId: "fibbage",
          eyebrow: "Fibbage",
          title: "Lobby",
          description: "Write lies. Fool your friends.",
          align: "left",
        }}
        settings={settingsPanel}
        ready={ready}
        onReadyToggle={handleReadyToggle}
        readyDisabled={!connected}
        readyPending={readyPending}
        canStart={canStart}
        onStart={handleStart}
        startPending={startPending}
        onLeave={requestLeave}
        leaveConfirmTitle="Leave Fibbage?"
        leaveConfirmDescription="You'll lose your spot in this lobby."
        error={displayError}
      />
    </div>
  );
}

function FibbageSettingsPanel({ settings, onChange }) {
  return (
    <div className="space-y-4 rounded-xl bg-[var(--fibbage-canvas-light)] p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--fibbage-text-muted)]">
        Game Settings
      </h3>

      <SettingSlider
        label="Rounds"
        value={settings.roundCount ?? 5}
        min={3}
        max={10}
        step={1}
        onCommit={(v) => onChange("roundCount", v)}
        format={(v) => `${v} rounds`}
      />

      <SettingSlider
        label="Writing Time"
        value={settings.writingSeconds ?? DEFAULT_WRITING_SECONDS}
        min={45}
        max={120}
        step={5}
        onCommit={(v) => onChange("writingSeconds", v)}
        format={(v) => `${v}s`}
      />

      <SettingSlider
        label="Voting Time"
        value={settings.votingSeconds ?? DEFAULT_VOTING_SECONDS}
        min={30}
        max={90}
        step={5}
        onCommit={(v) => onChange("votingSeconds", v)}
        format={(v) => `${v}s`}
      />
    </div>
  );
}

function FibbageSettingsDisplay({ settings }) {
  return (
    <div className="space-y-2 rounded-xl bg-[var(--fibbage-canvas-light)] p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--fibbage-text-muted)]">
        Game Settings
      </h3>
      <div className="flex flex-wrap gap-3 text-sm text-[var(--fibbage-text)]">
        <span>{settings.roundCount ?? 5} rounds</span>
        <span className="text-[var(--fibbage-text-muted)]">·</span>
        <span>{settings.writingSeconds ?? DEFAULT_WRITING_SECONDS}s writing</span>
        <span className="text-[var(--fibbage-text-muted)]">·</span>
        <span>{settings.votingSeconds ?? DEFAULT_VOTING_SECONDS}s voting</span>
      </div>
    </div>
  );
}

function SettingSlider({ label, value, min, max, step, onCommit, format }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const displayValue = localValue;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-[var(--fibbage-text)]">{label}</label>
        <span className="text-sm font-bold text-[var(--fibbage-accent)]">
          {format ? format(displayValue) : displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onChange={(e) => setLocalValue(Number(e.target.value))}
        onMouseUp={() => onCommit(displayValue)}
        onTouchEnd={() => onCommit(displayValue)}
        className="w-full accent-[var(--fibbage-accent)]"
      />
    </div>
  );
}
