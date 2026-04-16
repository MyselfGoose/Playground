import mongoose from 'mongoose';
import { npatRoomRepository } from '../../repositories/npatRoomRepository.js';
import { NpatRoomEngine } from './gameManager.js';
import { DEFAULT_TEAMS, NPAT_FIELDS } from './constants.js';

/**
 * @param {number} len
 */
function randomDigits(len) {
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

/**
 * Keyed single-flight: ensures at most one in-flight promise per key. Concurrent callers for the
 * same key share the same result.
 */
function keyedSingleflight() {
  /** @type {Map<string, Promise<any>>} */
  const pending = new Map();
  return {
    /**
     * @template T
     * @param {string} key
     * @param {() => Promise<T>} fn
     * @returns {Promise<T>}
     */
    run(key, fn) {
      const existing = pending.get(key);
      if (existing) return existing;
      const p = (async () => {
        try {
          return await fn();
        } finally {
          pending.delete(key);
        }
      })();
      pending.set(key, p);
      return p;
    },
  };
}

/**
 * Per-key serial queue: run tasks for the same key sequentially. Different keys run in parallel.
 */
function keyedSerialQueue() {
  /** @type {Map<string, Promise<any>>} */
  const tails = new Map();
  return {
    /**
     * @template T
     * @param {string} key
     * @param {() => Promise<T>} fn
     * @returns {Promise<T>}
     */
    run(key, fn) {
      const prev = tails.get(key) ?? Promise.resolve();
      const next = prev.then(fn, fn);
      const cleanup = next.finally(() => {
        if (tails.get(key) === cleanup) tails.delete(key);
      });
      tails.set(key, cleanup);
      return next;
    },
  };
}

/**
 * @param {{
 *   env: import('../../config/env.js').Env,
 *   logger: import('pino').Logger,
 *   npatNs: import('socket.io').Namespace,
 * }} params
 */
export function createNpatRoomRegistry({ env, logger, npatNs }) {
  /** @type {Map<string, NpatRoomEngine>} */
  const engines = new Map();
  /** @type {Map<string, string>} */
  const socketToRoom = new Map();
  /**
   * Pending room destructions. When the last connected socket leaves an empty WAITING room we do
   * NOT delete immediately: transient disconnects (React strict-mode remount, HMR, Wi-Fi blip,
   * quick tab refresh) otherwise obliterate a freshly-created room before the next socket lands.
   * The timeout is cleared when any socket reattaches to the same code.
   *
   * @type {Map<string, NodeJS.Timeout>}
   */
  const pendingDelete = new Map();
  const ROOM_GRACE_MS = 60_000;

  const hydrate = keyedSingleflight();
  const roomLock = keyedSerialQueue();

  /**
   * Cancel any scheduled delete for `code`. Called on every new join/create/attach.
   * @param {string} code
   */
  function cancelPendingDelete(code) {
    const timer = pendingDelete.get(code);
    if (timer) {
      clearTimeout(timer);
      pendingDelete.delete(code);
    }
  }

  /**
   * @param {string} code
   */
  function makePersist(code) {
    return async (
      /** @type {Record<string, unknown>} */ setPatch,
      /** @type {{ roundIndex: number, letter: string, submissions: Record<string, Record<string, string>>, endedAt: Date } | undefined} */ pushRound,
    ) => {
      /** @type {import('mongoose').UpdateQuery<import('mongoose').Document>} */
      const update = {};
      if (setPatch && Object.keys(setPatch).length > 0) {
        update.$set = setPatch;
      }
      if (pushRound) {
        update.$push = { roundsHistory: pushRound };
      }
      if (Object.keys(update).length === 0) return;
      update.$inc = { ...(update.$inc ?? {}), version: 1 };
      try {
        await npatRoomRepository.updateByCode(code, update);
      } catch (err) {
        logger.warn({ err, code, event: 'npat_persist_failed' }, 'npat_persist');
      }
    };
  }

  /**
   * Allocate a unique room code by inserting the doc and letting Mongo's unique index reject
   * collisions. Retries up to N times on E11000.
   *
   * @param {(code: string) => import('mongoose').FilterQuery<import('mongoose').Document>} buildDoc
   * @returns {Promise<{ code: string, doc: any }>}
   */
  async function allocateAndCreate(buildDoc) {
    const len = env.NPAT_ROOM_CODE_LENGTH;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const code = randomDigits(len);
      if (engines.has(code)) continue;
      try {
        const doc = await npatRoomRepository.create(buildDoc(code));
        return { code, doc };
      } catch (err) {
        if (npatRoomRepository.isDuplicateKey(err)) {
          continue;
        }
        throw err;
      }
    }
    const err = new Error('Could not allocate room code');
    /** @type {any} */ (err).code = 'ROOM_ALLOCATION_FAILED';
    throw err;
  }

  /**
   * Load or build the in-memory engine for a code. Single-flight: concurrent callers share one load.
   *
   * @param {string} code
   * @returns {Promise<NpatRoomEngine | null>}
   */
  function loadEngine(code) {
    const cached = engines.get(code);
    if (cached) return Promise.resolve(cached);
    return hydrate.run(code, async () => {
      const cached2 = engines.get(code);
      if (cached2) return cached2;
      const doc = await npatRoomRepository.findByCode(code);
      if (!doc) return null;
      const persist = makePersist(doc.code);
      const engine = NpatRoomEngine.hydrateFromDoc(doc, {
        env,
        logger,
        npatNs,
        persist,
      });
      engines.set(doc.code, engine);
      logger.info(
        { event: 'npat_room_hydrated', roomCode: doc.code, engineState: engine.state },
        'npat_room',
      );
      return engine;
    });
  }

  /**
   * @param {'solo' | 'team'} mode
   * @param {string} userId
   * @param {string} username
   * @param {import('socket.io').Socket} socket
   */
  async function createRoom(mode, userId, username, socket) {
    const hostOid = new mongoose.Types.ObjectId(userId);
    const teams = mode === 'team' ? [...DEFAULT_TEAMS] : [];

    const { code } = await allocateAndCreate((c) => ({
      code: c,
      hostUserId: hostOid,
      mode,
      maxPlayers: env.NPAT_MAX_PLAYERS,
      engineState: 'WAITING',
      roundPhase: 'none',
      usedLetters: [],
      letterPool: [],
      currentRoundIndex: -1,
      currentLetter: '',
      currentRound: { index: -1, letter: '', phase: 'none', submissions: {} },
      players: [
        {
          userId: hostOid,
          username,
          teamId: mode === 'team' ? 'A' : '',
          ready: false,
          joinedAt: new Date(),
        },
      ],
      teams,
      roundsHistory: [],
      version: 0,
    }));

    return roomLock.run(code, async () => {
      const persist = makePersist(code);
      const engine = new NpatRoomEngine({
        code,
        mode,
        hostUserId: userId,
        env,
        logger,
        npatNs,
        persist,
      });
      const now = Date.now();
      engine.upsertPlayer(userId, username, socket.id, now);
      if (mode === 'team') {
        const p = engine.players.get(userId);
        if (p) p.teamId = 'A';
      }
      engines.set(code, engine);
      cancelPendingDelete(code);
      socket.join(code);
      socketToRoom.set(socket.id, code);

      logger.info(
        { event: 'npat_room_created', roomCode: code, userId, socketId: socket.id, mode },
        'npat_room',
      );

      void persist(
        {
          players: engine.playersToMongo(),
          lastPublicSnapshot: engine.toPublicDto(),
        },
        undefined,
      );

      return { code, engine };
    });
  }

  /**
   * @param {string} code
   * @param {string} userId
   * @param {string} username
   * @param {import('socket.io').Socket} socket
   */
  async function joinRoom(code, userId, username, socket) {
    const engine = await loadEngine(code);
    if (!engine) {
      const err = new Error('Room not found');
      /** @type {any} */ (err).code = 'ROOM_NOT_FOUND';
      throw err;
    }

    return roomLock.run(code, async () => {
      const isReturning = engine.players.has(userId);
      if (engine.state === 'FINISHED') {
        const err = new Error('Game has already finished');
        /** @type {any} */ (err).code = 'GAME_FINISHED';
        throw err;
      }
      if (engine.state !== 'WAITING') {
        if (!isReturning) {
          const err = new Error('Game already in progress');
          /** @type {any} */ (err).code = 'GAME_ALREADY_STARTED';
          throw err;
        }
      } else if (!isReturning && engine.players.size >= env.NPAT_MAX_PLAYERS) {
        const err = new Error('Room is full');
        /** @type {any} */ (err).code = 'ROOM_FULL';
        throw err;
      }

      // Detach any stale socket this user still has so we don't end up with ghost connections.
      for (const [sid, rc] of socketToRoom) {
        if (rc !== code) continue;
        const other = engine.players.get(userId);
        if (other?.socketId && other.socketId !== socket.id && sid === other.socketId) {
          engine.clearSocket(sid);
          socketToRoom.delete(sid);
          const otherSock = npatNs.sockets.get(sid);
          if (otherSock) {
            otherSock.leave(code);
          }
        }
      }

      const now = Date.now();
      engine.upsertPlayer(userId, username, socket.id, now);
      engine.setSocket(userId, socket.id);
      socket.join(code);
      socketToRoom.set(socket.id, code);
      cancelPendingDelete(code);

      logger.info(
        {
          event: 'npat_room_joined',
          roomCode: code,
          userId,
          socketId: socket.id,
          engineState: engine.state,
          playerCount: engine.players.size,
        },
        'npat_room',
      );

      void engine.persist(
        {
          players: engine.playersToMongo(),
          hostUserId: new mongoose.Types.ObjectId(engine.hostUserId),
          lastPublicSnapshot: engine.toPublicDto(),
        },
        undefined,
      );

      return engine;
    });
  }

  /**
   * @param {import('socket.io').Socket} socket
   */
  function leaveRoom(socket) {
    const code = socketToRoom.get(socket.id);
    if (!code) return;
    const engine = engines.get(code);
    logger.info({ event: 'npat_leave_room', roomCode: code, socketId: socket.id }, 'npat_room');
    socket.leave(code);
    socketToRoom.delete(socket.id);
    if (!engine) return;

    // Serialize room-state mutation; cleanup below may follow.
    void roomLock.run(code, async () => {
      const uid = engine.clearSocket(socket.id);
      if (uid) {
        engine.reassignHostIfNeeded(uid);
        engine.emit('room_update', { room: engine.toPublicDto() });
        void engine.persist(
          {
            players: engine.playersToMongo(),
            hostUserId: new mongoose.Types.ObjectId(engine.hostUserId),
            lastPublicSnapshot: engine.toPublicDto(),
          },
          undefined,
        );
      }

      const anyConnected = [...engine.players.values()].some((p) => p.connected);
      if (!anyConnected) {
        const terminal = engine.state === 'WAITING' || engine.state === 'FINISHED';
        if (terminal) {
          scheduleRoomDelete(code, 'empty');
        } else {
          logger.info(
            { event: 'npat_room_orphan_sockets', roomCode: code, engineState: engine.state },
            'npat_room',
          );
          engine.emit('room_update', { room: engine.toPublicDto() });
        }
      }
    });
  }

  /**
   * Schedule a terminal-room destruction after a grace window. Quick disconnects (React strict
   * mode, navigation, HMR, Wi-Fi blip) would otherwise nuke a live room before a legitimate
   * reconnect arrives.
   *
   * @param {string} code
   * @param {string} reason
   */
  function scheduleRoomDelete(code, reason) {
    if (pendingDelete.has(code)) return;
    logger.info(
      { event: 'npat_room_delete_scheduled', roomCode: code, reason, graceMs: ROOM_GRACE_MS },
      'npat_room',
    );
    const timer = setTimeout(() => {
      pendingDelete.delete(code);
      void roomLock.run(code, async () => {
        const engine = engines.get(code);
        if (!engine) return;
        const anyConnected = [...engine.players.values()].some((p) => p.connected);
        if (anyConnected) {
          logger.info(
            { event: 'npat_room_delete_cancelled', roomCode: code, reason: 'reconnected' },
            'npat_room',
          );
          return;
        }
        logger.info(
          { event: 'npat_room_deleted', roomCode: code, engineState: engine.state, reason },
          'npat_room',
        );
        engine.destroy();
        engines.delete(code);
        void npatRoomRepository.deleteByCode(code).catch(() => {});
      });
    }, ROOM_GRACE_MS);
    timer.unref?.();
    pendingDelete.set(code, timer);
  }

  /**
   * @param {import('socket.io').Socket} socket
   */
  function getEngineForSocket(socket) {
    const code = socketToRoom.get(socket.id);
    if (!code) return null;
    return engines.get(code) ?? null;
  }

  /**
   * Find any non-finished room this user still belongs to, attach this socket, and return the
   * engine. Used by session_resumed on socket connect. Returns null when there is none.
   *
   * @param {string} userId
   * @param {string} username
   * @param {import('socket.io').Socket} socket
   */
  async function attachActiveRoomForUser(userId, username, socket) {
    // Already attached on this socket?
    const existing = getEngineForSocket(socket);
    if (existing) return existing;

    // Check in-memory first.
    for (const engine of engines.values()) {
      if (engine.state !== 'FINISHED' && engine.players.has(userId)) {
        return joinRoom(engine.code, userId, username, socket);
      }
    }

    // Fall back to DB (e.g. after a cold boot where we haven't re-hydrated this room yet).
    const doc = await npatRoomRepository.findActiveRoomForUser(userId);
    if (!doc) return null;
    return joinRoom(doc.code, userId, username, socket);
  }

  /**
   * Boot-time rehydration of active rooms from Mongo.
   */
  async function bootHydrate() {
    const docs = await npatRoomRepository.findAllActive();
    for (const doc of docs) {
      if (engines.has(doc.code)) continue;
      const persist = makePersist(doc.code);
      const engine = NpatRoomEngine.hydrateFromDoc(doc, { env, logger, npatNs, persist });
      engines.set(doc.code, engine);
      logger.info(
        {
          event: 'npat_room_hydrated',
          roomCode: doc.code,
          engineState: engine.state,
          roundPhase: engine.roundPhase,
          playerCount: engine.players.size,
        },
        'npat_room',
      );
    }
    logger.info({ event: 'npat_boot_hydrate_done', roomsLoaded: docs.length }, 'npat_room');
  }

  /**
   * Persist the latest snapshot for every live engine. Called on graceful shutdown.
   */
  async function flushAll() {
    const tasks = [];
    for (const engine of engines.values()) {
      tasks.push(
        engine.persist(engine.toPersistDoc(), undefined).catch((err) => {
          logger.warn({ err, roomCode: engine.code, event: 'npat_flush_failed' }, 'npat_room');
        }),
      );
    }
    await Promise.all(tasks);
    logger.info({ event: 'npat_flush_all_done', rooms: tasks.length }, 'npat_room');
  }

  /**
   * Periodic cleanup: delete rooms that finished long ago or waiting rooms created long ago.
   * @param {{ finishedAfterMs?: number, waitingAfterMs?: number }} [opts]
   */
  async function cleanupStale(opts = {}) {
    const finishedAfterMs = opts.finishedAfterMs ?? 24 * 60 * 60 * 1000;
    const waitingAfterMs = opts.waitingAfterMs ?? 12 * 60 * 60 * 1000;
    const now = Date.now();
    const res = await npatRoomRepository.cleanupStale({
      finishedCutoff: new Date(now - finishedAfterMs),
      waitingCutoff: new Date(now - waitingAfterMs),
    });
    if (res.finished || res.abandoned) {
      logger.info(
        { event: 'npat_cleanup_stale', ...res },
        'npat_room',
      );
    }
    return res;
  }

  return {
    engines,
    socketToRoom,
    NPAT_FIELDS,
    createRoom,
    joinRoom,
    leaveRoom,
    getEngineForSocket,
    attachActiveRoomForUser,
    bootHydrate,
    flushAll,
    cleanupStale,
    loadEngine,
  };
}
