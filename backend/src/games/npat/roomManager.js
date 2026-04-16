import mongoose from 'mongoose';
import { npatRoomRepository } from '../../repositories/npatRoomRepository.js';
import { NpatRoomEngine } from './gameManager.js';
import { DEFAULT_TEAMS } from './constants.js';

/**
 * @param {number} len
 */
function randomDigits(len) {
  const min = 10 ** (len - 1);
  const max = 10 ** len - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
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
      try {
        await npatRoomRepository.updateByCode(code, update);
      } catch (err) {
        logger.warn({ err, code }, 'npat_persist_failed');
      }
    };
  }

  /**
   * @returns {Promise<string>}
   */
  async function allocateUniqueCode() {
    const len = env.NPAT_ROOM_CODE_LENGTH;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const code = randomDigits(len);
      const existsMem = engines.has(code);
      const existsDb = await npatRoomRepository.existsByCode(code);
      if (!existsMem && !existsDb) {
        return code;
      }
    }
    throw new Error('Could not allocate room code');
  }

  return {
    engines,
    socketToRoom,

    /**
     * @param {import('socket.io').Socket} socket
     */
    getEngineForSocket(socket) {
      const code = socketToRoom.get(socket.id);
      if (!code) return null;
      return engines.get(code) ?? null;
    },

    /**
     * @param {'solo' | 'team'} mode
     * @param {string} userId
     * @param {string} username
     * @param {import('socket.io').Socket} socket
     */
    async createRoom(mode, userId, username, socket) {
      const code = await allocateUniqueCode();
      const hostOid = new mongoose.Types.ObjectId(userId);
      const teams = mode === 'team' ? [...DEFAULT_TEAMS] : [];

      await npatRoomRepository.create({
        code,
        hostUserId: hostOid,
        mode,
        maxPlayers: env.NPAT_MAX_PLAYERS,
        engineState: 'WAITING',
        roundPhase: 'none',
        usedLetters: [],
        letterPool: [],
        currentRoundIndex: -1,
        currentLetter: '',
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
      });

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
      socket.join(code);
      socketToRoom.set(socket.id, code);

      void persist(
        {
          players: engine.playersToMongo(),
          lastPublicSnapshot: engine.toPublicDto(),
        },
        undefined,
      );

      return { code, engine };
    },

    /**
     * @param {string} code
     * @param {string} userId
     * @param {string} username
     * @param {import('socket.io').Socket} socket
     */
    async joinRoom(code, userId, username, socket) {
      let engine = engines.get(code);
      if (!engine) {
        const doc = await npatRoomRepository.findByCode(code);
        if (!doc) {
          const err = new Error('Room not found');
          /** @type {any} */ (err).code = 'ROOM_NOT_FOUND';
          throw err;
        }
        if (doc.engineState !== 'WAITING') {
          const err = new Error('Game already started or room is inactive');
          /** @type {any} */ (err).code = 'GAME_ALREADY_STARTED';
          throw err;
        }
        const persist = makePersist(doc.code);
        engine = new NpatRoomEngine({
          code: doc.code,
          mode: /** @type {'solo' | 'team'} */ (doc.mode),
          hostUserId: String(doc.hostUserId),
          env,
          logger,
          npatNs,
          persist,
        });
        engine.teams = doc.teams?.length ? doc.teams : engine.teams;
        for (const pl of doc.players) {
          engine.upsertPlayer(String(pl.userId), pl.username, null, new Date(pl.joinedAt).getTime());
          const rp = engine.players.get(String(pl.userId));
          if (rp) {
            rp.teamId = pl.teamId ?? '';
            rp.ready = Boolean(pl.ready);
          }
        }
        engines.set(doc.code, engine);
      }

      const isReturning = engine.players.has(userId);
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

      const now = Date.now();
      engine.upsertPlayer(userId, username, socket.id, now);
      engine.setSocket(userId, socket.id);
      socket.join(code);
      socketToRoom.set(socket.id, code);

      void engine.persist(
        {
          players: engine.playersToMongo(),
          hostUserId: new mongoose.Types.ObjectId(engine.hostUserId),
          lastPublicSnapshot: engine.toPublicDto(),
        },
        undefined,
      );

      return engine;
    },

    /**
     * @param {import('socket.io').Socket} socket
     */
    leaveRoom(socket) {
      const code = socketToRoom.get(socket.id);
      if (!code) return;
      const engine = engines.get(code);
      socket.leave(code);
      socketToRoom.delete(socket.id);
      if (!engine) return;

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
          engine.destroy();
          engines.delete(code);
          void npatRoomRepository.deleteByCode(code).catch(() => {});
        } else {
          engine.emit('room_update', { room: engine.toPublicDto() });
        }
      }
    },
  };
}
