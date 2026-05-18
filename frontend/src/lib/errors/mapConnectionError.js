/**
 * Player-facing connection errors — never expose env var names or ops jargon.
 */

/** @typedef {'npat' | 'cah' | 'taboo' | 'hangman' | 'typing-race' | 'generic'} GameContext */

const MISSING_SOCKET_URL =
  "Live games are temporarily unavailable. Please try again in a moment.";

const NOT_CONNECTED = {
  npat: "Connecting to your game…",
  cah: "Connecting to your game…",
  taboo: "Connecting to your game…",
  hangman: "Connecting to your game…",
  "typing-race": "Connecting to your race…",
  generic: "Connecting…",
};

const CONNECT_FAILED = {
  npat: "Could not connect to the game. Check your connection and try again.",
  cah: "Could not connect to the game. Check your connection and try again.",
  taboo: "Could not connect to the game. Check your connection and try again.",
  hangman: "Could not connect to the game. Check your connection and try again.",
  "typing-race": "Could not connect to the race. Check your connection and try again.",
  generic: "Could not connect. Check your connection and try again.",
};

const TIMEOUT = {
  npat: "This is taking longer than usual. Check your connection and try again.",
  cah: "This is taking longer than usual. Check your connection and try again.",
  taboo: "This is taking longer than usual. Check your connection and try again.",
  hangman: "This is taking longer than usual. Check your connection and try again.",
  "typing-race": "This is taking longer than usual. Check your connection and try again.",
  generic: "This is taking longer than usual. Check your connection and try again.",
};

const RECONNECTING = {
  npat: "Reconnecting…",
  cah: "Reconnecting…",
  taboo: "Reconnecting to your room…",
  hangman: "Reconnecting…",
  "typing-race": "Reconnecting to your race…",
  generic: "Reconnecting…",
};

const ROOM_ERROR_MESSAGES = {
  ROOM_EXPIRED: "This game room is no longer available. Start or join a new one.",
  ROOM_NOT_FOUND: "We could not find that room. Check the code or create a new game.",
};

/**
 * @param {unknown} err
 * @returns {string | null}
 */
function resolveErrorCode(err) {
  if (err && typeof err === "object") {
    if ("code" in err && typeof /** @type {{ code: unknown }} */ (err).code === "string") {
      return /** @type {{ code: string }} */ (err).code;
    }
    if (
      "error" in err &&
      err.error &&
      typeof err.error === "object" &&
      "code" in err.error &&
      typeof /** @type {{ error: { code: unknown } }} */ (err).error.code === "string"
    ) {
      return /** @type {{ error: { code: string } }} */ (err).error.code;
    }
  }
  return null;
}

/**
 * @param {GameContext} game
 * @param {'missing_socket_url'} kind
 */
export function connectionMessage(game, kind) {
  if (kind === "missing_socket_url") return MISSING_SOCKET_URL;
  return NOT_CONNECTED[game] ?? NOT_CONNECTED.generic;
}

/**
 * @param {GameContext} game
 * @param {unknown} err
 * @param {{ phase?: 'connect' | 'timeout' | 'reconnect' }} [options]
 */
export function mapConnectionError(game, err, options = {}) {
  if (options.phase === "timeout") {
    return TIMEOUT[game] ?? TIMEOUT.generic;
  }
  if (options.phase === "reconnect") {
    return RECONNECTING[game] ?? RECONNECTING.generic;
  }

  const code = resolveErrorCode(err);
  if (code && code in ROOM_ERROR_MESSAGES) {
    return ROOM_ERROR_MESSAGES[/** @type {keyof typeof ROOM_ERROR_MESSAGES} */ (code)];
  }

  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";

  if (/NEXT_PUBLIC_|CORS_ORIGIN|localhost:4000|API origin|backend is running/i.test(msg)) {
    return CONNECT_FAILED[game] ?? CONNECT_FAILED.generic;
  }

  if (/timeout|timed out|ETIMEDOUT/i.test(msg)) {
    return TIMEOUT[game] ?? TIMEOUT.generic;
  }

  if (/UNAUTHENTICATED|SESSION_REVOKED|sign in/i.test(msg)) {
    return "Please sign in again to continue.";
  }

  if (msg.trim()) {
    return msg;
  }

  return CONNECT_FAILED[game] ?? CONNECT_FAILED.generic;
}

/**
 * Human-readable socket connection state for UI labels.
 * @param {'connected' | 'reconnecting' | 'disconnected' | string} state
 */
export function formatConnectionStateLabel(state) {
  switch (state) {
    case "connected":
      return "Connected";
    case "reconnecting":
      return "Reconnecting";
    case "disconnected":
      return "Disconnected";
    default:
      return "Connecting";
  }
}
