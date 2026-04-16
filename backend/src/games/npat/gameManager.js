import mongoose from 'mongoose';
import { GAME_STATES, assertTransition } from './stateMachine.js';
import { DEFAULT_TEAMS, NPAT_FIELDS } from './constants.js';

/**
 * @typedef {{
 *   userId: string,
 *   username: string,
 *   teamId: string,
 *   ready: boolean,
 *   socketId: string | null,
 *   joinedAt: number,
 *   connected: boolean,
 * }} RuntimePlayer
 */

/**
 * @param {Map<string, Record<string, string>>} submissions
 * @param {string} userId
 */
function playerHasAllSolo(submissions, userId) {
  const row = submissions.get(userId);
  if (!row) return false;
  return NPAT_FIELDS.every((f) => Boolean(row[f]?.trim()));
}

/**
 * @param {Map<string, RuntimePlayer>} players
 * @param {Map<string, Record<string, string>>} submissions
 * @param {string} teamId
 * @param {string} field
 */
function teamHasField(players, submissions, teamId, field) {
  for (const [uid, p] of players) {
    if (p.teamId !== teamId) continue;
    const row = submissions.get(uid);
    if (row?.[field]?.trim()) return true;
  }
  return false;
}

/**
 * @param {Map<string, RuntimePlayer>} players
 * @param {Map<string, Record<string, string>>} submissions
 * @param {string} teamId
 */
function teamUnionComplete(players, submissions, teamId) {
  return NPAT_FIELDS.every((f) => teamHasField(players, submissions, teamId, f));
}

/**
 * @param {'solo' | 'team'} mode
 * @param {Map<string, RuntimePlayer>} players
 * @param {Map<string, Record<string, string>>} submissions
 */
function completionTriggered(mode, players, submissions) {
  if (mode === 'solo') {
    for (const uid of players.keys()) {
      if (playerHasAllSolo(submissions, uid)) return true;
    }
    return false;
  }
  const teamIds = new Set();
  for (const p of players.values()) {
    if (p.teamId) teamIds.add(p.teamId);
  }
  for (const tid of teamIds) {
    if (teamUnionComplete(players, submissions, tid)) return true;
  }
  return false;
}

function shuffleLetters() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  for (let i = letters.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters;
}

export class NpatRoomEngine {
  /**
   * @param {{
   *   code: string,
   *   mode: 'solo' | 'team',
   *   hostUserId: string,
   *   env: import('../../config/env.js').Env,
   *   logger: import('pino').Logger,
   *   npatNs: import('socket.io').Namespace,
   *   persist: (
 *     setPatch: Record<string, unknown>,
 *     pushRound?: { roundIndex: number, letter: string, submissions: Record<string, Record<string, string>>, endedAt: Date },
 *   ) => Promise<void>,
   * }} params
   */
  constructor({ code, mode, hostUserId, env, logger, npatNs, persist }) {
    this.code = code;
    this.mode = mode;
    this.hostUserId = hostUserId;
    this.env = env;
    this.logger = logger;
    this.npatNs = npatNs;
    this.persist = persist;

    /** @type {string} */
    this.state = GAME_STATES.WAITING;
    /** @type {'none' | 'collecting' | 'countdown'} */
    this.roundPhase = 'none';

    /** @type {Map<string, RuntimePlayer>} */
    this.players = new Map();
    /** @type {typeof DEFAULT_TEAMS} */
    this.teams = mode === 'team' ? [...DEFAULT_TEAMS] : [];

    /** @type {string[]} */
    this.letterPool = [];
    /** @type {string[]} */
    this.usedLetters = [];
    /** @type {string | null} */
    this.currentLetter = null;
    this.currentRoundIndex = -1;

    /** @type {Map<string, Record<string, string>>} */
    this.submissions = new Map();

    /** @type {{ rounds: Array<{ roundIndex: number, letter: string, submissions: Record<string, Record<string, string>>, endedAt: string }> }} */
    this.results = { rounds: [] };

    /** @type {NodeJS.Timeout | null} */
    this._startingTimer = null;
    /** @type {NodeJS.Timeout | null} */
    this._roundTimer = null;
    /** @type {NodeJS.Timeout | null} */
    this._betweenTimer = null;

    this.roundStartAt = null;
    this.roundEndDeadline = null;
    this.betweenEndDeadline = null;
    this._countdownStarted = false;
  }

