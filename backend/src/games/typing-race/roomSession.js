import {
  PLAYER_COLORS,
  TYPING_RACE_COUNTDOWN_MS,
  TYPING_RACE_DISCONNECT_GRACE_MS,
  TYPING_RACE_MAX_PLAYERS,
  TYPING_RACE_MAX_WALL_MS,
  TYPING_RACE_MIN_PLAYERS,
} from "./constants.js";
import { generateRacePassage } from "./text-gen.js";

/**
 * @typedef {'lobby'|'countdown'|'racing'|'finished'} TypingPhase
 */

/**
 * @typedef {{
 *   userId: string;
 *   displayName: string;
 *   socketId: string | null;
 *   colorIndex: number;
 *   ready: boolean;
 *   connected: boolean;
 *   joinedAt: number;
 *   cursorDisplay: number;
 *   cursor: number;
 *   errorLen: number;
 *   wpm: number;
 *   lastProgressAt: number;
 *   finishedAtMs: number | null;
 *   rank: number | null;
 *   disconnectedAtMs: number | null;
 * }} PlayerState
 */

export class TypingRaceRoom {
  /**
   * @param {{
   *   roomCode: string;
   *   typingNs: import('socket.io').Namespace;
   *   logger: import('pino').Logger;
   * }} params
   */
  constructor({ roomCode, typingNs, logger }) {
    this.roomCode = roomCode;
    this.typingNs = typingNs;
    this.logger = logger;
    /** @type {TypingPhase} */
    this.phase = "lobby";
    this.hostUserId = /** @type {string | null} */ (null);
    /** @type {Map<string, PlayerState>} */
    this.players = new Map();
    this.raceConfig = /** @type {null | { passage: string; seed: number; version: number }} */ (
      null
    );
    this.countdownEndsAtMs = /** @type {number | null} */ (null);
    this.raceStartAtMs = /** @type {number | null} */ (null);
    this.raceWallEndAtMs = /** @type {number | null} */ (null);
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._countdownTimer = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    this._raceTick = null;
    this._version = 1;
  }

  serverNow() {
    return Date.now();
  }

  /**
   * @param {string} event
   * @param {unknown} payload
   */
  emit(event, payload) {
    this.typingNs.to(this.roomCode).emit(event, payload);
  }

  emitRoom() {
    this.emit("typing_room_updated", { room: this.toPublicSnapshot() });
  }

  /**
   * @param {string} userId
   * @param {string} displayName
   * @param {import('socket.io').Socket} socket
   */
  bindPlayerSocket(userId, displayName, socket) {
    socket.join(this.roomCode);
    const p = this.players.get(userId);
    if (p) {
      p.socketId = socket.id;
      p.connected = true;
      p.displayName = displayName;
    }
  }

  destroy() {
    this._clearTimers();
  }

  /**
   * @param {string} userId
   * @param {string} displayName
   * @param {import('socket.io').Socket} socket
   * @returns {string | null} replacedSocketId if same user reconnected from a new tab
   */
  addPlayer(userId, displayName, socket) {
    const existing = this.players.get(userId);
    if (this.phase !== "lobby" && !existing) {
      const err = new Error("Race already in progress");
      /** @type {any} */ (err).code = "ROOM_LOCKED";
      throw err;
    }
    if (existing) {
      const prevSid = existing.socketId;
      existing.socketId = socket.id;
      existing.connected = true;
      existing.disconnectedAtMs = null;
      existing.displayName = displayName;
      this.bindPlayerSocket(userId, displayName, socket);
      return prevSid && prevSid !== socket.id ? prevSid : null;
    }
    if (this.players.size >= TYPING_RACE_MAX_PLAYERS) {
      const err = new Error("Room is full");
      /** @type {any} */ (err).code = "ROOM_FULL";
      throw err;
    }
    const idx = this.players.size;
    /** @type {PlayerState} */
    const player = {
      userId,
      displayName,
      socketId: socket.id,
      colorIndex: idx % PLAYER_COLORS.length,
      ready: false,
      connected: true,
      joinedAt: Date.now(),
      cursorDisplay: 0,
      cursor: 0,
      errorLen: 0,
      wpm: 0,
      lastProgressAt: Date.now(),
      finishedAtMs: null,
      rank: null,
      disconnectedAtMs: null,
    };
    this.players.set(userId, player);
    if (!this.hostUserId) {
      this.hostUserId = userId;
    }
    this.bindPlayerSocket(userId, displayName, socket);
    return null;
  }

