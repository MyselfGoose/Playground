import { DEFAULT_HANGMAN_DATASET_VERSION } from '../../config/hangmanDefaults.js';
import { hangmanWordRepository } from '../../repositories/hangmanWordRepository.js';
import { persistHangmanGameResult } from '../../services/hangmanStatsService.js';
import {
  abortRoundSetterLeft,
  activePlayers,
  createHangmanRoom,
  guessLetter,
  nextRound,
  reconcileRoomAfterMembershipChange,
  setterApplyServerWord,
  setterSubmitWord,
  snapshotFor,
  startGame,
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

function normalizeSettings(room, input = {}) {
  const maxWrong = Number(input.maxWrongGuesses ?? room.settings.maxWrongGuesses);
  let minLen = Number(input.minWordLength ?? room.settings.minWordLength);
  let maxLen = Number(input.maxWordLength ?? room.settings.maxWordLength);
  if (minLen > maxLen) [minLen, maxLen] = [maxLen, minLen];
  const dv = String(input.datasetVersion ?? room.settings.datasetVersion ?? '').trim();
  return {
    maxWrongGuesses: Math.min(12, Math.max(4, Number.isFinite(maxWrong) ? maxWrong : room.settings.maxWrongGuesses)),
    minWordLength: Math.min(24, Math.max(4, Number.isFinite(minLen) ? minLen : room.settings.minWordLength)),
    maxWordLength: Math.min(24, Math.max(4, Number.isFinite(maxLen) ? maxLen : room.settings.maxWordLength)),
    datasetVersion: dv || DEFAULT_HANGMAN_DATASET_VERSION,
  };
}

function winnerUserId(game) {
  if (!game?.setterOrder?.length) return null;
  let best = null;
  let bestScore = -Infinity;
  for (const uid of game.setterOrder) {
    const s = game.scores[uid] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = uid;
    }
  }
  return best;
}

function persistMultiGameEnd(room, log) {
  const game = room.game;
  if (!game || game.phase !== 'game_end') return;
  const winId = winnerUserId(game);
  for (const p of activePlayers(room)) {
    void persistHangmanGameResult(
      {
        userId: p.userId,
        username: p.username,
        mode: 'multi',
        won: p.userId === winId,
        wrongGuesses: 0,
        correctGuesses: 0,
        lettersFirst: 0,
        durationMs: null,
        finishedAt: new Date(),
        roomCode: room.code,
      },
      log,
    );
  }
}

