import { createDisconnectGraceRegistry } from '../../realtime/playerPresence.js';
import {
  markPlayerConnected,
  markPlayerGone,
} from '../../realtime/playerPresence.js';
import { evictSupersededPartySockets } from '../../realtime/partySocketEviction.js';
import { dedupeRoomPlayersInPlace } from '../../realtime/dedupeRoomPlayers.js';
import { avatarFromSocket, baseLobbyPlayer, mergeAvatarIntoPlayer } from '../../utils/lobbyPlayerAvatar.js';
import {
  adminForceClosePartyRoom,
  adminKickPartyPlayer,
} from '../partyAdminRoomOps.js';
import {
  CAH_DEFAULT_HAND_SIZE,
  CAH_DEFAULT_MAX_ROUNDS,
  CAH_MAX_ROUNDS_LIMIT,
  CAH_REVEALING_AUTO_ADVANCE_MS,
} from './constants.js';
import {
  CAH_DATASET_VERSION,
  canAdvanceFromRevealing,
  createCahRoom,
  judgePickWinner,
  listAvailablePacks,
  nextRound,
  reconcileRoomAfterMembershipChange,
  snapshotFor,
  startGame,
  submitCards,
  validatePacksAgainstAllowed,
} from './gameManager.js';
import { persistCahGameResult, persistCahRoundResult } from '../../services/leaderboardStatsService.js';
import { registerRoomAccessor } from '../../realtime/roomInviteRegistry.js';
import { onRoomDestroyed, onRoomGameStarted } from '../../realtime/roomInviteLifecycle.js';

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

function normalizeSettings(input = {}, serverMaxPlayers) {
  const maxRounds = Number(input.maxRounds ?? CAH_DEFAULT_MAX_ROUNDS);
  const packs = Array.isArray(input.packs) ? [...new Set(input.packs.map((p) => String(p).trim()).filter(Boolean))] : [];
  const cap =
    typeof serverMaxPlayers === 'number' && Number.isFinite(serverMaxPlayers)
      ? Math.min(24, Math.max(3, Math.floor(serverMaxPlayers)))
      : 10;
  return {
    maxRounds: Math.max(1, Math.min(CAH_MAX_ROUNDS_LIMIT, Number.isFinite(maxRounds) ? maxRounds : CAH_DEFAULT_MAX_ROUNDS)),
    handSize: CAH_DEFAULT_HAND_SIZE,
    packs,
    maxPlayers: cap,
  };
}