  /**
   * Build an engine from a persisted NpatRoom document so in-flight games survive restart.
   * Timers are resumed based on wall-clock `endsAt`.
   *
   * @param {any} doc
   * @param {{ env: import('../../config/env.js').Env, logger: import('pino').Logger, npatNs: import('socket.io').Namespace, persist: NpatRoomEngine['persist'] }} deps
   */
  static hydrateFromDoc(doc, deps) {
    const engine = new NpatRoomEngine({
      code: doc.code,
      mode: doc.mode,
      hostUserId: String(doc.hostUserId),
      env: deps.env,
      logger: deps.logger,
      npatNs: deps.npatNs,
      persist: deps.persist,
    });

    engine.state = doc.engineState || GAME_STATES.WAITING;
    engine.roundPhase = doc.roundPhase || 'none';
    engine.teams = doc.teams?.length ? doc.teams : engine.teams;
    engine.letterPool = Array.isArray(doc.letterPool) ? [...doc.letterPool] : [];
    engine.usedLetters = Array.isArray(doc.usedLetters) ? [...doc.usedLetters] : [];
    engine.currentRoundIndex =
      typeof doc.currentRoundIndex === 'number' ? doc.currentRoundIndex : -1;
    engine.currentLetter = doc.currentLetter || null;

    for (const pl of doc.players ?? []) {
      const uid = String(pl.userId);
      engine.players.set(uid, {
        userId: uid,
        username: pl.username,
        teamId: pl.teamId ?? '',
        ready: Boolean(pl.ready),
        socketId: null,
        joinedAt: new Date(pl.joinedAt ?? Date.now()).getTime(),
        connected: false,
      });
    }

    const cr = doc.currentRound ?? {};
    engine.submissions = new Map();
    if (cr.submissions && typeof cr.submissions === 'object') {
      for (const [uid, row] of Object.entries(cr.submissions)) {
        engine.submissions.set(uid, { ...(row || {}) });
      }
    }
    engine.roundStartAt = cr.startsAt ? new Date(cr.startsAt).getTime() : null;
    engine.roundEndDeadline = cr.endsAt ? new Date(cr.endsAt).getTime() : null;
    engine._countdownStarted = engine.roundPhase === 'countdown';

    engine.results = {
      rounds: (doc.roundsHistory ?? []).map((r) => ({
        roundIndex: r.roundIndex,
        letter: r.letter,
        submissions: r.submissions ?? {},
        endedAt: r.endedAt instanceof Date ? r.endedAt.toISOString() : String(r.endedAt),
      })),
    };

    engine._resumeTimers();
    return engine;
  }

  /**
   * After hydration, restart any pending timers. If a deadline has already passed while the
   * server was down, advance the state machine immediately.
   */
  _resumeTimers() {
    const now = Date.now();
    switch (this.state) {
      case GAME_STATES.STARTING: {
        const startsAt = this.roundStartAt ?? now;
        const remaining = Math.max(0, startsAt + this.env.NPAT_STARTING_MS - now);
        this._startingTimer = setTimeout(() => this._enterFirstRound(), remaining);
        return;
      }
      case GAME_STATES.IN_ROUND: {
        if (this.roundPhase === 'countdown' && this.roundEndDeadline) {
          const remaining = Math.max(0, this.roundEndDeadline - now);
          this._roundTimer = setTimeout(() => this._endRoundFromTimer(), remaining);
        }
        return;
      }
      case GAME_STATES.BETWEEN_ROUNDS: {
        if (this.betweenEndDeadline) {
          const remaining = Math.max(0, this.betweenEndDeadline - now);
          this._betweenTimer = setTimeout(() => this._leaveBetween(), remaining);
        } else {
          this._betweenTimer = setTimeout(
            () => this._leaveBetween(),
            this.env.NPAT_BETWEEN_ROUNDS_MS,
          );
        }
        return;
      }
      default:
        return;
    }
  }

