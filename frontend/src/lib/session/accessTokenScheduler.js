/**
 * Proactive refresh before access JWT expiry to avoid 401 bursts mid-game.
 */

import { apiFetch } from "../api.js";
import { notifyRefreshCompleted } from "../reconciliation/reconciliationEvents.js";

/** ~80% of default 15m access TTL */
const DEFAULT_REFRESH_INTERVAL_MS = 12 * 60 * 1000;
/** More frequent while an active multiplayer room is held */
const IN_GAME_REFRESH_INTERVAL_MS = 8 * 60 * 1000;
const VISIBILITY_STALE_MS = 10 * 60 * 1000;

/** @type {ReturnType<typeof setInterval> | null} */
let intervalId = null;
let lastRefreshAt = 0;
let inGameBoost = false;

async function runProactiveRefresh() {
  try {
    await apiFetch("/api/v1/auth/refresh", { method: "POST" });
    lastRefreshAt = Date.now();
    notifyRefreshCompleted();
  } catch {
    /* UserContext / apiFetch will surface session invalidation if unrecoverable */
  }
}

/**
 * @param {{ inGame?: boolean }} [options]
 */
export function setAccessTokenSchedulerInGame(options = {}) {
  inGameBoost = options.inGame === true;
  if (intervalId) {
    stopAccessTokenScheduler();
    startAccessTokenScheduler();
  }
}

export function startAccessTokenScheduler() {
  if (typeof window === "undefined") return;
  stopAccessTokenScheduler();
  const intervalMs = inGameBoost ? IN_GAME_REFRESH_INTERVAL_MS : DEFAULT_REFRESH_INTERVAL_MS;
  intervalId = setInterval(() => {
    void runProactiveRefresh();
  }, intervalMs);
  intervalId.unref?.();
}

export function stopAccessTokenScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Refresh on tab focus if we have not refreshed recently.
 */
export function refreshOnVisibilityIfStale() {
  if (typeof document === "undefined" || document.visibilityState !== "visible") return;
  if (Date.now() - lastRefreshAt < VISIBILITY_STALE_MS) return;
  void runProactiveRefresh();
}
