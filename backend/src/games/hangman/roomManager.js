import { DEFAULT_HANGMAN_DATASET_VERSION } from '../../config/hangmanDefaults.js';
import { hangmanWordRepository } from '../../repositories/hangmanWordRepository.js';
import { persistHangmanGameResult, persistHangmanRoundResult } from '../../services/hangmanStatsService.js';
import {
  HANGMAN_LOBBY_COUNTDOWN_MS,
  HANGMAN_SETTER_PICK_TIMEOUT_MS,
  HANGMAN_WORD_MAX,
  HANGMAN_WORD_MIN,
} from './constants.js';
import { createDisconnectGraceRegistry } from '../../realtime/playerPresence.js';
import {
  markPlayerConnected,
  markPlayerGone,
} from '../../realtime/playerPresence.js';
import { evictSupersededPartySockets } from '../../realtime/partySocketEviction.js';
import { dedupeRoomPlayersInPlace } from '../../realtime/dedupeRoomPlayers.js';
import { avatarFromSocket, baseLobbyPlayer, mergeAvatarIntoPlayer } from '../../utils/lobbyPlayerAvatar.js';
import { registerRoomAccessor } from '../../realtime/roomInviteRegistry.js';
import { onRoomDestroyed, onRoomGameStarted } from '../../realtime/roomInviteLifecycle.js';
import {
  abortRoundSetterLeft,
  activePlayers,
  allPlayersReady,
  autoAssignSetterWord,
  createHangmanRoom,
  guessLetter,
  nextRound,
  playAgainSession,
  reconcileRoomAfterMembershipChange,
  returnSessionToLobby,
  setterSetPreview,
  setterSubmitWord,
  skipTurn,
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

function normalizeSettings(input = {}) {
  let minLen = Number(input.minWordLength ?? HANGMAN_WORD_MIN);
  let maxLen = Number(input.maxWordLength ?? HANGMAN_WORD_MAX);
  if (minLen > maxLen) [minLen, maxLen] = [maxLen, minLen];
  const dv = String(input.datasetVersion ?? '').trim();
  return {
    minWordLength: Math.min(HANGMAN_WORD_MAX, Math.max(HANGMAN_WORD_MIN, Number.isFinite(minLen) ? minLen : HANGMAN_WORD_MIN)),
    maxWordLength: Math.min(HANGMAN_WORD_MAX, Math.max(HANGMAN_WORD_MIN, Number.isFinite(maxLen) ? maxLen : HANGMAN_WORD_MAX)),
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
  const now = new Date();
  for (const p of activePlayers(room)) {
    const metrics = game.playerMetrics?.[p.userId] ?? { correctLetters: 0, wrongGuesses: 0, lettersFirst: 0 };
    const totalGuesses = (metrics.correctLetters ?? 0) + (metrics.wrongGuesses ?? 0);
    void persistHangmanGameResult(
      {
        userId: p.userId,
        username: p.username,
        mode: 'multi',
        source: 'multiplayer_server',
        won: p.userId === winId,
        wrongGuesses: metrics.wrongGuesses ?? 0,
        correctGuesses: metrics.correctLetters ?? 0,
        lettersFirst: metrics.lettersFirst ?? 0,
        totalGuesses,
        roundsPlayed: Number(game.roundNumber ?? 0),
        fastFinish: game.lastOutcome === 'won' && (game.wrongGuessCount ?? 0) <= Math.floor((game.maxWrongGuesses ?? 1) * 0.3),
        durationMs: null,
        gameSessionId: String(game.sessionId ?? ''),
        playerCount: activePlayers(room).length,
        placement: p.userId === winId ? 1 : null,
        score: Number(game.scores?.[p.userId] ?? 0),
        modeWeight: 1,
        finishedAt: now,
        roomCode: room.code,
      },
      log,
    );
  }
}

function persistCurrentRound(room, log) {
  const game = room.game;
  if (!game || game.phase !== 'round_end') return;
  const setterId = game.setterOrder?.[game.setterCursor];
  if (!setterId) return;
  const winner = Object.entries(game.lettersFirstThisRound ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0] ?? null;
  const setter = room.players.find((p) => p.userId === setterId) ?? null;
  const winnerPlayer = winner ? room.players.find((p) => p.userId === winner[0]) ?? null : null;
  void persistHangmanRoundResult(
    {
      gameSessionId: String(game.sessionId ?? ''),
      roundNumber: Number(game.roundNumber ?? 0),
      roomCode: room.code,
      setterUserId: setterId,
      setterUsername: setter?.username ?? '',
      winnerUserId: winnerPlayer?.userId ?? null,
      winnerUsername: winnerPlayer?.username ?? '',
      outcome: game.lastOutcome ?? 'aborted',
      wrongGuesses: Number(game.wrongGuessCount ?? 0),
      maxWrongGuesses: Number(game.maxWrongGuesses ?? 0),
      distinctCorrectLetters: Number(game.guessedLetters?.length ?? 0),
      participantCount: activePlayers(room).length,
      lettersFirstByUser: game.lettersFirstThisRound ?? {},
      finishedAt: new Date(),
    },
    log,
  );
}

export function createHangmanRoomManager({ hangmanNs, logger }) {
  const log = logger;
  const rooms = new Map();
  const socketToCode = new Map();
  const userToCode = new Map();
  const userToSocketIds = new Map();
  const disconnectGrace = createDisconnectGraceRegistry();
  /** @type {Map<string, { countdownTimeout?: NodeJS.Timeout, countdownInterval?: NodeJS.Timeout, turnTimeout?: NodeJS.Timeout, setterPickTimeout?: NodeJS.Timeout }>} */
  const roomTimers = new Map();

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

  function clearCountdownTimers(code) {
    const t = roomTimers.get(code);
    if (!t) return;
    if (t.countdownTimeout) clearTimeout(t.countdownTimeout);
    if (t.countdownInterval) clearInterval(t.countdownInterval);
    roomTimers.set(code, { ...t, countdownTimeout: undefined, countdownInterval: undefined });
    const next = roomTimers.get(code);
    if (
      next &&
      !next.countdownTimeout &&
      !next.countdownInterval &&
      !next.turnTimeout &&
      !next.setterPickTimeout
    ) {
      roomTimers.delete(code);
    }
  }

  function clearTurnTimer(code) {
    const t = roomTimers.get(code);
    if (!t?.turnTimeout) return;
    clearTimeout(t.turnTimeout);
    roomTimers.set(code, { ...t, turnTimeout: undefined });
    const next = roomTimers.get(code);
    if (
      next &&
      !next.countdownTimeout &&
      !next.countdownInterval &&
      !next.turnTimeout &&
      !next.setterPickTimeout
    ) {
      roomTimers.delete(code);
    }
  }

  function clearSetterPickTimer(code) {
    const t = roomTimers.get(code);
    if (!t?.setterPickTimeout) return;
    clearTimeout(t.setterPickTimeout);
    roomTimers.set(code, { ...t, setterPickTimeout: undefined });
    const next = roomTimers.get(code);
    if (
      next &&
      !next.countdownTimeout &&
      !next.countdownInterval &&
      !next.turnTimeout &&
      !next.setterPickTimeout
    ) {
      roomTimers.delete(code);
    }
  }

  function clearRoomTimers(code) {
    const t = roomTimers.get(code);
    if (!t) return;
    if (t.countdownTimeout) clearTimeout(t.countdownTimeout);
    if (t.countdownInterval) clearInterval(t.countdownInterval);
    if (t.turnTimeout) clearTimeout(t.turnTimeout);
    if (t.setterPickTimeout) clearTimeout(t.setterPickTimeout);
    roomTimers.delete(code);
  }

  function scheduleSetterPickTimeout(room) {
    const game = room.game;
    if (!game || game.phase !== 'setter_pick') {
      clearSetterPickTimer(room.code);
      return;
    }

    clearSetterPickTimer(room.code);
    const code = room.code;
    const setterPickTimeout = setTimeout(() => {
      void (async () => {
        const r = rooms.get(code);
        if (!r?.game || r.game.phase !== 'setter_pick') return;
        const ok = await autoAssignSetterWord(r);
        if (!ok) return;
        bumpStateVersion(r);
        emitRoom(code, 'setter_timeout');
        syncLobbyOrTurnTimers(r);
      })();
    }, HANGMAN_SETTER_PICK_TIMEOUT_MS);
    const prev = roomTimers.get(code) ?? {};
    roomTimers.set(code, { ...prev, setterPickTimeout });
  }

  function cancelLobbyCountdown(room, emit = true) {
    if (!room?.lobby?.countdownEndsAt) return;
    room.lobby.countdownEndsAt = null;
    clearCountdownTimers(room.code);
    bumpStateVersion(room);
    if (emit) emitRoom(room.code, 'countdown_cancelled');
  }

  function scheduleLobbyCountdown(room) {
    if (room.game) return;
    if (!allPlayersReady(room)) {
      cancelLobbyCountdown(room);
      return;
    }
    if (room.lobby?.countdownEndsAt) return;

    room.lobby = room.lobby ?? { countdownEndsAt: null };
    room.lobby.countdownEndsAt = Date.now() + HANGMAN_LOBBY_COUNTDOWN_MS;
    bumpStateVersion(room);
    emitRoom(room.code, 'countdown_started');

    const countdownInterval = setInterval(() => {
      const r = rooms.get(room.code);
      if (!r?.lobby?.countdownEndsAt || Date.now() >= r.lobby.countdownEndsAt) {
        clearInterval(countdownInterval);
        return;
      }
      bumpStateVersion(r);
      emitRoom(room.code, 'countdown_tick');
    }, 1000);

    const countdownTimeout = setTimeout(() => {
      clearInterval(countdownInterval);
      clearCountdownTimers(room.code);
      const r = rooms.get(room.code);
      if (!r) return;

      if (!allPlayersReady(r)) {
        r.lobby = { countdownEndsAt: null };
        bumpStateVersion(r);
        emitRoom(room.code, 'countdown_cancelled');
        return;
      }

      r.lobby = { countdownEndsAt: null };
      try {
        startGame(r);
        bumpStateVersion(r);
        onRoomGameStarted('hangman', room.code);
        emitRoom(room.code, 'game_started');
        syncLobbyOrTurnTimers(r);
      } catch (err) {
        log.warn({ err, code: room.code }, 'hangman_countdown_start_failed');
        bumpStateVersion(r);
        emitRoom(room.code, 'countdown_cancelled');
      }
    }, HANGMAN_LOBBY_COUNTDOWN_MS);

    countdownTimeout.unref?.();
    countdownInterval.unref?.();
    const prev = roomTimers.get(room.code) ?? {};
    roomTimers.set(room.code, { ...prev, countdownTimeout, countdownInterval });
  }

  function scheduleTurnTimeout(room) {
    const game = room.game;
    if (!game || game.phase !== 'guessing' || !game.turnEndsAt) {
      clearTurnTimer(room.code);
      return;
    }

    clearTurnTimer(room.code);
    const delay = Math.max(0, game.turnEndsAt - Date.now());
    const turnTimeout = setTimeout(() => {
      const r = rooms.get(room.code);
      if (!r?.game || r.game.phase !== 'guessing') return;
      if (r.game.turnEndsAt && Date.now() < r.game.turnEndsAt - 50) {
        scheduleTurnTimeout(r);
        return;
      }
      if (skipTurn(r)) {
        bumpStateVersion(r);
        emitRoom(room.code, 'turn_skipped');
        scheduleTurnTimeout(r);
      }
    }, delay);
    turnTimeout.unref?.();
    const prev = roomTimers.get(room.code) ?? {};
    roomTimers.set(room.code, { ...prev, turnTimeout });
  }

  function syncLobbyOrTurnTimers(room) {
    if (!room.game) {
      scheduleLobbyCountdown(room);
      clearSetterPickTimer(room.code);
    } else if (room.game.phase === 'setter_pick') {
      clearTurnTimer(room.code);
      scheduleSetterPickTimeout(room);
    } else if (room.game.phase === 'guessing') {
      clearSetterPickTimer(room.code);
      scheduleTurnTimeout(room);
    } else {
      clearTurnTimer(room.code);
      clearSetterPickTimer(room.code);
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

    const room = createHangmanRoom(socket.data.userId, socket.data.username, normalizeSettings(settings ?? {}));
    mergeAvatarIntoPlayer(room.players[0], avatarFromSocket(socket));
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

    const alreadyMember = room.players.some((p) => p.userId === socket.data.userId);
    if (!alreadyMember && room.game && room.game.phase !== 'game_end') {
      throw Object.assign(new Error('Game already in progress'), { code: 'ROOM_LOCKED' });
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
        extra: { ready: false },
      });
      markPlayerConnected(newbie);
      room.players.push(newbie);
    }
    dedupeRoomPlayersInPlace(room);
    room.socketIds.add(socket.id);
    evictSupersededPartySockets(hangmanNs, {
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
    reconcileRoomAfterMembershipChange(room);
    if (!existing && room.lobby?.countdownEndsAt) {
      cancelLobbyCountdown(room);
    }
    bumpStateVersion(room);
    syncLobbyOrTurnTimers(room);
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
        disconnectGrace.clearGrace(userId);
        const otherSockets = hasAnyConnectedSocketInRoom(room, userId);
        if (!otherSockets) {
          room.players = room.players.filter((p) => p.userId !== userId);
          userToCode.delete(userId);
        } else {
          markPlayerConnected(player);
        }
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
            if (pendingRoom.hostId === userId && pendingRoom.players.length) {
              const connectedHost = pendingRoom.players.find((p) => p.presenceStatus === 'connected');
              pendingRoom.hostId = connectedHost?.userId ?? pendingRoom.players[0].userId;
            }
            reconcileRoomAfterMembershipChange(pendingRoom);
            bumpStateVersion(pendingRoom);
            emitRoom(code, 'member_disconnected');
            syncLobbyOrTurnTimers(pendingRoom);
            if (!pendingRoom.players.length) {
              clearRoomTimers(code);
              rooms.delete(code);
              onRoomDestroyed('hangman', code);
            }
          });
          bumpStateVersion(room);
          emitRoom(code, 'player_disconnect_pending');
          return;
        }
      }
      if (room.hostId === userId && room.players.length) {
        const connectedHost = room.players.find((p) => p.presenceStatus === 'connected');
        room.hostId = connectedHost?.userId ?? room.players[0].userId;
      }
      reconcileRoomAfterMembershipChange(room);
      bumpStateVersion(room);
      syncLobbyOrTurnTimers(room);
    }
    if (!room.players.length) {
      clearRoomTimers(code);
      rooms.delete(code);
      onRoomDestroyed('hangman', code);
    }
  }

  async function attachActiveRoomForUser(socket) {
    const code = userToCode.get(socket.data.userId);
    if (!code) return null;
    const room = rooms.get(code);
    if (!room) return null;
    evictSupersededPartySockets(hangmanNs, {
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
    reconcileRoomAfterMembershipChange(room);
    bumpStateVersion(room);
    syncLobbyOrTurnTimers(room);
    return room;
  }

  function setReady(socket, ready) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    const me = room.players.find((p) => p.userId === socket.data.userId);
    if (!me) throw Object.assign(new Error('Player not found'), { code: 'PLAYER_NOT_FOUND' });
    if (room.game) {
      throw Object.assign(new Error('Cannot change ready after start'), { code: 'GAME_ALREADY_STARTED' });
    }
    me.ready = Boolean(ready);
    bumpStateVersion(room);
    syncLobbyOrTurnTimers(room);
    return room;
  }

  function submitSetterWord(socket, word) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    setterSubmitWord(room, socket.data.userId, word);
    bumpStateVersion(room);
    syncLobbyOrTurnTimers(room);
    return room;
  }

  async function randomizePreview(socket, opts = {}) {
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
    setterSetPreview(room, socket.data.userId, picked.word);
    bumpStateVersion(room);
    return room;
  }

  function submitGuess(socket, letter) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    guessLetter(room, socket.data.userId, letter);
    bumpStateVersion(room);
    if (room.game?.phase === 'guessing') {
      scheduleTurnTimeout(room);
    } else {
      const prev = roomTimers.get(room.code);
      if (prev?.turnTimeout) clearTimeout(prev.turnTimeout);
    }
    return room;
  }

  async function advanceRound(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    persistCurrentRound(room, log);
    nextRound(room, socket.data.userId);
    bumpStateVersion(room);
    syncLobbyOrTurnTimers(room);
    persistMultiGameEnd(room, log);
    return room;
  }

  function returnToLobby(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) {
      throw Object.assign(new Error('Only host can return to lobby'), { code: 'NOT_HOST' });
    }
    returnSessionToLobby(room);
    clearRoomTimers(room.code);
    bumpStateVersion(room);
    syncLobbyOrTurnTimers(room);
    return room;
  }

  function playAgain(socket) {
    const room = getRoomForSocket(socket);
    if (!room) throw Object.assign(new Error('Not in room'), { code: 'NOT_IN_ROOM' });
    if (room.hostId !== socket.data.userId) {
      throw Object.assign(new Error('Only host can start a new session'), { code: 'NOT_HOST' });
    }
    playAgainSession(room);
    clearRoomTimers(room.code);
    bumpStateVersion(room);
    syncLobbyOrTurnTimers(room);
    return room;
  }

  function snapshotForSocket(socket) {
    const room = getRoomForSocket(socket);
    if (!room) return null;
    return snapshotFor(room, socket.data.userId);
  }

  function shutdown() {
    for (const code of roomTimers.keys()) clearRoomTimers(code);
    for (const userId of userToCode.keys()) disconnectGrace.clearGrace(userId);
    rooms.clear();
    socketToCode.clear();
    userToCode.clear();
    userToSocketIds.clear();
  }

  registerRoomAccessor('hangman', {
    getInviteContext(rawCode) {
      const code = normalizeCode(rawCode);
      const room = rooms.get(code);
      if (!room) {
        return { exists: false, hostId: null, playerUserIds: [], joinable: false };
      }
      const joinable =
        (!room.game || room.game.phase === 'game_end') && !room.lobby?.countdownEndsAt;
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
    submitSetterWord,
    randomizePreview,
    submitGuess,
    advanceRound,
    returnToLobby,
    playAgain,
    snapshotForSocket,
    getRoomForSocket,
    attachActiveRoomForUser,
    emitRoom,
    shutdown,
  };
}
