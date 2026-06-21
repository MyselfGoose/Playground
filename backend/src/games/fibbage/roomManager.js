import { createDisconnectGraceRegistry, markPlayerConnected, markPlayerGone } from '../../realtime/playerPresence.js';
import { evictSupersededPartySockets } from '../../realtime/partySocketEviction.js';
import { dedupeRoomPlayersInPlace } from '../../realtime/dedupeRoomPlayers.js';
import { avatarFromSocket, baseLobbyPlayer, mergeAvatarIntoPlayer } from '../../utils/lobbyPlayerAvatar.js';
import { adminForceClosePartyRoom, adminKickPartyPlayer } from '../partyAdminRoomOps.js';
import { registerRoomAccessor } from '../../realtime/roomInviteRegistry.js';
import { onRoomDestroyed, onRoomGameStarted } from '../../realtime/roomInviteLifecycle.js';
import { activePlayersInRoom } from '../../realtime/playerPresence.js';
import { FibbagePrompt } from '../../models/FibbagePrompt.js';
import {
  FIBBAGE_DATASET_VERSION,
  FIBBAGE_MIN_PLAYERS,
  FIBBAGE_MAX_PLAYERS,
} from './constants.js';
import {
  normalizeSettings,
  initGame,
  advancePhaseIfExpired,
  advanceRevealIfExpired,
  finalizeWritingIfReady,
  finalizeVotingIfReady,
  submitLie,
  castVote,
  snapshotFor,
  getGameResults,
  getWinners,
} from './gameManager.js';
import { persistFibbageGameResult } from '../../services/leaderboardStatsService.js';

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 4; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function normalizeCode(code) {
  return String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

/**
 * @param {{ fibbageNs: import('socket.io').Namespace, logger: import('pino').Logger }} params
 */
export function createFibbageRoomManager({ fibbageNs, logger }) {
  const log = logger;
  /** @type {Map<string, object>} */
  const rooms = new Map();
  const socketToCode = new Map();
  const userToCode = new Map();
  const userToSocketIds = new Map();
  const disconnectGrace = createDisconnectGraceRegistry();

  function hasAnyConnectedSocketInRoom(room, userId) {
    return [...room.socketIds].some((sid) => fibbageNs.sockets.get(sid)?.data?.userId === userId);
  }

  function bumpStateVersion(room) {
    room.stateVersion = Number(room.stateVersion || 0) + 1;
    room.updatedAt = Date.now();
  }

  function trackUserSocket(userId, socketId) {
    disconnectGrace.clearGrace(userId);
    const set = userToSocketIds.get(userId) ?? new Set();
    set.add(socketId);
    userToSocketIds.set(userId, set);
  }

  function untrackUserSocket(userId, socketId) {
    const set = userToSocketIds.get(userId);
    if (!set) return;
    set.delete(socketId);
    if (!set.size) userToSocketIds.delete(userId);
  }

  function getRoomForSocket(socket) {
    const code = socketToCode.get(socket.id);
    return code ? rooms.get(code) ?? null : null;
  }

  function emitRoom(code, reason = 'room_update') {
    const room = rooms.get(code);
    if (!room) return;
    for (const socketId of room.socketIds) {
      const socket = fibbageNs.sockets.get(socketId);
      if (!socket) continue;
      socket.emit('room_update', { reason, room: snapshotFor(room, socket.data.userId) });
    }
  }

  async function persistFinishedGameIfNeeded(room) {
    const game = room.game;
    if (!game || game.status !== 'finished' || room.statsPersisted) return;
    room.statsPersisted = true;
    try {
      await persistFibbageGameResult(room, log);
    } catch (err) {
      log?.warn({ err, event: 'persist_fibbage_game_unhandled' }, 'fibbage');
    }
  }

  function applyPhaseTransition(code, room, reason) {
    if (!reason) return;
    bumpStateVersion(room);
    emitRoom(code, reason);
    void persistFinishedGameIfNeeded(room);
  }

  function destroyRoom(code) {
    rooms.delete(code);
    onRoomDestroyed('fibbage', code);
  }

  async function fetchRandomPrompt(room) {
    const excludeIds = [...room.usedPromptIds];
    const filter = {
      datasetVersion: FIBBAGE_DATASET_VERSION,
      active: true,
      ...(excludeIds.length ? { _id: { $nin: excludeIds } } : {}),
    };
    if (room.settings.categoryMode === 'single' && room.settings.categoryIds.length) {
      filter.category = { $in: room.settings.categoryIds };
    }

    let prompt = null;
    const count = await FibbagePrompt.countDocuments(filter);
    if (count > 0) {
      const skip = Math.floor(Math.random() * count);
      const doc = await FibbagePrompt.findOne(filter).skip(skip).lean();
      if (doc) {
        prompt = {
          id: String(doc._id),
          text: doc.text,
          answer: doc.answer,
          category: doc.category,
        };
      }
    }

    if (!prompt) {
      room.usedPromptIds.clear();
      const retryCount = await FibbagePrompt.countDocuments({
        datasetVersion: FIBBAGE_DATASET_VERSION,
        active: true,
        ...(room.settings.categoryMode === 'single' && room.settings.categoryIds.length
          ? { category: { $in: room.settings.categoryIds } }
          : {}),
      });
      if (retryCount > 0) {
        const skip = Math.floor(Math.random() * retryCount);
        const doc = await FibbagePrompt.findOne({
          datasetVersion: FIBBAGE_DATASET_VERSION,
          active: true,
          ...(room.settings.categoryMode === 'single' && room.settings.categoryIds.length
            ? { category: { $in: room.settings.categoryIds } }
            : {}),
        })
          .skip(skip)
          .lean();
        if (doc) {
          prompt = {
            id: String(doc._id),
            text: doc.text,
            answer: doc.answer,
            category: doc.category,
          };
        }
      }
    }

    return prompt;
  }

  async function createRoom(socket, settings) {
    await leaveRoom(socket, { hardLeave: true });
    let code = '';
    for (let i = 0; i < 40; i += 1) {
      const candidate = randomCode();
      if (!rooms.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) throw Object.assign(new Error('Could not allocate room'), { code: 'ROOM_ALLOC_FAIL' });

    const normalized = normalizeSettings(settings);
    const player = baseLobbyPlayer({
      userId: socket.data.userId,
      username: socket.data.username,
      socket,
      extra: { ready: false, score: 0 },
    });
    markPlayerConnected(player);
    mergeAvatarIntoPlayer(player, avatarFromSocket(socket));

    /** @type {object} */
    const room = {
      code,
      hostUserId: socket.data.userId,
      hostName: socket.data.username,
      stateVersion: 1,
      settings: normalized,
      players: [player],
      game: null,
      usedPromptIds: new Set(),
      datasetVersion: FIBBAGE_DATASET_VERSION,
      statsPersisted: false,
      socketIds: new Set([socket.id]),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    rooms.set(code, room);
    socketToCode.set(socket.id, code);
    userToCode.set(socket.data.userId, code);
    trackUserSocket(socket.data.userId, socket.id);
    socket.join(code);
    return room;
  }

  async function joinRoom(socket, code) {
    const normalized = normalizeCode(code);
    if (normalized.length !== 4) throw Object.assign(new Error('Invalid room code'), { code: 'VALIDATION_ERROR' });
    const room = rooms.get(normalized);
    if (!room) throw Object.assign(new Error('Room not found'), { code: 'ROOM_NOT_FOUND' });

    const alreadyMember = room.players.some((p) => p.userId === socket.data.userId);
    if (!alreadyMember && room.game && room.game.status !== 'finished') {
      throw Object.assign(new Error('Game already in progress'), { code: 'ROOM_LOCKED' });
    }
    if (!alreadyMember && room.players.length >= FIBBAGE_MAX_PLAYERS) {
      throw Object.assign(new Error('Lobby is full'), { code: 'LOBBY_FULL' });
    }

    await leaveRoom(socket, { hardLeave: false });

    const existing = room.players.find((p) => p.userId === socket.data.userId);
    if (existing) {
      markPlayerConnected(existing);
      existing.username = socket.data.username;
      mergeAvatarIntoPlayer(existing, avatarFromSocket(socket));
    } else {
      const newbie = baseLobbyPlayer({
        userId: socket.data.userId,
        username: socket.data.username,
        socket,
        extra: { ready: false, score: 0 },
      });
      markPlayerConnected(newbie);
      room.players.push(newbie);
    }

    dedupeRoomPlayersInPlace(room);
    room.socketIds.add(socket.id);
    evictSupersededPartySockets(fibbageNs, {
      userId: socket.data.userId,
      currentSocketId: socket.id,
      roomCode: normalized,
      socketToCode,
      room,
      userToSocketIds,
    });
    socketToCode.set(socket.id, normalized);
    userToCode.set(socket.data.userId, normalized);
    trackUserSocket(socket.data.userId, socket.id);
    socket.join(normalized);
    bumpStateVersion(room);
    return room;
  }

  async function leaveRoom(socket, { hardLeave }) {
    const code = socketToCode.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    socketToCode.delete(socket.id);
    untrackUserSocket(socket.data.userId, socket.id);
    socket.leave(code);
    if (!room) return;
    room.socketIds.delete(socket.id);

    const player = room.players.find((p) => p.userId === socket.data.userId);
    if (player) {
      const userId = socket.data.userId;
      if (hardLeave) {
        disconnectGrace.clearGrace(userId);
        if (!hasAnyConnectedSocketInRoom(room, userId)) {
          room.players = room.players.filter((p) => p.userId !== userId);
          userToCode.delete(userId);
        } else {
          markPlayerConnected(player);
        }
        if (room.hostUserId === userId && room.players.length) {
          const connectedHost = room.players.find((p) => p.presenceStatus === 'connected');
          room.hostUserId = connectedHost?.userId ?? room.players[0].userId;
          room.hostName = (connectedHost ?? room.players[0]).username;
        }
        bumpStateVersion(room);
      } else {
        disconnectGrace.clearGrace(userId);
        if (hasAnyConnectedSocketInRoom(room, userId)) {
          markPlayerConnected(player);
          bumpStateVersion(room);
          emitRoom(code, 'room_update');
        } else {
          disconnectGrace.scheduleGrace(userId, player, () => {
            const expectedCode = userToCode.get(userId);
            if (!expectedCode || expectedCode !== code) return;
            const pendingRoom = rooms.get(code);
            if (!pendingRoom) return;
            if (hasAnyConnectedSocketInRoom(pendingRoom, userId)) return;
            const pendingPlayer = pendingRoom.players.find((p) => p.userId === userId);
            if (!pendingPlayer) return;
            markPlayerGone(pendingPlayer);
            if (pendingRoom.hostUserId === userId && pendingRoom.players.length) {
              const connectedHost = pendingRoom.players.find((p) => p.presenceStatus === 'connected');
              pendingRoom.hostUserId = connectedHost?.userId ?? pendingRoom.players[0].userId;
              pendingRoom.hostName = (connectedHost ?? pendingRoom.players[0]).username;
            }
            bumpStateVersion(pendingRoom);
            emitRoom(code, 'member_disconnected');
            if (!pendingRoom.players.filter((p) => p.presenceStatus !== 'gone').length) {
              destroyRoom(code);
            }
          });
          bumpStateVersion(room);
          emitRoom(code, 'player_disconnect_pending');
        }
      }
    }
    if (!room.players.length) {
      destroyRoom(code);
    }
  }

  function attachActiveRoomForUser(socket) {
    const code = userToCode.get(socket.data.userId);
    if (!code) return null;
    const room = rooms.get(code);
    if (!room) return null;
    evictSupersededPartySockets(fibbageNs, {
      userId: socket.data.userId,
      currentSocketId: socket.id,
      roomCode: code,
      socketToCode,
      room,
      userToSocketIds,
    });
    room.socketIds.add(socket.id);
    socketToCode.set(socket.id, code);
    socket.join(code);
    trackUserSocket(socket.data.userId, socket.id);
    const player = room.players.find((p) => p.userId === socket.data.userId);
    if (player) {
      markPlayerConnected(player);
      mergeAvatarIntoPlayer(player, avatarFromSocket(socket));
    }
    bumpStateVersion(room);
    return room;
  }

  function setReady(socket, ready) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error('Player not found'), { code: 'PLAYER_NOT_FOUND' });
    if (room.game && room.game.status !== 'finished') {
      throw Object.assign(new Error('Cannot change ready during game'), { code: 'GAME_ALREADY_STARTED' });
    }
    me.ready = Boolean(ready);
    bumpStateVersion(room);
    return room;
  }

  function updateSettings(socket, settings) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostUserId !== socket.data.userId) {
      throw Object.assign(new Error('Only host can update settings'), { code: 'NOT_HOST' });
    }
    if (room.game && room.game.status !== 'finished') {
      throw Object.assign(new Error('Cannot update settings during game'), { code: 'GAME_ALREADY_STARTED' });
    }
    const current = room.settings;
    const merged = { ...current };
    if (settings.roundCount !== undefined) merged.roundCount = settings.roundCount;
    if (settings.writingSeconds !== undefined) merged.writingSeconds = settings.writingSeconds;
    if (settings.votingSeconds !== undefined) merged.votingSeconds = settings.votingSeconds;
    if (settings.categoryMode !== undefined) merged.categoryMode = settings.categoryMode;
    if (settings.categoryIds !== undefined) merged.categoryIds = settings.categoryIds;
    room.settings = normalizeSettings(merged);
    bumpStateVersion(room);
    return room;
  }

  async function startRoomGame(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostUserId !== socket.data.userId) {
      throw Object.assign(new Error('Only host can start'), { code: 'NOT_HOST' });
    }
    if (room.game && room.game.status !== 'finished') {
      throw Object.assign(new Error('Game already in progress'), { code: 'GAME_ALREADY_STARTED' });
    }
    const active = activePlayersInRoom(room);
    if (active.length < FIBBAGE_MIN_PLAYERS) {
      throw Object.assign(
        new Error(`Need at least ${FIBBAGE_MIN_PLAYERS} ready players`),
        { code: 'NOT_ENOUGH_PLAYERS' },
      );
    }
    if (!active.every((p) => p.ready)) {
      throw Object.assign(new Error('All players must be ready'), { code: 'NOT_ALL_READY' });
    }

    const prompt = await fetchRandomPrompt(room);
    if (!prompt) {
      throw Object.assign(new Error('No prompts available'), { code: 'NO_PROMPTS' });
    }

    room.statsPersisted = false;
    for (const p of room.players) {
      p.score = 0;
    }
    initGame(room, prompt);
    onRoomGameStarted('fibbage', room.code);
    bumpStateVersion(room);
    return room;
  }

  function submitRoomLie(socket, text) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    submitLie(room, socket.data.userId, text);
    const now = Date.now();
    const transitionReason = finalizeWritingIfReady(room, now);
    bumpStateVersion(room);
    return { room, transitionReason };
  }

  function castRoomVote(socket, answerId) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    castVote(room, socket.data.userId, answerId);
    const now = Date.now();
    const transitionReason = finalizeVotingIfReady(room, now);
    bumpStateVersion(room);
    return { room, transitionReason };
  }

  function snapshotForSocket(socket) {
    const room = getRoomForSocket(socket);
    if (!room) return null;
    return snapshotFor(room, socket.data.userId);
  }

  function returnToLobby(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostUserId !== socket.data.userId) {
      throw Object.assign(new Error('Only host can return to lobby'), { code: 'NOT_HOST' });
    }
    if (!room.game || room.game.status !== 'finished') {
      throw Object.assign(new Error('Game must be finished'), { code: 'INVALID_PHASE' });
    }
    room.game = null;
    room.statsPersisted = false;
    for (const p of room.players) {
      p.ready = false;
      p.score = 0;
    }
    bumpStateVersion(room);
    return room;
  }

  async function getCategories() {
    const result = await FibbagePrompt.distinct('category', {
      datasetVersion: FIBBAGE_DATASET_VERSION,
      active: true,
    });
    return result.sort();
  }

  /**
   * Tick all rooms: advance phases if timers expired.
   * @returns {Array<{code: string, reason: string}>}
   */
  function tick() {
    const now = Date.now();

    for (const [code, room] of rooms) {
      if (!room.game || room.phaseTransitionInFlight) continue;

      const game = room.game;

      if (game.status === 'revealing' && game.reveal) {
        if (now >= game.reveal.phaseEndsAt) {
          room.phaseTransitionInFlight = true;
          void (async () => {
            try {
              const reason = advanceRevealIfExpired(room, now);
              applyPhaseTransition(code, room, reason);
            } catch (err) {
              log?.error({ err, code, event: 'fibbage_reveal_tick_error' }, 'fibbage');
            } finally {
              room.phaseTransitionInFlight = false;
            }
          })();
        }
        continue;
      }

      if (!game.phaseEndsAt || now < game.phaseEndsAt) continue;

      if (game.status === 'between_rounds') {
        game.phaseEndsAt = null;
      }

      room.phaseTransitionInFlight = true;
      void (async () => {
        try {
          const reason = await advancePhaseIfExpired(room, now, () => fetchRandomPrompt(room));
          applyPhaseTransition(code, room, reason);
        } catch (err) {
          log?.error({ err, code, event: 'fibbage_tick_error' }, 'fibbage');
        } finally {
          room.phaseTransitionInFlight = false;
        }
      })();
    }

    return [];
  }

  function shutdown() {
    for (const userId of userToCode.keys()) disconnectGrace.clearGrace(userId);
    rooms.clear();
    socketToCode.clear();
    userToCode.clear();
    userToSocketIds.clear();
  }

  function listRoomsForAdmin() {
    return [...rooms.values()].map((room) => ({
      code: room.code,
      game: 'fibbage',
      hostId: String(room.hostUserId),
      hostUsername: room.hostName ?? null,
      playerCount: room.players?.length ?? 0,
      phase: room.game?.status ?? 'lobby',
      createdAt: room.createdAt,
    }));
  }

  function getRoomForAdmin(code) {
    const normalized = normalizeCode(code);
    const room = rooms.get(normalized);
    if (!room) return null;
    return {
      code: room.code,
      game: 'fibbage',
      hostId: String(room.hostUserId),
      hostUsername: room.hostName ?? null,
      phase: room.game?.status ?? 'lobby',
      players: (room.players ?? []).map((p) => ({
        userId: String(p.userId),
        username: p.username,
        ready: p.ready,
        score: p.score,
      })),
      meta: { settings: room.settings },
    };
  }

  function adminForceClose(code) {
    const normalized = normalizeCode(code);
    return adminForceClosePartyRoom({
      game: 'fibbage',
      code: normalized,
      rooms,
      socketToCode,
      userToCode,
      userToSocketIds,
      ns: fibbageNs,
      onDestroyed: onRoomDestroyed,
      disconnectGrace,
    });
  }

  function adminKickPlayer(code, targetUserId) {
    const normalized = normalizeCode(code);
    return adminKickPartyPlayer({
      game: 'fibbage',
      code: normalized,
      targetUserId,
      rooms,
      socketToCode,
      userToCode,
      userToSocketIds,
      ns: fibbageNs,
      onDestroyed: onRoomDestroyed,
      disconnectGrace,
    });
  }

  registerRoomAccessor('fibbage', {
    getInviteContext(rawCode) {
      const code = normalizeCode(rawCode);
      const room = rooms.get(code);
      if (!room) {
        return { exists: false, hostId: null, playerUserIds: [], joinable: false };
      }
      const joinable = !room.game || room.game.status === 'finished';
      return {
        exists: true,
        hostId: String(room.hostUserId),
        playerUserIds: room.players.map((p) => String(p.userId)),
        joinable,
      };
    },
  });

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    updateSettings,
    startRoomGame,
    submitRoomLie,
    castRoomVote,
    snapshotForSocket,
    snapshotFor: (room, userId) => snapshotFor(room, userId),
    getRoomForSocket,
    attachActiveRoomForUser,
    returnToLobby,
    getCategories,
    emitRoom,
    tick,
    shutdown,
    listRoomsForAdmin,
    getRoomForAdmin,
    adminForceClose,
    adminKickPlayer,
    getObservabilitySnapshot() {
      let roomCount = 0;
      let playerCount = 0;
      for (const room of rooms.values()) {
        roomCount += 1;
        playerCount += room.players?.length ?? 0;
      }
      return { game: 'fibbage', rooms: roomCount, players: playerCount };
    },
  };
}