  /**
   * @param {import('socket.io').Socket} socket
   * @param {{ hardLeave?: boolean }} [opts] - `hardLeave: true` (default) = user left, switched room, or host kicked — remove a lobby player from the room. `false` = TCP/transport disconnect only: keep the lobby row so a quick reconnect (e.g. Next.js navigation) can reattach without `ROOM_NOT_FOUND`.
   */
  removeSocket(socket, opts = {}) {
    const hardLeave = opts.hardLeave !== false;
    for (const [uid, p] of this.players) {
      if (p.socketId !== socket.id) {
        continue;
      }
      p.socketId = null;
      p.connected = false;
      if (this.phase === "racing") {
        p.disconnectedAtMs = Date.now();
      }
      if (this.phase === "lobby" && hardLeave) {
        const wasHost = uid === this.hostUserId;
        this.players.delete(uid);
        if (wasHost) {
          this.hostUserId = this.players.keys().next().value ?? null;
        }
      } else if (this.phase !== "lobby" && this.hostUserId === uid) {
        this._migrateHost();
      }
      break;
    }
    if (this.players.size === 0) {
      this._clearTimers();
    }
  }

  _migrateHost() {
    const ordered = [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt);
    const next = ordered.find((p) => p.connected && p.userId !== this.hostUserId);
    if (next) {
      this.hostUserId = next.userId;
    } else {
      const any = ordered.find((p) => p.connected);
      this.hostUserId = any ? any.userId : this.hostUserId;
    }
  }

  _clearTimers() {
    if (this._countdownTimer) {
      clearTimeout(this._countdownTimer);
      this._countdownTimer = null;
    }
    if (this._raceTick) {
      clearInterval(this._raceTick);
      this._raceTick = null;
    }
  }

  /**
   * @param {string} userId
   */
  kickUser(userId) {
    this.players.delete(userId);
    if (this.hostUserId === userId) {
      this.hostUserId = [...this.players.keys()][0] ?? null;
    }
  }

  /**
   * @param {string} userId
   * @param {boolean} ready
   */
  setReady(userId, ready) {
    const p = this.players.get(userId);
    if (!p || this.phase !== "lobby") {
      return;
    }
    p.ready = ready;
  }

  /**
   * @param {string} userId
   */
  startCountdown(userId) {
    if (userId !== this.hostUserId) {
      const err = new Error("Only the host can start");
      /** @type {any} */ (err).code = "FORBIDDEN";
      throw err;
    }
    if (this.phase !== "lobby") {
      const err = new Error("Invalid phase");
      /** @type {any} */ (err).code = "BAD_PHASE";
      throw err;
    }
    if (this.players.size < TYPING_RACE_MIN_PLAYERS) {
      const err = new Error("Need at least two players");
      /** @type {any} */ (err).code = "NOT_ENOUGH_PLAYERS";
      throw err;
    }
    for (const p of this.players.values()) {
      if (!p.ready) {
        const err = new Error("All players must be ready");
        /** @type {any} */ (err).code = "NOT_ALL_READY";
        throw err;
      }
    }

    const seed = (Math.random() * 2 ** 31) >>> 0;
    const passage = generateRacePassage(seed);
    this.raceConfig = { passage, seed, version: this._version };
    this.phase = "countdown";
    const now = Date.now();
    this.countdownEndsAtMs = now + TYPING_RACE_COUNTDOWN_MS;
    this.raceStartAtMs = this.countdownEndsAtMs;

    this.emit("typing_countdown_started", { room: this.toPublicSnapshot() });

    this._clearTimers();
    this._countdownTimer = setTimeout(() => this._beginRace(), TYPING_RACE_COUNTDOWN_MS);
  }

