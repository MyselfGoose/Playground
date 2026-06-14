/**
 * Player-facing connection errors — never expose env var names or ops jargon.
 */

/** @typedef {'npat' | 'cah' | 'taboo' | 'hangman' | 'typing-race' | 'generic'} GameContext */

/** @typedef {'retry' | 'sign_in' | 'leave' | 'create_room'} ConnectionActionId */

/**
 * @typedef {{
 *   code: string,
 *   message: string,
 *   recoverable: boolean,
 *   actions: ConnectionActionId[],
 * }} ConnectionErrorResult
 */

const MISSING_SOCKET_URL =
  "Live games are temporarily unavailable. Please try again in a moment.";

const NOT_CONNECTED = {
  npat: "Joining your party…",
  cah: "Joining your party…",
  taboo: "Joining your party…",
  hangman: "Joining your party…",
  "typing-race": "Joining your race…",
  generic: "Joining your party…",
};

const CONNECT_FAILED = {
  npat: "We lost the connection — check your network and try again.",
  cah: "We lost the connection — check your network and try again.",
  taboo: "We lost the connection — check your network and try again.",
  hangman: "We lost the connection — check your network and try again.",
  "typing-race": "We lost the connection — check your network and try again.",
  generic: "We lost the connection — check your network and try again.",
};

const TIMEOUT = {
  npat: "This is taking a while — try again in a moment.",
  cah: "This is taking a while — try again in a moment.",
  taboo: "This is taking a while — try again in a moment.",
  hangman: "This is taking a while — try again in a moment.",
  "typing-race": "This is taking a while — try again in a moment.",
  generic: "This is taking a while — try again in a moment.",
};

const RECONNECTING = {
  npat: "Back online — syncing your game…",
  cah: "Back online — syncing your game…",
  taboo: "Back online — syncing your room…",
  hangman: "Back online — syncing your game…",
  "typing-race": "Back online — syncing your race…",
  generic: "Back online — syncing…",
};

const ROOM_ERROR_MESSAGES = {
  ROOM_EXPIRED: "This party ended — start a fresh game when you're ready.",
  ROOM_NOT_FOUND:
    "We can't find that party code — double-check it or start a new game.",
};

const SESSION_ENDED_CODES = new Set([
  "SESSION_EXPIRED",
  "SESSION_REVOKED",
  "UNAUTHENTICATED",
  "MISSING_SOCKET_URL",
]);

/**
 * @param {string} code
 * @param {string} message
 * @param {ConnectionActionId[]} actions
 * @param {boolean} [recoverable=true]
 * @returns {ConnectionErrorResult}
 */
function result(code, message, actions, recoverable = true) {
  return { code, message, recoverable, actions };
}

/**
 * @param {unknown} err
 * @returns {string | null}
 */
export function resolveErrorCode(err) {
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
 * @param {'missing_socket_url' | 'connection_lost'} kind
 */
export function connectionMessage(game, kind) {
  if (kind === "missing_socket_url") return MISSING_SOCKET_URL;
  if (kind === "connection_lost") return CONNECT_FAILED[game] ?? CONNECT_FAILED.generic;
  return NOT_CONNECTED[game] ?? NOT_CONNECTED.generic;
}

/**
 * @param {GameContext} game
 * @param {unknown} err
 * @param {{ phase?: 'connect' | 'timeout' | 'reconnect' }} [options]
 * @returns {ConnectionErrorResult}
 */
export function resolveConnectionError(game, err, options = {}) {
  if (options.phase === "timeout") {
    return result("TIMEOUT", TIMEOUT[game] ?? TIMEOUT.generic, ["retry"]);
  }
  if (options.phase === "reconnect") {
    return result("RECONNECTING", RECONNECTING[game] ?? RECONNECTING.generic, ["retry"], true);
  }

  const code = resolveErrorCode(err);
  if (code === "ROOM_EXPIRED") {
    return result(code, ROOM_ERROR_MESSAGES.ROOM_EXPIRED, ["create_room", "leave"]);
  }
  if (code === "ROOM_NOT_FOUND") {
    return result(code, ROOM_ERROR_MESSAGES.ROOM_NOT_FOUND, ["create_room", "leave"]);
  }
  if (code && SESSION_ENDED_CODES.has(code)) {
    const message =
      code === "MISSING_SOCKET_URL"
        ? MISSING_SOCKET_URL
        : "Please sign in again to continue.";
    return result(code, message, ["sign_in"], true);
  }

  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";

  if (/NEXT_PUBLIC_|CORS_ORIGIN|localhost:4000|API origin|backend is running/i.test(msg)) {
    return result("CONNECT_FAILED", CONNECT_FAILED[game] ?? CONNECT_FAILED.generic, ["retry"]);
  }

  if (/timeout|timed out|ETIMEDOUT/i.test(msg)) {
    return result("TIMEOUT", TIMEOUT[game] ?? TIMEOUT.generic, ["retry"]);
  }

  if (
    /xhr poll error|websocket error|transport error|poll error|connection error|ECONNREFUSED|ENOTFOUND|network/i.test(
      msg,
    )
  ) {
    return result("CONNECT_FAILED", CONNECT_FAILED[game] ?? CONNECT_FAILED.generic, ["retry"]);
  }

  if (/UNAUTHENTICATED|SESSION_REVOKED|sign in/i.test(msg)) {
    return result("SESSION_REVOKED", "Please sign in again to continue.", ["sign_in"]);
  }

  if (msg.trim()) {
    return result("CONNECT_ERROR", msg, ["retry"], true);
  }

  return result("CONNECT_FAILED", CONNECT_FAILED[game] ?? CONNECT_FAILED.generic, ["retry"]);
}

/**
 * @param {GameContext} game
 * @param {unknown} err
 * @param {{ phase?: 'connect' | 'timeout' | 'reconnect' }} [options]
 * @returns {ConnectionErrorResult}
 */
export function mapConnectionError(game, err, options = {}) {
  return resolveConnectionError(game, err, options);
}

/**
 * @param {GameContext} game
 * @param {unknown} err
 * @param {{ phase?: 'connect' | 'timeout' | 'reconnect' }} [options]
 * @returns {string}
 */
export function mapConnectionErrorMessage(game, err, options = {}) {
  return resolveConnectionError(game, err, options).message;
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
      return "Joining";
  }
}
