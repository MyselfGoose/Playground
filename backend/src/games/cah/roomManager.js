import {
  CAH_DEFAULT_HAND_SIZE,
  CAH_DEFAULT_MAX_ROUNDS,
  CAH_MAX_ROUNDS_LIMIT,
} from './constants.js';
import {
  createCahRoom,
  judgePickWinner,
  nextRound,
  reconcileRoomAfterMembershipChange,
  snapshotFor,
  startGame,
  submitCards,
} from './gameManager.js';

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

function normalizeSettings(input = {}) {
  const maxRounds = Number(input.maxRounds ?? CAH_DEFAULT_MAX_ROUNDS);
  const packs = Array.isArray(input.packs) ? [...new Set(input.packs.map((p) => String(p).trim()).filter(Boolean))] : [];
  return {
    maxRounds: Math.max(1, Math.min(CAH_MAX_ROUNDS_LIMIT, Number.isFinite(maxRounds) ? maxRounds : CAH_DEFAULT_MAX_ROUNDS)),
    handSize: CAH_DEFAULT_HAND_SIZE,
    packs,
  };
}

export function createCahRoomManager({ cahNs }) {
  const rooms = new Map();
  const socketToCode = new Map();
  const userToCode = new Map();
  const userToSocketIds = new Map();

  function bumpStateVersion(room) {
    room.stateVersion = Number(room.stateVersion || 0) + 1;
    room.updatedAt = Date.now();
  }

  function trackUserSocket(userId, socketId) {
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

    const room = createCahRoom(socket.data.userId, socket.data.username, normalizeSettings(settings));
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
    const existing = room.players.find((p) => p.userId === socket.data.userId);
    if (!existing && room.game && room.game.status !== 'finished' && room.game.status !== 'lobby') {
      throw Object.assign(new Error('Game already in progress'), { code: 'ROOM_LOCKED' });
    }
    await leaveRoom(socket, { hardLeave: false });
    if (existing) {
      existing.connected = true;
      existing.username = socket.data.username;
    } else {
      room.players.push({
        userId: socket.data.userId,
        username: socket.data.username,
        ready: false,
        connected: true,
        score: 0,
      });
    }
    room.socketIds.add(socket.id);
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
      if (hardLeave) {
        const otherSockets = [...room.socketIds].some(
          (sid) => cahNs.sockets.get(sid)?.data?.userId === socket.data.userId,
        );
        if (!otherSockets) {
          room.players = room.players.filter((p) => p.userId !== socket.data.userId);
          userToCode.delete(socket.data.userId);
        } else {
          player.connected = true;
        }
      } else {
        player.connected = false;
      }
      if (room.hostId === socket.data.userId && room.players.length) {
        const connectedHost = room.players.find((p) => p.connected !== false);
        room.hostId = connectedHost?.userId ?? room.players[0].userId;
      }
      await reconcileRoomAfterMembershipChange(room);
      bumpStateVersion(room);
    }
    if (!room.players.length) rooms.delete(code);
  }

  async function attachActiveRoomForUser(socket) {
    const code = userToCode.get(socket.data.userId);
    if (!code) return null;
    const room = rooms.get(code);
    if (!room) return null;
    room.socketIds.add(socket.id);
    socketToCode.set(socket.id, code);
    socket.join(code);
    trackUserSocket(socket.data.userId, socket.id);
    const player = room.players.find((p) => p.userId === socket.data.userId);
    if (player) player.connected = true;
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

  function updateSettings(socket, settings) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) throw Object.assign(new Error('Only host can update settings'), { code: 'NOT_HOST' });
    if (room.game && room.game.status !== 'lobby') throw Object.assign(new Error('Cannot update settings after start'), { code: 'GAME_ALREADY_STARTED' });
    room.settings = { ...room.settings, ...normalizeSettings(settings) };
    bumpStateVersion(room);
    return room;
  }

  async function startRoomGame(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) throw Object.assign(new Error('Only host can start'), { code: 'NOT_HOST' });
    await startGame(room);
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

  function judgePick(socket, submissionId) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    judgePickWinner(room, socket.data.userId, submissionId);
    bumpStateVersion(room);
    return room;
  }

  async function advanceRound(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) throw Object.assign(new Error('Only host can advance round'), { code: 'NOT_HOST' });
    await nextRound(room);
    bumpStateVersion(room);
    return room;
  }

  function snapshotForSocket(socket) {
    const room = getRoomForSocket(socket);
    if (!room) return null;
    return snapshotFor(room, socket.data.userId);
  }

  function shutdown() {
    rooms.clear();
    socketToCode.clear();
    userToCode.clear();
    userToSocketIds.clear();
  }

  return {
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    updateSettings,
    startRoomGame,
    submitRoomCards,
    judgePick,
    advanceRound,
    snapshotForSocket,
    getRoomForSocket,
    attachActiveRoomForUser,
    reconcileRoomAfterMembership,
    emitRoom,
    shutdown,
  };
}