export function createCahRoomManager({ cahNs, logger, maxPlayers: lobbyMaxPlayers }) {
  const log = logger;
  const rooms = new Map();
  /** @type {Set<string> | null} */
  let cachedPackIds = null;
  const socketToCode = new Map();
  const userToCode = new Map();
  const userToSocketIds = new Map();
  const disconnectGrace = createDisconnectGraceRegistry();
  /** @type {Map<string, NodeJS.Timeout>} */
  const revealingTimers = new Map();

  function hasAnyConnectedSocketInRoom(room, userId) {
    return [...room.socketIds].some((sid) => cahNs.sockets.get(sid)?.data?.userId === userId);
  }

  function clearRevealingTimer(code) {
    const t = revealingTimers.get(code);
    if (t) clearTimeout(t);
    revealingTimers.delete(code);
  }

  async function advanceRoundInternal(room) {
    clearRevealingTimer(room.code);
    await nextRound(room);
    if (room.game?.status === 'finished') {
      try {
        await persistCahGameResult(room, log);
      } catch (err) {
        log?.warn({ err, event: 'persist_cah_game_unhandled' }, 'cah');
      }
    }
    bumpStateVersion(room);
  }

  function scheduleRevealingAutoAdvance(code) {
    clearRevealingTimer(code);
    const timeout = setTimeout(() => {
      void (async () => {
        const room = rooms.get(code);
        if (!room?.game || room.game.status !== 'revealing') return;
        await advanceRoundInternal(room);
        emitRoom(code, 'revealing_auto_advance');
      })();
    }, CAH_REVEALING_AUTO_ADVANCE_MS);
    timeout.unref?.();
    revealingTimers.set(code, timeout);
  }

  function bumpStateVersion(room) {
    room.stateVersion = Number(room.stateVersion || 0) + 1;
    room.updatedAt = Date.now();
  }

  async function getAllowedPackSet() {
    if (!cachedPackIds) {
      const packs = await listAvailablePacks(CAH_DATASET_VERSION);
      cachedPackIds = new Set(packs);
    }
    return cachedPackIds;
  }

  async function applyPackSettings(room, partialSettings) {
    const merged = normalizeSettings(partialSettings, lobbyMaxPlayers);
    if (Object.prototype.hasOwnProperty.call(partialSettings ?? {}, 'packs')) {
      const allowed = await getAllowedPackSet();
      merged.packs = validatePacksAgainstAllowed(merged.packs, allowed);
    }
    return merged;
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
      const socket = cahNs.sockets.get(socketId);
      if (!socket) continue;
      socket.emit('room_update', { reason, room: snapshotFor(room, socket.data.userId) });
    }
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

    const normalized = normalizeSettings(settings, lobbyMaxPlayers);
    if (normalized.packs.length) {
      const allowed = await getAllowedPackSet();
      normalized.packs = validatePacksAgainstAllowed(normalized.packs, allowed);
    }
    const room = createCahRoom(socket.data.userId, socket.data.username, normalized);
    mergeAvatarIntoPlayer(room.players[0], avatarFromSocket(socket));
    room.code = code;
    room.socketIds = new Set([socket.id]);
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
    if (!alreadyMember && room.game && room.game.status !== 'finished' && room.game.status !== 'lobby') {
      throw Object.assign(new Error('Game already in progress'), { code: 'ROOM_LOCKED' });
    }
    if (
      !alreadyMember &&
      room.players.length >= Number(room.settings?.maxPlayers ?? lobbyMaxPlayers ?? 10)
    ) {
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
    evictSupersededPartySockets(cahNs, {
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
        if (room.hostId === userId && room.players.length) {
          const connectedHost = room.players.find((p) => p.presenceStatus === 'connected');
          room.hostId = connectedHost?.userId ?? room.players[0].userId;
        }
        await reconcileRoomAfterMembershipChange(room);
        bumpStateVersion(room);
      } else {
        disconnectGrace.clearGrace(userId);
        if (hasAnyConnectedSocketInRoom(room, userId)) {
          markPlayerConnected(player);
          bumpStateVersion(room);
          emitRoom(code, 'room_update');
        } else {
          disconnectGrace.scheduleGrace(userId, player, async () => {
            const expectedCode = userToCode.get(userId);
            if (!expectedCode || expectedCode !== code) return;
            const pendingRoom = rooms.get(code);
            if (!pendingRoom) return;
            if (hasAnyConnectedSocketInRoom(pendingRoom, userId)) return;
            const pendingPlayer = pendingRoom.players.find((p) => p.userId === userId);
            if (!pendingPlayer) return;
            markPlayerGone(pendingPlayer);
            if (pendingRoom.hostId === userId && pendingRoom.players.length) {
              const connectedHost = pendingRoom.players.find((p) => p.presenceStatus === 'connected');
              pendingRoom.hostId = connectedHost?.userId ?? pendingRoom.players[0].userId;
            }
            await reconcileRoomAfterMembershipChange(pendingRoom);
            bumpStateVersion(pendingRoom);
            emitRoom(code, 'member_disconnected');
            if (!pendingRoom.players.filter((p) => p.presenceStatus !== 'gone').length) {
              clearRevealingTimer(code);
              rooms.delete(code);
              onRoomDestroyed('cah', code);
            }
          });
          bumpStateVersion(room);
          emitRoom(code, 'player_disconnect_pending');
        }
      }
    }
    if (!room.players.length) {
      clearRevealingTimer(code);
      rooms.delete(code);
      onRoomDestroyed('cah', code);
    }
  }

  async function attachActiveRoomForUser(socket) {
    const code = userToCode.get(socket.data.userId);
    if (!code) return null;
    const room = rooms.get(code);
    if (!room) return null;
    evictSupersededPartySockets(cahNs, {
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
    await reconcileRoomAfterMembershipChange(room);
    bumpStateVersion(room);
    return room;
  }
  function reconcileRoomAfterMembership(room) {
    return reconcileRoomAfterMembershipChange(room);
  }


  function setReady(socket, ready) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error('Player not found'), { code: 'PLAYER_NOT_FOUND' });
    if (room.game && room.game.status !== 'lobby') {
      throw Object.assign(new Error('Cannot change ready after game start'), { code: 'GAME_ALREADY_STARTED' });
    }
    me.ready = Boolean(ready);
    bumpStateVersion(room);
    return room;
  }

  async function updateSettings(socket, settings) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) throw Object.assign(new Error('Only host can update settings'), { code: 'NOT_HOST' });
    if (room.game && room.game.status !== 'lobby') throw Object.assign(new Error('Cannot update settings after start'), { code: 'GAME_ALREADY_STARTED' });
    const input = settings ?? {};
    const merged = { ...room.settings };
    if (Object.prototype.hasOwnProperty.call(input, 'maxRounds')) {
      merged.maxRounds = normalizeSettings({ maxRounds: input.maxRounds }, lobbyMaxPlayers).maxRounds;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'packs')) {
      const packPatch = await applyPackSettings(room, { packs: input.packs });
      merged.packs = packPatch.packs;
    }
    room.settings = merged;
    bumpStateVersion(room);
    return room;
  }

  async function listPacks() {
    const packs = await listAvailablePacks(CAH_DATASET_VERSION);
    cachedPackIds = new Set(packs);
    return packs.map((pack) => ({ pack }));
  }

  async function startRoomGame(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) throw Object.assign(new Error('Only host can start'), { code: 'NOT_HOST' });
    await startGame(room);
    onRoomGameStarted('cah', room.code);
    bumpStateVersion(room);
    return room;
  }

  async function submitRoomCards(socket, cardIds) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    await submitCards(room, socket.data.userId, cardIds);
    bumpStateVersion(room);
    return room;
  }

  async function judgePick(socket, submissionId) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    judgePickWinner(room, socket.data.userId, submissionId);
    bumpStateVersion(room);
    try {
      await persistCahRoundResult(room, log);
    } catch (err) {
      log?.warn({ err, event: 'persist_cah_round_unhandled' }, 'cah');
    }
    if (room.game?.status === 'revealing') {
      scheduleRevealingAutoAdvance(room.code);
    }
    return room;
  }

  async function advanceRound(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (!canAdvanceFromRevealing(room, socket.data.userId)) {
      throw Object.assign(new Error('Cannot advance round now'), { code: 'NOT_ALLOWED' });
    }
    await advanceRoundInternal(room);
    return room;
  }

  function snapshotForSocket(socket) {
    const room = getRoomForSocket(socket);
    if (!room) return null;
    return snapshotFor(room, socket.data.userId);
  }

  function returnToLobby(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) {
      throw Object.assign(new Error('Only host can return to lobby'), { code: 'NOT_HOST' });
    }
    if (!room.game || room.game.status !== 'finished') {
      throw Object.assign(new Error('Game must be finished'), { code: 'INVALID_PHASE' });
    }
    clearRevealingTimer(room.code);
    room.game = null;
    room.deckRecycled = false;
    for (const p of room.players) {
      p.ready = false;
      p.score = 0;
    }
    bumpStateVersion(room);
    room.updatedAt = Date.now();
    return room;
  }

  function shutdown() {
    for (const t of revealingTimers.values()) clearTimeout(t);
    revealingTimers.clear();
    for (const userId of userToCode.keys()) disconnectGrace.clearGrace(userId);
    rooms.clear();
    socketToCode.clear();
    userToCode.clear();
    userToSocketIds.clear();
  }

  function listRoomsForAdmin() {
    return [...rooms.values()].map((room) => ({
      code: room.code,
      game: 'cah',
      hostId: String(room.hostId),
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
      game: 'cah',
      hostId: String(room.hostId),
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
      game: 'cah',
      code: normalized,
      rooms,
      socketToCode,
      userToCode,
      userToSocketIds,
      ns: cahNs,
      onDestroyed: onRoomDestroyed,
      disconnectGrace,
    });
  }

  function adminKickPlayer(code, targetUserId) {
    const normalized = normalizeCode(code);
    return adminKickPartyPlayer({
      game: 'cah',
      code: normalized,
      targetUserId,
      rooms,
      socketToCode,
      userToCode,
      userToSocketIds,
      ns: cahNs,
      onDestroyed: onRoomDestroyed,
      disconnectGrace,
    });
  }

  registerRoomAccessor('cah', {
    getInviteContext(rawCode) {
      const code = normalizeCode(rawCode);
      const room = rooms.get(code);
      if (!room) {
        return { exists: false, hostId: null, playerUserIds: [], joinable: false };
      }
      const joinable = !room.game || room.game.status === 'lobby' || room.game.status === 'finished';
      return {
        exists: true,
        hostId: String(room.hostId),
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
    listPacks,
    startRoomGame,
    submitRoomCards,
    judgePick,
    advanceRound,
    snapshotForSocket,
    getRoomForSocket,
    attachActiveRoomForUser,
    reconcileRoomAfterMembership,
    returnToLobby,
    emitRoom,
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
      return { game: 'cah', rooms: roomCount, players: playerCount };
    },
  };
}
