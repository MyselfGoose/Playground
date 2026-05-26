import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NpatRoomEngine } from '../../../backend/src/games/npat/gameManager.js';

const HOST_OID = '507f1f77bcf86cd799439011';
const GUEST_OID = '507f1f77bcf86cd799439012';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createEngine() {
  const events = [];
  const engine = new NpatRoomEngine({
    code: '1234',
    mode: 'solo',
    maxRounds: 3,
    hostUserId: HOST_OID,
    env: /** @type {any} */ ({
      NPAT_MIN_PLAYERS_TO_START: 2,
      NPAT_STARTING_MS: 35,
      NPAT_ROUND_END_COUNTDOWN_MS: 80,
      NPAT_BETWEEN_ROUNDS_MS: 35,
    }),
    logger: /** @type {any} */ ({ info() {}, warn() {}, error() {}, debug() {} }),
    npatNs: /** @type {any} */ ({
      to: () => ({
        emit: (event, payload) => {
          events.push({ event, payload });
        },
      }),
    }),
    persist: async () => {},
  });

  for (const [userId, username] of [
    [HOST_OID, 'Host'],
    [GUEST_OID, 'Guest'],
  ]) {
    engine.players.set(userId, {
      userId,
      username,
      teamId: '',
      ready: false,
      socketId: `${userId}-s1`,
      joinedAt: Date.now(),
      connected: true,
    });
    engine.submissions.set(userId, {});
  }
  return { engine, events };
}

describe('NPAT countdown timeline', () => {
  it('follows WAITING -> STARTING(3s logical) -> IN_ROUND collecting -> IN_ROUND countdown', async () => {
    const { engine, events } = createEngine();

    engine.setReady(HOST_OID, true);
    assert.equal(engine.state, 'WAITING');
    engine.setReady(GUEST_OID, true);
    assert.equal(engine.state, 'STARTING');
    assert.ok(typeof engine.startingEndsAt === 'number');
    assert.equal(events.some((e) => e.event === 'game_started'), true);

    await sleep(60);
    assert.equal(engine.state, 'IN_ROUND');
    assert.equal(engine.roundPhase, 'collecting');
    assert.equal(engine.startingEndsAt, null);

    engine.submitField(HOST_OID, 'name', 'Amy');
    engine.submitField(HOST_OID, 'place', 'Athens');
    engine.submitField(HOST_OID, 'animal', 'Ant');
    engine.submitField(HOST_OID, 'thing', 'Arrow');
    assert.equal(engine.state, 'IN_ROUND');
    assert.equal(engine.roundPhase, 'countdown');
    assert.ok(typeof engine.roundEndDeadline === 'number');
    const timerStartedEvents = events.filter((e) => e.event === 'timer_started');
    assert.equal(timerStartedEvents.length, 1);
  });
});