export function createHangmanRoomManager({ hangmanNs, logger }) {
  const log = logger;
  const rooms = new Map();
  const socketToCode = new Map();
  const userToCode = new Map();
  const userToSocketIds = new Map();
  const softDisconnectTimers = new Map();
  const SOFT_DISCONNECT_GRACE_MS = 7000;

  function bumpStateVersion(room) {
    room.stateVersion = Number(room.stateVersion || 0) + 1;
    room.updatedAt = Date.now();
  }

  function trackUserSocket(userId, socketId) {
    clearSoftDisconnect(userId);
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

  function clearSoftDisconnect(userId) {
    const timer = softDisconnectTimers.get(userId);
    if (!timer) return;
    clearTimeout(timer);
    softDisconnectTimers.delete(userId);
  }

  function hasAnyConnectedSocketInRoom(room, userId) {
    return [...room.socketIds].some((sid) => hangmanNs.sockets.get(sid)?.data?.userId === userId);
  }

  function getRoomForSocket(socket) {
    const code = socketToCode.get(socket.id);
    return code ? rooms.get(code) ?? null : null;
  }

  function emitRoom(code, reason = 'room_update') {
    const room = rooms.get(code);
    if (!room) return;
    for (const socketId of room.socketIds) {
      const socket = hangmanNs.sockets.get(socketId);
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

    const room = createHangmanRoom(socket.data.userId, socket.data.username, settings ?? {});
    room.code = code;
    room.socketIds = new Set([socket.id]);
    rooms.set(code, room);
    socketToCode.set(socket.id, code);
    userToCode.set(socket.data.userId, code);
    trackUserSocket(socket.data.userId, socket.id);
    socket.join(code);
    bumpStateVersion(room);
    return room;
  }

  async function joinRoom(socket, rawCode) {
    const normalized = normalizeCode(rawCode);
    if (normalized.length !== 4) throw Object.assign(new Error('Invalid room code'), { code: 'VALIDATION_ERROR' });
    const room = rooms.get(normalized);
    if (!room) throw Object.assign(new Error('Room not found'), { code: 'ROOM_NOT_FOUND' });

    const existing = room.players.find((p) => p.userId === socket.data.userId);
    if (!existing && room.game && !['lobby', 'game_end'].includes(room.game.phase)) {
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
      });
    }
    room.socketIds.add(socket.id);
    socketToCode.set(socket.id, normalized);
    userToCode.set(socket.data.userId, normalized);
    trackUserSocket(socket.data.userId, socket.id);
    socket.join(normalized);
    reconcileRoomAfterMembershipChange(room);
    bumpStateVersion(room);
    return room;
  }

  async function leaveRoom(socket, { hardLeave }) {
    const code = socketToCode.get(socket.id);
    if (!code) return;
    const room = rooms.get(code);
    const userId = socket.data.userId;
    socketToCode.delete(socket.id);
    untrackUserSocket(userId, socket.id);
    socket.leave(code);
    if (!room) return;
    room.socketIds.delete(socket.id);
    const player = room.players.find((p) => p.userId === userId);
    if (player) {
      if (hardLeave) {
        clearSoftDisconnect(userId);
        const otherSockets = hasAnyConnectedSocketInRoom(room, userId);
        if (!otherSockets) {
          room.players = room.players.filter((p) => p.userId !== userId);
          userToCode.delete(userId);
        } else {
          player.connected = true;
        }
      } else {
        clearSoftDisconnect(userId);
        if (hasAnyConnectedSocketInRoom(room, userId)) {
          player.connected = true;
        } else {
          const timer = setTimeout(() => {
            softDisconnectTimers.delete(userId);
            const expectedCode = userToCode.get(userId);
            if (!expectedCode || expectedCode !== code) return;
            const pendingRoom = rooms.get(code);
            if (!pendingRoom) return;
            if (hasAnyConnectedSocketInRoom(pendingRoom, userId)) return;
            const pendingPlayer = pendingRoom.players.find((p) => p.userId === userId);
            if (!pendingPlayer) return;
            pendingPlayer.connected = false;
            if (pendingRoom.hostId === userId && pendingRoom.players.length) {
              const connectedHost = pendingRoom.players.find((p) => p.connected !== false);
              pendingRoom.hostId = connectedHost?.userId ?? pendingRoom.players[0].userId;
            }
            reconcileRoomAfterMembershipChange(pendingRoom);
            bumpStateVersion(pendingRoom);
            emitRoom(code, 'member_disconnected');
            if (!pendingRoom.players.length) rooms.delete(code);
          }, SOFT_DISCONNECT_GRACE_MS);
          timer.unref?.();
          softDisconnectTimers.set(userId, timer);
          return;
        }
      }
      if (room.hostId === userId && room.players.length) {
        const connectedHost = room.players.find((p) => p.connected !== false);
        room.hostId = connectedHost?.userId ?? room.players[0].userId;
      }
      reconcileRoomAfterMembershipChange(room);
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
    reconcileRoomAfterMembershipChange(room);
    bumpStateVersion(room);
    return room;
  }

  function setReady(socket, ready) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error('Player not found'), { code: 'PLAYER_NOT_FOUND' });
    if (room.game && room.game.phase !== 'lobby') {
      throw Object.assign(new Error('Cannot change ready after start'), { code: 'GAME_ALREADY_STARTED' });
    }
    me.ready = Boolean(ready);
    bumpStateVersion(room);
    return room;
  }

  function updateSettings(socket, data) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) throw Object.assign(new Error('Only host can update'), { code: 'NOT_HOST' });
    if (room.game) throw Object.assign(new Error('Cannot update during game'), { code: 'GAME_IN_PROGRESS' });
    room.settings = normalizeSettings(room, data);
    bumpStateVersion(room);
    return room;
  }

  async function startRoomGame(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) throw Object.assign(new Error('Only host can start'), { code: 'NOT_HOST' });
    startGame(room);
    bumpStateVersion(room);
    return room;
  }

  function submitSetterWord(socket, word) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    setterSubmitWord(room, socket.data.userId, word);
    bumpStateVersion(room);
    return room;
  }

  async function requestRandomWord(socket, opts = {}) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    const game = room.game;
    if (!game || game.phase !== 'setter_pick') {
      throw Object.assign(new Error('Cannot randomize word now'), { code: 'INVALID_PHASE' });
    }
    const difficulty =
      opts.difficulty != null && Number.isFinite(Number(opts.difficulty)) ? Number(opts.difficulty) : undefined;
    const picked = await hangmanWordRepository.randomWord({
      datasetVersion: game.datasetVersion ?? DEFAULT_HANGMAN_DATASET_VERSION,
      minLength: game.minWordLength,
      maxLength: game.maxWordLength,
      difficulty,
    });
    if (!picked?.word) {
      throw Object.assign(new Error('No words available — run import script'), { code: 'WORD_BANK_EMPTY' });
    }
    setterApplyServerWord(room, socket.data.userId, picked.word);
    bumpStateVersion(room);
    return room;
  }

  function submitGuess(socket, letter) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    guessLetter(room, socket.data.userId, letter);
    bumpStateVersion(room);
    return room;
  }

  async function advanceRound(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    nextRound(room, socket.data.userId);
    bumpStateVersion(room);
    persistMultiGameEnd(room, log);
    return room;
  }

  function snapshotForSocket(socket) {
    const room = getRoomForSocket(socket);
    if (!room) return null;
    return snapshotFor(room, socket.data.userId);
  }

  function shutdown() {
    for (const timer of softDisconnectTimers.values()) clearTimeout(timer);
    softDisconnectTimers.clear();
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
    submitSetterWord,
    requestRandomWord,
    submitGuess,
    advanceRound,
    snapshotForSocket,
    getRoomForSocket,
    attachActiveRoomForUser,
    emitRoom,
    shutdown,
  };
}