  _beginRace() {
    this._countdownTimer = null;
    if (this.phase !== "countdown") {
      return;
    }
    this.phase = "racing";
    const now = Date.now();
    this.raceStartAtMs = now;
    this.raceWallEndAtMs = now + TYPING_RACE_MAX_WALL_MS;
    for (const p of this.players.values()) {
      p.cursorDisplay = 0;
      p.cursor = 0;
      p.errorLen = 0;
      p.wpm = 0;
      p.finishedAtMs = null;
      p.rank = null;
      p.lastProgressAt = now;
      if (!p.connected) {
        p.disconnectedAtMs = now;
      } else {
        p.disconnectedAtMs = null;
      }
    }
    this.emit("typing_race_started", { room: this.toPublicSnapshot() });

    this._raceTick = setInterval(() => this._tickRace(), 500);
  }

  _tickRace() {
    if (this.phase !== "racing") {
      return;
    }
    const now = Date.now();
    if (this.raceWallEndAtMs != null && now >= this.raceWallEndAtMs) {
      this._finishRace("timeout");
      return;
    }
    for (const p of this.players.values()) {
      if (p.finishedAtMs != null) {
        continue;
      }
      if (
        !p.connected &&
        p.disconnectedAtMs != null &&
        now - p.disconnectedAtMs >= TYPING_RACE_DISCONNECT_GRACE_MS
      ) {
        this._dnfPlayer(p, now);
      }
    }
    let allDone = true;
    for (const p of this.players.values()) {
      if (p.finishedAtMs == null) {
        allDone = false;
        break;
      }
    }
    if (allDone && this.players.size > 0) {
      this._finishRace("all_finished");
    }
  }

  /**
   * Disconnected too long during race — counts as finished for room completion.
   * @param {PlayerState} p
   * @param {number} now
   */
  _dnfPlayer(p, now) {
    if (p.finishedAtMs != null) {
      return;
    }
    p.finishedAtMs = now;
    this.logger.info(
      { event: "typing_race_dnf", roomCode: this.roomCode, userId: p.userId },
      "typing_race",
    );
    this.emit("typing_player_finished", {
      room: this.toPublicSnapshot(),
      userId: p.userId,
      rank: null,
      dnf: true,
    });
  }

  /**
   * @param {string} reason
   */
  _finishRace(reason) {
    if (this.phase !== "racing") {
      return;
    }
    this.phase = "finished";
    this._clearTimers();
    this.logger.info(
      { event: "typing_race_finished", roomCode: this.roomCode, reason },
      "typing_race",
    );
    this.emit("typing_race_finished", { room: this.toPublicSnapshot(), reason });
  }

  /**
   * @param {string} userId
   * @param {{ cursorDisplay: number; cursor: number; errorLen?: number; wpm?: number }} data
   */
  applyProgress(userId, data) {
    if (this.phase !== "racing") {
      return null;
    }
    const p = this.players.get(userId);
    if (!p || p.finishedAtMs != null) {
      return null;
    }
    const passageLen = this.raceConfig?.passage?.length ?? 0;
    const now = Date.now();
    let cd = Math.floor(Number(data.cursorDisplay) || 0);
    const cur = Math.floor(Number(data.cursor) || 0);
    const errLen = Math.floor(Number(data.errorLen) || 0);
    const wpm = Number(data.wpm) || 0;

    if (cd < p.cursorDisplay) {
      cd = p.cursorDisplay;
    }
    const dt = Math.max(1, now - p.lastProgressAt);
    const maxJump = Math.max(8, (dt / 1000) * 50);
    if (cd - p.cursorDisplay > maxJump) {
      cd = p.cursorDisplay + Math.floor(maxJump);
    }
    const cap = passageLen + 8;
    cd = Math.min(cd, cap);

    p.cursorDisplay = cd;
    p.cursor = Math.min(cur, passageLen + 4);
    p.errorLen = errLen;
    p.wpm = Math.min(wpm, 400);
    p.lastProgressAt = now;

    const snap = this.toPublicSnapshot();
    this.emit("typing_peer_progress", {
      roomCode: this.roomCode,
      userId,
      cursorDisplay: p.cursorDisplay,
      wpm: p.wpm,
      progress01: passageLen ? Math.min(1, p.cursor / passageLen) : 0,
      serverTs: now,
    });
    return snap;
  }

