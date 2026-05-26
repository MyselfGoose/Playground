import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_STATES } from './stateMachine.js';
import { NpatRoomEngine } from './gameManager.js';

const HOST_OID = '507f1f77bcf86cd799439011';
const GUEST_OID = '507f1f77bcf86cd799439012';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeEngine(overrides = {}) {
  const emitted = [];
  const env = {
    NPAT_ROUND_END_COUNTDOWN_MS: 80,
    NPAT_BETWEEN_ROUNDS_MS: 30,
    NPAT_STARTING_MS: 40,
    NPAT_MIN_PLAYERS_TO_START: 2,
    ...overrides,
  };
  const engine = new NpatRoomEngine({
    code: 'ABCD',
    mode: 'solo',
    maxRounds: 3,
    hostUserId: HOST_OID,
    env: /** @type {any} */ (env),
    logger: /** @type {any} */ ({ info() {}, warn() {}, error() {}, debug() {} }),
    npatNs: /** @type {any} */ ({
      to: () => ({
        emit: (event, payload) => emitted.push({ event, payload }),
      }),
    }),
    persist: async () => {},
  });
  return { engine, emitted, env };
}

function addConnectedPlayer(engine, userId, ready = false) {
  engine.players.set(userId, {
    userId,
    username: userId === HOST_OID ? 'Host' : 'Guest',
    teamId: '',
    ready,
    joinedAt: Date.now(),
    socketId: `${userId}-s1`,
    connected: true,
  });
}

test('resetForRematch moves FINISHED room to WAITING and clears ready flags', () => {
  const { engine } = makeEngine();
  engine.state = GAME_STATES.FINISHED;
  addConnectedPlayer(engine, HOST_OID, true);
  addConnectedPlayer(engine, GUEST_OID, true);

  engine.resetForRematch(HOST_OID);

  assert.equal(engine.state, GAME_STATES.WAITING);
  assert.equal(engine.roundPhase, 'none');
  assert.deepEqual(engine.results, { rounds: [] });
  assert.equal(engine.players.get(HOST_OID)?.ready, false);
  assert.equal(engine.players.get(GUEST_OID)?.ready, false);
  assert.equal(engine.startingEndsAt, null);
});

test('resetForRematch rejects non-host', () => {
  const { engine } = makeEngine();
  engine.state = GAME_STATES.FINISHED;
  assert.throws(
    () => engine.resetForRematch(GUEST_OID),
    (err) => /** @type {any} */ (err).code === 'NOT_HOST',
  );
});

test('auto-start triggers STARTING exactly once when everyone ready', async () => {
  const { engine, emitted } = makeEngine();
  addConnectedPlayer(engine, HOST_OID, false);
  addConnectedPlayer(engine, GUEST_OID, false);

  engine.setReady(HOST_OID, true);
  assert.equal(engine.state, GAME_STATES.WAITING);
  engine.setReady(GUEST_OID, true);
  assert.equal(engine.state, GAME_STATES.STARTING);
  assert.equal(typeof engine.startingEndsAt, 'number');
  const gameStartedCount = emitted.filter((e) => e.event === 'game_started').length;
  assert.equal(gameStartedCount, 1);

  // Repeated start attempts must not schedule another STARTING countdown.
  engine.tryStartGame(HOST_OID);
  const gameStartedCountAfter = emitted.filter((e) => e.event === 'game_started').length;
  assert.equal(gameStartedCountAfter, 1);

  await sleep(70);
  assert.equal(engine.state, GAME_STATES.IN_ROUND);
  assert.equal(engine.roundPhase, 'collecting');
  assert.equal(engine.startingEndsAt, null);
});

test('in-round first completion emits timer_started without STARTING re-entry', () => {
  const { engine, emitted } = makeEngine({ NPAT_ROUND_END_COUNTDOWN_MS: 120 });
  addConnectedPlayer(engine, HOST_OID, true);
  addConnectedPlayer(engine, GUEST_OID, true);

  engine.state = GAME_STATES.IN_ROUND;
  engine.roundPhase = 'collecting';
  engine.currentRoundIndex = 0;
  engine.currentLetter = 'A';
  engine.submissions.set(HOST_OID, {});
  engine.submissions.set(GUEST_OID, {});

  engine.submitField(HOST_OID, 'name', 'Amy');
  engine.submitField(HOST_OID, 'place', 'Athens');
  engine.submitField(HOST_OID, 'animal', 'Ant');
  engine.submitField(HOST_OID, 'thing', 'Arrow');

  assert.equal(engine.state, GAME_STATES.IN_ROUND);
  assert.equal(engine.roundPhase, 'countdown');
  assert.equal(engine.countdownTriggeredByUserId, HOST_OID);
  assert.ok(typeof engine.roundEndDeadline === 'number');
  const timerStarted = emitted.filter((e) => e.event === 'timer_started');
  assert.equal(timerStarted.length, 1);
  const gameStarted = emitted.filter((e) => e.event === 'game_started');
  assert.equal(gameStarted.length, 0);
});
