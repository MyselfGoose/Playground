/** @typedef {{
 *   game: string,
 *   listRooms: () => Array<Record<string, unknown>>,
 *   getRoom: (code: string) => Record<string, unknown> | null,
 *   forceClose: (code: string) => { ok: boolean, code: string },
 *   kickPlayer: (code: string, userId: string) => { ok: boolean },
 * }} GameAdminAdapter */

/** @type {Map<string, GameAdminAdapter>} */
const gameAdapters = new Map();

/** @type {import('socket.io').Server | null} */
let io = null;

/** @type {{ getOnlineCount?: () => number } | null} */
let presenceRegistry = null;

/** @type {{ engines?: Map<string, unknown> } | null} */
let npatRegistry = null;

/**
 * @param {import('socket.io').Server} ioInstance
 * @param {{ getOnlineCount?: () => number } | null} [presence]
 */
export function registerAdminSocketRuntime(ioInstance, presence = null) {
  io = ioInstance;
  presenceRegistry = presence;
}

/**
 * @param {GameAdminAdapter} adapter
 */
export function registerGameAdminAdapter(adapter) {
  gameAdapters.set(adapter.game, adapter);
}

/**
 * @param {{ engines?: Map<string, unknown> }} registry
 */
export function registerNpatRegistry(registry) {
  npatRegistry = registry;
}

export function getNpatRegistry() {
  return npatRegistry;
}

export function clearAdminRuntimeHubForTests() {
  gameAdapters.clear();
  io = null;
  presenceRegistry = null;
  npatRegistry = null;
}

/**
 * @param {string} [gameFilter]
 */
export function listAllRoomsForAdmin(gameFilter) {
  /** @type {Array<Record<string, unknown>>} */
  const out = [];
  for (const [game, adapter] of gameAdapters) {
    if (gameFilter && game !== gameFilter) continue;
    try {
      out.push(...adapter.listRooms());
    } catch {
      // skip broken adapter
    }
  }
  return out;
}

/**
 * @param {string} game
 * @param {string} code
 */
export function getRoomForAdmin(game, code) {
  const adapter = gameAdapters.get(game);
  if (!adapter) return null;
  return adapter.getRoom(code);
}

/**
 * @param {string} game
 * @param {string} code
 */
export function adminForceCloseRoom(game, code) {
  const adapter = gameAdapters.get(game);
  if (!adapter) {
    const err = new Error('Unknown game');
    /** @type {any} */ (err).code = 'VALIDATION_ERROR';
    throw err;
  }
  return adapter.forceClose(code);
}

/**
 * @param {string} game
 * @param {string} code
 * @param {string} userId
 */
export function adminKickRoomPlayer(game, code, userId) {
  const adapter = gameAdapters.get(game);
  if (!adapter) {
    const err = new Error('Unknown game');
    /** @type {any} */ (err).code = 'VALIDATION_ERROR';
    throw err;
  }
  return adapter.kickPlayer(code, userId);
}

const SOCKET_NAMESPACES = ['/npat', '/typing-race', '/taboo', '/cah', '/hangman', '/social'];

/**
 * @returns {Promise<{ perInstance: boolean, namespaces: Array<{ namespace: string, connections: number }>, presenceOnline: number }>}
 */
export async function getSocketConnectionCounts() {
  if (!io) {
    return { perInstance: true, namespaces: [], presenceOnline: 0 };
  }
  const namespaces = [];
  for (const nsPath of SOCKET_NAMESPACES) {
    try {
      const sockets = await io.of(nsPath).fetchSockets();
      namespaces.push({ namespace: nsPath, connections: sockets.length });
    } catch {
      namespaces.push({ namespace: nsPath, connections: 0 });
    }
  }
  const presenceOnline = presenceRegistry?.getOnlineCount?.() ?? 0;
  return { perInstance: true, namespaces, presenceOnline };
}

export function getRegisteredGames() {
  return [...gameAdapters.keys()];
}
