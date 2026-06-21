import { AppError } from '../../errors/AppError.js';
import { NpatRoom } from '../../models/NpatRoom.js';
import { npatRoomRepository } from '../../repositories/npatRoomRepository.js';
import { toRoomDetail, toRoomSummary } from '../../games/adminRoomShapes.js';
import { getAdminRuntimeContext } from './adminRuntimeContext.js';
import {
  adminForceCloseRoom,
  adminKickRoomPlayer,
  getRoomForAdmin,
  getSocketConnectionCounts,
  getNpatRegistry,
  listAllRoomsForAdmin,
} from './adminRuntimeHub.js';
import { adminAuditService } from './adminAuditService.js';

/**
 * @param {import('../../config/env.js').Env} env
 */
export function createAdminLiveOpsService(env) {
  return {
    async getSocketCounts() {
      return getSocketConnectionCounts();
    },

    /**
     * @param {string} [game]
     */
    listRooms(game) {
      const rows = listAllRoomsForAdmin(game);
      const runtime = getAdminRuntimeContext();
      const bootedAt = new Date(runtime.bootedAt).getTime();
      const summaries = rows.map((r) => toRoomSummary(/** @type {any} */ (r)));
      const survivedRestart = summaries.some((r) => {
        const created = r.createdAt ? new Date(r.createdAt).getTime() : 0;
        return created > 0 && created < bootedAt;
      });
      return {
        rooms: summaries,
        perInstance: true,
        instanceCount: runtime.instanceCount,
        bootedAt: runtime.bootedAt,
        survivedRestart,
      };
    },

    /**
     * @param {string} game
     * @param {string} code
     */
    getRoom(game, code) {
      const room = getRoomForAdmin(game, code);
      if (!room) {
        throw new AppError(404, 'Room not found', { code: 'ROOM_NOT_FOUND', expose: true });
      }
      return toRoomDetail(/** @type {any} */ (room));
    },

    /**
     * @param {string} actorId
     * @param {string} game
     * @param {string} code
     * @param {string} [reason]
     */
    async forceCloseRoom(actorId, game, code, reason = '') {
      const result = adminForceCloseRoom(game, code);
      await adminAuditService.log({
        actorId,
        action: 'room_force_close',
        metadata: { game, code: result.code, reason },
      });
      return result;
    },

    /**
     * @param {string} actorId
     * @param {string} game
     * @param {string} code
     * @param {string} userId
     */
    async kickPlayer(actorId, game, code, userId) {
      const result = adminKickRoomPlayer(game, code, userId);
      await adminAuditService.log({
        actorId,
        targetUserId: userId,
        action: 'room_kick_player',
        metadata: { game, code },
      });
      return result;
    },

    /**
     * @param {{ limit?: number }} [opts]
     */
    async listNpatMongoRooms(opts = {}) {
      const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
      const rows = await NpatRoom.find({ finishedAt: null })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
      return rows.map((r) => ({
        code: r.code,
        hostUserId: String(r.hostUserId),
        engineState: r.engineState,
        roundPhase: r.roundPhase,
        playerCount: r.players?.length ?? 0,
        updatedAt: r.updatedAt,
        createdAt: r.createdAt,
        version: r.version,
      }));
    },

    /**
     * @param {string} code
     */
    async getNpatMongoRoom(code) {
      const normalized = String(code).replace(/\D/g, '').slice(0, 6);
      const doc = await npatRoomRepository.findByCode(normalized);
      if (!doc) {
        throw new AppError(404, 'NPAT room not found', { code: 'ROOM_NOT_FOUND', expose: true });
      }
      return doc;
    },

    /**
     * @param {{ limit?: number }} [opts]
     */
    async listNpatEvalFailures(opts = {}) {
      const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
      const rows = await NpatRoom.find({
        $or: [
          { 'roundsHistory.evaluationStatus': 'failed' },
          {
            'roundsHistory.evaluationStatus': 'complete',
            'roundsHistory.evaluationSource': 'fallback',
            'roundsHistory.evaluationFailureClass': { $ne: null },
          },
        ],
      })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();

      /** @type {Array<Record<string, unknown>>} */
      const failures = [];
      for (const room of rows) {
        const history = Array.isArray(room.roundsHistory) ? room.roundsHistory : [];
        for (const round of history) {
          if (
            round.evaluationStatus === 'failed' ||
            (round.evaluationSource === 'fallback' && round.evaluationFailureClass)
          ) {
            failures.push({
              roomCode: room.code,
              roundIndex: round.roundIndex,
              letter: round.letter,
              evaluationStatus: round.evaluationStatus,
              evaluationSource: round.evaluationSource,
              evaluationFailureClass: round.evaluationFailureClass,
              evaluatedAt: round.evaluatedAt,
            });
          }
        }
      }
      return failures.slice(0, limit);
    },

    /**
     * @param {string} actorId
     * @param {string} code
     */
    async retryNpatEval(actorId, code) {
      const normalized = String(code).replace(/\D/g, '').slice(0, 6);
      const registry = getNpatRegistry();
      const engine = registry?.engines?.get(normalized);
      if (engine?.retryAdminEvaluation) {
        await engine.retryAdminEvaluation();
        await adminAuditService.log({
          actorId,
          action: 'npat_eval_retry',
          metadata: { code: normalized, mode: 'live_engine' },
        });
        return { ok: true, mode: 'live_engine' };
      }

      const doc = await npatRoomRepository.findByCode(normalized);
      if (!doc) {
        throw new AppError(404, 'NPAT room not found', { code: 'ROOM_NOT_FOUND', expose: true });
      }

      throw new AppError(409, 'Room is not active in memory; retry requires a live game engine', {
        code: 'NPAT_ROOM_NOT_ACTIVE',
        expose: true,
      });
    },
  };
}