  emit(event, payload) {
    this.npatNs.to(this.code).emit(event, payload);
  }

  clearTimers() {
    for (const t of [this._startingTimer, this._roundTimer, this._betweenTimer]) {
      if (t) clearTimeout(t);
    }
    this._startingTimer = null;
    this._roundTimer = null;
    this._betweenTimer = null;
  }

  destroy() {
    this.clearTimers();
  }

  /**
   * Returns the subset of state that must be persisted to survive a restart.
   */
  toPersistDoc() {
    return {
      hostUserId: new mongoose.Types.ObjectId(this.hostUserId),
      mode: this.mode,
      engineState: this.state,
      roundPhase: this.roundPhase,
      letterPool: [...this.letterPool],
      usedLetters: [...this.usedLetters],
      currentRoundIndex: this.currentRoundIndex,
      currentLetter: this.currentLetter ?? '',
      currentRound: this._currentRoundDoc(),
      players: this.playersToMongo(),
      teams: this.teams,
      lastPublicSnapshot: this.toPublicDto(),
    };
  }

  _currentRoundDoc() {
    /** @type {Record<string, Record<string, string>>} */
    const subs = {};
    for (const [uid, row] of this.submissions) subs[uid] = { ...row };
    return {
      index: this.currentRoundIndex,
      letter: this.currentLetter ?? '',
      phase: this.roundPhase,
      startsAt: this.roundStartAt ? new Date(this.roundStartAt) : null,
      endsAt: this.roundEndDeadline ? new Date(this.roundEndDeadline) : null,
      submissions: subs,
    };
  }

  /**
   * @param {string} userId
   * @param {string} username
   * @param {string | null} socketId
   * @param {number} joinedAt
   */
  upsertPlayer(userId, username, socketId, joinedAt) {
    const existing = this.players.get(userId);
    const teamId = this.pickTeamForNewPlayer(userId, existing?.teamId);
    this.players.set(userId, {
      userId,
      username,
      teamId: existing?.teamId ?? teamId,
      ready: existing?.ready ?? false,
      socketId: socketId ?? existing?.socketId ?? null,
      joinedAt: existing?.joinedAt ?? joinedAt,
      connected: Boolean(socketId),
    });
  }

  /**
   * @param {string} userId
   * @param {string | undefined} previousTeam
   */
  pickTeamForNewPlayer(userId, previousTeam) {
    if (this.mode !== 'team') return '';
    if (previousTeam) return previousTeam;
    const counts = new Map();
    for (const t of this.teams) {
      counts.set(t.id, 0);
    }
    for (const p of this.players.values()) {
      if (p.userId === userId) continue;
      if (p.teamId) {
        counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
      }
    }
    let best = this.teams[0]?.id ?? 'A';
    let min = Infinity;
    for (const t of this.teams) {
      const c = counts.get(t.id) ?? 0;
      if (c < min) {
        min = c;
        best = t.id;
      }
    }
    return best;
  }

  setSocket(userId, socketId) {
    const p = this.players.get(userId);
    if (!p) return;
    p.socketId = socketId;
    p.connected = true;
  }

  /**
   * @param {string} socketId
   * @returns {string | null} userId
   */
  clearSocket(socketId) {
    for (const [uid, p] of this.players) {
      if (p.socketId === socketId) {
        p.socketId = null;
        p.connected = false;
        return uid;
      }
    }
    return null;
  }

  reassignHostIfNeeded(departedUserId) {
    if (this.hostUserId !== departedUserId) return;
    const connected = [...this.players.entries()]
      .filter(([, p]) => p.connected)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    this.hostUserId = connected[0]?.[0] ?? this.hostUserId;
  }