  /**
   * @param {string} userId
   */
  finishPlayer(userId) {
    if (this.phase !== "racing") {
      const err = new Error("Not racing");
      /** @type {any} */ (err).code = "BAD_PHASE";
      throw err;
    }
    const p = this.players.get(userId);
    if (!p || p.finishedAtMs != null) {
      return this.toPublicSnapshot();
    }
    const passageLen = this.raceConfig?.passage?.length ?? 0;
    if (p.cursor < passageLen) {
      const err = new Error("Passage not complete");
      /** @type {any} */ (err).code = "NOT_DONE";
      throw err;
    }
    const now = Date.now();
    const finishedCount = [...this.players.values()].filter((x) => x.finishedAtMs != null)
      .length;
    p.finishedAtMs = now;
    p.rank = finishedCount + 1;
    this.emit("typing_player_finished", {
      room: this.toPublicSnapshot(),
      userId,
      rank: p.rank,
    });
    this._tickRace();
    return this.toPublicSnapshot();
  }

  /**
   * @param {string} userId
   */
  forceEnd(userId) {
    if (userId !== this.hostUserId) {
      const err = new Error("Only host can force end");
      /** @type {any} */ (err).code = "FORBIDDEN";
      throw err;
    }
    if (this.phase === "racing") {
      this._finishRace("host_force");
    }
  }

  toPublicSnapshot() {
    const passageLen = this.raceConfig?.passage?.length ?? 0;
    const players = [...this.players.values()].map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      colorIndex: p.colorIndex,
      color: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length],
      ready: p.ready,
      connected: p.connected,
      cursorDisplay: p.cursorDisplay,
      cursor: p.cursor,
      errorLen: p.errorLen,
      wpm: p.wpm,
      progress01: passageLen ? Math.min(1, p.cursor / passageLen) : 0,
      rank: p.rank,
      finishedAtMs: p.finishedAtMs,
    }));
    return {
      roomCode: this.roomCode,
      phase: this.phase,
      hostUserId: this.hostUserId,
      serverNow: this.serverNow(),
      countdownEndsAtMs: this.countdownEndsAtMs,
      raceStartAtMs: this.raceStartAtMs,
      raceWallEndAtMs: this.raceWallEndAtMs,
      raceConfig: this.raceConfig,
      players,
    };
  }

  /**
   * Host resets lobby for replay (same room).
   * @param {string} userId
   */
  resetLobby(userId) {
    if (userId !== this.hostUserId) {
      const err = new Error("Only host can reset");
      /** @type {any} */ (err).code = "FORBIDDEN";
      throw err;
    }
    this._clearTimers();
    this.phase = "lobby";
    this.raceConfig = null;
    this.countdownEndsAtMs = null;
    this.raceStartAtMs = null;
    this.raceWallEndAtMs = null;
    this._version += 1;
    for (const p of this.players.values()) {
      p.ready = false;
      p.cursorDisplay = 0;
      p.cursor = 0;
      p.errorLen = 0;
      p.wpm = 0;
      p.finishedAtMs = null;
      p.rank = null;
      p.disconnectedAtMs = null;
    }
    this.emitRoom();
  }
}
