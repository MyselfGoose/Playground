"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { play } from "../../../lib/sound/soundManager.js";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { useLeaveLobby } from "../../../lib/party/useLeaveLobby.js";
import { mapPartyPlayer } from "../../../lib/party/mapPartyPlayer.js";
import { PartyLobby } from "../../../components/party/PartyLobby.jsx";
import { LobbyInviteFriends } from "../../../components/party/LobbyInviteFriends.jsx";
import { FIBBAGE_PATHS } from "./fibbage-shared.js";
import { FIBBAGE_PRESETS, PRESET_ORDER, presetLabel } from "./fibbage-presets.js";
import { FibbageButton } from "./components/FibbageButton.jsx";

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
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  const handlePresetSelect = useCallback(
    async (presetId) => {
      setError(null);
      try {
        const result = await updateSettings({ presetId });
        if (result && !result.ok) {
          setError(result.error?.message ?? "Could not update settings.");
        } else {
          play("success");
        }
      } catch {
        setError("Could not update settings.");
      }
    },
    [updateSettings],
  );

  const handleSettingsChange = useCallback(
    async (key, value) => {
      setError(null);
      try {
        const result = await updateSettings({ [key]: value, presetId: "custom" });
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
        <FibbageSettingsPanel
          settings={settings}
          advancedOpen={advancedOpen}
          onAdvancedToggle={() => setAdvancedOpen((o) => !o)}
          onPresetSelect={handlePresetSelect}
          onChange={handleSettingsChange}
        />
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
    <div className="fibbage-lobby min-h-[100dvh]">
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
        className="text-[var(--fibbage-text)]"
        primaryAction={
          <div className="flex flex-col gap-3">
            <FibbageButton
              variant={ready ? "secondary" : "primary"}
              className="w-full rounded-full py-3.5"
              disabled={!connected}
              pending={readyPending}
              onClick={handleReadyToggle}
            >
              {readyPending ? "Updating…" : ready ? "Unready" : "Ready up"}
            </FibbageButton>
            {isHost ? (
              <FibbageButton
                className="w-full rounded-full py-3.5"
                disabled={!canStart}
                pending={startPending}
                onClick={handleStart}
              >
                {startPending ? "Starting…" : "Start game"}
              </FibbageButton>
            ) : null}
          </div>
        }
      />
    </div>
  );
}

/**
 * @param {{
 *   settings: Record<string, unknown>,
 *   advancedOpen: boolean,
 *   onAdvancedToggle: () => void,
 *   onPresetSelect: (id: string) => void,
 *   onChange: (key: string, value: number) => void,
 * }} props
 */
function FibbageSettingsPanel({ settings, advancedOpen, onAdvancedToggle, onPresetSelect, onChange }) {
  const activePresetId =
    typeof settings.presetId === "string" && settings.presetId !== "custom"
      ? settings.presetId
      : "classic";
  const activePreset = FIBBAGE_PRESETS[activePresetId] ?? FIBBAGE_PRESETS.classic;
  const displayDescription =
    settings.presetId === "custom"
      ? "Custom settings"
      : activePreset.description;

  return (
    <div className="space-y-4 rounded-xl bg-[var(--fibbage-canvas-light)] p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--fibbage-text-muted)]">
        Game mode
      </h3>

      <div className="flex flex-wrap gap-2">
        {PRESET_ORDER.map((id) => {
          const preset = FIBBAGE_PRESETS[id];
          const selected =
            settings.presetId === id || (settings.presetId === undefined && id === "classic");
          const isBlitz = id === "blitz";
          return (
            <button
              key={id}
              type="button"
              onClick={() => onPresetSelect(id)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                selected
                  ? "fibbage-card--selected border-2 border-[var(--fibbage-accent)] bg-[var(--fibbage-canvas)]"
                  : "bg-[var(--fibbage-canvas)] text-[var(--fibbage-text)] hover:bg-[var(--fibbage-canvas-light)]"
              } ${isBlitz && selected ? "text-[var(--fibbage-cta)]" : ""}`}
            >
              {isBlitz ? "⚡ " : ""}
              {preset.label}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-[var(--fibbage-text-muted)]">{displayDescription}</p>

      <button
        type="button"
        onClick={onAdvancedToggle}
        className="flex w-full items-center justify-between text-sm font-semibold text-[var(--fibbage-text)]"
        aria-expanded={advancedOpen}
      >
        Advanced
        <span className="text-[var(--fibbage-text-muted)]">{advancedOpen ? "▾" : "▸"}</span>
      </button>

      {advancedOpen ? (
        <div className="space-y-4 border-t border-[var(--fibbage-text-muted)]/20 pt-4">
          <SettingSlider
            label="Rounds"
            value={Number(settings.roundCount) || 5}
            min={3}
            max={10}
            step={1}
            onCommit={(v) => onChange("roundCount", v)}
            format={(v) => `${v} rounds`}
          />

          <SettingSlider
            label="Writing Time"
            value={Number(settings.writingSeconds) || DEFAULT_WRITING_SECONDS}
            min={45}
            max={120}
            step={5}
            onCommit={(v) => onChange("writingSeconds", v)}
            format={(v) => `${v}s`}
          />

          <SettingSlider
            label="Voting Time"
            value={Number(settings.votingSeconds) || DEFAULT_VOTING_SECONDS}
            min={30}
            max={90}
            step={5}
            onCommit={(v) => onChange("votingSeconds", v)}
            format={(v) => `${v}s`}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{ settings: Record<string, unknown> }} props
 */
function FibbageSettingsDisplay({ settings }) {
  const mode = presetLabel(typeof settings.presetId === "string" ? settings.presetId : "classic");
  const rounds = settings.roundCount ?? 5;
  const writing = settings.writingSeconds ?? DEFAULT_WRITING_SECONDS;
  const voting = settings.votingSeconds ?? DEFAULT_VOTING_SECONDS;

  return (
    <div className="space-y-2 rounded-xl bg-[var(--fibbage-canvas-light)] p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--fibbage-text-muted)]">
        Game Settings
      </h3>
      <p className="text-sm text-[var(--fibbage-text)]">
        Mode: {mode} · {rounds} rounds · {writing}s writing · {voting}s voting
      </p>
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