  /**
   * @param {string} userId
   */
  tryStartGame(userId) {
    if (userId !== this.hostUserId) {
      const err = new Error('Only the host can start the game');
      /** @type {any} */ (err).code = 'NOT_HOST';
      throw err;
    }
    if (this.state !== GAME_STATES.WAITING) {
      const err = new Error('Game already started');
      /** @type {any} */ (err).code = 'GAME_ALREADY_STARTED';
      throw err;
    }
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length < this.env.NPAT_MIN_PLAYERS_TO_START) {
      const err = new Error(`Need at least ${this.env.NPAT_MIN_PLAYERS_TO_START} connected players`);
      /** @type {any} */ (err).code = 'NOT_ENOUGH_PLAYERS';
      throw err;
    }
    if (this.mode === 'team') {
      const teamIds = new Set(this.teams.map((t) => t.id));
      for (const tid of teamIds) {
        const has = connected.some((p) => p.teamId === tid);
        if (!has) {
          const err = new Error('Each team needs at least one connected player');
          /** @type {any} */ (err).code = 'EMPTY_TEAM';
          throw err;
        }
      }
    }
    const notReady = connected.filter((p) => !p.ready);
    if (notReady.length > 0) {
      const err = new Error('All players must mark ready before starting');
      /** @type {any} */ (err).code = 'NOT_READY';
      throw err;
    }

    assertTransition(this.state, GAME_STATES.STARTING);
    this.state = GAME_STATES.STARTING;
    this.letterPool = shuffleLetters();
    this.usedLetters = [];
    this.currentRoundIndex = -1;
    this.currentLetter = null;
    this.submissions = new Map();
    this.results = { rounds: [] };
    this.roundStartAt = Date.now();

    void this.persist(
      {
        engineState: this.state,
        letterPool: this.letterPool,
        usedLetters: this.usedLetters,
        currentRoundIndex: this.currentRoundIndex,
        currentLetter: '',
        roundsHistory: [],
        currentRound: this._currentRoundDoc(),
      },
      undefined,
    );

    this.emit('game_started', { room: this.toPublicDto() });

