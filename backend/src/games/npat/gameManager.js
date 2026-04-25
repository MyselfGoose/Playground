import mongoose from 'mongoose';
import { npatRoomRepository } from '../../repositories/npatRoomRepository.js';
import { evaluateNpatFullGame, evaluateNpatFullGameFallback } from '../../services/npat/npatGameEvaluationService.js';
import { persistNpatResults } from '../../services/leaderboardStatsService.js';
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

/**
 * Every connected player has submitted all four fields (personal completion).
 */
function allConnectedPlayersFinished(players, submissions) {
  let any = false;
  for (const [uid, p] of players) {
    if (!p.connected) continue;
    any = true;
    if (!playerHasAllSolo(submissions, uid)) return false;
  }
  return any;
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

    /** @type {{ rounds: Array<Record<string, unknown>> }} */
    this.results = { rounds: [] };

    /** @type {Promise<void> | null} */
    this._evaluationFlight = null;

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

    /**
     * Active vote to end the game early. Everyone connected must vote yes; any no cancels.
     * @type {{ proposedBy: string, votes: Record<string, 'yes' | 'no'>, proposedAt: number } | null}
     */
    this.earlyFinishProposal = null;

    /** @type {string | null} User who caused the final countdown to start (first to finish all fields in solo). */
    this.countdownTriggeredByUserId = null;
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

    {
      let st = doc.engineState || GAME_STATES.WAITING;
      if (st === GAME_STATES.ROUND_ENDING) st = GAME_STATES.BETWEEN_ROUNDS;
      engine.state = st;
    }
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
        evaluationStatus: r.evaluationStatus ?? (r.evaluation ? 'complete' : 'pending'),
        evaluationSource: r.evaluationSource,
        evaluatedAt:
          r.evaluatedAt != null
            ? r.evaluatedAt instanceof Date
              ? r.evaluatedAt.toISOString()
              : String(r.evaluatedAt)
            : undefined,
        evaluation: r.evaluation,
        evaluationError: r.evaluationError,
      })),
    };

    const ef = doc.earlyFinishProposal;
    if (ef && typeof ef === 'object' && typeof ef.proposedBy === 'string' && ef.votes && typeof ef.votes === 'object') {
      /** @type {Record<string, 'yes' | 'no'>} */
      const votes = {};
      for (const [k, v] of Object.entries(ef.votes)) {
        if (v === 'yes' || v === 'no') votes[k] = v;
      }
      engine.earlyFinishProposal = {
        proposedBy: String(ef.proposedBy),
        votes,
        proposedAt: typeof ef.proposedAt === 'number' ? ef.proposedAt : Date.now(),
      };
    }

    engine.countdownTriggeredByUserId =
      doc.countdownTriggeredByUserId != null && String(doc.countdownTriggeredByUserId).trim()
        ? String(doc.countdownTriggeredByUserId)
        : null;

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
      case GAME_STATES.EVALUATING: {
        void this._queueFullGameEvaluation();
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
      earlyFinishProposal: this.earlyFinishProposal,
      countdownTriggeredByUserId: this.countdownTriggeredByUserId ?? '',
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
   * Explicit leave / switch room / create new room: remove the user from the roster so
   * `attachActiveRoomForUser` does not keep pulling them back after disconnect.
   *
   * @param {string} userId
   * @returns {{ empty: boolean }}
   */
  removePlayerCompletely(userId) {
    if (!this.players.has(userId)) {
      return { empty: this.players.size === 0 };
    }

    if (this.earlyFinishProposal) {
      const { votes, proposedBy } = this.earlyFinishProposal;
      delete votes[userId];
      if (proposedBy === userId || Object.keys(votes).length === 0) {
        this.earlyFinishProposal = null;
      }
    }

    if (this.countdownTriggeredByUserId === userId) {
      this.countdownTriggeredByUserId = null;
    }

    const wasHost = this.hostUserId === userId;
    this.players.delete(userId);
    this.submissions.delete(userId);

    if (wasHost && this.players.size > 0) {
      const ordered = [...this.players.entries()].sort((a, b) => a[1].joinedAt - b[1].joinedAt);
      this.hostUserId = ordered[0][0];
    }

    const empty = this.players.size === 0;
    if (empty) {
      return { empty: true };
    }

    void this.persist(
      {
        players: this.playersToMongo(),
        hostUserId: new mongoose.Types.ObjectId(this.hostUserId),
        lastPublicSnapshot: this.toPublicDto(),
        earlyFinishProposal: this.earlyFinishProposal,
        countdownTriggeredByUserId: this.countdownTriggeredByUserId ?? '',
      },
      undefined,
    );
    this.emit('room_update', { room: this.toPublicDto() });
    this._evaluateEarlyFinishVotes();
    return { empty: false };
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
    this.earlyFinishProposal = null;
    this.countdownTriggeredByUserId = null;

    void this.persist(
      {
        engineState: this.state,
        letterPool: this.letterPool,
        usedLetters: this.usedLetters,
        currentRoundIndex: this.currentRoundIndex,
        currentLetter: '',
        roundsHistory: [],
        currentRound: this._currentRoundDoc(),
        earlyFinishProposal: null,
        countdownTriggeredByUserId: '',
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
    this.countdownTriggeredByUserId = null;
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
        countdownTriggeredByUserId: '',
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

  /**
   * First player (or team rule) completes → optional 10s countdown for everyone else.
   * @param {string} triggerUserId
   */
  _maybeStartCountdown(triggerUserId) {
    if (this.state !== GAME_STATES.IN_ROUND || this.roundPhase !== 'collecting') return;
    if (this._countdownStarted) return;
    if (!completionTriggered(this.mode, this.players, this.submissions)) return;
    this._countdownStarted = true;
    this.roundPhase = 'countdown';
    this.countdownTriggeredByUserId = triggerUserId;
    const endsAt = Date.now() + this.env.NPAT_ROUND_END_COUNTDOWN_MS;
    this.roundEndDeadline = endsAt;

    void this.persist(
      {
        roundPhase: this.roundPhase,
        currentRound: this._currentRoundDoc(),
        countdownTriggeredByUserId: this.countdownTriggeredByUserId ?? '',
      },
      undefined,
    );

    this.emit('timer_started', {
      room: this.toPublicDto(),
      endsAt,
      msRemaining: this.env.NPAT_ROUND_END_COUNTDOWN_MS,
      triggeredByUserId: triggerUserId,
    });

    if (this._roundTimer) clearTimeout(this._roundTimer);
    this._roundTimer = setTimeout(() => this._endRoundFromTimer(), this.env.NPAT_ROUND_END_COUNTDOWN_MS);
  }

  /**
   * When every connected player has all four fields, end the round immediately (no waiting timer).
   * @returns {boolean} true if the round was completed
   */
  _maybeCompleteRoundIfEveryoneDone() {
    if (this.state !== GAME_STATES.IN_ROUND) return false;
    if (this.roundPhase !== 'collecting' && this.roundPhase !== 'countdown') return false;
    if (!allConnectedPlayersFinished(this.players, this.submissions)) return false;
    if (this._roundTimer) {
      clearTimeout(this._roundTimer);
      this._roundTimer = null;
    }
    this.roundEndDeadline = null;
    assertTransition(this.state, GAME_STATES.ROUND_ENDING, { roundPhase: this.roundPhase });
    this.state = GAME_STATES.ROUND_ENDING;
    this.roundPhase = 'none';
    this.countdownTriggeredByUserId = null;
    this._finalizeRoundSnapshot();
    return true;
  }

  _endRoundFromTimer() {
    this._roundTimer = null;
    if (this.state !== GAME_STATES.IN_ROUND) return;
    assertTransition(this.state, GAME_STATES.ROUND_ENDING, { roundPhase: this.roundPhase });
    this.state = GAME_STATES.ROUND_ENDING;
    this.roundPhase = 'none';
    this.countdownTriggeredByUserId = null;
    this._finalizeRoundSnapshot();
  }

  /**
   * Snapshot the closed round. Scoring runs once at game end, not here.
   * Between rounds: go straight to BETWEEN_ROUNDS. Last round: EVALUATING then batch score.
   */
  _finalizeRoundSnapshot() {
    if (this.state !== GAME_STATES.ROUND_ENDING) return;
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
      evaluationStatus: 'pending',
    });

    void this.persist(
      {
        engineState: this.state,
        roundPhase: this.roundPhase,
        currentRound: this._currentRoundDoc(),
      },
      {
        roundIndex,
        letter,
        submissions: snap,
        endedAt: new Date(),
        evaluationStatus: 'pending',
      },
    );

    this.emit('round_ended', {
      room: this.toPublicDto(),
      roundIndex,
      letter,
      submissions: snap,
      evaluationPending: false,
    });

    const hasMore = this.letterPool.length > 0;
    if (hasMore) {
      assertTransition(this.state, GAME_STATES.BETWEEN_ROUNDS);
      this.state = GAME_STATES.BETWEEN_ROUNDS;
      this.betweenEndDeadline = Date.now() + this.env.NPAT_BETWEEN_ROUNDS_MS;

      void this.persist({ engineState: this.state }, undefined);

      this.emit('room_update', { room: this.toPublicDto() });

      if (this._betweenTimer) clearTimeout(this._betweenTimer);
      this._betweenTimer = setTimeout(() => this._leaveBetween(), this.env.NPAT_BETWEEN_ROUNDS_MS);
      return;
    }

    assertTransition(this.state, GAME_STATES.EVALUATING);
    this.state = GAME_STATES.EVALUATING;
    void this.persist({ engineState: this.state }, undefined);
    this.emit('room_update', { room: this.toPublicDto() });
    void this._queueFullGameEvaluation();
  }

  /**
   * Score all recorded rounds at once (Gemini or fallback), then finish the game.
   */
  _queueFullGameEvaluation() {
    if (this._evaluationFlight) return;
    this._evaluationFlight = (async () => {
      try {
        let source = /** @type {'gemini' | 'fallback'} */ ('fallback');
        /** @type {{ rounds: Array<{ roundIndex: number, round: string, results: unknown[] }> }} */
        let batch;
        try {
          const out = await evaluateNpatFullGame(this.env, this, this.logger);
          source = out.source;
          batch = out.payload;
        } catch (e) {
          this.logger.warn({ err: e, event: 'npat_full_eval_inner' }, 'npat_room');
          batch = evaluateNpatFullGameFallback(this);
          source = 'fallback';
        }

        for (const br of batch.rounds) {
          const round = this.results.rounds.find((r) => r.roundIndex === br.roundIndex);
          if (!round) continue;
          const evaluation = { round: br.round, results: br.results };
          round.evaluation = evaluation;
          round.evaluationStatus = 'complete';
          round.evaluationSource = source;
          round.evaluatedAt = new Date().toISOString();
          round.evaluationError = undefined;
          try {
            await npatRoomRepository.patchRoundHistoryByRoundIndex(this.code, br.roundIndex, {
              evaluation,
              evaluationStatus: 'complete',
              evaluationSource: source,
              evaluatedAt: new Date(),
              evaluationError: null,
            });
          } catch (pe) {
            this.logger.warn({ err: pe, code: this.code, roundIndex: br.roundIndex }, 'npat_full_eval_persist');
          }
        }

        this.emit('room_update', { room: this.toPublicDto() });
        this.emit('game_evaluated', { room: this.toPublicDto(), source });

        this._applyFinishGameFromEvaluation();
      } catch (err) {
        this.logger.error({ err, code: this.code, event: 'npat_full_eval_failed' }, 'npat_room');
        try {
          const batch = evaluateNpatFullGameFallback(this);
          for (const br of batch.rounds) {
            const round = this.results.rounds.find((r) => r.roundIndex === br.roundIndex);
            if (!round) continue;
            const evaluation = { round: br.round, results: br.results };
            round.evaluation = evaluation;
            round.evaluationStatus = 'complete';
            round.evaluationSource = 'fallback';
            round.evaluatedAt = new Date().toISOString();
            await npatRoomRepository.patchRoundHistoryByRoundIndex(this.code, br.roundIndex, {
              evaluation,
              evaluationStatus: 'complete',
              evaluationSource: 'fallback',
              evaluatedAt: new Date(),
              evaluationError: null,
            }).catch(() => {});
          }
          this.emit('room_update', { room: this.toPublicDto() });
        } catch (_) {
          /* ignore */
        }
        this._applyFinishGameFromEvaluation();
      } finally {
        this._evaluationFlight = null;
      }
    })();
  }

  /**
   * Drop the in-progress round (early finish): remove letter from stats and restore pool.
   */
  _discardInProgressRound() {
    if (this.state !== GAME_STATES.IN_ROUND || this.currentRoundIndex < 0) return;
    const L = this.currentLetter;
    if (L && this.usedLetters.length > 0 && this.usedLetters[this.usedLetters.length - 1] === L) {
      this.usedLetters.pop();
    }
    if (L) {
      this.letterPool.unshift(L);
    }
    this.currentRoundIndex = Math.max(-1, this.currentRoundIndex - 1);
    this.currentLetter = null;
    this.roundPhase = 'none';
    this.roundEndDeadline = null;
    this._countdownStarted = false;
    this.countdownTriggeredByUserId = null;
    this.submissions = new Map();
    for (const uid of this.players.keys()) {
      this.submissions.set(uid, {});
    }
  }

  _applyFinishGameFromEvaluation() {
    if (this.state === GAME_STATES.FINISHED) return;
    this.clearTimers();
    this.earlyFinishProposal = null;
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
        earlyFinishProposal: null,
      },
      undefined,
    );

    this.emit('game_finished', { room: this.toPublicDto(), results: this.results });

    void persistNpatResults({
      code: this.code,
      mode: this.mode,
      players: this.players,
      results: this.results,
      logger: this.logger,
    });
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
    this.earlyFinishProposal = null;
    if (this.results.rounds.length > 0) {
      assertTransition(this.state, GAME_STATES.EVALUATING, { roundPhase: this.roundPhase });
      this.state = GAME_STATES.EVALUATING;
      this.roundPhase = 'none';
      void this.persist(
        {
          engineState: this.state,
          roundPhase: this.roundPhase,
          currentRound: this._currentRoundDoc(),
          earlyFinishProposal: null,
        },
        undefined,
      );
      this.emit('room_update', { room: this.toPublicDto() });
      void this._queueFullGameEvaluation();
      return;
    }
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
        earlyFinishProposal: null,
      },
      undefined,
    );

    this.emit('game_finished', { room: this.toPublicDto(), results: this.results });
  }

  /**
   * End the game after a successful unanimous early-finish vote.
   * Discards the in-progress round (letter + submissions) so it does not count.
   */
  _finishGameEarly() {
    this.earlyFinishProposal = null;
    this.clearTimers();
    if (this.state === GAME_STATES.FINISHED) return;
    if (this.state === GAME_STATES.IN_ROUND) {
      this._discardInProgressRound();
    }
    void this.persist(
      {
        letterPool: this.letterPool,
        usedLetters: this.usedLetters,
        currentRoundIndex: this.currentRoundIndex,
        currentLetter: this.currentLetter ?? '',
        currentRound: this._currentRoundDoc(),
        engineState: this.state,
        roundPhase: this.roundPhase,
        earlyFinishProposal: null,
      },
      undefined,
    );

    if (this.results.rounds.length > 0) {
      assertTransition(this.state, GAME_STATES.EVALUATING, { roundPhase: this.roundPhase });
      this.state = GAME_STATES.EVALUATING;
      this.roundPhase = 'none';
      void this.persist(
        {
          engineState: this.state,
          roundPhase: this.roundPhase,
          currentRound: this._currentRoundDoc(),
          earlyFinishProposal: null,
        },
        undefined,
      );
      this.emit('room_update', { room: this.toPublicDto() });
      void this._queueFullGameEvaluation();
      this.logger.info({ event: 'npat_game_finished_early', roomCode: this.code }, 'npat_room');
      return;
    }

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
        earlyFinishProposal: null,
      },
      undefined,
    );

    this.logger.info({ event: 'npat_game_finished_early', roomCode: this.code }, 'npat_room');
    this.emit('game_finished', { room: this.toPublicDto(), results: this.results });
  }

  _evaluateEarlyFinishVotes() {
    if (!this.earlyFinishProposal) return;
    const connected = [...this.players.values()].filter((p) => p.connected);
    if (connected.length === 0) return;
    const { votes } = this.earlyFinishProposal;
    if (connected.some((p) => votes[p.userId] === 'no')) {
      this.earlyFinishProposal = null;
      void this.persist({ earlyFinishProposal: null }, undefined);
      this.emit('room_update', { room: this.toPublicDto() });
      return;
    }
    if (connected.every((p) => votes[p.userId] === 'yes')) {
      this._finishGameEarly();
      return;
    }
    this.emit('room_update', { room: this.toPublicDto() });
  }

  /**
   * Start (or replace) an early-finish vote. Proposer is recorded as voting yes.
   * @param {string} userId
   */
  proposeEarlyFinish(userId) {
    const allowed = new Set([
      GAME_STATES.STARTING,
      GAME_STATES.IN_ROUND,
      GAME_STATES.BETWEEN_ROUNDS,
    ]);
    if (!allowed.has(this.state)) {
      const err = new Error('The game cannot be ended right now');
      /** @type {any} */ (err).code = 'EARLY_FINISH_NOT_ALLOWED';
      throw err;
    }
    const p = this.players.get(userId);
    if (!p?.connected) {
      const err = new Error('Player not in room');
      /** @type {any} */ (err).code = 'NOT_IN_ROOM';
      throw err;
    }
    this.earlyFinishProposal = {
      proposedBy: userId,
      votes: { [userId]: 'yes' },
      proposedAt: Date.now(),
    };
    void this.persist({ earlyFinishProposal: this.earlyFinishProposal }, undefined);
    this._evaluateEarlyFinishVotes();
  }

  /**
   * Cast yes/no on the active early-finish vote.
   * @param {string} userId
   * @param {boolean} accept
   */
  voteEarlyFinish(userId, accept) {
    if (!this.earlyFinishProposal) {
      const err = new Error('No vote to end the game is active');
      /** @type {any} */ (err).code = 'NO_EARLY_FINISH_VOTE';
      throw err;
    }
    const p = this.players.get(userId);
    if (!p?.connected) {
      const err = new Error('Player not in room');
      /** @type {any} */ (err).code = 'NOT_IN_ROOM';
      throw err;
    }
    this.earlyFinishProposal.votes[userId] = accept ? 'yes' : 'no';
    void this.persist({ earlyFinishProposal: this.earlyFinishProposal }, undefined);
    this._evaluateEarlyFinishVotes();
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

    if (this._maybeCompleteRoundIfEveryoneDone()) {
      return;
    }
    this._maybeStartCountdown(userId);
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
      countdownTriggeredByUserId: this.countdownTriggeredByUserId,
      /** Full-game batch scoring at the end (not tied to a single round index). */
      evaluatingRoundIndex: null,
      results:
        this.results.rounds.length > 0 &&
        this.state !== GAME_STATES.WAITING &&
        this.state !== GAME_STATES.STARTING
          ? this.results
          : null,
      earlyFinish:
        this.state !== GAME_STATES.FINISHED && this.earlyFinishProposal
          ? {
              proposedBy: this.earlyFinishProposal.proposedBy,
              votes: { ...this.earlyFinishProposal.votes },
              proposedAt: this.earlyFinishProposal.proposedAt,
            }
          : null,
    };
  }
}