    this._startingTimer = setTimeout(() => this._enterFirstRound(), this.env.NPAT_STARTING_MS);
  }

  _enterFirstRound() {
    this._startingTimer = null;
    if (this.state !== GAME_STATES.STARTING) return;
    assertTransition(this.state, GAME_STATES.IN_ROUND);
    this.state = GAME_STATES.IN_ROUND;
    this._beginNewRound();
  }

  _beginNewRound() {
    const letter = this.letterPool.shift();
    if (!letter) {
      this._finishGame();
      return;
    }
    this.currentRoundIndex += 1;
    this.currentLetter = letter;
    this.usedLetters.push(letter);
    this.roundPhase = 'collecting';
    this.roundStartAt = Date.now();
    this.roundEndDeadline = null;
    this.betweenEndDeadline = null;
    this._countdownStarted = false;
    this.submissions = new Map();
    for (const uid of this.players.keys()) {
      this.submissions.set(uid, {});
    }

    void this.persist(
      {
        engineState: this.state,
        roundPhase: this.roundPhase,
        letterPool: this.letterPool,
        usedLetters: this.usedLetters,
        currentRoundIndex: this.currentRoundIndex,
        currentLetter: letter,
        currentRound: this._currentRoundDoc(),
      },
      undefined,
    );

    this.emit('round_started', {
      room: this.toPublicDto(),
      letter,
      roundIndex: this.currentRoundIndex,
      endsAt: null,
    });
  }

  _maybeStartCountdown() {
    if (this.state !== GAME_STATES.IN_ROUND || this.roundPhase !== 'collecting') return;
    if (this._countdownStarted) return;
    if (!completionTriggered(this.mode, this.players, this.submissions)) return;
    this._countdownStarted = true;
    this.roundPhase = 'countdown';
    const endsAt = Date.now() + this.env.NPAT_ROUND_END_COUNTDOWN_MS;
    this.roundEndDeadline = endsAt;

    void this.persist(
      { roundPhase: this.roundPhase, currentRound: this._currentRoundDoc() },
      undefined,
    );

    this.emit('timer_started', {
      room: this.toPublicDto(),
      endsAt,
      msRemaining: this.env.NPAT_ROUND_END_COUNTDOWN_MS,
    });

    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this._endRoundFromTimer(), this.env.NPAT_ROUND_END_COUNTDOWN_MS);
  }

  _endRoundFromTimer() {
    this._roundTimer = null;
    if (this.state !== GAME_STATES.IN_ROUND) return;
    assertTransition(this.state, GAME_STATES.ROUND_ENDING, { roundPhase: this.roundPhase });
    this.state = GAME_STATES.ROUND_ENDING;
    this.roundPhase = 'none';
    this._finalizeRoundSnapshot();
  }

  _finalizeRoundSnapshot() {
    const letter = this.currentLetter ?? '?';
    const roundIndex = this.currentRoundIndex;
    /** @type {Record<string, Record<string, string>>} */
    const snap = {};
    for (const [uid, row] of this.submissions) {
      snap[uid] = { ...row };
    }
    const endedAt = new Date().toISOString();
    this.results.rounds.push({
      roundIndex,
      letter,
      submissions: snap,
      endedAt,
    });

    void this.persist(
      {
        engineState: this.state,
        roundPhase: this.roundPhase,
        currentRound: this._currentRoundDoc(),
      },
      { roundIndex, letter, submissions: snap, endedAt: new Date() },
    );

    this.emit('round_ended', {
      room: this.toPublicDto(),
      roundIndex,
      letter,
      submissions: snap,
    });

    const hasMore = this.letterPool.length > 0;
    if (!hasMore) {
      this._finishGame();
      return;
    }

    assertTransition(this.state, GAME_STATES.BETWEEN_ROUNDS);
    this.state = GAME_STATES.BETWEEN_ROUNDS;
    this.betweenEndDeadline = Date.now() + this.env.NPAT_BETWEEN_ROUNDS_MS;

    void this.persist({ engineState: this.state }, undefined);

    this.emit('room_update', { room: this.toPublicDto() });

    if (this._betweenTimer) clearTimeout(this._betweenTimer);
    this._betweenTimer = setTimeout(() => this._leaveBetween(), this.env.NPAT_BETWEEN_ROUNDS_MS);
  }

  _leaveBetween() {
    this._betweenTimer = null;
    this.betweenEndDeadline = null;
    if (this.state !== GAME_STATES.BETWEEN_ROUNDS) return;
    assertTransition(this.state, GAME_STATES.IN_ROUND);
    this.state = GAME_STATES.IN_ROUND;
    void this.persist({ engineState: this.state }, undefined);
    this._beginNewRound();
  }

  _finishGame() {
    this.clearTimers();
    if (this.state === GAME_STATES.FINISHED) return;
    assertTransition(this.state, GAME_STATES.FINISHED, { roundPhase: this.roundPhase });
    this.state = GAME_STATES.FINISHED;
    this.roundPhase = 'none';
    this.roundStartAt = null;
    this.roundEndDeadline = null;
    this.betweenEndDeadline = null;
    this.currentLetter = null;

    void this.persist(
      {
        engineState: this.state,
        roundPhase: this.roundPhase,
        finishedAt: new Date(),
        currentRound: this._currentRoundDoc(),
      },
      undefined,
    );

    this.emit('game_finished', { room: this.toPublicDto(), results: this.results });
  }

  /**
   * @param {string} userId
   * @param {string} field
   * @param {string} value
   */
  submitField(userId, field, value) {
    if (this.state !== GAME_STATES.IN_ROUND) {
      const err = new Error('Submissions are closed for this round');
      /** @type {any} */ (err).code = 'SUBMISSION_CLOSED';
      throw err;
    }
    if (this.roundPhase !== 'collecting' && this.roundPhase !== 'countdown') {
      const err = new Error('Submissions are closed for this round');
      /** @type {any} */ (err).code = 'SUBMISSION_CLOSED';
      throw err;
    }
    const p = this.players.get(userId);
    if (!p?.connected) {
      const err = new Error('Player not in room');
      /** @type {any} */ (err).code = 'NOT_IN_ROOM';
      throw err;
    }
    let row = this.submissions.get(userId);
    if (!row) {
      row = {};
      this.submissions.set(userId, row);
    }
    if (row[field]?.trim()) {
      const err = new Error('This field has already been submitted for this round');
      /** @type {any} */ (err).code = 'FIELD_ALREADY_SUBMITTED';
      throw err;
    }
    row[field] = value;
    // Incremental persist so a crash keeps answers durable.
    void this.persist({ currentRound: this._currentRoundDoc() }, undefined);
    this._maybeStartCountdown();
    this.emit('room_update', { room: this.toPublicDto() });
  }

  /**
   * @param {string} userId
   * @param {string} teamId
   */
  switchTeam(userId, teamId) {
    if (this.state !== GAME_STATES.WAITING) {
      const err = new Error('Cannot switch teams after the game starts');
      /** @type {any} */ (err).code = 'GAME_ALREADY_STARTED';
      throw err;
    }
    if (this.mode !== 'team') {
      const err = new Error('Not a team game');
      /** @type {any} */ (err).code = 'NOT_TEAM_MODE';
      throw err;
    }
    if (!this.teams.some((t) => t.id === teamId)) {
      const err = new Error('Invalid team');
      /** @type {any} */ (err).code = 'INVALID_TEAM';
      throw err;
    }
    const p = this.players.get(userId);
    if (!p) {
      const err = new Error('Player not in room');
      /** @type {any} */ (err).code = 'NOT_IN_ROOM';
      throw err;
    }
    p.teamId = teamId;
    void this.persist({ players: this.playersToMongo() }, undefined);
    this.emit('room_update', { room: this.toPublicDto() });
  }

  /**
   * @param {string} userId
   * @param {boolean} ready
   */
  setReady(userId, ready) {
    if (this.state !== GAME_STATES.WAITING) {
      const err = new Error('Game already in progress');
      /** @type {any} */ (err).code = 'GAME_ALREADY_STARTED';
      throw err;
    }
    const p = this.players.get(userId);
    if (!p) {
      const err = new Error('Player not in room');
      /** @type {any} */ (err).code = 'NOT_IN_ROOM';
      throw err;
    }
    p.ready = ready;
    void this.persist({ players: this.playersToMongo() }, undefined);
    this.emit('room_update', { room: this.toPublicDto() });
  }

  playersToMongo() {
    return [...this.players.values()].map((p) => ({
      userId: new mongoose.Types.ObjectId(p.userId),
      username: p.username,
      teamId: p.teamId,
      ready: p.ready,
      joinedAt: new Date(p.joinedAt),
    }));
  }

  toPublicDto() {
    /** @type {Record<string, Record<string, string>>} */
    const subs = {};
    for (const [k, v] of this.submissions) {
      subs[k] = { ...v };
    }
    return {
      code: this.code,
      mode: this.mode,
      state: this.state,
      roundPhase: this.roundPhase,
      hostUserId: this.hostUserId,
      players: [...this.players.values()].map((p) => ({
        userId: p.userId,
        username: p.username,
        teamId: p.teamId,
        ready: p.ready,
        connected: p.connected,
      })),
      teams: this.teams,
      currentRoundIndex: this.currentRoundIndex,
      currentLetter: this.currentLetter,
      usedLetters: [...this.usedLetters],
      submissions: subs,
      timerEndsAt: this.roundEndDeadline,
      betweenRoundsEndsAt: this.betweenEndDeadline,
      letterPoolRemaining: this.letterPool.length,
      results: this.state === GAME_STATES.FINISHED ? this.results : null,
    };
  }
}
